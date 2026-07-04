import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/firebase/auth-session'
import { adminDb } from '@/lib/firebase/admin'
import { randomUUID } from 'crypto'

// 초대 링크 생성
export async function POST() {
  try {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // household가 없으면 자동 생성
    let memberSnap = await adminDb
      .collection('household_members')
      .where('user_id', '==', user.uid)
      .limit(1)
      .get()

    let householdId: string

    if (memberSnap.empty) {
      const householdRef = await adminDb.collection('households').add({
        name: '우리 가계부',
        created_by: user.uid,
        created_at: new Date().toISOString(),
      })
      householdId = householdRef.id

      await adminDb.collection('household_members').add({
        household_id: householdId,
        user_id: user.uid,
        role: 'owner',
        joined_at: new Date().toISOString(),
      })
    } else {
      householdId = memberSnap.docs[0].data().household_id
    }

    // 멤버가 이미 2명이면 더 초대 불가
    const allMembersSnap = await adminDb
      .collection('household_members')
      .where('household_id', '==', householdId)
      .get()

    if (allMembersSnap.size >= 2) {
      return NextResponse.json({ error: '이미 파트너가 있습니다.' }, { status: 400 })
    }

    // 기존 pending 초대 삭제
    const pendingSnap = await adminDb
      .collection('household_invites')
      .where('household_id', '==', householdId)
      .where('status', '==', 'pending')
      .get()

    const batch = adminDb.batch()
    pendingSnap.docs.forEach(d => batch.delete(d.ref))
    await batch.commit()

    // 새 초대 생성
    const token = randomUUID()
    await adminDb.collection('household_invites').add({
      household_id: householdId,
      invited_by: user.uid,
      token,
      status: 'pending',
      created_at: new Date().toISOString(),
    })

    return NextResponse.json({ data: { token } })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// 초대 토큰으로 정보 조회
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')
    if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

    const inviteSnap = await adminDb
      .collection('household_invites')
      .where('token', '==', token)
      .limit(1)
      .get()

    if (inviteSnap.empty) {
      return NextResponse.json({ error: '유효하지 않은 초대 링크입니다.' }, { status: 404 })
    }

    const invite = inviteSnap.docs[0].data()
    if (invite.status !== 'pending') {
      return NextResponse.json({ error: '이미 사용된 초대 링크입니다.' }, { status: 400 })
    }

    const householdDoc = await adminDb.collection('households').doc(invite.household_id).get()
    const household = householdDoc.exists ? { name: householdDoc.data()?.name } : null

    return NextResponse.json({ data: { invite, household } })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
