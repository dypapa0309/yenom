import { initializeApp, getApps, cert, type App } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

function getApp(): App | null {
  if (getApps().length > 0) return getApps()[0]

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY

  if (!projectId || !clientEmail || !privateKey) {
    console.warn('Firebase Admin credentials not configured.')
    return null
  }

  try {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    })
  } catch (e) {
    console.error('Firebase Admin init failed:', e)
    return null
  }
}

export const adminAuth: Auth = new Proxy({} as Auth, {
  get(_, prop) {
    const app = getApp()
    if (!app) throw new Error('Firebase Admin not initialized')
    return (getAuth(app) as unknown as Record<string | symbol, unknown>)[prop]
  },
})

export const adminDb: Firestore = new Proxy({} as Firestore, {
  get(_, prop) {
    const app = getApp()
    if (!app) throw new Error('Firebase Admin not initialized')
    return (getFirestore(app) as unknown as Record<string | symbol, unknown>)[prop]
  },
})
