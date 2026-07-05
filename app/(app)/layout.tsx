import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/firebase/auth-session'
import Sidebar from '@/components/Sidebar'
import BottomNav from '@/components/BottomNav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()

  if (!user) redirect('/login')

  return (
    <div className="flex min-h-screen bg-[#FAFAFA]">
      <Sidebar />
      <main className="flex-1 md:ml-52 min-h-screen pb-20 md:pb-0">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 md:py-6">
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
