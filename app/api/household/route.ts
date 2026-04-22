import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 현재 household 정보 조회
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id, role, joined_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) return NextResponse.json({ data: null })

  const { data: household } = await supabase
    .from('households')
    .select('id, name, created_by')
    .eq('id', membership.household_id)
    .single()

  const { data: members } = await supabase
    .from('household_members')
    .select('user_id, role, joined_at')
    .eq('household_id', membership.household_id)

  const { data: invites } = await supabase
    .from('household_invites')
    .select('id, token, status, created_at')
    .eq('household_id', membership.household_id)
    .eq('status', 'pending')

  return NextResponse.json({
    data: { household, members, invites, myRole: membership.role }
  })
}

// household 생성 (처음 초대하는 사람이 생성)
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 이미 household가 있으면 안 됨
  const { data: existing } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) return NextResponse.json({ error: '이미 가족 그룹에 속해 있습니다.' }, { status: 400 })

  const { data: household, error: hError } = await supabase
    .from('households')
    .insert({ name: '우리 가계부', created_by: user.id })
    .select()
    .single()

  if (hError) return NextResponse.json({ error: hError.message }, { status: 500 })

  await supabase.from('household_members').insert({
    household_id: household.id,
    user_id: user.id,
    role: 'owner',
  })

  return NextResponse.json({ data: household })
}

// household 탈퇴
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) return NextResponse.json({ error: '가족 그룹이 없습니다.' }, { status: 404 })

  await supabase.from('household_members').delete()
    .eq('user_id', user.id)
    .eq('household_id', membership.household_id)

  // owner가 나가면 household 삭제
  if (membership.role === 'owner') {
    await supabase.from('households').delete().eq('id', membership.household_id)
  }

  return NextResponse.json({ ok: true })
}
