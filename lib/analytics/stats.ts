import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, getDay } from 'date-fns'
import { Category, CategoryStats, DashboardData, MonthlyStats, TopMerchant, Transaction } from '@/types'

function activeExpenses(transactions: Transaction[]): Transaction[] {
  return transactions.filter(t => !t.excluded && t.type === 'expense')
}

function activeIncome(transactions: Transaction[]): Transaction[] {
  return transactions.filter(t => !t.excluded && t.type === 'income')
}

export function calcTotalIncome(transactions: Transaction[]): number {
  return activeIncome(transactions).reduce((sum, t) => sum + t.amount, 0)
}

export function calcTotalExpense(transactions: Transaction[]): number {
  return activeExpenses(transactions).reduce((sum, t) => sum + t.amount, 0)
}

export function calcSavingsRate(income: number, expense: number): number {
  if (income === 0) return 0
  return Math.max(0, ((income - expense) / income) * 100)
}

export function calcCategoryStats(transactions: Transaction[]): CategoryStats[] {
  const expenses = activeExpenses(transactions)
  const total = expenses.reduce((sum, t) => sum + t.amount, 0)

  const map = new Map<Category, { amount: number; count: number }>()

  for (const t of expenses) {
    const cat = t.category as Category
    const existing = map.get(cat) ?? { amount: 0, count: 0 }
    map.set(cat, { amount: existing.amount + t.amount, count: existing.count + 1 })
  }

  return Array.from(map.entries())
    .map(([category, { amount, count }]) => ({
      category,
      amount,
      count,
      percentage: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
}

export function calcMonthlyStats(transactions: Transaction[]): MonthlyStats[] {
  const active = transactions.filter(t => !t.excluded)
  if (active.length === 0) return []

  const dates = active.map(t => new Date(t.transaction_date))
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())))
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())))

  const months = eachMonthOfInterval({ start: startOfMonth(minDate), end: startOfMonth(maxDate) })

  return months.map(monthDate => {
    const monthStr = format(monthDate, 'yyyy-MM')
    const monthTxs = active.filter(t => t.transaction_date.startsWith(monthStr))
    const income = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expense = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const savings = income - expense
    return {
      month: monthStr,
      income,
      expense,
      savings,
      savingsRate: calcSavingsRate(income, expense),
    }
  })
}

export function calcWeeklyExpense(
  transactions: Transaction[],
  targetMonth: string
): { week: string; amount: number }[] {
  const expenses = activeExpenses(transactions).filter(t => t.transaction_date.startsWith(targetMonth))

  const weeks: Record<string, number> = {
    '1주차': 0,
    '2주차': 0,
    '3주차': 0,
    '4주차': 0,
    '5주차': 0,
  }

  for (const t of expenses) {
    const day = parseInt(t.transaction_date.split('-')[2])
    const weekKey = `${Math.ceil(day / 7)}주차`
    if (weeks[weekKey] !== undefined) weeks[weekKey] += t.amount
  }

  return Object.entries(weeks)
    .filter(([, amount]) => amount > 0)
    .map(([week, amount]) => ({ week, amount }))
}

export function calcTopMerchants(transactions: Transaction[], limit = 10): TopMerchant[] {
  const expenses = activeExpenses(transactions)
  const map = new Map<string, { amount: number; count: number }>()

  for (const t of expenses) {
    const key = t.merchant_name ?? t.description.substring(0, 15)
    const existing = map.get(key) ?? { amount: 0, count: 0 }
    map.set(key, { amount: existing.amount + t.amount, count: existing.count + 1 })
  }

  return Array.from(map.entries())
    .map(([merchant_name, { amount, count }]) => ({ merchant_name, amount, count }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
}

export function calcDailyAvgExpense(transactions: Transaction[], targetMonth: string): number {
  const expenses = activeExpenses(transactions).filter(t => t.transaction_date.startsWith(targetMonth))
  if (expenses.length === 0) return 0
  const days = new Set(expenses.map(t => t.transaction_date)).size
  const total = expenses.reduce((s, t) => s + t.amount, 0)
  return days > 0 ? total / days : 0
}

export function calcSmallTransactions(transactions: Transaction[], threshold = 10000) {
  const small = activeExpenses(transactions).filter(t => t.amount <= threshold)
  return {
    count: small.length,
    total: small.reduce((s, t) => s + t.amount, 0),
  }
}

export function calcWeekendVsWeekday(transactions: Transaction[], targetMonth: string) {
  const expenses = activeExpenses(transactions).filter(t => t.transaction_date.startsWith(targetMonth))
  let weekendTotal = 0, weekdayTotal = 0
  let weekendDays = 0, weekdayDays = 0

  const days = new Set(expenses.map(t => t.transaction_date))
  for (const day of days) {
    const dow = getDay(new Date(day))
    if (dow === 0 || dow === 6) weekendDays++
    else weekdayDays++
  }

  for (const t of expenses) {
    const dow = getDay(new Date(t.transaction_date))
    if (dow === 0 || dow === 6) weekendTotal += t.amount
    else weekdayTotal += t.amount
  }

  const weekendAvg = weekendDays > 0 ? weekendTotal / weekendDays : 0
  const weekdayAvg = weekdayDays > 0 ? weekdayTotal / weekdayDays : 0

  return { weekendTotal, weekdayTotal, weekendAvg, weekdayAvg }
}

export function buildDashboardData(
  allTransactions: Transaction[],
  targetMonth: string
): DashboardData {
  const monthTxs = allTransactions.filter(t => t.transaction_date.startsWith(targetMonth))
  const prevMonth = format(subMonths(new Date(targetMonth + '-01'), 1), 'yyyy-MM')
  const prevMonthTxs = allTransactions.filter(t => t.transaction_date.startsWith(prevMonth))

  const totalIncome = calcTotalIncome(monthTxs)
  const totalExpense = calcTotalExpense(monthTxs)
  const netSavings = totalIncome - totalExpense
  const savingsRate = calcSavingsRate(totalIncome, totalExpense)

  const prevMonthIncome = calcTotalIncome(prevMonthTxs)
  const prevMonthExpense = calcTotalExpense(prevMonthTxs)

  const categoryStats = calcCategoryStats(monthTxs)
  const monthlyStats = calcMonthlyStats(allTransactions)
  const topMerchants = calcTopMerchants(monthTxs)
  const dailyAvgExpense = calcDailyAvgExpense(monthTxs, targetMonth)
  const { count: smallTransactionCount, total: smallTransactionTotal } = calcSmallTransactions(monthTxs)

  return {
    totalIncome,
    totalExpense,
    netSavings,
    savingsRate,
    categoryStats,
    monthlyStats,
    topMerchants,
    recurringItems: [],
    prevMonthIncome,
    prevMonthExpense,
    dailyAvgExpense,
    smallTransactionCount,
    smallTransactionTotal,
  }
}
