import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function Home() {
  // Firebase Admin 로드 없이 쿠키만 체크하여 리다이렉트 결정
  // (실제 세션 검증은 middleware + 각 페이지에서 수행)
  const cookieStore = await cookies()
  const hasSession = cookieStore.get('__session')?.value

  if (hasSession) {
    redirect('/dashboard')
  }

  redirect('/login')
}
