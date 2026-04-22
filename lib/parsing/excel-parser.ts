import * as XLSX from 'xlsx'
import { format, parse, isValid } from 'date-fns'
import { ColumnMapping, ParsedTransaction, TransactionType } from '@/types'
import iconv from 'iconv-lite'

export interface ParseResult {
  headers: string[]
  rows: Record<string, unknown>[]
  sheetName: string
}

// UTF-8과 EUC-KR 각각으로 디코딩해서 한글 출현 수가 더 많은 쪽을 선택.
// "한글이 존재하는가"가 아닌 "한글이 더 많은가"로 판단해야
// UTF-8 파일을 EUC-KR로 잘못 인식하는 오판을 막을 수 있음.
async function decodeCsvBuffer(buffer: ArrayBuffer): Promise<string> {
  const bytes = Buffer.from(buffer)

  // UTF-8 BOM
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return iconv.decode(bytes.slice(3), 'utf-8')
  }

  const utf8Text = iconv.decode(bytes, 'utf-8')
  const euckrText = iconv.decode(bytes, 'euc-kr')

  const countKorean = (s: string) => (s.match(/[가-힣]/g) ?? []).length

  const utf8Korean = countKorean(utf8Text)
  const euckrKorean = countKorean(euckrText)

  // 한글 수가 더 많은 인코딩을 선택
  return euckrKorean > utf8Korean ? euckrText : utf8Text
}

// 금융 컬럼 키워드가 가장 많이 매칭되는 행을 헤더로 탐지
const HEADER_KEYWORD_GROUPS = [
  ['날짜', '거래일', '일시', '거래일시', '처리일시', '거래날짜', '입출금일', 'date'],
  ['금액', '거래금액', '입금금액', '출금금액', '입금액', '출금액', 'amount'],
  ['적요', '내용', '거래내용', '상세', '거래내역', '내역', '이용상점', '가맹점'],
  ['구분', '입출금', '거래구분', '유형', '거래종류', '처리구분'],
]

export class PasswordRequiredError extends Error {
  constructor() { super('password_required') }
}

// 셀 값이 데이터처럼 보이는지 판단 (날짜, 숫자, 긴 계좌번호 등)
function isDataLike(cell: string): boolean {
  if (!cell) return false
  if (/^\d{4}[-\/\.]\d{2}[-\/\.]\d{2}/.test(cell)) return true  // 날짜
  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}/.test(cell)) return true  // datetime
  if (/^\d{8,}$/.test(cell)) return true  // 계좌번호 같은 긴 숫자
  // JS Date.toString(): "Wed Apr 22 2026 08:49:20 GMT..."
  if (/^\w{3}\s\w{3}\s\d{2}\s\d{4}/.test(cell)) return true
  return false
}

// 행이 헤더처럼 생겼는지 판단
function isHeaderRow(cells: string[]): boolean {
  const nonEmpty = cells.filter(c => c.length > 0)
  if (nonEmpty.length < 2) return false
  // 비어있지 않은 셀 중 절반 이상이 데이터처럼 생겼으면 헤더가 아님
  const dataLikeCount = nonEmpty.filter(isDataLike).length
  return dataLikeCount <= nonEmpty.length * 0.3
}

function findHeaderRowIndex(raw: unknown[][]): number {
  let bestScore = 0
  let bestIdx = -1

  for (let i = 0; i < Math.min(25, raw.length); i++) {
    const rowArr = raw[i] as unknown[]
    // SheetJS cellDates:true → Date 객체가 있으면 데이터 행
    if (rowArr.some(c => c instanceof Date)) continue
    const cells = rowArr.map(c => String(c).trim())
    if (!isHeaderRow(cells)) continue  // 데이터처럼 생긴 행은 후보에서 제외

    let score = 0
    for (const group of HEADER_KEYWORD_GROUPS) {
      if (cells.some(c => group.some(k => c.replace(/\s/g, '').includes(k)))) score++
    }
    if (score > bestScore) {
      bestScore = score
      bestIdx = i
    }
  }

  if (bestIdx >= 0 && bestScore >= 1) return bestIdx

  // 키워드 매칭 실패 → 헤더처럼 생긴 첫 번째 행 사용
  for (let i = 0; i < Math.min(20, raw.length); i++) {
    const rowArr = raw[i] as unknown[]
    if (rowArr.some(c => c instanceof Date)) continue
    const cells = rowArr.map(c => String(c).trim())
    const nonEmpty = cells.filter(c => c.length > 0)
    if (nonEmpty.length >= 3 && isHeaderRow(cells)) return i
  }

  // 최후 수단: 첫 번째 비어있지 않은 행 (Date 객체 행 포함)
  for (let i = 0; i < Math.min(15, raw.length); i++) {
    const nonEmpty = (raw[i] as unknown[]).filter(c => String(c).trim().length > 0)
    if (nonEmpty.length >= 3) return i
  }

  return 0
}

