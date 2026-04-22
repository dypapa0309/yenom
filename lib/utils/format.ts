export function formatKRW(amount: number): string {
  return `${amount < 0 ? '-' : ''}${Math.abs(amount).toLocaleString('ko-KR')}원`
}

export function formatKRWCompact(amount: number): string {
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(1)}억원`
  if (abs >= 10_000) return `${sign}${(abs / 10_000).toFixed(0)}만원`
  return `${sign}${abs.toLocaleString('ko-KR')}원`
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-')
  return `${year}년 ${parseInt(month)}월`
}

export function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function changeLabel(current: number, prev: number): string {
  if (prev === 0) return '+신규'
  const change = ((current - prev) / prev) * 100
  return `${change >= 0 ? '+' : ''}${Math.round(change)}%`
}
