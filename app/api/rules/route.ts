import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/firebase/auth-session'
import { adminDb } from '@/lib/firebase/admin'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const snap = await adminDb
    .collection('user_rules')
    .where('user_id', '==', user.uid)
    .orderBy('created_at', 'desc')
    .get()

  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { keyword, merchant_name, category } = body

  if (!category || (!keyword && !merchant_name)) {
    return NextResponse.json({ error: 'keyword or merchant_name required' }, { status: 400 })
  }

  const ref = await adminDb.collection('user_rules').add({
    user_id: user.uid,
    keyword: keyword || null,
    merchant_name: merchant_name || null,
    category,
    created_at: new Date().toISOString(),
  })

  const doc = await ref.get()
  return NextResponse.json({ data: { id: doc.id, ...doc.data() } })
}

export async function DELETE(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const docRef = adminDb.collection('user_rules').doc(id)
  const doc = await docRef.get()

  if (!doc.exists || doc.data()?.user_id !== user.uid) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await docRef.delete()
  return NextResponse.json({ ok: true })
}
