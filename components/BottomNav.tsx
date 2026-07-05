'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Home,
  List,
  Plus,
  PieChart,
  Menu,
  BarChart3,
  Receipt,
  Upload,
  Calendar,
  Settings,
  LogOut,
} from 'lucide-react'
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer'
import { QuickEntrySheet } from '@/components/QuickEntry'

const PRIMARY_TABS = [
  { href: '/dashboard', label: '대시보드', icon: Home },
  { href: '/transactions', label: '거래내역', icon: List },
  { href: '/upload', label: '추가', icon: Plus, isFab: true },
  { href: '/budgets', label: '예산', icon: PieChart },
  { href: '__more__', label: '더보기', icon: Menu },
]

const MORE_ITEMS = [
  { href: '/insights', label: '인사이트', icon: BarChart3 },
  { href: '/tax', label: '절세', icon: Receipt },
  { href: '/upload', label: '업로드', icon: Upload },
  { href: '/calendar', label: '캘린더', icon: Calendar },
  { href: '/settings', label: '설정', icon: Settings },
]

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [quickEntryOpen, setQuickEntryOpen] = useState(false)

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  // Check if the "more" section is active
  const moreHrefs = MORE_ITEMS.map((item) => item.href)
  const isMoreActive = moreHrefs.some((href) => pathname.startsWith(href) && href !== '/upload')

  return (
    <>
      <QuickEntrySheet open={quickEntryOpen} onOpenChange={setQuickEntryOpen} />
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#E5E7EB] md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-center justify-around h-16 px-2">
          {PRIMARY_TABS.map((tab) => {
            if (tab.isFab) {
              return (
                <button
                  key="fab"
                  onClick={() => setQuickEntryOpen(true)}
                  className="flex items-center justify-center w-12 h-12 -mt-4 rounded-full bg-[#111111] text-white shadow-lg active:scale-95 transition-transform"
                >
                  <Plus className="w-6 h-6" />
                </button>
              )
            }

            if (tab.href === '__more__') {
              const isActive = isMoreActive || drawerOpen
              return (
                <Drawer key={tab.href} open={drawerOpen} onOpenChange={setDrawerOpen}>
                  <DrawerTrigger asChild>
                    <button
                      className={`flex flex-col items-center justify-center gap-0.5 min-w-[48px] py-1 ${
                        isActive ? 'text-[#111111] font-bold' : 'text-[#9CA3AF]'
                      }`}
                    >
                      <tab.icon className="w-5 h-5" />
                      <span className="text-[10px]">{tab.label}</span>
                    </button>
                  </DrawerTrigger>
                  <DrawerContent>
                    <DrawerHeader>
                      <DrawerTitle>더보기</DrawerTitle>
                    </DrawerHeader>
                    <div className="px-4 pb-6 space-y-1">
                      {MORE_ITEMS.map((item) => {
                        const isItemActive = pathname.startsWith(item.href)
                        return (
                          <DrawerClose key={item.href} asChild>
                            <Link
                              href={item.href}
                              className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-colors ${
                                isItemActive
                                  ? 'bg-[#111111] text-white font-medium'
                                  : 'text-[#374151] hover:bg-[#F3F4F6]'
                              }`}
                            >
                              <item.icon className="w-5 h-5" />
                              {item.label}
                            </Link>
                          </DrawerClose>
                        )
                      })}
                      <DrawerClose asChild>
                        <button
                          onClick={handleSignOut}
                          className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-[#6B7280] hover:bg-[#F3F4F6] w-full transition-colors"
                        >
                          <LogOut className="w-5 h-5" />
                          로그아웃
                        </button>
                      </DrawerClose>
                    </div>
                  </DrawerContent>
                </Drawer>
              )
            }

            const isActive = pathname.startsWith(tab.href)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center justify-center gap-0.5 min-w-[48px] py-1 ${
                  isActive ? 'text-[#111111] font-bold' : 'text-[#9CA3AF]'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span className="text-[10px]">{tab.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
