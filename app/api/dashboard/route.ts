import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildDashboardData } from '@/lib/analytics/stats'
import { detectRecurring } from '@/lib/analytics/recurring'
import { currentMonth } from '@/lib/utils/format'
import { getHouseholdContext } from '@/lib/supabase/household'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') ?? currentMonth()

  const [year, mon] = month.split('-').map(Number)
  const sixMonthsAgo = new Date(year, mon - 7, 1)
  const startDate = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`

  const hCtx = await getHouseholdContext(supabase, user.id)

  // 본인 데이터
  const { data: ownTxs, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .gte('transaction_date', startDate)
    .order('transaction_date', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 파트너 데이터 (공유된 카테고리만)
  let partnerTxs: typeof ownTxs = []
  for (const partnerId of hCtx.partnerIds) {
    const visibleCategories = hCtx.partnerVisibility[partnerId] ?? []
    if (visibleCategories.length === 0) continue
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', partnerId)
      .in('category', visibleCategories)
      .gte('transaction_date', startDate)
      .order('transaction_date', { ascending: true })
    partnerTxs = [...partnerTxs, ...(data ?? [])]
  }

  const allTxs = [...(ownTxs ?? []), ...partnerTxs]
    .sort((a, b) => a.transaction_date.localeCompare(b.transaction_date))

  const dashboardData = buildDashboardData(allTxs, month)
  dashboardData.recurringItems = detectRecurring(allTxs).slice(0, 8)

  return NextResponse.json({ data: dashboardData, month, isShared: hCtx.partnerIds.length > 0 })
}
