'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createUserWithEmailAndPassword, sendEmailVerification, signInWithPopup, GoogleAuthProvider } from 'firebase/auth'
import { getClientAuth } from '@/lib/firebase/config'
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

  async function handleGoogleSignIn() {
    setError('')
    setLoading(true)
    try {
      const provider = new GoogleAuthProvider()
      const cred = await signInWithPopup(getClientAuth(), provider)
      const idToken = await cred.user.getIdToken()

      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      })

      if (!res.ok) throw new Error('Session creation failed')

      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Google 로그인에 실패했습니다.')
      setLoading(false)
    }
  }

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

    try {
      const cred = await createUserWithEmailAndPassword(getClientAuth(), email, password)
      await sendEmailVerification(cred.user)
      setDone(true)
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err) {
        const code = (err as { code: string }).code
        if (code === 'auth/email-already-in-use') {
          setError('이미 사용 중인 이메일입니다.')
        } else if (code === 'auth/weak-password') {
          setError('비밀번호가 너무 약합니다.')
        } else {
          setError('회원가입에 실패했습니다.')
        }
      } else {
        setError('회원가입에 실패했습니다.')
      }
      setLoading(false)
    }
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

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#E5E7EB]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-2 text-xs text-[#9CA3AF]">또는</span>
            </div>
          </div>

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full h-9 flex items-center justify-center gap-2 border border-[#E5E7EB] rounded-md text-sm text-[#374151] hover:bg-[#F9FAFB] transition-colors disabled:opacity-50"
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google로 가입하기
          </button>
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