export async function parseFile(file: File, password?: string): Promise<ParseResult> {
  const isCSV = file.name.toLowerCase().endsWith('.csv')

  let workbook: XLSX.WorkBook

  try {
    if (isCSV) {
      const buffer = await file.arrayBuffer()
      const text = await decodeCsvBuffer(buffer)
      workbook = XLSX.read(text, { type: 'string', cellDates: true })
    } else {
      const buffer = await file.arrayBuffer()
      workbook = XLSX.read(buffer, { type: 'array', cellDates: true, ...(password ? { password } : {}) })
    }
  } catch (err) {
    const msg = String(err)
    if (msg.includes('password') || msg.includes('Password') || msg.includes('Encrypted') || msg.includes('ECMA-376')) {
      throw new PasswordRequiredError()
    }
    throw err
  }

  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]

  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]

  const headerRowIdx = findHeaderRowIndex(raw)
  const rawHeaders = (raw[headerRowIdx] as unknown[]).map(h => String(h).trim())

  // 헤더 행에 Date 객체가 있거나, 첫 번째 셀이 날짜처럼 보이면 → 헤더가 없는 파일
  const headerRowRaw = raw[headerRowIdx] as unknown[]
  const headerHasDates = headerRowRaw.some(c => c instanceof Date)
  const firstNonEmpty = rawHeaders.find(h => h.length > 0) ?? ''
  const firstIsDate = /^\d{4}[-\/\.]\d{2}[-\/\.]\d{2}/.test(firstNonEmpty) ||
                      /^\d{4}-\d{2}-\d{2}T/.test(firstNonEmpty)
  const nonEmptyRaw = rawHeaders.filter(h => h.length > 0)
  const allDataLike = headerHasDates || firstIsDate ||
                      (nonEmptyRaw.length > 0 && nonEmptyRaw.every(isDataLike))

  // 비어있는 헤더 열을 제거하되, 원래 인덱스를 기억해서 데이터 행과 정확히 매칭
  const headers: string[] = []
  const headerColIndices: number[] = []

  if (allDataLike) {
    // 헤더 행이 없는 파일 → 제네릭 이름으로 컬럼 생성, 데이터는 headerRowIdx부터
    rawHeaders.forEach((_, idx) => {
      headers.push(`컬럼${idx + 1}`)
      headerColIndices.push(idx)
    })
  } else {
    rawHeaders.forEach((h, idx) => {
      if (h) {
        headers.push(h)
        headerColIndices.push(idx)
      }
    })
  }

  const rows: Record<string, unknown>[] = []
  const dataStartIdx = allDataLike ? headerRowIdx : headerRowIdx + 1

  for (let i = dataStartIdx; i < raw.length; i++) {
    const rowArr = raw[i] as unknown[]
    if (rowArr.every(c => String(c).trim() === '')) continue

    const row: Record<string, unknown> = {}
    headers.forEach((h, idx) => {
      // 원래 컬럼 인덱스를 사용해서 정확하게 매핑
      row[h] = rowArr[headerColIndices[idx]] ?? ''
    })
    rows.push(row)
  }

  return { headers, rows, sheetName }
}

