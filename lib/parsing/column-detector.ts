import { ColumnMapping } from '@/types'

const DATE_PATTERNS = ['거래일시', '처리일시', '날짜', '거래일', '일자', '처리일', 'date', '거래날짜', '입출금일', '일시', '거래시간']
const DESCRIPTION_PATTERNS = ['내용', '적요', '거래내용', '상세내용', 'description', '거래적요', '이용상점', '가맹점', '거래내역', '내역', '사용내역', '주요내용']
const AMOUNT_PATTERNS = ['거래금액', '금액', 'amount', '합계금액', '거래액']
const INCOME_PATTERNS = ['입금액', '입금금액', '수입금액', '들어온금액', '입금', '수입액']
const EXPENSE_PATTERNS = ['출금액', '출금금액', '지출금액', '나간금액', '출금', '지출액', '사용금액']
// '구분'은 카카오뱅크의 입출금 구분 컬럼 — '거래구분'보다 먼저 매칭돼야 함
const TYPE_PATTERNS = ['입출금구분', '유형', 'type']
// 단독 '구분'은 TYPE 전용 (더 넓게 매칭하되 BANK_CATEGORY보다 우선)
const TYPE_EXACT = ['구분', '입출금']
// 은행 자체 거래 분류 (이동이체, 체크카드결제, 자동납부 등)
const BANK_CATEGORY_PATTERNS = ['거래구분', '거래유형', '거래종류', '이용구분', '처리구분', '거래종류명']

function normalize(s: string): string {
  return s.replace(/\s/g, '').toLowerCase()
}

function matchesAny(col: string, patterns: string[]): boolean {
  const norm = normalize(col)
  return patterns.some(p => norm.includes(normalize(p)))
}

function matchesExact(col: string, patterns: string[]): boolean {
  const norm = normalize(col)
  return patterns.some(p => norm === normalize(p))
}

export function detectColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    date: null,
    description: null,
    amount: null,
    income: null,
    expense: null,
    type: null,
    bankCategory: null,
  }

  for (const header of headers) {
    if (!mapping.date && matchesAny(header, DATE_PATTERNS)) {
      mapping.date = header
    } else if (!mapping.bankCategory && matchesAny(header, BANK_CATEGORY_PATTERNS)) {
      // 거래구분 → bankCategory (이동이체, 체크카드결제 등)
      mapping.bankCategory = header
    } else if (!mapping.description && matchesAny(header, DESCRIPTION_PATTERNS)) {
      mapping.description = header
    } else if (!mapping.income && matchesAny(header, INCOME_PATTERNS)) {
      mapping.income = header
    } else if (!mapping.expense && matchesAny(header, EXPENSE_PATTERNS)) {
      mapping.expense = header
    } else if (!mapping.amount && matchesAny(header, AMOUNT_PATTERNS)) {
      mapping.amount = header
    } else if (!mapping.type && (matchesExact(header, TYPE_EXACT) || matchesAny(header, TYPE_PATTERNS))) {
      mapping.type = header
    }
  }

  return mapping
}

export function isMappingComplete(mapping: ColumnMapping): boolean {
  const hasDate = !!mapping.date
  const hasDescription = !!mapping.description
  const hasAmount = !!mapping.amount || (!!mapping.income && !!mapping.expense)
  return hasDate && hasDescription && hasAmount
}

