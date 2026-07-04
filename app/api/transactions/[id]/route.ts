import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/firebase/auth-session'
import { adminDb } from '@/lib/firebase/admin'
import { z } from 'zod'

const updateSchema = z.object({
  category: z.string().optional(),
  excluded: z.boolean().optional(),
  memo: z.string().nullable().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const parsed = updateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 })
  }

  const docRef = adminDb.collection('transactions').doc(id)
  const doc = await docRef.get()

  if (!doc.exists || doc.data()?.user_id !== user.uid) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await docRef.update(parsed.data)
  const updated = await docRef.get()
  const tx = { id: updated.id, ...updated.data() }

  // Save user rule if category was updated
  if (parsed.data.category) {
    const txData = updated.data()!
    const ruleKey = txData.merchant_name ?? txData.description?.substring(0, 20)
    if (ruleKey) {
      const existingSnap = await adminDb
        .collection('user_rules')
        .where('user_id', '==', user.uid)
        .where('merchant_name', '==', ruleKey)
        .limit(1)
        .get()

      if (existingSnap.empty) {
        await adminDb.collection('user_rules').add({
          user_id: user.uid,
          merchant_name: ruleKey,
          keyword: null,
          category: parsed.data.category,
          created_at: new Date().toISOString(),
        })
      } else {
        await existingSnap.docs[0].ref.update({ category: parsed.data.category })
      }
    }
  }

  return NextResponse.json({ data: tx })
}
