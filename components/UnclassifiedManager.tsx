'use client'

import { useState } from 'react'
import { CATEGORIES, Category, Transaction } from '@/types'
import { formatKRW } from '@/lib/utils/format'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

interface MerchantGroup {
  key: string
  count: number
  total: number
  ids: string[]
}

interface Props {
  transactions: Transaction[]
  onReclassified: () => void
}

export default function UnclassifiedManager({ transactions, onReclassified }: Props) {
  const unclassified = transactions.filter(t => t.category === '기타' && t.type === 'expense' && !t.excluded)

  // 상호명별 그룹
  const groupMap = new Map<string, MerchantGroup>()
  for (const tx of unclassified) {
    const key = tx.merchant_name ?? tx.description.substring(0, 15)
    const existing = groupMap.get(key) ?? { key, count: 0, total: 0, ids: [] }
    existing.count++
    existing.total += tx.amount
    existing.ids.push(tx.id)
    groupMap.set(key, existing)
  }

  const groups = Array.from(groupMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 15)

  const [selections, setSelections] = useState<Record<string, Category>>({})
  const [saving, setSaving] = useState(false)
  const [reclassifying, setReclassifying] = useState(false)
  const [reclassifyResult, setReclassifyResult] = useState<number | null>(null)

  async function reclassifyWithKakao() {
    setReclassifying(true)
    setReclassifyResult(null)
    try {
      const res = await fetch('/api/transactions/reclassify', { method: 'POST' })
      const data = await res.json()
      setReclassifyResult(data.updated ?? 0)
      if ((data.updated ?? 0) > 0) onReclassified()
    } catch {
      setReclassifyResult(0)
    } finally {
      setReclassifying(false)
    }
  }

  async function applyAll() {
    setSaving(true)
    const entries = Object.entries(selections)
    for (const [key, category] of entries) {
      const group = groupMap.get(key)
      if (!group) continue
      // 같은 merchant의 모든 거래를 일괄 수정
      await Promise.all(
        group.ids.map(id =>
          fetch(`/api/transactions/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category }),
          })
        )
      )
    }
    setSaving(false)
    setSelections({})
    onReclassified()
  }

  if (groups.length === 0) return null

  const selectedCount = Object.keys(selections).length

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-[#111111]">미분류 항목 처리</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#6B7280]">기타 {unclassified.length}건</span>
          <button
            onClick={reclassifyWithKakao}
            disabled={reclassifying}
            className="text-xs text-[#2563EB] hover:underline disabled:opacity-50 disabled:no-underline"
          >
            {reclassifying ? '분류 중...' : '카카오 자동분류'}
          </button>
        </div>
      </div>
      {reclassifyResult !== null && (
        <p className="text-xs text-[#2563EB] mb-2">
          {reclassifyResult > 0 ? `${reclassifyResult}건 자동분류 완료` : '자동분류 가능한 항목이 없습니다'}
        </p>
      )}
      <p className="text-xs text-[#9CA3AF] mb-4">
        아래 항목들의 카테고리를 선택하면 동일 상호명 전체에 일괄 적용됩니다.
      </p>

      <div className="space-y-2">
        {groups.map(g => (
          <div key={g.key} className="flex items-center gap-3 py-2 border-b border-[#F3F4F6] last:border-0">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#111111] truncate">{g.key}</p>
              <p className="text-xs text-[#9CA3AF] mt-0.5 num">{g.count}건 · {formatKRW(g.total)}</p>
            </div>
            <Select
              value={selections[g.key] ?? ''}
              onValueChange={v => v && setSelections(prev => ({ ...prev, [g.key]: v as Category }))}
            >
              <SelectTrigger className={`w-32 h-7 text-xs shrink-0 ${selections[g.key] ? 'border-[#2563EB] text-[#2563EB]' : ''}`}>
                <SelectValue placeholder="카테고리" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.filter(c => c !== '기타').map(c => (
                  <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      {selectedCount > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-[#6B7280]">{selectedCount}개 항목 선택됨</span>
          <Button
            onClick={applyAll}
            disabled={saving}
            className="h-7 text-xs bg-[#111111] hover:bg-[#333333] text-white"
          >
            {saving ? '적용 중...' : '일괄 적용'}
          </Button>
        </div>
      )}
    </div>
  )
}
