'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { format, subMonths, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns'
import { Transaction } from '@/types'
import { formatKRW, formatKRWCompact } from '@/lib/utils/format'

function toYMD(date: Date) {
  return format(date, 'yyyy-MM-dd')
}

interface DayData {
  date: Date
  expense: number
  income: number
  txs: Transaction[]
}

export default function CalendarPage() {
  const [baseDate, setBaseDate] = useState(() => new Date())
  const [allTxs, setAllTxs] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const month = format(baseDate, 'yyyy-MM')

  const fetchTxs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/transactions?month=${month}&pageSize=2000`)
      const data = await res.json()
      setAllTxs(data.data ?? [])
    } catch {
      setAllTxs([])
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => { fetchTxs() }, [fetchTxs])
  useEffect(() => { setSelectedDate(null) }, [month])

  // 날짜별 집계
  const dayMap = useMemo(() => {
    const map = new Map<string, DayData>()
    for (const tx of allTxs) {
      if (tx.excluded) continue
      const key = tx.transaction_date.substring(0, 10)
      if (!map.has(key)) {
        map.set(key, { date: new Date(key), expense: 0, income: 0, txs: [] })
      }
      const d = map.get(key)!
      if (tx.type === 'expense') d.expense += tx.amount
      else if (tx.type === 'income') d.income += tx.amount
      d.txs.push(tx)
    }
    return map
  }, [allTxs])

  // 달력 날짜 배열
  const days = useMemo(() => {
    const start = startOfMonth(baseDate)
    const end = endOfMonth(baseDate)
    return eachDayOfInterval({ start, end })
  }, [baseDate])

  const startDow = getDay(startOfMonth(baseDate)) // 0=일

  const maxExpense = useMemo(() => {
    let max = 0
    for (const d of dayMap.values()) max = Math.max(max, d.expense)
    return max
  }, [dayMap])

  const monthExpense = useMemo(() => allTxs.filter(t => t.type === 'expense' && !t.excluded).reduce((s, t) => s + t.amount, 0), [allTxs])
  const monthIncome = useMemo(() => allTxs.filter(t => t.type === 'income' && !t.excluded).reduce((s, t) => s + t.amount, 0), [allTxs])

  const selectedDay = selectedDate ? dayMap.get(selectedDate) : null

  const DOW = ['일', '월', '화', '수', '목', '금', '토']

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#111111] tracking-tight">캘린더</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setBaseDate(d => subMonths(d, 1))}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6] transition-colors text-sm"
          >
            ‹
          </button>
          <span className="text-sm font-semibold text-[#111111] w-20 text-center">
            {format(baseDate, 'yyyy년 M월')}
          </span>
          <button
            onClick={() => setBaseDate(d => addMonths(d, 1))}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6] transition-colors text-sm"
          >
            ›
          </button>
        </div>
      </div>

      {/* Monthly summary */}
      <div className="flex gap-4 mb-4">
        <div className="bg-white border border-[#E5E7EB] rounded-xl px-4 py-3 flex gap-6">
          <div>
            <p className="text-xs text-[#6B7280]">이번 달 지출</p>
            <p className="text-base font-bold text-[#111111] num mt-0.5">{formatKRW(monthExpense)}</p>
          </div>
          <div className="w-px bg-[#F3F4F6]" />
          <div>
            <p className="text-xs text-[#6B7280]">이번 달 수입</p>
            <p className="text-base font-bold text-[#16A34A] num mt-0.5">{formatKRW(monthIncome)}</p>
          </div>
          <div className="w-px bg-[#F3F4F6]" />
          <div>
            <p className="text-xs text-[#6B7280]">일평균 지출</p>
            <p className="text-base font-bold text-[#111111] num mt-0.5">
              {formatKRW(Math.round(monthExpense / days.length))}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Calendar grid */}
        <div className="flex-1 bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-80">
              <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Day of week header */}
              <div className="grid grid-cols-7 border-b border-[#E5E7EB]">
                {DOW.map((d, i) => (
                  <div
                    key={d}
                    className={`py-2 text-center text-xs font-medium ${i === 0 ? 'text-red-400' : i === 6 ? 'text-[#2563EB]' : 'text-[#9CA3AF]'}`}
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Cells */}
              <div className="grid grid-cols-7">
                {/* Empty cells before month start */}
                {Array.from({ length: startDow }).map((_, i) => (
                  <div key={`empty-${i}`} className="border-b border-r border-[#F3F4F6] min-h-[80px]" />
                ))}

                {days.map((day, idx) => {
                  const key = toYMD(day)
                  const data = dayMap.get(key)
                  const dow = getDay(day)
                  const isSelected = selectedDate === key
                  const isToday = toYMD(new Date()) === key
                  const colIdx = (startDow + idx) % 7
                  const isLastRow = Math.floor((startDow + idx) / 7) === Math.floor((startDow + days.length - 1) / 7)
                  const intensity = data && maxExpense > 0 ? data.expense / maxExpense : 0

                  return (
                    <div
                      key={key}
                      onClick={() => setSelectedDate(isSelected ? null : key)}
                      className={`
                        min-h-[80px] p-2 border-b border-r border-[#F3F4F6] cursor-pointer transition-colors relative
                        ${colIdx === 6 ? 'border-r-0' : ''}
                        ${isLastRow ? 'border-b-0' : ''}
                        ${isSelected ? 'bg-[#EFF6FF]' : 'hover:bg-[#FAFAFA]'}
                      `}
                    >
                      {/* Expense intensity bar */}
                      {intensity > 0 && (
                        <div
                          className="absolute bottom-0 left-0 right-0 bg-[#111111] opacity-[0.06] rounded-b"
                          style={{ height: `${intensity * 70}%` }}
                        />
                      )}

                      <div className="relative">
                        <span className={`
                          text-xs font-medium inline-flex w-6 h-6 items-center justify-center rounded-full
                          ${isToday ? 'bg-[#111111] text-white' : dow === 0 ? 'text-red-400' : dow === 6 ? 'text-[#2563EB]' : 'text-[#374151]'}
                        `}>
                          {day.getDate()}
                        </span>

                        <div className="mt-1 space-y-0.5">
                          {data?.expense ? (
                            <p className="text-[10px] text-[#111111] font-medium num leading-tight">
                              -{formatKRWCompact(data.expense)}
                            </p>
                          ) : null}
                          {data?.income ? (
                            <p className="text-[10px] text-[#16A34A] num leading-tight">
                              +{formatKRWCompact(data.income)}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Side panel */}
        <div className="w-64 shrink-0">
          {selectedDay ? (
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
              <p className="text-sm font-semibold text-[#111111] mb-1">
                {(() => {
                  const [y, m, d] = selectedDate!.split('-').map(Number)
                  return format(new Date(y, m - 1, d), 'M월 d일')
                })()}
              </p>
              <div className="flex gap-3 mb-3 pb-3 border-b border-[#F3F4F6]">
                {selectedDay.expense > 0 && (
                  <div>
                    <p className="text-[10px] text-[#9CA3AF]">지출</p>
                    <p className="text-sm font-bold text-[#111111] num">{formatKRW(selectedDay.expense)}</p>
                  </div>
                )}
                {selectedDay.income > 0 && (
                  <div>
                    <p className="text-[10px] text-[#9CA3AF]">수입</p>
                    <p className="text-sm font-bold text-[#16A34A] num">{formatKRW(selectedDay.income)}</p>
                  </div>
                )}
              </div>

              <div className="space-y-2 max-h-[480px] overflow-y-auto">
                {selectedDay.txs
                  .sort((a, b) => b.amount - a.amount)
                  .map(tx => (
                    <div key={tx.id} className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs text-[#111111] truncate">{tx.merchant_name ?? tx.description}</p>
                        <p className="text-[10px] text-[#9CA3AF] mt-0.5">{tx.category}</p>
                      </div>
                      <span className={`text-xs font-semibold num shrink-0 ${tx.type === 'income' ? 'text-[#16A34A]' : 'text-[#111111]'}`}>
                        {tx.type === 'income' ? '+' : '-'}{formatKRW(tx.amount)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 flex items-center justify-center h-32">
              <p className="text-xs text-[#9CA3AF]">날짜를 클릭하면 상세 내역이 표시됩니다</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
