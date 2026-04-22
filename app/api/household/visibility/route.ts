import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 내 카테고리 공유 설정 조회
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) return NextResponse.json({ data: [] })

  const { data } = await supabase
    .from('household_visibility')
    .select('user_id, category, visible')
    .eq('household_id', membership.household_id)

  return NextResponse.json({ data: data ?? [] })
}

// 카테고리 공유 여부 업데이트
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { category, visible } = await request.json()

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) return NextResponse.json({ error: '가족 그룹이 없습니다.' }, { status: 404 })

  const { error } = await supabase
    .from('household_visibility')
    .upsert({
      household_id: membership.household_id,
      user_id: user.id,
      category,
      visible,
    }, { onConflict: 'household_id,user_id,category' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
