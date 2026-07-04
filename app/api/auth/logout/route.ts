import { NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/firebase/auth-session'

export async function POST() {
  await clearSessionCookie()
  return NextResponse.json({ ok: true })
}
