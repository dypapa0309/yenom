import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/firebase/auth-session'
import { adminDb } from '@/lib/firebase/admin'
import { z } from 'zod'

const budgetSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  category: z.string(),
  budget_amount: z.number().positive(),
})

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')

    let query: FirebaseFirestore.Query = adminDb
      .collection('budgets')
      .where('user_id', '==', user.uid)

    if (month) {
      query = query.where('month', '==', month)
    }

    const snap = await query.get()
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))

    return NextResponse.json({ data })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const parsed = budgetSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.format() }, { status: 400 })

    // Upsert: find existing by user_id + month + category
    const existingSnap = await adminDb
      .collection('budgets')
      .where('user_id', '==', user.uid)
      .where('month', '==', parsed.data.month)
      .where('category', '==', parsed.data.category)
      .limit(1)
      .get()

    let docId: string

    if (!existingSnap.empty) {
      docId = existingSnap.docs[0].id
      await adminDb.collection('budgets').doc(docId).update({ budget_amount: parsed.data.budget_amount })
    } else {
      const ref = await adminDb.collection('budgets').add({
        user_id: user.uid,
        ...parsed.data,
        created_at: new Date().toISOString(),
      })
      docId = ref.id
    }

    const doc = await adminDb.collection('budgets').doc(docId).get()
    return NextResponse.json({ data: { id: doc.id, ...doc.data() } })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
