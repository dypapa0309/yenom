'use client'

import { useEffect, useState, useCallback, Fragment } from 'react'
import { useSearchParams } from 'next/navigation'
import { Transaction, CATEGORIES, Category } from '@/types'
import { formatKRW, formatDate } from '@/lib/utils/format'
import EmptyState from '@/components/EmptyState'
import AddTransactionPanel from '@/components/AddTransactionPanel'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { format, subMonths } from 'date-fns'

function getMonthOptions() {
  const opts = [{ value: '', label: '전체 기간' }]
  for (let i = 0; i < 12; i++) {
    const d = subMonths(new Date(), i)
    const val = format(d, 'yyyy-MM')
    opts.push({ value: val, label: format(d, 'yyyy년 M월') })
  }
  return opts
}

const TYPE_LABELS: Record<string, string> = {
  income: '수입',
  expense: '지출',
  transfer: '이체',
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const searchParams = useSearchParams()
  const [search, setSearch] = useState('')
  const [month, setMonth] = useState(() => searchParams.get('month') ?? '')
  const [category, setCategory] = useState(() => searchParams.get('category') ?? '')
  const [type, setType] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editCategory, setEditCategory] = useState<Category>('기타')
  const [editMemo, setEditMemo] = useState('')
  const [panelOpen, setPanelOpen] = useState(false)

  const pageSize = 50

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (month) params.set('month', month)
    if (category) params.set('category', category)
    if (type) params.set('type', type)
    if (search) params.set('search', search)
    params.set('page', String(page))
    params.set('pageSize', String(pageSize))

    try {
      const res = await fetch(`/api/transactions?${params}`)
      const data = await res.json()
      setTransactions(data.data ?? [])
      setTotal(data.count ?? 0)
    } catch {
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }, [month, category, type, search, page])

  useEffect(() => { fetchTransactions() }, [fetchTransactions])

  async function updateTransaction(id: string, updates: Partial<Transaction>) {
    await fetch(`/api/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    fetchTransactions()
  }

  async function saveEdit(id: string) {
    await updateTransaction(id, { category: editCategory, memo: editMemo || null })
    setEditingId(null)
  }

  function startEdit(tx: Transaction) {
    setEditingId(tx.id)
    setEditCategory(tx.category)
    setEditMemo(tx.memo ?? '')
  }

  const monthOptions = getMonthOptions()
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div>
      <AddTransactionPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onSaved={fetchTransactions}
      />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#111111] tracking-tight">거래내역</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#6B7280] num">{total.toLocaleString()}건</span>
          <a
            href={`/api/transactions/export?${new URLSearchParams({ ...(month && { month }), ...(category && { category }), ...(type && { type }), ...(search && { search }) }).toString()}`}
            download
            className="h-7 px-3 text-xs border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:text-[#111111] hover:bg-[#F3F4F6] transition-colors flex items-center"
          >
            내보내기
          </a>
          <Button
            onClick={() => setPanelOpen(true)}
            className="h-7 px-3 text-xs bg-[#111111] hover:bg-[#333333] text-white"
          >
            + 거래 추가
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <Input
          placeholder="검색..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="h-8 text-xs w-48"
        />
        <Select value={month || '__all__'} onValueChange={v => { setMonth(v === '__all__' ? '' : (v ?? '')); setPage(1) }}>
          <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {monthOptions.map(o => (
              <SelectItem key={o.value || '__all__'} value={o.value || '__all__'} className="text-xs">{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category || '__all__'} onValueChange={v => { if (v) { setCategory(v === '__all__' ? '' : v); setPage(1) } }}>
          <SelectTrigger className="h-8 text-xs w-36">
            <SelectValue placeholder="카테고리 전체" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__" className="text-xs">카테고리 전체</SelectItem>
            {CATEGORIES.map(c => (
              <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={type || '__all__'} onValueChange={v => { if (v) { setType(v === '__all__' ? '' : v); setPage(1) } }}>
          <SelectTrigger className="h-8 text-xs w-28">
            <SelectValue placeholder="전체 유형" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__" className="text-xs">전체 유형</SelectItem>
            <SelectItem value="income" className="text-xs">수입</SelectItem>
            <SelectItem value="expense" className="text-xs">지출</SelectItem>
            <SelectItem value="transfer" className="text-xs">이체</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-5 h-5 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <EmptyState
            title="거래내역이 없습니다"
            description="조건에 맞는 거래내역이 없습니다."
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#FAFAFA]">
                <th className="text-left px-4 py-2.5 text-xs text-[#6B7280] font-medium w-24">날짜</th>
                <th className="text-left px-4 py-2.5 text-xs text-[#6B7280] font-medium">적요</th>
                <th className="text-left px-4 py-2.5 text-xs text-[#6B7280] font-medium w-28">카테고리</th>
                <th className="text-right px-4 py-2.5 text-xs text-[#6B7280] font-medium w-28">금액</th>
                <th className="text-center px-4 py-2.5 text-xs text-[#6B7280] font-medium w-16">유형</th>
                <th className="text-center px-4 py-2.5 text-xs text-[#6B7280] font-medium w-16">제외</th>
                <th className="px-4 py-2.5 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => (
                <Fragment key={tx.id}>
                  <tr
                    className={`border-b border-[#F9FAFB] hover:bg-[#FAFAFA] transition-colors ${
                      tx.excluded ? 'opacity-40' : ''
                    }`}
                  >
                    <td className="px-4 py-2.5 text-xs text-[#6B7280] num whitespace-nowrap">
                      {formatDate(tx.transaction_date)}
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="text-sm text-[#111111] truncate max-w-xs">{tx.description}</p>
                      {tx.memo && (
                        <p className="text-xs text-[#9CA3AF] mt-0.5">{tx.memo}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {editingId === tx.id ? (
                        <Select value={editCategory} onValueChange={v => setEditCategory(v as Category)}>
                          <SelectTrigger className="h-6 text-xs w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map(c => (
                              <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs px-2 py-0.5 bg-[#F3F4F6] rounded text-[#374151]">
                          {tx.category}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`text-sm font-semibold num ${
                        tx.type === 'income' ? 'text-[#16A34A]' :
                        tx.type === 'expense' ? 'text-[#111111]' :
                        'text-[#6B7280]'
                      }`}>
                        {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                        {formatKRW(tx.amount)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`text-xs ${
                        tx.type === 'income' ? 'text-[#16A34A]' :
                        tx.type === 'expense' ? 'text-[#6B7280]' :
                        'text-[#9CA3AF]'
                      }`}>
                        {TYPE_LABELS[tx.type]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <Switch
                        checked={tx.excluded}
                        onCheckedChange={v => updateTransaction(tx.id, { excluded: v })}
                        className="scale-75"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {editingId === tx.id ? (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            className="h-6 text-xs px-2 bg-[#111111] hover:bg-[#333333] text-white"
                            onClick={() => saveEdit(tx.id)}
                          >
                            저장
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs px-2"
                            onClick={() => setEditingId(null)}
                          >
                            취소
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs px-2 text-[#6B7280]"
                          onClick={() => startEdit(tx)}
                        >
                          수정
                        </Button>
                      )}
                    </td>
                  </tr>
                  {editingId === tx.id && (
                    <tr className="bg-[#F9FAFB] border-b border-[#F3F4F6]">
                      <td colSpan={7} className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-[#6B7280]">메모</label>
                          <Input
                            value={editMemo}
                            onChange={e => setEditMemo(e.target.value)}
                            placeholder="메모 입력..."
                            className="h-6 text-xs max-w-sm"
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-[#6B7280] num">{total.toLocaleString()}건 중 {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              이전
            </Button>
            <span className="flex items-center text-xs text-[#6B7280] px-2">{page} / {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              다음
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
