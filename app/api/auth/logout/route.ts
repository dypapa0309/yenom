import { NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/firebase/auth-session'

export async function POST() {
  try {
    await clearSessionCookie()
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
