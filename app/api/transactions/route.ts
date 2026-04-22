import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month')
  const category = searchParams.get('category')
  const type = searchParams.get('type')
  const search = searchParams.get('search')
  const page = parseInt(searchParams.get('page') ?? '1')
  const pageSize = parseInt(searchParams.get('pageSize') ?? '50')

  let query = supabase
    .from('transactions')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('transaction_date', { ascending: false })

  if (month) {
    const [y, m] = month.split('-').map(Number)
    const nextMonth = m === 12
      ? `${y + 1}-01-01`
      : `${y}-${String(m + 1).padStart(2, '0')}-01`
    query = query
      .gte('transaction_date', `${month}-01`)
      .lt('transaction_date', nextMonth)
  }

  if (category) query = query.eq('category', category)
  if (type) query = query.eq('type', type)
  if (search) query = query.ilike('description', `%${search}%`)

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, count, page, pageSize })
}

// merchant_name 또는 description 기준으로 전체 제외/복원
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { merchant_name, description, excluded } = await request.json()

  let query = supabase
    .from('transactions')
    .update({ excluded })
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
