import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enrichWithKakao } from '@/lib/categorization/kakao-classifier'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.KAKAO_REST_API_KEY) {
    return NextResponse.json({ error: 'Kakao API key not configured' }, { status: 503 })
  }

  // Fetch all 기타 expense transactions for this user
  const { data: txs, error } = await supabase
    .from('transactions')
    .select('id, merchant_name, description')
    .eq('user_id', user.id)
    .eq('category', '기타')
    .eq('type', 'expense')
    .eq('excluded', false)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!txs || txs.length === 0) return NextResponse.json({ updated: 0 })

  const kakaoMap = await enrichWithKakao(txs)

  if (kakaoMap.size === 0) return NextResponse.json({ updated: 0 })

  // Batch update
  const updates = Array.from(kakaoMap.entries()).map(([id, category]) =>
    supabase
      .from('transactions')
      .update({ category })
      .eq('id', id)
      .eq('user_id', user.id)
  )

  await Promise.all(updates)

  return NextResponse.json({ updated: kakaoMap.size })
}
