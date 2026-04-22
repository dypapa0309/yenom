import { Category, CategoryStats, RecurringTransaction, Transaction } from '@/types'
import { calcCategoryStats, calcSmallTransactions, calcWeekendVsWeekday } from '../analytics/stats'
import { detectRecurring } from '../analytics/recurring'

export type InsightSeverity = 'info' | 'warning' | 'tip'

export interface Insight {
  id: string
  severity: InsightSeverity
  title: string
  description: string
  amount?: number
  category?: Category
}

export function generateInsights(
  currentMonthTxs: Transaction[],
  prevMonthTxs: Transaction[],
  currentMonth: string
): Insight[] {
  const insights: Insight[] = []

  const currentStats = calcCategoryStats(currentMonthTxs)
  const prevStats = calcCategoryStats(prevMonthTxs)

  // 1. Category spike vs last month
  for (const curr of currentStats) {
    const prev = prevStats.find(p => p.category === curr.category)
    if (!prev || prev.amount === 0) continue
    const changeRate = ((curr.amount - prev.amount) / prev.amount) * 100
    if (changeRate >= 30 && curr.amount > 50000) {
      insights.push({
        id: `spike-${curr.category}`,
        severity: 'warning',
        title: `${curr.category} 지출 급증`,
        description: `${curr.category} 지출이 지난달 대비 ${Math.round(changeRate)}% 증가했습니다.`,
        amount: curr.amount,
        category: curr.category,
      })
    }
  }

  // 2. Top category share
  if (currentStats.length > 0) {
    const top = currentStats[0]
    if (top.percentage > 35) {
      insights.push({
        id: 'top-category-share',
        severity: 'info',
        title: `${top.category} 집중 지출`,
        description: `전체 지출의 ${Math.round(top.percentage)}%가 ${top.category}에서 발생했습니다.`,
        amount: top.amount,
        category: top.category,
      })
    }
  }

  // 3. Small transactions
  const { count, total } = calcSmallTransactions(currentMonthTxs)
  if (count >= 10) {
    insights.push({
      id: 'small-transactions',
      severity: 'tip',
      title: '소액결제 누적',
      description: `소액결제가 ${count}건 누적되어 총 ${total.toLocaleString()}원이 나갔습니다.`,
      amount: total,
    })
  }

  // 4. Recurring subscriptions
  const recurring = detectRecurring(currentMonthTxs)
  const subscriptions = recurring.filter(r =>
    r.category === '구독/디지털' || r.intervalDays >= 25
  )
  if (subscriptions.length > 0) {
    const totalSub = subscriptions.reduce((s, r) => s + r.amount, 0)
    insights.push({
      id: 'subscriptions',
      severity: 'tip',
      title: '정기결제 항목',
      description: `정기결제로 보이는 항목 ${subscriptions.length}건을 확인해보세요. 월 ${Math.round(totalSub).toLocaleString()}원 수준입니다.`,
      amount: totalSub,
    })
  }

  // 5. Weekend spending
  const { weekendAvg, weekdayAvg } = calcWeekendVsWeekday(currentMonthTxs, currentMonth)
  if (weekendAvg > weekdayAvg * 1.8 && weekendAvg > 30000) {
    insights.push({
      id: 'weekend-spending',
      severity: 'info',
      title: '주말 지출 집중',
      description: `주말 평균 지출이 평일보다 ${Math.round((weekendAvg / weekdayAvg - 1) * 100)}% 높습니다.`,
    })
  }

  // 6. Cafe ratio vs food
  const cafe = currentStats.find(s => s.category === '카페/간식')
  const food = currentStats.find(s => s.category === '식비')
  if (cafe && food && food.amount > 0) {
    const ratio = (cafe.amount / food.amount) * 100
    if (ratio > 20) {
      insights.push({
        id: 'cafe-food-ratio',
        severity: 'tip',
        title: '카페/간식 비중',
        description: `카페/간식 지출이 식비의 ${Math.round(ratio)}%를 차지합니다.`,
        amount: cafe.amount,
        category: '카페/간식',
      })
    }
  }

  // 7. Easy cuts recommendation
  const easyCuts: Category[] = ['구독/디지털', '카페/간식', '배달/외식', '여가/취미', '뷰티/미용']
  const cuttableCategories = currentStats
    .filter(s => easyCuts.includes(s.category) && s.amount > 20000)
    .map(s => s.category)

  if (cuttableCategories.length > 0) {
    insights.push({
      id: 'easy-cuts',
      severity: 'tip',
      title: '줄이기 쉬운 지출',
      description: `줄이기 쉬운 항목은 ${cuttableCategories.join(', ')} 순입니다.`,
    })
  }

  return insights
}

export function generateBudgetInsights(
  currentStats: CategoryStats[],
  budgets: { category: string; budget_amount: number }[]
): Insight[] {
  const insights: Insight[] = []

  for (const budget of budgets) {
    const stat = currentStats.find(s => s.category === budget.category)
    if (!stat) continue
    const usageRate = (stat.amount / budget.budget_amount) * 100

    if (usageRate > 100) {
      insights.push({
        id: `budget-over-${budget.category}`,
        severity: 'warning',
        title: `${budget.category} 예산 초과`,
        description: `${budget.category} 예산을 ${Math.round(usageRate - 100)}% 초과했습니다. (${stat.amount.toLocaleString()}원 / ${budget.budget_amount.toLocaleString()}원)`,
        amount: stat.amount,
        category: budget.category as Category,
      })
    } else if (usageRate > 80) {
      insights.push({
        id: `budget-warn-${budget.category}`,
        severity: 'info',
        title: `${budget.category} 예산 80% 도달`,
        description: `${budget.category} 예산의 ${Math.round(usageRate)}%를 사용했습니다.`,
        amount: stat.amount,
        category: budget.category as Category,
      })
    }
  }

  return insights
}
