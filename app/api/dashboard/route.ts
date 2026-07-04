import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/firebase/auth-session'
import { adminDb } from '@/lib/firebase/admin'
import { buildDashboardData } from '@/lib/analytics/stats'
import { detectRecurring } from '@/lib/analytics/recurring'
import { currentMonth } from '@/lib/utils/format'
import { getHouseholdContext } from '@/lib/firebase/household'

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') ?? currentMonth()

    const [year, mon] = month.split('-').map(Number)
    const sixMonthsAgo = new Date(year, mon - 7, 1)
    const startDate = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`

    const hCtx = await getHouseholdContext(user.uid)

    // 본인 데이터
    const ownSnap = await adminDb
      .collection('transactions')
      .where('user_id', '==', user.uid)
      .where('transaction_date', '>=', startDate)
      .orderBy('transaction_date', 'asc')
      .get()

    const ownTxs = ownSnap.docs.map(d => ({ id: d.id, ...d.data() }))

    // 파트너 데이터 (공유된 카테고리만)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let partnerTxs: any[] = []
    for (const partnerId of hCtx.partnerIds) {
      const visibleCategories = hCtx.partnerVisibility[partnerId] ?? []
      if (visibleCategories.length === 0) continue
      // Firestore 'in' supports max 30 values
      const pSnap = await adminDb
        .collection('transactions')
        .where('user_id', '==', partnerId)
        .where('transaction_date', '>=', startDate)
        .where('category', 'in', visibleCategories.slice(0, 30))
        .orderBy('transaction_date', 'asc')
        .get()
      partnerTxs = [...partnerTxs, ...pSnap.docs.map(d => ({ id: d.id, ...d.data() }))]
    }

    const allTxs = [...ownTxs, ...partnerTxs]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) => a.transaction_date.localeCompare(b.transaction_date))

    const dashboardData = buildDashboardData(allTxs, month)
    dashboardData.recurringItems = detectRecurring(allTxs).slice(0, 8)

    return NextResponse.json({ data: dashboardData, month, isShared: hCtx.partnerIds.length > 0 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
