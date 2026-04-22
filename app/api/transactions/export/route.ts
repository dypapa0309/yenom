import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getHouseholdContext } from '@/lib/supabase/household'

const COLS = 'transaction_date, description, merchant_name, amount, type, category, memo, excluded'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters(q: any, month: string | null, category: string | null, type: string | null, search: string | null) {
  if (month) {
    const [y, m] = month.split('-').map(Number)
    const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
    q = q.gte('transaction_date', `${month}-01`).lt('transaction_date', next)
  }
  if (category) q = q.eq('category', category)
  if (type) q = q.eq('type', type)
  if (search) q = q.ilike('description', `%${search}%`)
  return q
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month')
  const category = searchParams.get('category')
  const type = searchParams.get('type')
  const search = searchParams.get('search')

  const hCtx = await getHouseholdContext(supabase, user.id)

  const ownQ = applyFilters(
    supabase.from('transactions').select(COLS).eq('user_id', user.id),
    month, category, type, search
  )
  const { data: ownData, error } = await ownQ
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let partnerData: any[] = []
  for (const partnerId of hCtx.partnerIds) {
    const visibleCats = hCtx.partnerVisibility[partnerId] ?? []
    if (visibleCats.length === 0) continue
    const pQ = applyFilters(
      supabase.from('transactions').select(COLS).eq('user_id', partnerId).in('category', visibleCats),
      month, category, type, search
    )
    const { data: pd } = await pQ
    partnerData = [...partnerData, ...(pd ?? [])]
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any[] = [...(ownData ?? []), ...partnerData]
    .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date))

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
