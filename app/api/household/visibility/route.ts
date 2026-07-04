import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/firebase/auth-session'
import { adminDb } from '@/lib/firebase/admin'

// 내 카테고리 공유 설정 조회
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const memberSnap = await adminDb
    .collection('household_members')
    .where('user_id', '==', user.uid)
    .limit(1)
    .get()

  if (memberSnap.empty) return NextResponse.json({ data: [] })

  const householdId = memberSnap.docs[0].data().household_id

  const visSnap = await adminDb
    .collection('household_visibility')
    .where('household_id', '==', householdId)
    .get()

  const data = visSnap.docs.map(d => d.data())
  return NextResponse.json({ data })
}

// 카테고리 공유 여부 업데이트
export async function PATCH(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { category, visible } = await request.json()

  const memberSnap = await adminDb
    .collection('household_members')
    .where('user_id', '==', user.uid)
    .limit(1)
    .get()

  if (memberSnap.empty) {
    return NextResponse.json({ error: '가족 그룹이 없습니다.' }, { status: 404 })
  }

  const householdId = memberSnap.docs[0].data().household_id

  // Upsert by household_id + user_id + category
  const existingSnap = await adminDb
    .collection('household_visibility')
    .where('household_id', '==', householdId)
    .where('user_id', '==', user.uid)
    .where('category', '==', category)
    .limit(1)
    .get()

  if (!existingSnap.empty) {
    await existingSnap.docs[0].ref.update({ visible })
  } else {
    await adminDb.collection('household_visibility').add({
      household_id: householdId,
      user_id: user.uid,
      category,
      visible,
    })
  }

  return NextResponse.json({ ok: true })
}
