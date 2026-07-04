import { initializeApp, getApps, cert, type App } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

function getApp(): App {
  if (getApps().length > 0) return getApps()[0]

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin credentials not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.')
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
  })
}

export const adminAuth: Auth = new Proxy({} as Auth, {
  get(_, prop) {
    return (getAuth(getApp()) as unknown as Record<string | symbol, unknown>)[prop]
  },
})

export const adminDb: Firestore = new Proxy({} as Firestore, {
  get(_, prop) {
    return (getFirestore(getApp()) as unknown as Record<string | symbol, unknown>)[prop]
  },
})
