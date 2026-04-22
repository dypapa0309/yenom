'use client'

import { useCallback, useState } from 'react'

interface UploadDropzoneProps {
  onFile: (file: File) => void
  loading?: boolean
}

export default function UploadDropzone({ onFile, loading }: UploadDropzoneProps) {
  const [dragging, setDragging] = useState(false)

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }, [onFile])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFile(file)
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      className={`
        border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
        ${dragging ? 'border-[#2563EB] bg-blue-50' : 'border-[#D1D5DB] bg-white hover:border-[#9CA3AF]'}
        ${loading ? 'opacity-50 pointer-events-none' : ''}
      `}
    >
      <input
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        id="file-upload"
        onChange={handleChange}
        disabled={loading}
      />
      <label htmlFor="file-upload" className="cursor-pointer">
        <div className="w-10 h-10 bg-[#F3F4F6] rounded-lg flex items-center justify-center mx-auto mb-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <p className="text-sm font-medium text-[#111111] mb-1">
          {loading ? '파일 처리 중...' : '파일을 드래그하거나 클릭해서 선택하세요'}
        </p>
        <p className="text-xs text-[#6B7280]">.xlsx, .xls, .csv 지원</p>
      </label>
    </div>
  )
}
