'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import UploadDropzone from '@/components/UploadDropzone'
import ColumnMapper from '@/components/ColumnMapper'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ColumnMapping } from '@/types'
import { isMappingComplete } from '@/lib/parsing/column-detector'
import { formatDate } from '@/lib/utils/format'

type Step = 'upload' | 'password' | 'mapping' | 'importing' | 'done'

interface UploadRecord {
  id: string
  filename: string
  uploaded_at: string
  source_type: string
}

export default function UploadPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [preview, setPreview] = useState<Record<string, unknown>[]>([])
  const [mapping, setMapping] = useState<ColumnMapping>({
    date: null, description: null, amount: null,
    income: null, expense: null, type: null, bankCategory: null,
  })
  const [result, setResult] = useState<{ count: number; skipped?: boolean } | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [password, setPassword] = useState('')
  const passwordRef = useRef<HTMLInputElement>(null)

  const [uploads, setUploads] = useState<UploadRecord[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchUploads = useCallback(async () => {
    const res = await fetch('/api/uploads')
    const data = await res.json()
    setUploads(data.data ?? [])
  }, [])

  useEffect(() => { fetchUploads() }, [fetchUploads])

  async function handleFile(f: File, pw?: string) {
    setFile(f)
    setLoading(true)
    setError('')

    const formData = new FormData()
    formData.append('file', f)
    if (pw) formData.append('password', pw)

    try {
      const res = await fetch('/api/upload/preview', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.status === 422 && data.error === 'password_required') {
        if (pw) {
          // 비밀번호가 틀렸음
          setError('비밀번호가 올바르지 않습니다.')
        }
        setStep('password')
        setTimeout(() => passwordRef.current?.focus(), 50)
        return
      }
      if (!res.ok) throw new Error(data.error)
      setHeaders(data.headers)
      setPreview(data.preview)
      setMapping(data.mapping)
      setStep('mapping')
    } catch {
      setError('파일 파싱에 실패했습니다. 파일 형식을 확인해주세요.')
    } finally {
      setLoading(false)
    }
  }

  async function handlePasswordSubmit() {
    if (!file || !password) return
    await handleFile(file, password)
  }

  async function handleImport() {
    if (!file) return
    setLoading(true)
    setError('')
    setStep('importing')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('mapping', JSON.stringify(mapping))
    if (password) formData.append('password', password)

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult({ count: data.count, skipped: data.skipped })
      setStep('done')
      fetchUploads()
    } catch {
      setError('업로드 중 오류가 발생했습니다.')
      setStep('mapping')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    await fetch(`/api/uploads?id=${id}`, { method: 'DELETE' })
    await fetchUploads()
    setDeletingId(null)
  }

  async function handleDeleteAll() {
    if (!confirm('모든 거래내역을 삭제하시겠습니까?')) return
    setDeletingId('all')
    await fetch('/api/uploads', { method: 'DELETE' })
    await fetchUploads()
    setDeletingId(null)
  }

  function reset() {
    setStep('upload')
    setFile(null)
    setHeaders([])
    setPreview([])
    setResult(null)
    setError('')
    setPassword('')
  }

  const complete = isMappingComplete(mapping)

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#111111] tracking-tight">거래내역 업로드</h1>
        <p className="text-sm text-[#6B7280] mt-1">은행 엑셀 파일을 업로드하면 자동으로 분류합니다</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-6 text-xs">
        {['파일 선택', '컬럼 매핑', '완료'].map((label, i) => {
          const stepIdx = { upload: 0, password: 0, mapping: 1, importing: 2, done: 2 }[step]
          const active = i <= stepIdx
          return (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && <div className="w-8 h-px bg-[#E5E7EB]" />}
              <div className={`flex items-center gap-1.5 ${active ? 'text-[#111111]' : 'text-[#9CA3AF]'}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold
                  ${active ? 'bg-[#111111] text-white' : 'bg-[#E5E7EB] text-[#9CA3AF]'}`}>
                  {i + 1}
                </div>
                <span className="font-medium">{label}</span>
              </div>
            </div>
          )
        })}
      </div>

      {error && step !== 'password' && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {step === 'upload' && <UploadDropzone onFile={f => handleFile(f)} loading={loading} />}

      {step === 'password' && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-8 text-center">
          <div className="w-10 h-10 rounded-full bg-[#FEF3C7] flex items-center justify-center mx-auto mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <p className="text-sm font-semibold text-[#111111] mb-1">비밀번호가 설정된 파일</p>
          <p className="text-xs text-[#6B7280] mb-5">{file?.name}</p>
          <div className="flex gap-2 max-w-xs mx-auto">
            <Input
              ref={passwordRef}
              type="password"
              placeholder="파일 비밀번호 입력"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
              className="h-8 text-xs"
            />
            <Button
              disabled={!password || loading}
              onClick={handlePasswordSubmit}
              className="h-8 text-xs bg-[#111111] hover:bg-[#333333] text-white whitespace-nowrap"
            >
              {loading ? '확인 중...' : '열기'}
            </Button>
          </div>
          {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
          <button onClick={reset} className="text-xs text-[#9CA3AF] mt-4 hover:text-[#6B7280]">
            다른 파일 선택
          </button>
        </div>
      )}

      {step === 'mapping' && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
          <div className="mb-4">
            <p className="text-sm font-medium text-[#111111]">{file?.name}</p>
            <p className="text-xs text-[#6B7280] mt-0.5">
              컬럼을 올바르게 매핑해주세요. 날짜, 적요, 금액은 필수입니다.
            </p>
          </div>
          <ColumnMapper headers={headers} mapping={mapping} onChange={setMapping} preview={preview} />
          <div className="flex gap-3 mt-5">
            <Button variant="outline" onClick={reset} className="h-8 text-xs">다시 선택</Button>
            <Button
              disabled={!complete || loading}
              onClick={handleImport}
              className="h-8 text-xs bg-[#111111] hover:bg-[#333333] text-white"
            >
              {loading ? '처리 중...' : '업로드 시작'}
            </Button>
          </div>
        </div>
      )}

      {step === 'importing' && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-10 text-center">
          <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-medium text-[#111111]">거래내역을 분류하는 중...</p>
        </div>
      )}

      {step === 'done' && result && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-10 text-center">
          <div className="w-10 h-10 rounded-full bg-[#DCFCE7] flex items-center justify-center mx-auto mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <p className="text-base font-semibold text-[#111111] mb-1">
            {result.skipped ? '중복 감지됨' : `${result.count.toLocaleString()}건 완료`}
          </p>
          <p className="text-sm text-[#6B7280] mb-5">
            {result.skipped
              ? '이미 업로드된 거래내역입니다. 중복을 건너뛰었습니다.'
              : '거래내역이 자동으로 분류되었습니다'}
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={reset} className="h-8 text-xs">추가 업로드</Button>
            <Button
              onClick={() => router.push('/dashboard')}
              className="h-8 text-xs bg-[#111111] hover:bg-[#333333] text-white"
            >
              대시보드 보기
            </Button>
          </div>
        </div>
      )}

      {/* 업로드 이력 */}
      {uploads.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[#374151]">업로드 이력</h2>
            <button
              onClick={handleDeleteAll}
              disabled={deletingId === 'all'}
              className="text-xs text-red-500 hover:text-red-700 transition-colors"
            >
              {deletingId === 'all' ? '삭제 중...' : '전체 삭제'}
            </button>
          </div>
          <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
            {uploads.map((u, i) => (
              <div
                key={u.id}
                className={`flex items-center justify-between px-4 py-3 ${
                  i < uploads.length - 1 ? 'border-b border-[#F3F4F6]' : ''
                }`}
              >
                <div>
                  <p className="text-sm text-[#111111]">{u.filename}</p>
                  <p className="text-xs text-[#9CA3AF] mt-0.5">{formatDate(u.uploaded_at)}</p>
                </div>
                <button
                  onClick={() => handleDelete(u.id)}
                  disabled={deletingId === u.id}
                  className="text-xs text-[#9CA3AF] hover:text-red-500 transition-colors"
                >
                  {deletingId === u.id ? '삭제 중...' : '삭제'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
