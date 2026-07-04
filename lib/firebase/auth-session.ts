import { cookies } from 'next/headers'
import { adminAuth } from './admin'

const SESSION_COOKIE_NAME = '__session'
const SESSION_EXPIRY = 60 * 60 * 24 * 14 * 1000 // 14 days

export async function createSessionCookie(idToken: string) {
  const sessionCookie = await adminAuth.createSessionCookie(idToken, {
    expiresIn: SESSION_EXPIRY,
  })
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_EXPIRY / 1000,
    path: '/',
  })
}

export async function getSessionUser() {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value
    if (!sessionCookie) return null

    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true)
    return decoded
  } catch {
    // Firebase Admin init failure or invalid session — treat as unauthenticated
    return null
  }
}

export async function clearSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}
