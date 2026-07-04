import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/firebase/auth-session'
import { adminDb } from '@/lib/firebase/admin'
import { getHouseholdContext } from '@/lib/firebase/household'

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')
    const category = searchParams.get('category')
    const type = searchParams.get('type')
    const search = searchParams.get('search')

    const hCtx = await getHouseholdContext(user.uid)

    // 본인 데이터
    let ownQuery: FirebaseFirestore.Query = adminDb
      .collection('transactions')
      .where('user_id', '==', user.uid)

    if (month) {
      const [y, m] = month.split('-').map(Number)
      const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
      ownQuery = ownQuery
        .where('transaction_date', '>=', `${month}-01`)
        .where('transaction_date', '<', next)
    }
    if (category) ownQuery = ownQuery.where('category', '==', category)
    if (type) ownQuery = ownQuery.where('type', '==', type)

    const ownSnap = await ownQuery.get()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ownData: any[] = ownSnap.docs.map(d => d.data())

    if (search) {
      const lower = search.toLowerCase()
      ownData = ownData.filter(t => t.description?.toLowerCase().includes(lower))
    }

    // 파트너 데이터
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let partnerData: any[] = []
    for (const partnerId of hCtx.partnerIds) {
      const visibleCats = hCtx.partnerVisibility[partnerId] ?? []
      if (visibleCats.length === 0) continue

      let pQuery: FirebaseFirestore.Query = adminDb
        .collection('transactions')
        .where('user_id', '==', partnerId)
        .where('category', 'in', visibleCats.slice(0, 30))

      if (month) {
        const [y, m] = month.split('-').map(Number)
        const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
        pQuery = pQuery
          .where('transaction_date', '>=', `${month}-01`)
          .where('transaction_date', '<', next)
      }
      if (type) pQuery = pQuery.where('type', '==', type)

      const pSnap = await pQuery.get()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let pData: any[] = pSnap.docs.map(d => d.data())
      if (category) pData = pData.filter(t => t.category === category)
      if (search) {
        const lower = search.toLowerCase()
        pData = pData.filter(t => t.description?.toLowerCase().includes(lower))
      }
      partnerData = [...partnerData, ...pData]
    }

    const data = [...ownData, ...partnerData]
      .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date))

    const TYPE_KO: Record<string, string> = { income: '수입', expense: '지출', transfer: '이체' }

    const headers = ['날짜', '적요', '상호명', '금액', '유형', '카테고리', '메모', '제외여부']
    const rows = data.map(r => [
      r.transaction_date,
      `"${(r.description ?? '').replace(/"/g, '""')}"`,
      `"${(r.merchant_name ?? '').replace(/"/g, '""')}"`,
      r.amount,
      TYPE_KO[r.type] ?? r.type,
      r.category,
      `"${(r.memo ?? '').replace(/"/g, '""')}"`,
      r.excluded ? '제외' : '',
    ])

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const bom = '\uFEFF'

    return new NextResponse(bom + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="yenom_${month ?? 'all'}.csv"`,
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
