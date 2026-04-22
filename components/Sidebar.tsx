'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV_ITEMS = [
  { href: '/dashboard', label: '대시보드' },
  { href: '/upload', label: '업로드' },
  { href: '/transactions', label: '거래내역' },
  { href: '/insights', label: '인사이트' },
  { href: '/budgets', label: '예산' },
  { href: '/calendar', label: '캘린더' },
  { href: '/settings', label: '설정' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="fixed inset-y-0 left-0 w-52 bg-[#FAFAFA] border-r border-[#E5E7EB] flex flex-col z-30">
      <div className="px-5 py-5 border-b border-[#E5E7EB]">
        <Link href="/dashboard" className="text-lg font-bold text-[#111111] tracking-tight hover:opacity-70 transition-opacity">Yenom</Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(item => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                block px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${isActive
                  ? 'bg-[#111111] text-white'
                  : 'text-[#374151] hover:bg-[#F3F4F6]'}
              `}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 py-4 border-t border-[#E5E7EB]">
        <button
          onClick={handleSignOut}
          className="w-full text-left px-3 py-2 text-sm text-[#6B7280] hover:text-[#111111] hover:bg-[#F3F4F6] rounded-lg transition-colors"
        >
          로그아웃
        </button>
      </div>
    </aside>
  )
}
