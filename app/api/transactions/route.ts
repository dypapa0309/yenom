import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/firebase/auth-session'
import { adminDb } from '@/lib/firebase/admin'
import { getHouseholdContext } from '@/lib/firebase/household'
import { Transaction } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')
    const category = searchParams.get('category')
    const type = searchParams.get('type')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') ?? '1')
    const pageSize = parseInt(searchParams.get('pageSize') ?? '50')

    const hCtx = await getHouseholdContext(user.uid)

    // 본인 데이터 쿼리
    let ownQuery: FirebaseFirestore.Query = adminDb
      .collection('transactions')
      .where('user_id', '==', user.uid)

    if (month) {
      const [y, mo] = month.split('-').map(Number)
      const next = mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, '0')}-01`
      ownQuery = ownQuery
        .where('transaction_date', '>=', `${month}-01`)
        .where('transaction_date', '<', next)
    }
    if (category) ownQuery = ownQuery.where('category', '==', category)
    if (type) ownQuery = ownQuery.where('type', '==', type)

    const ownSnap = await ownQuery.get()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ownData: any[] = ownSnap.docs.map(d => ({ id: d.id, ...d.data() }))

    // Client-side search filter (Firestore doesn't support ILIKE)
    if (search) {
      const lower = search.toLowerCase()
      ownData = ownData.filter(t => t.description?.toLowerCase().includes(lower))
    }

    // 파트너 데이터
    let partnerData: Transaction[] = []
    for (const partnerId of hCtx.partnerIds) {
      const visibleCats = hCtx.partnerVisibility[partnerId] ?? []
      if (visibleCats.length === 0) continue

      let pQuery: FirebaseFirestore.Query = adminDb
        .collection('transactions')
        .where('user_id', '==', partnerId)
        .where('category', 'in', visibleCats.slice(0, 30))

      if (month) {
        const [y, mo] = month.split('-').map(Number)
        const next = mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, '0')}-01`
        pQuery = pQuery
          .where('transaction_date', '>=', `${month}-01`)
          .where('transaction_date', '<', next)
      }
      if (type) pQuery = pQuery.where('type', '==', type)

      const pSnap = await pQuery.get()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let pData: any[] = pSnap.docs.map(d => ({ id: d.id, ...d.data() }))

      if (category) pData = pData.filter(t => t.category === category)
      if (search) {
        const lower = search.toLowerCase()
        pData = pData.filter(t => t.description?.toLowerCase().includes(lower))
      }
      partnerData = [...partnerData, ...pData]
    }

    const allData = [...ownData, ...partnerData]
      .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date) || (b.created_at ?? '').localeCompare(a.created_at ?? ''))

    const count = allData.length
    const from = (page - 1) * pageSize
    const paginated = allData.slice(from, from + pageSize)

    return NextResponse.json({ data: paginated, count, page, pageSize })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// merchant_name 또는 description 기준으로 전체 제외/복원
export async function PATCH(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { merchant_name, description } = body

  const updates: Record<string, unknown> = {}
  if ('excluded' in body) updates.excluded = body.excluded
  if ('category' in body) updates.category = body.category
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  let query: FirebaseFirestore.Query = adminDb
    .collection('transactions')
    .where('user_id', '==', user.uid)

  if (merchant_name) {
    query = query.where('merchant_name', '==', merchant_name)
  } else if (description) {
    // Firestore doesn't support ILIKE, fetch all user's transactions and filter
    const snap = await query.get()
    const lower = description.toLowerCase()
    const matching = snap.docs.filter(d =>
      d.data().description?.toLowerCase().includes(lower)
    )
    const batch = adminDb.batch()
    matching.forEach(d => batch.update(d.ref, updates))
    await batch.commit()
    return NextResponse.json({ ok: true })
  } else {
    return NextResponse.json({ error: 'merchant_name or description required' }, { status: 400 })
  }

  const snap = await query.get()
  const batch = adminDb.batch()
  snap.docs.forEach(d => batch.update(d.ref, updates))
  await batch.commit()

  return NextResponse.json({ ok: true })
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { transaction_date, description, amount, type, category, memo, merchant_name } = body

  if (!transaction_date || !description || !amount || !type || !category) {
    return NextResponse.json({ error: 'Required fields missing' }, { status: 400 })
  }

  const ref = await adminDb.collection('transactions').add({
    user_id: user.uid,
    upload_id: null,
    transaction_date,
    description,
    amount: Number(amount),
    type,
    category,
    merchant_name: merchant_name ?? null,
    memo: memo ?? null,
    excluded: false,
    created_at: new Date().toISOString(),
  })

  const doc = await ref.get()
  return NextResponse.json({ data: { id: doc.id, ...doc.data() } })
}
