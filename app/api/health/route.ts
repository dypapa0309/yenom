import { NextResponse } from 'next/server'

export async function GET() {
  const checks: Record<string, string> = {}

  // 1. Env vars
  checks.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID ? 'set' : 'MISSING'
  checks.FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL ? 'set' : 'MISSING'
  checks.FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY ? `set (${process.env.FIREBASE_PRIVATE_KEY.length} chars)` : 'MISSING'
  checks.NEXT_PUBLIC_FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 'set' : 'MISSING'

  // 2. Firebase Admin init
  try {
    const { adminAuth } = await import('@/lib/firebase/admin')
    // Try a simple operation
    await adminAuth.listUsers(1)
    checks.firebaseAdmin = 'OK'
  } catch (e) {
    checks.firebaseAdmin = `ERROR: ${e instanceof Error ? e.message : String(e)}`
  }

  return NextResponse.json({ status: 'ok', checks })
}
