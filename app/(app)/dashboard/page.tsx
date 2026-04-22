'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import StatCard from '@/components/StatCard'
import ChartCard from '@/components/ChartCard'
import EmptyState from '@/components/EmptyState'
import { DashboardData } from '@/types'
import { formatKRW, formatKRWCompact, formatPercent, changeLabel, currentMonth, formatMonth } from '@/lib/utils/format'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { format, subMonths } from 'date-fns'

const CHART_COLORS = ['#111111', '#2563EB', '#6B7280', '#D1D5DB', '#374151', '#9CA3AF']

function getMonthOptions() {
  const options = []
  for (let i = 0; i < 12; i++) {
    const d = subMonths(new Date(), i)
    const val = format(d, 'yyyy-MM')
    options.push({ value: val, label: formatMonth(val) })
  }
  return options
}

export default function DashboardPage() {
  const [month, setMonth] = useState(currentMonth())
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [empty, setEmpty] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/dashboard?month=${month}`)
      const json = await res.json()
      const d: DashboardData = json.data

      if (d.totalIncome === 0 && d.totalExpense === 0 && d.monthlyStats.length === 0) {
        setEmpty(true)
      } else {
        setEmpty(false)
        setData(d)
      }
    } catch {
      setEmpty(true)
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => { fetchData() }, [fetchData])

  const monthOptions = getMonthOptions()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (empty || !data) {
    return (
      <EmptyState
        title="거래내역이 없습니다"
        description="은행 거래내역 파일을 업로드하면 분석이 시작됩니다."
        actionLabel="업로드하기"
        actionHref="/upload"
      />
    )
  }

  const incomeChange = changeLabel(data.totalIncome, data.prevMonthIncome)
  const expenseChange = changeLabel(data.totalExpense, data.prevMonthExpense)
  const expenseUp = data.totalExpense > data.prevMonthExpense

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#111111] tracking-tight">대시보드</h1>
        <Select value={month} onValueChange={v => v && setMonth(v)}>
          <SelectTrigger className="w-36 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value} className="text-sm">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          label="총 수입"
          value={formatKRWCompact(data.totalIncome)}
          sub={`지난달 대비 ${incomeChange}`}
          subPositive={data.totalIncome >= data.prevMonthIncome}
        />
        <StatCard
          label="총 지출"
          value={formatKRWCompact(data.totalExpense)}
          sub={`지난달 대비 ${expenseChange}`}
          subNegative={expenseUp}
          subPositive={!expenseUp && data.prevMonthExpense > 0}
        />
        <StatCard
          label="순저축"
          value={formatKRWCompact(data.netSavings)}
          sub={data.netSavings >= 0 ? '흑자' : '적자'}
          subPositive={data.netSavings >= 0}
          subNegative={data.netSavings < 0}
        />
        <StatCard
          label="저축률"
          value={formatPercent(data.savingsRate)}
          sub={`하루 평균 ${formatKRWCompact(data.dailyAvgExpense)} 지출`}
          accent={data.savingsRate >= 20}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <ChartCard title="월별 수입 / 지출">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.monthlyStats} barSize={12} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                tickFormatter={m => m.split('-')[1] + '월'}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                tickFormatter={v => formatKRWCompact(v)}
                axisLine={false}
                tickLine={false}
                width={55}
              />
              <Tooltip
                formatter={(v, name) => [formatKRW(Number(v)), name === 'income' ? '수입' : '지출']}
                labelFormatter={l => formatMonth(l as string)}
                contentStyle={{ fontSize: 12, border: '1px solid #E5E7EB', borderRadius: 8 }}
              />
              <Bar dataKey="income" fill="#6B7280" radius={[3, 3, 0, 0]} name="income" />
              <Bar dataKey="expense" fill="#111111" radius={[3, 3, 0, 0]} name="expense" />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 justify-end mt-2">
            <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
              <div className="w-2.5 h-2.5 rounded-sm bg-[#6B7280]" />수입
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
              <div className="w-2.5 h-2.5 rounded-sm bg-[#111111]" />지출
            </div>
          </div>
        </ChartCard>

        <ChartCard title="카테고리별 지출">
          {data.categoryStats.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="45%" height={180}>
                <PieChart>
                  <Pie
                    data={data.categoryStats.slice(0, 6)}
                    dataKey="amount"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={80}
                    strokeWidth={0}
                  >
                    {data.categoryStats.slice(0, 6).map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => [formatKRW(Number(v))]}
                    contentStyle={{ fontSize: 12, border: '1px solid #E5E7EB', borderRadius: 8 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {data.categoryStats.slice(0, 6).map((s, i) => (
                  <div key={s.category} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-[#374151]">{s.category}</span>
                    </div>
                    <span className="text-[#111111] font-medium num">{formatPercent(s.percentage)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-44 flex items-center justify-center text-sm text-[#9CA3AF]">지출 데이터 없음</div>
          )}
        </ChartCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* Top Merchants */}
        <ChartCard title={`상위 지출처`} className="col-span-2">
          <div className="space-y-2.5">
            {data.topMerchants.slice(0, 8).map((m, i) => {
              const maxAmount = data.topMerchants[0]?.amount ?? 1
              const pct = (m.amount / maxAmount) * 100
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-[#9CA3AF] w-4 num">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-[#111111] truncate">{m.merchant_name}</span>
                      <span className="text-xs font-medium text-[#111111] num ml-2 shrink-0">{formatKRW(m.amount)}</span>
                    </div>
                    <div className="h-1 bg-[#F3F4F6] rounded-full">
                      <div className="h-full bg-[#111111] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="text-[10px] text-[#9CA3AF] w-8 text-right num">{m.count}건</span>
                </div>
              )
            })}
          </div>
        </ChartCard>

        {/* Recurring */}
        <ChartCard title="반복지출 추정">
          {data.recurringItems.length > 0 ? (
            <div className="space-y-3">
              {data.recurringItems.slice(0, 5).map((r, i) => (
                <div key={i} className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-[#111111] truncate">{r.merchant_name ?? r.description}</p>
                    <p className="text-[10px] text-[#9CA3AF] mt-0.5">{r.intervalDays}일 간격 · {r.dates.length}회</p>
                  </div>
                  <span className="text-xs font-medium text-[#111111] num ml-2 shrink-0">{formatKRW(r.amount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-xs text-[#9CA3AF]">
              패턴 감지 중
            </div>
          )}
        </ChartCard>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Small transactions warning */}
        {data.smallTransactionCount > 0 && (
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-[#111111] mb-3">소액결제 누적</h3>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-[#111111] num">{data.smallTransactionCount}건</span>
              <span className="text-sm text-[#6B7280] mb-0.5">/ 총 {formatKRW(data.smallTransactionTotal)}</span>
            </div>
            <p className="text-xs text-[#6B7280] mt-1.5">1만원 이하 소액결제 합산</p>
          </div>
        )}

        {/* Category breakdown text */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#111111] mb-3">지출 상위 카테고리</h3>
          <div className="space-y-2">
            {data.categoryStats.slice(0, 4).map((s, i) => (
              <div key={s.category} className="flex justify-between items-center">
                <span className="text-sm text-[#374151]">{s.category}</span>
                <div className="text-right">
                  <span className="text-sm font-semibold text-[#111111] num">{formatKRW(s.amount)}</span>
                  <span className="text-xs text-[#9CA3AF] ml-1.5 num">{formatPercent(s.percentage)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