function parseAmount(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  const str = String(val)
    .replace(/,/g, '')
    .replace(/원/g, '')
    .replace(/\s/g, '')
    .replace(/"/g, '')
    .trim()
  const num = parseFloat(str)
  return isNaN(num) ? 0 : Math.abs(num)
}

function parseDate(val: unknown): string {
  if (!val) return format(new Date(), 'yyyy-MM-dd')

  if (val instanceof Date && isValid(val)) {
    return format(val, 'yyyy-MM-dd')
  }

  const str = String(val).trim()

  const formats = [
    'yyyy-MM-dd HH:mm:ss',
    'yyyy/MM/dd HH:mm:ss',
    'yyyy.MM.dd HH:mm:ss',
    'yyyy-MM-dd',
    'yyyy/MM/dd',
    'yyyy.MM.dd',
    'yyyyMMdd HHmmss',
    'yyyyMMddHHmmss',
    'yyyyMMdd',
    'MM/dd/yyyy',
  ]

  for (const fmt of formats) {
    try {
      const trimmed = str.substring(0, fmt.length)
      const d = parse(trimmed, fmt, new Date())
      if (isValid(d) && d.getFullYear() > 1990) return format(d, 'yyyy-MM-dd')
    } catch {
      // continue
    }
  }

  // Excel 시리얼 날짜
  const num = Number(str)
  if (!isNaN(num) && num > 40000 && num < 60000) {
    const d = XLSX.SSF.parse_date_code(num)
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }

  return format(new Date(), 'yyyy-MM-dd')
}

// 이동이체, 자동이체 등 → transfer 타입으로 분류
const TRANSFER_BANK_CATEGORIES = ['이동이체', '자동이체', '타행이체', '당행이체', '인터넷이체', '폰뱅킹이체']
const INCOME_BANK_CATEGORIES = ['일반입금', '급여', '이자', '캐시백', '환급']

function inferType(row: Record<string, unknown>, mapping: ColumnMapping): TransactionType {
  // 입금/출금 분리 컬럼이 있으면 가장 먼저 방향을 결정
  // (bankCategory의 "이체" 키워드는 입금/출금 모두에 찍히므로 방향 판단 불가)
  if (mapping.income && mapping.expense) {
    const incomeVal = parseAmount(row[mapping.income!])
    const expenseVal = parseAmount(row[mapping.expense!])
    if (incomeVal > 0 && expenseVal === 0) return 'income'
    if (expenseVal > 0 && incomeVal === 0) {
      // 출금이지만 이체 성격인지 확인
      if (mapping.bankCategory) {
        const bankCat = String(row[mapping.bankCategory] ?? '').replace(/\s/g, '')
        if (TRANSFER_BANK_CATEGORIES.some(k => bankCat.includes(k))) return 'transfer'
      }
      return 'expense'
    }
    if (incomeVal > 0 && expenseVal > 0) return 'transfer'
  }

  // 입출금 구분 컬럼
  if (mapping.type) {
    const val = String(row[mapping.type] ?? '').trim().replace(/\s/g, '')
    if (['입금', '수입', 'income', '+', 'CR'].includes(val)) return 'income'
    if (['출금', '지출', 'expense', '-', 'DR'].includes(val)) return 'expense'
    if (['이체', 'transfer'].includes(val)) return 'transfer'
  }

  // 입금/출금 분리 없이 bankCategory만 있는 경우
  if (mapping.bankCategory) {
    const bankCat = String(row[mapping.bankCategory] ?? '').replace(/\s/g, '')
    if (TRANSFER_BANK_CATEGORIES.some(k => bankCat.includes(k))) return 'transfer'
    if (INCOME_BANK_CATEGORIES.some(k => bankCat.includes(k))) return 'income'
    if (bankCat.includes('입금') && !bankCat.includes('자동납부')) return 'income'
  }

  if (mapping.amount) {
    const raw = String(row[mapping.amount] ?? '')
    if (raw.includes('-')) return 'expense'
  }

  return 'expense'
}

export function applyMapping(rows: Record<string, unknown>[], mapping: ColumnMapping): ParsedTransaction[] {
  const results: ParsedTransaction[] = []

  for (const row of rows) {
    const dateVal = mapping.date ? row[mapping.date] : null
    const descVal = mapping.description ? String(row[mapping.description] ?? '').trim() : ''

    let amount = 0
    if (mapping.amount) {
      amount = parseAmount(row[mapping.amount])
    } else if (mapping.income && mapping.expense) {
      const inc = parseAmount(row[mapping.income!])
      const exp = parseAmount(row[mapping.expense!])
      amount = inc > 0 ? inc : exp
    }

    if (!descVal && amount === 0) continue

    const type = inferType(row, mapping)
    const dateStr = parseDate(dateVal)
    const merchantName = extractMerchantName(descVal)

    results.push({ transaction_date: dateStr, description: descVal, amount, type, merchant_name: merchantName })
  }

  return results
}

function extractMerchantName(description: string): string | null {
  if (!description) return null
  const m = description.match(/^(.+?)[\s\-_\/\\]/)
  if (m && m[1].length >= 2) return m[1].trim()
  return description.length > 20 ? description.substring(0, 20).trim() : description.trim()
}
