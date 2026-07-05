'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Category } from '@/types'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'

// Category emoji mapping
const CATEGORY_ICONS: Record<string, string> = {
  '식비': '🍚',
  '카페/간식': '☕',
  '배달/외식': '🍕',
  '교통': '🚌',
  '쇼핑': '🛍️',
  '주거/관리비': '🏠',
  '통신': '📱',
  '의료/약국': '💊',
  '교육': '📚',
  '육아': '👶',
  '구독/디지털': '💻',
  '금융/보험': '🏦',
  '저축/투자': '💰',
  '여가/취미': '🎮',
  '뷰티/미용': '💄',
  '기타': '➕',
}

// Top 8 most common categories + 기타
const QUICK_CATEGORIES: Category[] = [
  '식비',
  '카페/간식',
  '배달/외식',
  '교통',
  '쇼핑',
  '주거/관리비',
  '구독/디지털',
  '여가/취미',
  '기타',
]

function formatAmountWithCommas(value: string): string {
  const digits = value.replace(/[^\d]/g, '')
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

interface QuickEntryProps {
  onSaved?: () => void
}

export default function QuickEntry({ onSaved }: QuickEntryProps) {
  const [txType, setTxType] = useState<'expense' | 'income'>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<Category>('식비')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [pastDescriptions, setPastDescriptions] = useState<string[]>([])

  const amountRef = useRef<HTMLInputElement>(null)
  const descriptionRef = useRef<HTMLInputElement>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)

  // Load past descriptions for autocomplete
  useEffect(() => {
    async function loadDescriptions() {
      try {
        const res = await fetch('/api/transactions?pageSize=200')
        const data = await res.json()
        if (data.data) {
          const descs = [...new Set(data.data.map((t: { description: string }) => t.description))] as string[]
          setPastDescriptions(descs)
        }
      } catch {
        // silently fail
      }
    }
    loadDescriptions()
  }, [])

  // Auto-focus amount on mount
  useEffect(() => {
    setTimeout(() => amountRef.current?.focus(), 100)
  }, [])

  // Filter suggestions based on description input
  useEffect(() => {
    if (description.trim().length > 0) {
      const lower = description.toLowerCase()
      const filtered = pastDescriptions.filter(d =>
        d.toLowerCase().includes(lower) && d.toLowerCase() !== lower
      ).slice(0, 5)
      setSuggestions(filtered)
      setShowSuggestions(filtered.length > 0)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }, [description, pastDescriptions])

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, '')
    setAmount(formatAmountWithCommas(raw))
  }

  const handleSave = useCallback(async () => {
    const numericAmount = parseInt(amount.replace(/,/g, ''), 10)
    if (isNaN(numericAmount) || numericAmount <= 0) return
    if (!description.trim()) return

    setSaving(true)
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_date: date,
          description: description.trim(),
          amount: numericAmount,
          type: txType,
          category,
          memo: null,
          merchant_name: null,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('거래가 추가되었습니다')
      // Clear form for next entry
      setAmount('')
      setDescription('')
      setCategory('식비')
      setTxType('expense')
      setDate(format(new Date(), 'yyyy-MM-dd'))
      onSaved?.()
      // Re-focus amount for rapid entry
      setTimeout(() => amountRef.current?.focus(), 50)
    } catch {
      toast.error('저장에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }, [amount, description, date, txType, category, onSaved])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    }
  }

  const dateLabel = date === format(new Date(), 'yyyy-MM-dd') ? '오늘' : date

  return (
    <div className="p-4 space-y-4">
      {/* Type toggle + Date */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setTxType(txType === 'expense' ? 'income' : 'expense')}
          className={`text-xs font-medium px-3 py-1 rounded-full transition-colors ${
            txType === 'expense'
              ? 'bg-[#111111] text-white'
              : 'bg-[#16A34A] text-white'
          }`}
        >
          {txType === 'expense' ? '지출' : '수입'}
        </button>
        <button
          type="button"
          onClick={() => setShowDatePicker(!showDatePicker)}
          className="text-xs text-[#6B7280] hover:text-[#111111] transition-colors"
        >
          {dateLabel}
        </button>
      </div>

      {/* Date picker (hidden by default) */}
      {showDatePicker && (
        <input
          ref={dateInputRef}
          type="date"
          value={date}
          onChange={e => { setDate(e.target.value); setShowDatePicker(false) }}
          className="w-full h-9 text-sm border border-[#E5E7EB] rounded-lg px-3"
        />
      )}

      {/* Amount input */}
      <div className="relative">
        <input
          ref={amountRef}
          type="text"
          inputMode="numeric"
          placeholder="금액"
          value={amount}
          onChange={handleAmountChange}
          onKeyDown={handleKeyDown}
          className="w-full text-3xl font-bold text-[#111111] placeholder:text-[#D1D5DB] outline-none border-b-2 border-[#E5E7EB] focus:border-[#111111] pb-2 transition-colors num"
        />
        {amount && (
          <span className="absolute right-0 bottom-3 text-sm text-[#9CA3AF]">원</span>
        )}
      </div>

      {/* Category horizontal scroll */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {QUICK_CATEGORIES.map(cat => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              category === cat
                ? 'bg-[#111111] text-white'
                : 'bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]'
            }`}
          >
            <span>{CATEGORY_ICONS[cat]}</span>
            <span>{cat}</span>
          </button>
        ))}
      </div>

      {/* Description input with autocomplete */}
      <div className="relative">
        <input
          ref={descriptionRef}
          type="text"
          placeholder="내용"
          value={description}
          onChange={e => setDescription(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onFocus={() => {
            if (suggestions.length > 0) setShowSuggestions(true)
          }}
          className="w-full h-10 text-sm text-[#111111] placeholder:text-[#9CA3AF] outline-none border border-[#E5E7EB] rounded-lg px-3 focus:border-[#111111] transition-colors"
        />
        {/* Autocomplete dropdown */}
        {showSuggestions && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#E5E7EB] rounded-lg shadow-lg z-10 overflow-hidden">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onMouseDown={() => {
                  setDescription(s)
                  setShowSuggestions(false)
                }}
                className="w-full text-left px-3 py-2 text-sm text-[#374151] hover:bg-[#F3F4F6] transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Save button */}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !amount || !description.trim()}
        className="w-full h-11 bg-[#111111] hover:bg-[#333333] disabled:bg-[#D1D5DB] text-white text-sm font-medium rounded-lg transition-colors"
      >
        {saving ? '저장 중...' : '저장'}
      </button>
    </div>
  )
}

// Wrapper component for mobile (bottom sheet) and desktop (floating card)
interface QuickEntrySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}

export function QuickEntrySheet({ open, onOpenChange, onSaved }: QuickEntrySheetProps) {
  // ESC key handler for desktop
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onOpenChange(false)
    }
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  return (
    <>
      {/* Mobile: Bottom drawer */}
      <div className="md:hidden">
        <Drawer open={open} onOpenChange={onOpenChange}>
          <DrawerContent>
            <DrawerTitle className="sr-only">빠른 거래 입력</DrawerTitle>
            <QuickEntry onSaved={onSaved} />
          </DrawerContent>
        </Drawer>
      </div>

      {/* Desktop: Fixed floating card bottom-right */}
      {open && (
        <div className="hidden md:block fixed bottom-6 right-6 w-96 bg-white border border-[#E5E7EB] rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-3 pb-0">
            <h3 className="text-sm font-semibold text-[#111111]">빠른 입력</h3>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-6 h-6 flex items-center justify-center rounded-lg text-[#9CA3AF] hover:text-[#111111] hover:bg-[#F3F4F6] transition-colors text-base"
            >
              ×
            </button>
          </div>
          <QuickEntry onSaved={onSaved} />
        </div>
      )}
    </>
  )
}
