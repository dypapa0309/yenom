'use client'

import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import ChartCard from '@/components/ChartCard'
import InsightCard from '@/components/InsightCard'
import EmptyState from '@/components/EmptyState'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Transaction } from '@/types'
import { calcDeductionSummary } from '@/lib/tax/deduction-rules'
import { calcDeductionProgress, calcTotalEstimatedRefund } from '@/lib/tax/deduction-calculator'
import { analyzeCardRatio, checkCardSwitchAlert } from '@/lib/tax/card-ratio'
import { generateCardOptimizationPlan, getMonthlyCardTarget } from '@/lib/tax/card-optimization'
import { quickSimulate } from '@/lib/tax/year-end-simulator'
import { compareStandardVsItemized } from '@/lib/tax/standard-deduction-compare'
import { generateTaxInsights } from '@/lib/tax/tax-insights'
import { formatKRW, formatPercent } from '@/lib/utils/format'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function TaxPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [salary, setSalary] = useState(50_000_000)
  const [salaryInput, setSalaryInput] = useState('5000')

  const currentYear = format(new Date(), 'yyyy')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/transactions?pageSize=5000`)
      const data = await res.json()
      setTransactions(data.data ?? [])
    } catch {
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // 올해 거래만 필터
  const yearTxs = transactions.filter(t => t.transaction_date.startsWith(currentYear))

  const deductionSummary = calcDeductionSummary(yearTxs)
  const deductionProgress = calcDeductionProgress(yearTxs, { annualSalary: salary })
  const totalRefund = calcTotalEstimatedRefund(deductionProgress)
  const cardRatio = analyzeCardRatio(yearTxs, salary)
  const cardAlert = checkCardSwitchAlert(yearTxs, salary)
  const cardPlan = generateCardOptimizationPlan(yearTxs, salary)
  const remainingMonths = 12 - (new Date().getMonth() + 1)
  const monthlyTargets = getMonthlyCardTarget(cardPlan, remainingMonths)
  const standardComparison = compareStandardVsItemized(yearTxs, salary)
  const simResult = quickSimulate(salary, 0)
  const taxInsights = generateTaxInsights(yearTxs, salary)

  function handleSalaryUpdate() {
    const val = parseFloat(salaryInput.replace(/,/g, ''))
    if (!isNaN(val) && val > 0) {
      setSalary(val * 10000)
    }
  }

  // Progress bar colors
  function progressColor(pct: number): string {
    if (pct >= 100) return '#16A34A'
    if (pct >= 80) return '#2563EB'
    if (pct >= 50) return '#111111'
    return '#9CA3AF'
  }

  // Chart data
  const chartData = deductionProgress.map(p => ({
    name: p.label,
    spent: p.spent,
    remaining: Math.max(0, p.limit - p.spent),
    percentage: p.percentage,
  }))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (yearTxs.length === 0) {
    return (
      <EmptyState
        title="올해 거래내역이 없습니다"
        description="거래내역을 업로드하면 절세 분석이 시작됩니다."
        actionLabel="업로드하기"
        actionHref="/upload"
      />
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#111111] tracking-tight">절세 리포트</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">{currentYear}년 연말정산 시뮬레이션</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#6B7280]">총급여</span>
          <Input
            value={salaryInput}
            onChange={e => setSalaryInput(e.target.value)}
            className="w-24 h-8 text-xs text-right"
            placeholder="5000"
          />
          <span className="text-xs text-[#6B7280]">만원</span>
          <Button onClick={handleSalaryUpdate} className="h-8 text-xs bg-[#111111] text-white px-3">
            적용
          </Button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
          <p className="text-xs text-[#6B7280]">예상 환급액</p>
          <p className="text-xl font-bold text-[#16A34A] num mt-1">{formatKRW(totalRefund)}</p>
        </div>
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
          <p className="text-xs text-[#6B7280]">공제 대상 지출</p>
          <p className="text-xl font-bold text-[#111111] num mt-1">
            {formatKRW(deductionSummary.reduce((s, d) => s + d.totalAmount, 0))}
          </p>
        </div>
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
          <p className="text-xs text-[#6B7280]">카드 소득공제</p>
          <p className="text-xl font-bold text-[#111111] num mt-1">
            {cardRatio.overThreshold ? '공제 가능' : '미달'}
          </p>
          <p className="text-xs text-[#9CA3AF] mt-0.5">
            {cardRatio.overThreshold
              ? `최저사용액 초과 ${formatKRW(cardRatio.totalSpend - cardRatio.salaryThreshold)}`
              : `${formatKRW(cardRatio.amountToThreshold)} 더 사용 필요`
            }
          </p>
        </div>
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
          <p className="text-xs text-[#6B7280]">신용카드 비중</p>
          <p className="text-xl font-bold text-[#111111] num mt-1">{Math.round(cardRatio.creditRatio)}%</p>
          <p className="text-xs mt-0.5" style={{ color: cardRatio.recommendation === 'switch_debit' ? '#DC2626' : '#9CA3AF' }}>
            {cardRatio.recommendation === 'switch_debit' && '체크카드 전환 권장'}
            {cardRatio.recommendation === 'use_credit' && '신용카드 혜택 활용'}
            {cardRatio.recommendation === 'balanced' && '적절한 비율'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Deduction Progress */}
        <div className="col-span-2">
          <h2 className="text-sm font-semibold text-[#374151] mb-3">공제 한도 진행률</h2>
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 space-y-4">
            {deductionProgress.map(p => (
              <div key={p.type}>
                <div className="flex justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#111111] font-medium">{p.label}</span>
                    <span className="text-xs text-[#6B7280] bg-[#F3F4F6] px-1.5 py-0.5 rounded">{p.rate}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-[#111111] num">{formatKRW(p.spent)}</span>
                    <span className="text-xs text-[#9CA3AF] ml-1">/ {p.limit === Infinity ? '무한도' : formatKRW(p.limit)}</span>
                  </div>
                </div>
                <div className="h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, p.percentage)}%`,
                      backgroundColor: progressColor(p.percentage),
                    }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-[#9CA3AF]">
                    {p.percentage >= 100 ? '한도 달성' : `잔여 ${formatKRW(p.remaining)}`}
                  </span>
                  <span className="text-xs text-[#16A34A] num">환급 예상 {formatKRW(p.estimatedRefund)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tax Insights */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[#374151] mb-3">절세 알림</h2>
          {taxInsights.length === 0 ? (
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 text-center text-sm text-[#9CA3AF]">
              현재 절세 알림이 없습니다.
            </div>
          ) : (
            taxInsights.map(insight => (
              <InsightCard key={insight.id} insight={insight} />
            ))
          )}

          {/* Card switch alert */}
          {cardAlert.triggered && (
            <div className={`border rounded-xl p-4 ${cardAlert.percentage >= 100 ? 'border-[#DC2626] bg-red-50' : 'border-[#F59E0B] bg-amber-50'}`}>
              <p className="text-xs font-semibold text-[#111111] mb-1">
                {cardAlert.percentage >= 100 ? '체크카드 전환!' : '전환 임박'}
              </p>
              <p className="text-xs text-[#374151]">{cardAlert.message}</p>
              <div className="mt-2 h-1.5 bg-white rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, cardAlert.percentage)}%`,
                    backgroundColor: cardAlert.percentage >= 100 ? '#DC2626' : '#F59E0B',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Deduction breakdown chart */}
      <ChartCard title="공제 항목별 사용 현황">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} barSize={20}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: '#9CA3AF' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#9CA3AF' }}
              tickFormatter={v => Math.round(v / 10000) + '만'}
              axisLine={false}
              tickLine={false}
              width={45}
            />
            <Tooltip
              formatter={(v) => [formatKRW(Number(v))]}
              contentStyle={{ fontSize: 12, border: '1px solid #E5E7EB', borderRadius: 8 }}
            />
            <Bar dataKey="spent" stackId="a" fill="#111111" radius={[3, 3, 0, 0]} name="사용액">
              {chartData.map((entry, i) => (
                <Cell key={i} fill={progressColor(entry.percentage)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Deduction tagged transactions summary */}
      {deductionSummary.length > 0 && (
        <div className="mt-4 bg-white border border-[#E5E7EB] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#111111] mb-3">공제 대상 거래 요약</h3>
          <div className="grid grid-cols-2 gap-3">
            {deductionSummary.map(d => (
              <div key={d.type} className="flex items-center justify-between py-2.5 px-3 bg-[#FAFAFA] rounded-lg">
                <div>
                  <span className="text-sm text-[#111111] font-medium">{d.label}</span>
                  <span className="text-xs text-[#6B7280] ml-2">{d.count}건</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-[#111111] num">{formatKRW(d.totalAmount)}</span>
                  <span className="text-xs text-[#9CA3AF] ml-1.5">공제율 {d.rate}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Card Optimization Strategy */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#111111] mb-3">카드 공제 최적화 전략</h3>
          <div className="space-y-3">
            {/* Threshold status */}
            <div className="flex justify-between items-center pb-3 border-b border-[#F3F4F6]">
              <span className="text-xs text-[#6B7280]">최저사용액 (25%)</span>
              <span className="text-sm font-semibold text-[#111111] num">{formatKRW(cardPlan.threshold)}</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-[#F3F4F6]">
              <span className="text-xs text-[#6B7280]">현재 사용액</span>
              <span className="text-sm font-semibold text-[#111111] num">{formatKRW(cardPlan.currentTotal)}</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-[#F3F4F6]">
              <span className="text-xs text-[#6B7280]">공제 가능액 (초과분)</span>
              <span className="text-sm font-semibold num" style={{ color: cardPlan.thresholdReached ? '#16A34A' : '#9CA3AF' }}>
                {cardPlan.thresholdReached ? formatKRW(cardPlan.deductibleAmount) : '미달'}
              </span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-[#F3F4F6]">
              <span className="text-xs text-[#6B7280]">실제 공제액 (한도 적용)</span>
              <span className="text-sm font-bold text-[#16A34A] num">{formatKRW(cardPlan.totalDeduction)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-[#6B7280]">잔여 한도</span>
              <span className="text-sm text-[#111111] num">
                기본 {formatKRW(cardPlan.remainingBasicLimit)} / 교통 {formatKRW(cardPlan.remainingTransitBonus)} / 시장 {formatKRW(cardPlan.remainingMarketBonus)}
              </span>
            </div>
          </div>

          {/* Recommendations */}
          {cardPlan.recommendations.length > 0 && (
            <div className="mt-4 pt-3 border-t border-[#F3F4F6]">
              <p className="text-xs font-semibold text-[#374151] mb-2">추천 액션</p>
              <div className="space-y-2">
                {cardPlan.recommendations.slice(0, 4).map((rec, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 bg-[#F9FAFB] rounded-lg">
                    <span className="text-xs text-[#2563EB] font-bold mt-0.5">{rec.priority}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#111111]">{rec.action}</p>
                      <p className="text-[10px] text-[#9CA3AF] mt-0.5">
                        +{formatKRW(rec.additionalAmount)} → 공제 +{formatKRW(rec.additionalDeduction)} ({(rec.rate * 100)}%)
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Monthly card targets */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#111111] mb-1">월별 카드 사용 목표</h3>
          <p className="text-xs text-[#9CA3AF] mb-4">남은 {remainingMonths}개월 기준 최적 배분</p>

          {monthlyTargets.length === 0 ? (
            <div className="text-xs text-[#9CA3AF] text-center py-6">공제 한도를 모두 채웠습니다.</div>
          ) : (
            <div className="space-y-3">
              {monthlyTargets.map((target, i) => (
                <div key={i} className="p-3 bg-[#FAFAFA] rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-[#111111]">{target.method}</span>
                    <span className="text-sm font-bold text-[#111111] num">{formatKRW(target.monthlyAmount)}/월</span>
                  </div>
                  <p className="text-xs text-[#6B7280]">{target.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Year-end simulation + Standard deduction comparison */}
      <div className="mt-4 grid grid-cols-3 gap-4">
        {/* Quick Simulation */}
        <div className="col-span-2 bg-white border border-[#E5E7EB] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#111111] mb-3">연말정산 간이 시뮬레이션</h3>
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center p-3 bg-[#F9FAFB] rounded-lg">
              <p className="text-[10px] text-[#6B7280] mb-1">총급여</p>
              <p className="text-sm font-bold text-[#111111] num">{formatKRW(simResult.grossSalary)}</p>
            </div>
            <div className="text-center p-3 bg-[#F9FAFB] rounded-lg">
              <p className="text-[10px] text-[#6B7280] mb-1">과세표준</p>
              <p className="text-sm font-bold text-[#111111] num">{formatKRW(simResult.taxableIncome)}</p>
            </div>
            <div className="text-center p-3 bg-[#F9FAFB] rounded-lg">
              <p className="text-[10px] text-[#6B7280] mb-1">산출세액</p>
              <p className="text-sm font-bold text-[#111111] num">{formatKRW(simResult.calculatedTax)}</p>
            </div>
            <div className="text-center p-3 bg-[#F9FAFB] rounded-lg">
              <p className="text-[10px] text-[#6B7280] mb-1">결정세액</p>
              <p className="text-sm font-bold text-[#111111] num">{formatKRW(simResult.determinedTax)}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: simResult.finalTax < 0 ? '#F0FDF4' : '#FEF2F2' }}>
            <span className="text-sm font-medium text-[#374151]">
              {simResult.finalTax < 0 ? '예상 환급' : '예상 추가납부'}
            </span>
            <span className="text-xl font-bold num" style={{ color: simResult.finalTax < 0 ? '#16A34A' : '#DC2626' }}>
              {formatKRW(Math.abs(simResult.finalTax))}
            </span>
          </div>
          <p className="text-[10px] text-[#9CA3AF] mt-2">* 부양가족 0명, 기본공제 기준 간이 계산. 실제와 차이가 있을 수 있습니다.</p>

          {/* Breakdown */}
          {simResult.incomeDeductionBreakdown.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1">
              <p className="text-xs font-semibold text-[#374151] col-span-2 mb-1">소득공제 내역</p>
              {simResult.incomeDeductionBreakdown.map((item, i) => (
                <div key={i} className="flex justify-between text-xs py-0.5">
                  <span className="text-[#6B7280]">{item.label}</span>
                  <span className="text-[#111111] num">{formatKRW(item.amount)}</span>
                </div>
              ))}
            </div>
          )}
          {simResult.taxCreditBreakdown.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1">
              <p className="text-xs font-semibold text-[#374151] col-span-2 mb-1">세액공제 내역</p>
              {simResult.taxCreditBreakdown.map((item, i) => (
                <div key={i} className="flex justify-between text-xs py-0.5">
                  <span className="text-[#6B7280]">{item.label}</span>
                  <span className="text-[#111111] num">{formatKRW(item.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Standard vs Itemized comparison */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#111111] mb-3">표준 vs 항목별 공제</h3>
          <div className="space-y-3">
            <div className="p-3 rounded-lg" style={{ backgroundColor: standardComparison.recommendation === 'standard' ? '#EFF6FF' : '#F0FDF4' }}>
              <p className="text-xs font-semibold mb-1" style={{ color: standardComparison.recommendation === 'standard' ? '#2563EB' : '#16A34A' }}>
                {standardComparison.recommendation === 'standard' ? '표준세액공제 유리' : '항목별 공제 유리'}
              </p>
              <p className="text-xs text-[#374151]">{standardComparison.message}</p>
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-xs">
                <span className="text-[#6B7280]">표준세액공제</span>
                <span className="text-[#111111] font-semibold num">{formatKRW(standardComparison.standardCredit)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#6B7280]">항목별 합산</span>
                <span className="text-[#111111] font-semibold num">{formatKRW(standardComparison.itemizedTotal)}</span>
              </div>
              <div className="h-px bg-[#F3F4F6]" />
              <div className="flex justify-between text-xs">
                <span className="text-[#6B7280]">보험료 공제</span>
                <span className="text-[#9CA3AF] num">{formatKRW(standardComparison.insuranceCredit)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#6B7280]">의료비 공제</span>
                <span className="text-[#9CA3AF] num">{formatKRW(standardComparison.medicalCredit)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#6B7280]">교육비 공제</span>
                <span className="text-[#9CA3AF] num">{formatKRW(standardComparison.educationCredit)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#6B7280]">기부금 공제</span>
                <span className="text-[#9CA3AF] num">{formatKRW(standardComparison.donationCredit)}</span>
              </div>
            </div>

            {standardComparison.breakEvenAmounts && standardComparison.recommendation === 'standard' && (
              <div className="pt-2 border-t border-[#F3F4F6]">
                <p className="text-xs font-semibold text-[#374151] mb-1.5">항목별이 유리해지려면</p>
                {standardComparison.breakEvenAmounts.additionalMedical !== undefined && standardComparison.breakEvenAmounts.additionalMedical > 0 && (
                  <p className="text-xs text-[#6B7280]">의료비 +{formatKRW(standardComparison.breakEvenAmounts.additionalMedical)}</p>
                )}
                {standardComparison.breakEvenAmounts.additionalInsurance !== undefined && standardComparison.breakEvenAmounts.additionalInsurance > 0 && (
                  <p className="text-xs text-[#6B7280]">보험료 +{formatKRW(standardComparison.breakEvenAmounts.additionalInsurance)}</p>
                )}
                {standardComparison.breakEvenAmounts.additionalEducation !== undefined && standardComparison.breakEvenAmounts.additionalEducation > 0 && (
                  <p className="text-xs text-[#6B7280]">교육비 +{formatKRW(standardComparison.breakEvenAmounts.additionalEducation)}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
