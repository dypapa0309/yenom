import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getHouseholdContext } from '@/lib/supabase/household'
import { Transaction } from '@/types'

export async function GET(request: NextRequest) {
  try {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month')
  const category = searchParams.get('category')
  const type = searchParams.get('type')
  const search = searchParams.get('search')
  const page = parseInt(searchParams.get('page') ?? '1')
  const pageSize = parseInt(searchParams.get('pageSize') ?? '50')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function buildDateFilter(q: any, m: string): any {
    const [y, mo] = m.split('-').map(Number)
    const next = mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, '0')}-01`
    return q.gte('transaction_date', `${m}-01`).lt('transaction_date', next)
  }

  const hCtx = await getHouseholdContext(supabase, user.id)

  // 본인 데이터 쿼리
  let ownQuery = supabase.from('transactions').select('*').eq('user_id', user.id)
  if (month) ownQuery = buildDateFilter(ownQuery, month)
  if (category) ownQuery = ownQuery.eq('category', category)
  if (type) ownQuery = ownQuery.eq('type', type)
  if (search) ownQuery = ownQuery.ilike('description', `%${search}%`)
  const { data: ownData, error } = await ownQuery
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 파트너 데이터 (공유된 카테고리만)
  let partnerData: Transaction[] = []
  for (const partnerId of hCtx.partnerIds) {
    const visibleCats = hCtx.partnerVisibility[partnerId] ?? []
    if (visibleCats.length === 0) continue
    let pQuery = supabase.from('transactions').select('*').eq('user_id', partnerId).in('category', visibleCats)
    if (month) pQuery = buildDateFilter(pQuery, month)
    if (category) pQuery = pQuery.eq('category', category)
    if (type) pQuery = pQuery.eq('type', type)
    if (search) pQuery = pQuery.ilike('description', `%${search}%`)
    const { data: pd } = await pQuery
    partnerData = [...partnerData, ...(pd ?? [])]
  }

  const allData = [...(ownData ?? []), ...partnerData]
    .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date) || b.created_at.localeCompare(a.created_at))

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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { merchant_name, description } = body

  // Build only the fields that are present in the request body
  const updates: Record<string, unknown> = {}
  if ('excluded' in body) updates.excluded = body.excluded
  if ('category' in body) updates.category = body.category
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  let query = supabase
    .from('transactions')
    .update(updates)
    .eq('user_id', user.id)

  if (merchant_name) {
    query = query.eq('merchant_name', merchant_name)
  } else if (description) {
    query = query.ilike('description', `%${description}%`)
  } else {
    return NextResponse.json({ error: 'merchant_name or description required' }, { status: 400 })
  }

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { transaction_date, description, amount, type, category, memo, merchant_name } = body

  if (!transaction_date || !description || !amount || !type || !category) {
    return NextResponse.json({ error: 'Required fields missing' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: user.id,
      upload_id: null,
      transaction_date,
      description,
      amount: Number(amount),
      type,
      category,
      merchant_name: merchant_name ?? null,
      memo: memo ?? null,
      excluded: false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
