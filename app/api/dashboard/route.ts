import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildDashboardData } from '@/lib/analytics/stats'
import { detectRecurring } from '@/lib/analytics/recurring'
import { currentMonth } from '@/lib/utils/format'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') ?? currentMonth()

  // Load all transactions (last 6 months for trend calculation)
  const [year, mon] = month.split('-').map(Number)
  const sixMonthsAgo = new Date(year, mon - 7, 1)
  const startDate = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`

  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .gte('transaction_date', startDate)
    .order('transaction_date', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const dashboardData = buildDashboardData(transactions ?? [], month)

  // Add recurring items
  const monthTxs = (transactions ?? []).filter(t => t.transaction_date.startsWith(month))
  dashboardData.recurringItems = detectRecurring(transactions ?? []).slice(0, 8)

  return NextResponse.json({ data: dashboardData, month })
}
