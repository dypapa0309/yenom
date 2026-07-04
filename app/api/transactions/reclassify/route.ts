import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/firebase/auth-session'
import { adminDb } from '@/lib/firebase/admin'
import { enrichWithKakao } from '@/lib/categorization/kakao-classifier'

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.KAKAO_REST_API_KEY) {
    return NextResponse.json({ error: 'Kakao API key not configured' }, { status: 503 })
  }

  // Fetch all 기타 expense transactions for this user
  const snap = await adminDb
    .collection('transactions')
    .where('user_id', '==', user.uid)
    .where('category', '==', '기타')
    .where('type', '==', 'expense')
    .where('excluded', '==', false)
    .get()

  if (snap.empty) return NextResponse.json({ updated: 0 })

  const txs = snap.docs.map(d => ({
    id: d.id,
    merchant_name: d.data().merchant_name,
    description: d.data().description,
  }))

  const kakaoMap = await enrichWithKakao(txs)
  if (kakaoMap.size === 0) return NextResponse.json({ updated: 0 })

  // Batch update
  const batch = adminDb.batch()
  for (const [id, category] of kakaoMap.entries()) {
    batch.update(adminDb.collection('transactions').doc(id), { category })
  }
  await batch.commit()

  return NextResponse.json({ updated: kakaoMap.size })
}
