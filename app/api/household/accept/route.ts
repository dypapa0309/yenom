import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/firebase/auth-session'
import { adminDb } from '@/lib/firebase/admin'

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token } = await request.json()
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  // 초대 확인
  const inviteSnap = await adminDb
    .collection('household_invites')
    .where('token', '==', token)
    .limit(1)
    .get()

  if (inviteSnap.empty) {
    return NextResponse.json({ error: '유효하지 않은 초대 링크입니다.' }, { status: 404 })
  }

  const inviteDoc = inviteSnap.docs[0]
  const invite = inviteDoc.data()

  if (invite.status !== 'pending') {
    return NextResponse.json({ error: '이미 사용된 초대 링크입니다.' }, { status: 400 })
  }
  if (invite.invited_by === user.uid) {
    return NextResponse.json({ error: '본인이 만든 초대 링크입니다.' }, { status: 400 })
  }

  // 이미 다른 household에 속해있으면 탈퇴 처리
  const existingSnap = await adminDb
    .collection('household_members')
    .where('user_id', '==', user.uid)
    .limit(1)
    .get()

  if (!existingSnap.empty) {
    const existing = existingSnap.docs[0]
    const existingData = existing.data()
    await existing.ref.delete()
    if (existingData.role === 'owner') {
      await adminDb.collection('households').doc(existingData.household_id).delete()
    }
  }

  // 멤버 추가
  await adminDb.collection('household_members').add({
    household_id: invite.household_id,
    user_id: user.uid,
    role: 'member',
    joined_at: new Date().toISOString(),
  })

  // 초대 상태 업데이트
  await inviteDoc.ref.update({ status: 'accepted' })

  return NextResponse.json({ ok: true, householdId: invite.household_id })
}
