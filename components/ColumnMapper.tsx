'use client'

import { ColumnMapping } from '@/types'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'

interface ColumnMapperProps {
  headers: string[]
  mapping: ColumnMapping
  onChange: (mapping: ColumnMapping) => void
  preview: Record<string, unknown>[]
}

const FIELDS: { key: keyof ColumnMapping; label: string; required?: boolean }[] = [
  { key: 'date', label: '날짜', required: true },
  { key: 'description', label: '적요 / 내용', required: true },
  { key: 'amount', label: '금액 (통합)' },
  { key: 'income', label: '입금액' },
  { key: 'expense', label: '출금액' },
  { key: 'type', label: '입출금 구분' },
]

export default function ColumnMapper({ headers, mapping, onChange, preview }: ColumnMapperProps) {
  function setField(key: keyof ColumnMapping, value: string | null) {
    onChange({ ...mapping, [key]: value === '__none__' ? null : value })
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 mb-6">
        {FIELDS.map(field => (
          <div key={field.key} className="space-y-1.5">
            <Label className="text-xs text-[#374151]">
              {field.label}
              {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </Label>
            <Select
              value={mapping[field.key] ?? '__none__'}
              onValueChange={v => v && setField(field.key, v)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="컬럼 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" className="text-xs text-[#6B7280]">선택 안함</SelectItem>
                {headers.map((h, idx) => {
                  const sample = preview.length > 0 ? String(preview[0][h] ?? '').trim() : ''
                  const isGeneric = /^컬럼\d+$/.test(h)
                  return (
                    <SelectItem key={idx} value={h} className="text-xs">
                      <span>{h}</span>
                      {isGeneric && sample && (
                        <span className="ml-1.5 text-[#9CA3AF] truncate max-w-[140px] inline-block align-bottom">
                          {sample.length > 18 ? sample.slice(0, 18) + '…' : sample}
                        </span>
                      )}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      {preview.length > 0 && (
        <div>
          <p className="text-xs font-medium text-[#6B7280] mb-2">미리보기 (최대 5행)</p>
          <div className="overflow-x-auto">
            <table className="text-xs w-full border-collapse">
              <thead>
                <tr className="border-b border-[#E5E7EB]">
                  {headers.map((h, idx) => {
                    const mappedAs = (Object.entries(mapping) as [string, string | null][]).find(([, v]) => v === h)?.[0]
                    const fieldLabel = mappedAs ? FIELDS.find(f => f.key === mappedAs as keyof ColumnMapping)?.label : null
                    return (
                      <th key={idx} className="text-left px-2 py-1.5 whitespace-nowrap">
                        <span className="text-[#6B7280] font-medium">{h}</span>
                        {fieldLabel && (
                          <span className="ml-1 text-[#2563EB] font-normal">→ {fieldLabel}</span>
                        )}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-b border-[#F3F4F6]">
                    {headers.map((h, idx) => (
                      <td key={idx} className="px-2 py-1.5 text-[#374151] whitespace-nowrap max-w-[150px] overflow-hidden text-ellipsis">
                        {String(row[h] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
