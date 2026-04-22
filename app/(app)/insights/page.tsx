'use client'

import { useEffect, useState, useCallback } from 'react'
import { format, subMonths } from 'date-fns'
import InsightCard from '@/components/InsightCard'
import EmptyState from '@/components/EmptyState'
import ChartCard from '@/components/ChartCard'
import UnclassifiedManager from '@/components/UnclassifiedManager'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { generateInsights } from '@/lib/insights/generator'
import { calcCategoryStats, calcMonthlyStats, calcSmallTransactions, calcWeekendVsWeekday } from '@/lib/analytics/stats'
import { detectRecurring } from '@/lib/analytics/recurring'
import { formatKRW, formatPercent, currentMonth } from '@/lib/utils/format'
import { Transaction } from '@/types'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

function getMonthOptions() {
  const opts = []
  for (let i = 0; i < 12; i++) {
    const d = subMonths(new Date(), i)
    const val = format(d, 'yyyy-MM')
    opts.push({ value: val, label: format(d, 'yyyy년 M월') })
  }
  return opts
}

export default function InsightsPage() {
  const [month, setMonth] = useState(currentMonth())
  const [allTxs, setAllTxs] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  const prevMonth = format(subMonths(new Date(month + '-01'), 1), 'yyyy-MM')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/transactions?pageSize=2000`)
      const data = await res.json()
      setAllTxs(data.data ?? [])
    } catch {
      setAllTxs([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const currentTxs = allTxs.filter(t => t.transaction_date.startsWith(month))
  const prevTxs = allTxs.filter(t => t.transaction_date.startsWith(prevMonth))

  const insights = generateInsights(currentTxs, prevTxs, month)
  const categoryStats = calcCategoryStats(currentTxs)
  const prevCategoryStats = calcCategoryStats(prevTxs)
  const recurring = detectRecurring(allTxs)
  const { count: smallCount, total: smallTotal } = calcSmallTransactions(currentTxs)
  const { weekendAvg, weekdayAvg } = calcWeekendVsWeekday(currentTxs, month)

  // Category trend: 최근 6개월 × 상위 카테고리
  const trendMonths = Array.from({ length: 6 }, (_, i) =>
    format(subMonths(new Date(month + '-01'), 5 - i), 'yyyy-MM')
  )
  const topCategories = categoryStats.slice(0, 5).map(s => s.category)
  const trendData = trendMonths.map(m => {
    const mTxs = allTxs.filter(t => t.transaction_date.startsWith(m))
    const mStats = calcCategoryStats(mTxs)
    const row: Record<string, unknown> = { month: m.slice(5) + '월' }
    for (const cat of topCategories) {
      row[cat] = mStats.find(s => s.category === cat)?.amount ?? 0
    }
    return row
  })
  const TREND_COLORS = ['#111111', '#2563EB', '#6B7280', '#D97706', '#16A34A']

  // Category comparison data
  const comparisonData = categoryStats.slice(0, 6).map(curr => {
    const prev = prevCategoryStats.find(p => p.category === curr.category)
    return {
      category: curr.category,
      current: curr.amount,
      previous: prev?.amount ?? 0,
    }
  })

  const monthOptions = getMonthOptions()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (currentTxs.length === 0 && prevTxs.length === 0) {
    return (
      <EmptyState
        title="분석할 데이터가 없습니다"
        description="거래내역을 업로드하면 인사이트가 생성됩니다."
        actionLabel="업로드하기"
        actionHref="/upload"
      />
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#111111] tracking-tight">인사이트</h1>
        <Select value={month} onValueChange={v => v && setMonth(v)}>
          <SelectTrigger className="w-36 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value} className="text-sm">{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Insights list */}
        <div className="col-span-2 space-y-2.5">
          <h2 className="text-sm font-semibold text-[#374151] mb-3">소비 패턴 분석</h2>
          {insights.length === 0 ? (
            <div className="text-sm text-[#9CA3AF] py-6 text-center bg-white border border-[#E5E7EB] rounded-xl">
              이번 달 특이 패턴이 감지되지 않았습니다.
            </div>
          ) : (
            insights.map(insight => (
              <InsightCard key={insight.id} insight={insight} />
            ))
          )}
        </div>

        {/* Summary stats */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[#374151] mb-3">이번 달 요약</h2>

          <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 space-y-3">
            <div>
              <p className="text-xs text-[#6B7280] mb-0.5">소액결제 누적</p>
              <p className="text-base font-bold text-[#111111] num">{smallCount}건 / {formatKRW(smallTotal)}</p>
              <p className="text-xs text-[#9CA3AF]">1만원 이하</p>
            </div>
            <div className="h-px bg-[#F3F4F6]" />
            <div>
              <p className="text-xs text-[#6B7280] mb-0.5">주말 vs 평일 일평균</p>
              <p className="text-sm font-semibold text-[#111111] num">{formatKRW(Math.round(weekendAvg))} vs {formatKRW(Math.round(weekdayAvg))}</p>
              {weekendAvg > weekdayAvg * 1.5 && (
                <p className="text-xs text-orange-500 mt-0.5">주말 지출이 {Math.round((weekendAvg / Math.max(weekdayAvg, 1) - 1) * 100)}% 높습니다</p>
              )}
            </div>
            <div className="h-px bg-[#F3F4F6]" />
            <div>
              <p className="text-xs text-[#6B7280] mb-1">반복지출 추정</p>
              {recurring.length === 0 ? (
                <p className="text-xs text-[#9CA3AF]">패턴 없음</p>
              ) : (
                <div className="space-y-1.5">
                  {recurring.slice(0, 4).map((r, i) => (
                    <div key={i} className="flex justify-between">
                      <span className="text-xs text-[#374151] truncate max-w-[100px]">{r.merchant_name ?? r.description}</span>
                      <span className="text-xs font-medium text-[#111111] num">{formatKRW(r.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Category comparison chart */}
      {comparisonData.length > 0 && (
        <ChartCard title="카테고리별 지난달 비교">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={comparisonData} barSize={14} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis
                dataKey="category"
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                tickFormatter={v => Math.round(v / 10000) + '만'}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                formatter={(v, name) => [formatKRW(Number(v)), name === 'current' ? '이번 달' : '지난 달']}
                contentStyle={{ fontSize: 12, border: '1px solid #E5E7EB', borderRadius: 8 }}
              />
              <Bar dataKey="previous" fill="#D1D5DB" radius={[3, 3, 0, 0]} name="previous" />
              <Bar dataKey="current" fill="#111111" radius={[3, 3, 0, 0]} name="current" />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 justify-end mt-2">
            <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
              <div className="w-2.5 h-2.5 rounded-sm bg-[#D1D5DB]" />지난 달
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
              <div className="w-2.5 h-2.5 rounded-sm bg-[#111111]" />이번 달
            </div>
          </div>
        </ChartCard>
      )}

      {/* Category trend chart */}
      {trendData.length > 0 && topCategories.length > 0 && (
        <ChartCard title="카테고리 추세 (최근 6개월)" className="mt-4">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                tickFormatter={v => Math.round(v / 10000) + '만'}
                axisLine={false} tickLine={false} width={40}
              />
              <Tooltip
                formatter={(v, name) => [formatKRW(Number(v)), String(name)]}
                contentStyle={{ fontSize: 12, border: '1px solid #E5E7EB', borderRadius: 8 }}
              />
              {topCategories.map((cat, i) => (
                <Line
                  key={cat}
                  type="monotone"
                  dataKey={cat}
                  stroke={TREND_COLORS[i % TREND_COLORS.length]}
                  strokeWidth={1.5}
                  dot={{ r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <div className="flex gap-4 flex-wrap mt-2">
            {topCategories.map((cat, i) => (
              <div key={cat} className="flex items-center gap-1.5 text-xs text-[#6B7280]">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: TREND_COLORS[i % TREND_COLORS.length] }} />
                {cat}
              </div>
            ))}
          </div>
        </ChartCard>
      )}

      {/* Unclassified manager */}
      <div className="mt-4">
        <UnclassifiedManager transactions={currentTxs} onReclassified={fetchAll} />
      </div>

      {/* Recurring details */}
      {recurring.length > 0 && (
        <div className="mt-4 bg-white border border-[#E5E7EB] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#111111] mb-3">반복결제 의심 항목</h3>
          <div className="space-y-2.5">
            {recurring.map((r, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-[#F3F4F6] last:border-0">
                <div>
                  <p className="text-sm text-[#111111]">{r.merchant_name ?? r.description}</p>
                  <p className="text-xs text-[#9CA3AF] mt-0.5">{r.category} · {r.intervalDays}일 간격 · {r.dates.length}회 반복</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-[#111111] num">{formatKRW(r.amount)}</p>
                  <p className="text-xs text-[#9CA3AF]">1회 평균</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
