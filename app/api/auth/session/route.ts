import { NextRequest, NextResponse } from 'next/server'
import { createSessionCookie } from '@/lib/firebase/auth-session'

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json()
    if (!idToken) {
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400 })
    }
    await createSessionCookie(idToken)
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Session creation failed'
    return NextResponse.json({ error: message }, { status: 401 })
  }
}
