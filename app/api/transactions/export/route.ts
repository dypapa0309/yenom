import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month')
  const category = searchParams.get('category')
  const type = searchParams.get('type')
  const search = searchParams.get('search')

  let query = supabase
    .from('transactions')
    .select('transaction_date, description, merchant_name, amount, type, category, memo, excluded')
    .eq('user_id', user.id)
    .order('transaction_date', { ascending: false })

  if (month) {
    const [y, m] = month.split('-').map(Number)
    const nextMonth = m === 12
      ? `${y + 1}-01-01`
      : `${y}-${String(m + 1).padStart(2, '0')}-01`
    query = query.gte('transaction_date', `${month}-01`).lt('transaction_date', nextMonth)
  }
  if (category) query = query.eq('category', category)
  if (type) query = query.eq('type', type)
  if (search) query = query.ilike('description', `%${search}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const TYPE_KO: Record<string, string> = { income: '수입', expense: '지출', transfer: '이체' }

  const headers = ['날짜', '적요', '상호명', '금액', '유형', '카테고리', '메모', '제외여부']
  const rows = (data ?? []).map(r => [
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
  const bom = '﻿'

  return new NextResponse(bom + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="yenom_${month ?? 'all'}.csv"`,
    },
  })
}
