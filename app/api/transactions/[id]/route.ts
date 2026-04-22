import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const parsed = updateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('transactions')
    .update(parsed.data)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Save user rule if category was updated
  if (parsed.data.category) {
    const tx = data
    if (tx.merchant_name || tx.description) {
      // Check existing rule
      const { data: existing } = await supabase
        .from('user_rules')
        .select('id')
        .eq('user_id', user.id)
        .eq('merchant_name', tx.merchant_name ?? tx.description.substring(0, 20))
        .maybeSingle()

      if (!existing) {
        await supabase.from('user_rules').insert({
          user_id: user.id,
          merchant_name: tx.merchant_name ?? tx.description.substring(0, 20),
          keyword: null,
          category: parsed.data.category,
        })
      } else {
        await supabase
          .from('user_rules')
          .update({ category: parsed.data.category })
          .eq('id', existing.id)
      }
    }
  }

  return NextResponse.json({ data })
}
