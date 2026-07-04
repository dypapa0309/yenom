import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/firebase/auth-session'
import Sidebar from '@/components/Sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()

  if (!user) redirect('/login')

  return (
    <div className="flex min-h-screen bg-[#FAFAFA]">
      <Sidebar />
      <main className="flex-1 ml-52 min-h-screen">
        <div className="max-w-6xl mx-auto px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  )
}
