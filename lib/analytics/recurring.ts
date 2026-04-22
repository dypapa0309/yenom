import { differenceInDays } from 'date-fns'
import { RecurringTransaction, Transaction } from '@/types'

export function detectRecurring(transactions: Transaction[]): RecurringTransaction[] {
  const expenses = transactions.filter(t => !t.excluded && t.type === 'expense')

  // Group by merchant/description similarity
  const groups = new Map<string, Transaction[]>()

  for (const t of expenses) {
    const key = normalizeKey(t.merchant_name ?? t.description)
    const group = groups.get(key) ?? []
    group.push(t)
    groups.set(key, group)
  }

  const recurring: RecurringTransaction[] = []

  for (const [, group] of groups) {
    if (group.length < 2) continue

    // Sort by date
    group.sort((a, b) => a.transaction_date.localeCompare(b.transaction_date))

    const dates = group.map(t => new Date(t.transaction_date))
    const intervals: number[] = []
    for (let i = 1; i < dates.length; i++) {
      intervals.push(differenceInDays(dates[i], dates[i - 1]))
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
    const variance = intervals.reduce((acc, v) => acc + Math.pow(v - avgInterval, 2), 0) / intervals.length
    const stdDev = Math.sqrt(variance)

    // Regular if interval is 25-35 days (monthly) or 7 days (weekly), with low variance
    const isMonthly = avgInterval >= 25 && avgInterval <= 35 && stdDev < 5
    const isWeekly = avgInterval >= 6 && avgInterval <= 8 && stdDev < 2

    if ((isMonthly || isWeekly) && group.length >= 2) {
      const sample = group[0]
      recurring.push({
        description: sample.description,
        merchant_name: sample.merchant_name,
        amount: group.reduce((s, t) => s + t.amount, 0) / group.length,
        dates: group.map(t => t.transaction_date),
        intervalDays: Math.round(avgInterval),
        category: sample.category as RecurringTransaction['category'],
      })
    }
  }

  return recurring.sort((a, b) => b.amount - a.amount)
}

function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/\s/g, '').replace(/[0-9]/g, '').substring(0, 10)
}
