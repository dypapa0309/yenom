import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/firebase/auth-session'
import { adminDb } from '@/lib/firebase/admin'

// 현재 household 정보 조회
export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const memberSnap = await adminDb
      .collection('household_members')
      .where('user_id', '==', user.uid)
      .limit(1)
      .get()

    if (memberSnap.empty) return NextResponse.json({ data: null })

    const membership = memberSnap.docs[0].data()
    const householdId = membership.household_id

    const householdDoc = await adminDb.collection('households').doc(householdId).get()
    const household = householdDoc.exists ? { id: householdDoc.id, ...householdDoc.data() } : null

    const membersSnap = await adminDb
      .collection('household_members')
      .where('household_id', '==', householdId)
      .get()
    const members = membersSnap.docs.map(d => d.data())

    const invitesSnap = await adminDb
      .collection('household_invites')
      .where('household_id', '==', householdId)
      .where('status', '==', 'pending')
      .get()
    const invites = invitesSnap.docs.map(d => ({ id: d.id, ...d.data() }))

    return NextResponse.json({
      data: { household, members, invites, myRole: membership.role }
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// household 생성
export async function POST() {
  try {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const existingSnap = await adminDb
      .collection('household_members')
      .where('user_id', '==', user.uid)
      .limit(1)
      .get()

    if (!existingSnap.empty) {
      return NextResponse.json({ error: '이미 가족 그룹에 속해 있습니다.' }, { status: 400 })
    }

    const householdRef = await adminDb.collection('households').add({
      name: '우리 가계부',
      created_by: user.uid,
      created_at: new Date().toISOString(),
    })

    await adminDb.collection('household_members').add({
      household_id: householdRef.id,
      user_id: user.uid,
      role: 'owner',
      joined_at: new Date().toISOString(),
    })

    const household = await householdRef.get()
    return NextResponse.json({ data: { id: household.id, ...household.data() } })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// household 탈퇴
export async function DELETE() {
  try {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const memberSnap = await adminDb
      .collection('household_members')
      .where('user_id', '==', user.uid)
      .limit(1)
      .get()

    if (memberSnap.empty) {
      return NextResponse.json({ error: '가족 그룹이 없습니다.' }, { status: 404 })
    }

    const membership = memberSnap.docs[0]
    const data = membership.data()
    const householdId = data.household_id

    await membership.ref.delete()

    // owner가 나가면 household 및 관련 데이터 삭제
    if (data.role === 'owner') {
      await adminDb.collection('households').doc(householdId).delete()
      // 나머지 멤버도 제거
      const remainingSnap = await adminDb
        .collection('household_members')
        .where('household_id', '==', householdId)
        .get()
      const batch = adminDb.batch()
      remainingSnap.docs.forEach(d => batch.delete(d.ref))
      await batch.commit()
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
