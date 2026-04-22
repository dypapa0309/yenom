import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token } = await request.json()
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  // 초대 확인
  const { data: invite } = await supabase
    .from('household_invites')
    .select('id, household_id, invited_by, status')
    .eq('token', token)
    .maybeSingle()

  if (!invite) return NextResponse.json({ error: '유효하지 않은 초대 링크입니다.' }, { status: 404 })
  if (invite.status !== 'pending') return NextResponse.json({ error: '이미 사용된 초대 링크입니다.' }, { status: 400 })
  if (invite.invited_by === user.id) return NextResponse.json({ error: '본인이 만든 초대 링크입니다.' }, { status: 400 })

  // 이미 다른 household에 속해있으면 탈퇴 처리
  const { data: existing } = await supabase
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    await supabase.from('household_members').delete()
      .eq('user_id', user.id).eq('household_id', existing.household_id)
    if (existing.role === 'owner') {
      await supabase.from('households').delete().eq('id', existing.household_id)
    }
  }

  // 멤버 추가
  const { error: joinError } = await supabase.from('household_members').insert({
    household_id: invite.household_id,
    user_id: user.id,
    role: 'member',
  })
  if (joinError) return NextResponse.json({ error: joinError.message }, { status: 500 })

  // 초대 상태 업데이트
  await supabase.from('household_invites')
    .update({ status: 'accepted' })
    .eq('id', invite.id)

  return NextResponse.json({ ok: true, householdId: invite.household_id })
}