// 제네릭 컬럼명(컬럼N)일 때 실제 데이터 값으로 컬럼 타입 추론
export function detectColumnsByData(headers: string[], rows: Record<string, unknown>[]): ColumnMapping {
  const mapping: ColumnMapping = { date: null, description: null, amount: null, income: null, expense: null, type: null, bankCategory: null }
  if (rows.length === 0) return mapping

  const isDateValue = (v: unknown): boolean => {
    if (v instanceof Date) return true
    const s = String(v ?? '').trim()
    return /^\d{4}[-\/\.]\d{2}[-\/\.]\d{2}/.test(s) || /^\d{4}-\d{2}-\d{2}T/.test(s)
  }
  const isNumericValue = (v: unknown): boolean => {
    if (typeof v === 'number') return true
    const s = String(v ?? '').trim().replace(/,/g, '').replace(/원/g, '')
    return s !== '' && !isNaN(Number(s))
  }
  const isTextValue = (v: unknown): boolean => {
    const s = String(v ?? '').trim()
    return s.length >= 2 && /[가-힣a-zA-Z]/.test(s) && !/^\d/.test(s)
  }
  const isLongNumber = (v: unknown): boolean => /^\d{8,}$/.test(String(v ?? '').trim())
  const isTypeValue = (v: unknown): boolean => {
    const s = String(v ?? '').trim()
    if (['체크', '이체', '이자', 'CC', '입금', '출금', '수입', '지출', 'CR', 'DR'].includes(s)) return true
    if (['이체', '뱅킹', '카드', '결제', '자동납부', '취소'].some(k => s.includes(k))) return true
    return false
  }

  const colScores: Record<string, { date: number; income: number; expense: number; desc: number; type: number; accountNo: number }> = {}

  for (const h of headers) {
    colScores[h] = { date: 0, income: 0, expense: 0, desc: 0, type: 0, accountNo: 0 }
    let nonEmpty = 0
    let incomeCandidate = true  // all positive or zero
    let expenseCandidate = true  // all positive or zero (separate from income)

    for (const row of rows) {
      const v = row[h]
      const s = String(v ?? '').trim()
      if (!s) continue
      nonEmpty++

      if (isDateValue(v)) colScores[h].date++
      if (isNumericValue(v) && !isDateValue(v)) {
        const n = Number(String(v).replace(/,/g, ''))
        if (!isNaN(n) && n >= 0) {
          // Could be income or expense — scored separately below
        }
      }
      if (isTextValue(v) && !isDateValue(v) && !isLongNumber(v) && !isTypeValue(v)) colScores[h].desc++
      if (isTypeValue(v)) colScores[h].type++
      if (isLongNumber(v)) colScores[h].accountNo++
    }

    // Income/expense: numeric col where some rows are 0 and others are positive
    if (nonEmpty > 0) {
      const nums = rows.map(r => {
        const n = Number(String(r[h] ?? '').replace(/,/g, '').replace(/원/g, ''))
        return isNaN(n) ? null : n
      }).filter(n => n !== null) as number[]
      const hasPositive = nums.some(n => n > 0)
      const hasZero = nums.some(n => n === 0)
      const allNonNeg = nums.every(n => n >= 0)
      if (hasPositive && hasZero && allNonNeg) {
        colScores[h].income = nums.filter(n => n > 0).length
        colScores[h].expense = nums.filter(n => n > 0).length
      }
    }
  }

  // 날짜 컬럼 선택 (date 점수 가장 높은 것)
  const dateCol = headers.reduce((best, h) => colScores[h].date > (colScores[best]?.date ?? -1) ? h : best, '')
  if (dateCol && colScores[dateCol].date > 0) mapping.date = dateCol

  // account number, type 컬럼 제외 후 text 컬럼에서 description 선택
  const descCol = headers
    .filter(h => h !== dateCol && colScores[h].accountNo === 0)
    .reduce((best, h) => colScores[h].desc > (colScores[best]?.desc ?? -1) ? h : best, '')
  if (descCol && colScores[descCol].desc > 0) mapping.description = descCol

  // type 컬럼
  const typeCol = headers
    .filter(h => h !== dateCol && h !== descCol)
    .reduce((best, h) => colScores[h].type > (colScores[best]?.type ?? -1) ? h : best, '')
  if (typeCol && colScores[typeCol].type > 0) mapping.bankCategory = typeCol

  const toNum = (v: unknown) => {
    const n = Number(String(v ?? '').replace(/,/g, '').replace(/원/g, ''))
    return isNaN(n) ? 0 : n
  }

  // income/expense 후보: 양수값과 0이 섞인 컬럼 (컬럼 순서 유지)
  const numericCols = headers
    .map((h, idx) => ({ h, idx }))
    .filter(({ h }) =>
      h !== dateCol && h !== descCol && h !== typeCol &&
      colScores[h].accountNo === 0 && colScores[h].income > 0
    )

  if (numericCols.length >= 2) {
    // 잔액 컬럼 찾기: 모든 값이 양수이고 절대 0이 없는 컬럼
    const balCol = headers.find(h => {
      if (numericCols.some(nc => nc.h === h) || h === dateCol || h === descCol || h === typeCol) return false
      if (colScores[h].accountNo > 0) return false
      const vals = rows.map(r => toNum(r[h]))
      return vals.length > 0 && vals.every(n => n > 0)
    })

    // 기본값: 컬럼 순서상 앞 = 출금(expense), 뒤 = 입금(income) (한국 은행 표준)
    let expCol = numericCols[0].h
    let incCol = numericCols[1].h

    if (balCol && rows.length >= 2) {
      // 잔액 변화로 입금/출금 방향 검증
      let correctScore = 0
      let swappedScore = 0

      for (let i = 0; i < Math.min(rows.length - 1, 10); i++) {
        const bal0 = toNum(rows[i][balCol])
        const bal1 = toNum(rows[i + 1][balCol])
        const inc = toNum(rows[i][incCol])
        const exp = toNum(rows[i][expCol])

        // 내림차순(최신→과거): bal0 = bal1 + inc - exp
        // 오름차순(과거→최신): bal1 = bal0 + inc - exp
        const descMatch = Math.abs((bal1 + inc - exp) - bal0) < 2
        const ascMatch = Math.abs((bal0 + inc - exp) - bal1) < 2
        const swapDescMatch = Math.abs((bal1 + exp - inc) - bal0) < 2
        const swapAscMatch = Math.abs((bal0 + exp - inc) - bal1) < 2

        if (descMatch || ascMatch) correctScore++
        else if (swapDescMatch || swapAscMatch) swappedScore++
      }

      if (swappedScore > correctScore) {
        expCol = numericCols[1].h
        incCol = numericCols[0].h
      }
    }

    mapping.income = incCol
    mapping.expense = expCol
  } else if (numericCols.length === 1) {
    mapping.amount = numericCols[0].h
  }

  return mapping
}
