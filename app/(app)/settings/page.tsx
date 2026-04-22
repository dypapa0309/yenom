'use client'

import { useEffect, useState, useCallback } from 'react'
import { CATEGORIES, Category, UserRule } from '@/types'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function SettingsPage() {
  const [rules, setRules] = useState<UserRule[]>([])
  const [loading, setLoading] = useState(true)

  const [addType, setAddType] = useState<'keyword' | 'merchant'>('keyword')
  const [addText, setAddText] = useState('')
  const [addCategory, setAddCategory] = useState<Category | ''>('')
  const [adding, setAdding] = useState(false)

  const fetchRules = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/rules')
      const data = await res.json()
      setRules(data.data ?? [])
    } catch {
      setRules([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRules() }, [fetchRules])

  async function deleteRule(id: string) {
    await fetch(`/api/rules?id=${id}`, { method: 'DELETE' })
    setRules(prev => prev.filter(r => r.id !== id))
  }

  async function addRule() {
    if (!addText || !addCategory) return
    setAdding(true)
    const body = addType === 'keyword'
      ? { keyword: addText, category: addCategory }
      : { merchant_name: addText, category: addCategory }

    const res = await fetch('/api/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      setAddText('')
      setAddCategory('')
      await fetchRules()
    }
    setAdding(false)
  }

  const keywordRules = rules.filter(r => r.keyword)
  const merchantRules = rules.filter(r => r.merchant_name)

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#111111] tracking-tight mb-6">설정</h1>

      <div className="grid grid-cols-3 gap-5">
        {/* Rules list */}
        <div className="col-span-2 space-y-5">
          {/* Merchant rules */}
          <div>
            <h2 className="text-sm font-semibold text-[#374151] mb-3">상호명 규칙</h2>
            {loading ? (
              <div className="flex items-center justify-center h-16">
                <div className="w-5 h-5 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : merchantRules.length === 0 ? (
              <p className="text-sm text-[#9CA3AF] py-4 text-center bg-white border border-[#E5E7EB] rounded-xl">
                상호명 규칙이 없습니다
              </p>
            ) : (
              <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] bg-[#FAFAFA]">
                      <th className="text-left px-4 py-2 text-xs text-[#6B7280] font-medium">상호명</th>
                      <th className="text-left px-4 py-2 text-xs text-[#6B7280] font-medium">카테고리</th>
                      <th className="px-4 py-2 w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {merchantRules.map(r => (
                      <tr key={r.id} className="border-b border-[#F9FAFB] last:border-0">
                        <td className="px-4 py-2.5 text-sm text-[#111111]">{r.merchant_name}</td>
                        <td className="px-4 py-2.5">
                          <span className="text-xs px-2 py-0.5 bg-[#F3F4F6] rounded text-[#374151]">{r.category}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => deleteRule(r.id)}
                            className="text-xs text-[#9CA3AF] hover:text-red-500 transition-colors"
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Keyword rules */}
          <div>
            <h2 className="text-sm font-semibold text-[#374151] mb-3">키워드 규칙</h2>
            {!loading && keywordRules.length === 0 ? (
              <p className="text-sm text-[#9CA3AF] py-4 text-center bg-white border border-[#E5E7EB] rounded-xl">
                키워드 규칙이 없습니다
              </p>
            ) : (
              <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] bg-[#FAFAFA]">
                      <th className="text-left px-4 py-2 text-xs text-[#6B7280] font-medium">키워드</th>
                      <th className="text-left px-4 py-2 text-xs text-[#6B7280] font-medium">카테고리</th>
                      <th className="px-4 py-2 w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {keywordRules.map(r => (
                      <tr key={r.id} className="border-b border-[#F9FAFB] last:border-0">
                        <td className="px-4 py-2.5 text-sm font-mono text-[#111111]">{r.keyword}</td>
                        <td className="px-4 py-2.5">
                          <span className="text-xs px-2 py-0.5 bg-[#F3F4F6] rounded text-[#374151]">{r.category}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => deleteRule(r.id)}
                            className="text-xs text-[#9CA3AF] hover:text-red-500 transition-colors"
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Add rule panel */}
        <div className="space-y-4">
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
            <h3 className="text-sm font-semibold text-[#111111] mb-3">규칙 추가</h3>
            <div className="space-y-2.5">
              <div className="flex border border-[#E5E7EB] rounded-lg overflow-hidden text-xs">
                <button
                  onClick={() => setAddType('keyword')}
                  className={`flex-1 py-1.5 font-medium transition-colors ${addType === 'keyword' ? 'bg-[#111111] text-white' : 'text-[#6B7280] hover:bg-[#F3F4F6]'}`}
                >
                  키워드
                </button>
                <button
                  onClick={() => setAddType('merchant')}
                  className={`flex-1 py-1.5 font-medium transition-colors ${addType === 'merchant' ? 'bg-[#111111] text-white' : 'text-[#6B7280] hover:bg-[#F3F4F6]'}`}
                >
                  상호명
                </button>
              </div>
              <Input
                placeholder={addType === 'keyword' ? '포함될 키워드' : '정확한 상호명'}
                value={addText}
                onChange={e => setAddText(e.target.value)}
                className="h-8 text-xs"
                onKeyDown={e => { if (e.key === 'Enter') addRule() }}
              />
              <Select value={addCategory} onValueChange={v => v && setAddCategory(v as Category)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="카테고리 선택" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                disabled={!addText || !addCategory || adding}
                onClick={addRule}
                className="w-full h-8 text-xs bg-[#111111] hover:bg-[#333333] text-white"
              >
                {adding ? '저장 중...' : '규칙 저장'}
              </Button>
            </div>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
            <h3 className="text-sm font-semibold text-[#111111] mb-1">규칙 적용 방식</h3>
            <p className="text-xs text-[#9CA3AF] leading-relaxed">
              상호명 규칙은 정확히 일치하는 거래에 우선 적용됩니다.<br />
              키워드 규칙은 적요에 해당 단어가 포함되면 적용됩니다.<br />
              규칙은 다음 업로드부터 자동 반영됩니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
