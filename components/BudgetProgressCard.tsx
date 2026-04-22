'use client'

import { useState } from 'react'
import { formatKRW, formatPercent } from '@/lib/utils/format'

interface BudgetProgressCardProps {
  id: string
  category: string
  spent: number
  budget: number
  onDelete: (id: string) => void
  onUpdate: (id: string, amount: number) => void
}

export default function BudgetProgressCard({
  id, category, spent, budget, onDelete, onUpdate
}: BudgetProgressCardProps) {
  const usageRate = budget > 0 ? (spent / budget) * 100 : 0
  const isOver = usageRate > 100
  const isWarn = usageRate > 80 && !isOver

  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(String(budget))

  function handleSave() {
    const n = parseFloat(editValue.replace(/,/g, ''))
    if (!isNaN(n) && n > 0) onUpdate(id, n)
    setEditing(false)
  }

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 group">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-[#111111]">{category}</span>
        <div className="flex items-center gap-2">
          <span className={`text-xs num font-semibold ${isOver ? 'text-red-500' : isWarn ? 'text-orange-500' : 'text-[#6B7280]'}`}>
            {formatPercent(Math.min(usageRate, 999))}
          </span>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => { setEditing(true); setEditValue(String(budget)) }}
              className="text-[10px] text-[#6B7280] hover:text-[#2563EB] px-1"
            >
              수정
            </button>
            <button
              onClick={() => onDelete(id)}
              className="text-[10px] text-[#6B7280] hover:text-red-500 px-1"
            >
              삭제
            </button>
          </div>
        </div>
      </div>

      <div className="h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all ${isOver ? 'bg-red-500' : isWarn ? 'bg-orange-400' : 'bg-[#2563EB]'}`}
          style={{ width: `${Math.min(usageRate, 100)}%` }}
        />
      </div>

      {editing ? (
        <div className="flex items-center gap-1.5 mt-1">
          <input
            className="border border-[#E5E7EB] rounded px-2 py-0.5 text-xs w-28 num"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
            autoFocus
          />
          <button onClick={handleSave} className="text-xs text-[#2563EB] hover:underline">저장</button>
          <button onClick={() => setEditing(false)} className="text-xs text-[#9CA3AF] hover:underline">취소</button>
        </div>
      ) : (
        <div className="flex justify-between text-xs text-[#6B7280] num">
          <span>{formatKRW(spent)}</span>
          <span>{formatKRW(budget)}</span>
        </div>
      )}

      {isOver && !editing && (
        <p className="text-xs text-red-500 mt-1.5 font-medium">{formatKRW(spent - budget)} 초과</p>
      )}
    </div>
  )
}
