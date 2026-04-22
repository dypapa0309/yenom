'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CATEGORIES } from '@/types'

interface InviteInfo {
  invite: { id: string; household_id: string; status: string; created_at: string; invited_by: string }
  household: { name: string }
}

function InviteContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')

  const [info, setInfo] = useState<InviteInfo | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token) { setError('초대 링크가 올바르지 않습니다.'); setLoading(false); return }
    fetch(`/api/household/invite?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setInfo(d.data)
      })
      .catch(() => setError('초대 정보를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [token])

  async function accept() {
    setAccepting(true)
    const res = await fetch('/api/household/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    const d = await res.json()
    if (d.error) {
      setError(d.error)
      setAccepting(false)
    } else {
      setDone(true)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
        <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-8 max-w-sm w-full mx-4 text-center space-y-4">
          <div className="text-3xl font-bold text-[#111111]">Yenom</div>
          <p className="text-sm font-semibold text-[#111111]">가족 그룹에 합류했습니다</p>
          <p className="text-xs text-[#6B7280]">설정에서 공유할 카테고리를 선택할 수 있습니다.</p>
          <Button onClick={() => router.push('/dashboard')} className="w-full bg-[#111111] hover:bg-[#333333] text-white text-sm">
            대시보드로 이동
          </Button>
        </div>
      </div>
    )
  }

  if (error || !info) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-8 max-w-sm w-full mx-4 text-center space-y-4">
          <div className="text-3xl font-bold text-[#111111]">Yenom</div>
          <p className="text-sm text-red-500">{error || '유효하지 않은 초대 링크입니다.'}</p>
          <Button onClick={() => router.push('/dashboard')} variant="outline" className="w-full text-sm">
            대시보드로 이동
          </Button>
        </div>
      </div>
    )
  }

  const invitedAt = new Date(info.invite.created_at).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-8 max-w-sm w-full mx-4 space-y-6">
        <div className="text-center space-y-1">
          <div className="text-3xl font-bold text-[#111111]">Yenom</div>
          <p className="text-xs text-[#9CA3AF]">가족 가계부 초대</p>
        </div>

        <div className="bg-[#F9FAFB] rounded-xl p-4 space-y-1">
          <p className="text-xs text-[#6B7280]">초대받은 그룹</p>
          <p className="text-sm font-semibold text-[#111111]">{info.household.name}</p>
          <p className="text-xs text-[#9CA3AF]">{invitedAt} 생성</p>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-[#374151] font-medium">합류하면 공유되는 카테고리</p>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map(c => (
              <span key={c} className="text-xs px-2 py-0.5 bg-[#F3F4F6] rounded text-[#374151]">{c}</span>
            ))}
          </div>
          <p className="text-xs text-[#9CA3AF]">설정에서 카테고리별로 공유 범위를 변경할 수 있습니다.</p>
        </div>

        <div className="space-y-2">
          <Button onClick={accept} disabled={accepting} className="w-full bg-[#111111] hover:bg-[#333333] text-white text-sm">
            {accepting ? '처리 중...' : '초대 수락'}
          </Button>
          <Button onClick={() => router.push('/dashboard')} variant="outline" className="w-full text-sm">
            거절
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function InvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
        <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <InviteContent />
    </Suspense>
  )
}
