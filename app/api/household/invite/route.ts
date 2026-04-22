import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 초대 링크 생성
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // household가 없으면 자동 생성
  let { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) {
    const { data: household } = await supabase
      .from('households')
      .insert({ name: '우리 가계부', created_by: user.id })
      .select()
      .single()

    if (!household) return NextResponse.json({ error: 'Failed to create household' }, { status: 500 })

    await supabase.from('household_members').insert({
      household_id: household.id,
      user_id: user.id,
      role: 'owner',
    })

    membership = { household_id: household.id }
  }

  // 멤버가 이미 2명이면 더 초대 불가
  const { data: members } = await supabase
    .from('household_members')
    .select('user_id')
    .eq('household_id', membership.household_id)

  if ((members?.length ?? 0) >= 2) {
    return NextResponse.json({ error: '이미 파트너가 있습니다.' }, { status: 400 })
  }

  // 기존 pending 초대 삭제 후 새로 생성
  await supabase.from('household_invites')
    .delete()
    .eq('household_id', membership.household_id)
    .eq('status', 'pending')

  const { data: invite, error } = await supabase
    .from('household_invites')
    .insert({ household_id: membership.household_id, invited_by: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: { token: invite.token } })
}

// 초대 토큰으로 정보 조회 (수락 전 미리보기)
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const token = request.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const { data: invite } = await supabase
    .from('household_invites')
    .select('id, household_id, status, created_at, invited_by')
    .eq('token', token)
    .maybeSingle()

  if (!invite) return NextResponse.json({ error: '유효하지 않은 초대 링크입니다.' }, { status: 404 })
  if (invite.status !== 'pending') return NextResponse.json({ error: '이미 사용된 초대 링크입니다.' }, { status: 400 })

  const { data: household } = await supabase
    .from('households')
    .select('name')
    .eq('id', invite.household_id)
    .single()

  return NextResponse.json({ data: { invite, household } })
}
