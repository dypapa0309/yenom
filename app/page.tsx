import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/firebase/auth-session'

export default async function Home() {
  let user = null
  try {
    user = await getSessionUser()
  } catch {
    // Firebase Admin init may fail — treat as unauthenticated
  }

  if (user) {
    redirect('/dashboard')
  } else {
    redirect('/login')
  }
}
