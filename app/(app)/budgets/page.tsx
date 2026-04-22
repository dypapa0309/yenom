'use client'

import { useEffect, useState, useCallback } from 'react'
import { format, subMonths } from 'date-fns'
import BudgetProgressCard from '@/components/BudgetProgressCard'
import EmptyState from '@/components/EmptyState'
import InsightCard from '@/components/InsightCard'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CATEGORIES, Category, Transaction, Budget } from '@/types'
import { calcCategoryStats } from '@/lib/analytics/stats'
import { generateBudgetInsights } from '@/lib/insights/generator'
import { formatKRW, currentMonth } from '@/lib/utils/format'

function getMonthOptions() {
  const opts = []
  for (let i = 0; i < 6; i++) {
    const d = subMonths(new Date(), i)
    const val = format(d, 'yyyy-MM')
    opts.push({ value: val, label: format(d, 'yyyy년 M월') })
  }
  return opts
}

export default function BudgetsPage() {
  const [month, setMonth] = useState(currentMonth())
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)

  const [addingCategory, setAddingCategory] = useState<Category | ''>('')
  const [addingAmount, setAddingAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [copying, setCopying] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [txRes, budgetRes] = await Promise.all([
        fetch(`/api/transactions?month=${month}&pageSize=2000`),
        fetch(`/api/budgets?month=${month}`),
      ])
      const txData = await txRes.json()
      const budgetData = await budgetRes.json()
      setTransactions(txData.data ?? [])
      setBudgets(budgetData.data ?? [])
    } catch {
      setTransactions([])
      setBudgets([])
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => { fetchData() }, [fetchData])

  const categoryStats = calcCategoryStats(transactions)

  async function deleteBudget(id: string) {
    await fetch(`/api/budgets/${id}`, { method: 'DELETE' })
    await fetchData()
  }

  async function updateBudget(id: string, amount: number) {
    await fetch(`/api/budgets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ budget_amount: amount }),
    })
    await fetchData()
  }

  async function copyPrevMonthBudgets() {
    setCopying(true)
    const prevMonth = format(subMonths(new Date(month + '-01'), 1), 'yyyy-MM')
    const res = await fetch(`/api/budgets?month=${prevMonth}`)
    const data = await res.json()
    const prevBudgets: Budget[] = data.data ?? []

    if (prevBudgets.length === 0) { setCopying(false); return }

    const existingCategories = new Set(budgets.map(b => b.category))
    const toAdd = prevBudgets.filter(b => !existingCategories.has(b.category))

    await Promise.all(
      toAdd.map(b =>
        fetch('/api/budgets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ month, category: b.category, budget_amount: b.budget_amount }),
        })
      )
    )
    await fetchData()
    setCopying(false)
  }

  async function saveBudget() {
    if (!addingCategory || !addingAmount) return
    setSaving(true)

    await fetch('/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        month,
        category: addingCategory,
        budget_amount: parseFloat(addingAmount.replace(/,/g, '')),
      }),
    })

    setAddingCategory('')
    setAddingAmount('')
    await fetchData()
    setSaving(false)
  }

  const budgetInsights = generateBudgetInsights(categoryStats, budgets)

  const budgetedCategories = new Set(budgets.map(b => b.category))
  const unbudgetedStats = categoryStats.filter(s => !budgetedCategories.has(s.category) && s.amount > 0)

  const monthOptions = getMonthOptions()

  // Estimate end-of-month projection
  const today = new Date()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const daysPassed = today.getDate()
  const totalExpense = categoryStats.reduce((s, c) => s + c.amount, 0)
  const projectedExpense = daysPassed > 0 ? (totalExpense / daysPassed) * daysInMonth : 0

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#111111] tracking-tight">예산</h1>
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

      {/* Projection banner */}
      {totalExpense > 0 && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-[#6B7280]">이번 달 말 예상 지출</p>
            <p className="text-lg font-bold text-[#111111] num mt-0.5">{formatKRW(Math.round(projectedExpense))}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[#6B7280]">현재까지 지출</p>
            <p className="text-base font-semibold text-[#111111] num mt-0.5">{formatKRW(totalExpense)}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-5">
        {/* Budget settings */}
        <div className="col-span-2">
          {budgets.length > 0 && (
            <div className="mb-5">
              <h2 className="text-sm font-semibold text-[#374151] mb-3">예산 현황</h2>
              <div className="grid grid-cols-2 gap-3">
                {budgets.map(b => {
                  const stat = categoryStats.find(s => s.category === b.category)
                  return (
                    <BudgetProgressCard
                      key={b.id}
                      id={b.id}
                      category={b.category}
                      spent={stat?.amount ?? 0}
                      budget={b.budget_amount}
                      onDelete={deleteBudget}
                      onUpdate={updateBudget}
                    />
                  )
                })}
              </div>
            </div>
          )}

          {/* Unbudgeted categories */}
          {unbudgetedStats.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-[#374151] mb-3">예산 미설정 카테고리</h2>
              <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] bg-[#FAFAFA]">
                      <th className="text-left px-4 py-2 text-xs text-[#6B7280] font-medium">카테고리</th>
                      <th className="text-right px-4 py-2 text-xs text-[#6B7280] font-medium">이번 달 지출</th>
                      <th className="text-right px-4 py-2 text-xs text-[#6B7280] font-medium">건수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unbudgetedStats.map(s => (
                      <tr key={s.category} className="border-b border-[#F9FAFB]">
                        <td className="px-4 py-2.5 text-sm text-[#374151]">{s.category}</td>
                        <td className="px-4 py-2.5 text-right text-sm font-semibold text-[#111111] num">{formatKRW(s.amount)}</td>
                        <td className="px-4 py-2.5 text-right text-xs text-[#9CA3AF] num">{s.count}건</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {budgets.length === 0 && transactions.length === 0 && (
            <EmptyState
              title="데이터가 없습니다"
              description="거래내역을 업로드하고 예산을 설정해보세요."
              actionLabel="업로드하기"
              actionHref="/upload"
            />
          )}
        </div>

        {/* Add budget + insights */}
        <div className="space-y-4">
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#111111]">예산 설정</h3>
              <button
                onClick={copyPrevMonthBudgets}
                disabled={copying}
                className="text-xs text-[#2563EB] hover:underline disabled:opacity-50"
              >
                {copying ? '복사 중...' : '지난달 복사'}
              </button>
            </div>
            <div className="space-y-2.5">
              <Select value={addingCategory} onValueChange={v => v && setAddingCategory(v as Category)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="카테고리 선택" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="예산 금액 (원)"
                value={addingAmount}
                onChange={e => setAddingAmount(e.target.value)}
                className="h-8 text-xs"
                type="number"
              />
              <Button
                disabled={!addingCategory || !addingAmount || saving}
                onClick={saveBudget}
                className="w-full h-8 text-xs bg-[#111111] hover:bg-[#333333] text-white"
              >
                {saving ? '저장 중...' : '예산 저장'}
              </Button>
            </div>
          </div>

          {budgetInsights.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-[#374151]">예산 알림</h3>
              {budgetInsights.map(insight => (
                <InsightCard key={insight.id} insight={insight} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
