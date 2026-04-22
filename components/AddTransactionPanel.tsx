'use client'

import { useState, useEffect, useRef } from 'react'
import { CATEGORIES, Category } from '@/types'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

const TYPE_OPTIONS = [
  { value: 'expense', label: '지출' },
  { value: 'income', label: '수입' },
  { value: 'transfer', label: '이체' },
]

export default function AddTransactionPanel({ open, onClose, onSaved }: Props) {
  const [txType, setTxType] = useState<'expense' | 'income' | 'transfer'>('expense')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<Category>('기타')
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const amountRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setTxType('expense')
      setDate(format(new Date(), 'yyyy-MM-dd'))
      setDescription('')
      setAmount('')
      setCategory('기타')
      setMemo('')
      setError('')
      setTimeout(() => amountRef.current?.focus(), 100)
    }
  }, [open])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  async function handleSave() {
    const amt = parseFloat(amount.replace(/,/g, ''))
    if (!description.trim()) { setError('적요를 입력해주세요'); return }
    if (isNaN(amt) || amt <= 0) { setError('금액을 올바르게 입력해주세요'); return }
    if (!date) { setError('날짜를 입력해주세요'); return }

    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_date: date,
          description: description.trim(),
          amount: amt,
          type: txType,
          category,
          memo: memo.trim() || null,
          merchant_name: null,
        }),
      })
      if (!res.ok) throw new Error()
      onSaved()
      onClose()
    } catch {
      setError('저장에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/20 z-40 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div className={`
        fixed top-0 right-0 h-full w-80 bg-white border-l border-[#E5E7EB] z-50
        shadow-xl flex flex-col
        transition-transform duration-250 ease-out
        ${open ? 'translate-x-0' : 'translate-x-full'}
      `}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB]">
          <h2 className="text-sm font-semibold text-[#111111]">거래 추가</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#9CA3AF] hover:text-[#111111] hover:bg-[#F3F4F6] transition-colors text-lg"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {/* Type toggle */}
          <div>
            <label className="text-xs text-[#6B7280] mb-1.5 block">유형</label>
            <div className="flex border border-[#E5E7EB] rounded-lg overflow-hidden">
              {TYPE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setTxType(opt.value as typeof txType)}
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${
                    txType === opt.value
                      ? opt.value === 'income' ? 'bg-[#16A34A] text-white'
                        : opt.value === 'expense' ? 'bg-[#111111] text-white'
                        : 'bg-[#6B7280] text-white'
                      : 'text-[#6B7280] hover:bg-[#F3F4F6]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="text-xs text-[#6B7280] mb-1.5 block">금액</label>
            <div className="relative">
              <Input
                ref={amountRef}
                type="number"
                placeholder="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
                className="h-10 text-base font-semibold num pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#9CA3AF]">원</span>
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="text-xs text-[#6B7280] mb-1.5 block">날짜</label>
            <Input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-[#6B7280] mb-1.5 block">적요</label>
            <Input
              placeholder="거래처 또는 내용"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-xs text-[#6B7280] mb-1.5 block">카테고리</label>
            <Select value={category} onValueChange={v => v && setCategory(v as Category)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => (
                  <SelectItem key={c} value={c} className="text-sm">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Memo */}
          <div>
            <label className="text-xs text-[#6B7280] mb-1.5 block">메모 <span className="text-[#D1D5DB]">(선택)</span></label>
            <Input
              placeholder="메모 입력..."
              value={memo}
              onChange={e => setMemo(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#E5E7EB]">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-9 text-sm bg-[#111111] hover:bg-[#333333] text-white"
          >
            {saving ? '저장 중...' : '저장'}
          </Button>
        </div>
      </div>
    </>
  )
}
