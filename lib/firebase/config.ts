import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
}

function getApp(): FirebaseApp {
  if (getApps().length > 0) return getApps()[0]
  return initializeApp(firebaseConfig)
}

export function getClientAuth(): Auth {
  return getAuth(getApp())
}

export function getClientDb(): Firestore {
  return getFirestore(getApp())
}

// Lazy getters for backward compat
export const auth: Auth = new Proxy({} as Auth, {
  get(_, prop) {
    return (getClientAuth() as unknown as Record<string | symbol, unknown>)[prop]
  },
})

export const db: Firestore = new Proxy({} as Firestore, {
  get(_, prop) {
    return (getClientDb() as unknown as Record<string | symbol, unknown>)[prop]
  },
})

export default getApp
