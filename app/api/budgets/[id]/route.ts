import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/firebase/auth-session'
import { adminDb } from '@/lib/firebase/admin'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { budget_amount } = body

  if (!budget_amount || isNaN(Number(budget_amount))) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }

  const docRef = adminDb.collection('budgets').doc(id)
  const doc = await docRef.get()

  if (!doc.exists || doc.data()?.user_id !== user.uid) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await docRef.update({ budget_amount: Number(budget_amount) })
  const updated = await docRef.get()
  return NextResponse.json({ data: { id: updated.id, ...updated.data() } })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const docRef = adminDb.collection('budgets').doc(id)
  const doc = await docRef.get()

  if (!doc.exists || doc.data()?.user_id !== user.uid) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await docRef.delete()
  return NextResponse.json({ ok: true })
}
