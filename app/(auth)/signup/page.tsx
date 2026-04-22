'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setDone(true)
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-bold text-[#111111] tracking-tight mb-8">Yenom</h1>
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-8">
            <div className="w-12 h-12 rounded-full bg-[#DCFCE7] flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <p className="text-base font-semibold text-[#111111] mb-2">이메일을 확인해주세요</p>
            <p className="text-sm text-[#6B7280]">
              <span className="font-medium text-[#111111]">{email}</span>로<br />
              인증 링크를 보냈습니다.<br />
              메일의 링크를 클릭하면 로그인할 수 있습니다.
            </p>
            <button
              onClick={() => router.push('/login')}
              className="mt-6 text-sm text-[#2563EB] hover:underline"
            >
              로그인 페이지로 이동
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#111111] tracking-tight">Yenom</h1>
          <p className="text-sm text-[#6B7280] mt-1">내 돈의 흐름을 번역하는 가계부</p>
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-xl p-6">
          <h2 className="text-base font-semibold mb-5">회원가입</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm text-[#374151]">이메일</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="email@example.com"
                required
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm text-[#374151]">비밀번호</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="6자 이상"
                required
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm" className="text-sm text-[#374151]">비밀번호 확인</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                className="h-9 text-sm"
              />
            </div>

            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-9 bg-[#111111] hover:bg-[#333333] text-white text-sm"
            >
              {loading ? '가입 중...' : '가입하기'}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-[#6B7280] mt-4">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="text-[#2563EB] hover:underline">
            로그인
          </Link>
        </p>
      </div>
    </div>
  )
}
