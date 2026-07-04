import { Transaction } from '@/types'

/**
 * ��용카드 vs 체크카드/현금 소득공제 비율 분석
 *
 * 소득공제 구조:
 * - 총급여 25% 초과분부터 공제 적용
 * - 신용카드: 15%
 * - 체크카드/현금영수증: 30%
 * - 대중교통/전통시장: 40%
 *
 * 전략: 총급여 25%까지는 혜택 많은 신용카드 → 이후 체크카드 전환
 */

export interface CardRatioAnalysis {
  creditTotal: number
  debitTotal: number
  cashTotal: number
  totalSpend: number
  creditRatio: number
  debitRatio: number
  // 공제 관련
  salaryThreshold: number      // 총급여 25% (최저사용액)
  overThreshold: boolean       // 최저사용액 초과 여부
  amountToThreshold: number    // 최저사용액까지 남은 금액
  // 추천
  recommendation: CardRecommendation
}

export type CardRecommendation =
  | 'use_credit'     // 아직 25% 미달, 신용카드 사용 권장
  | 'switch_debit'   // 25% 초과, 체크카드 전환 권장
  | 'balanced'       // 적절��� 비율

export interface CardSwitchAlert {
  triggered: boolean
  message: string
  currentTotal: number
  threshold: number
  percentage: number
}

/**
 * 결제수단 분류 (description 기반 추정)
 * 실제로는 은행 거래내역에 카드종류가 포함되어 있으므로 파싱 단계에서 처리하는 게 이상적
 */
const CREDIT_KEYWORDS = ['신용', '신용카드', 'CREDIT']
const DEBIT_KEYWORDS = ['체크', '체크카드', 'DEBIT', '직불']
const CASH_KEYWORDS = ['현금', '현금영수증', 'ATM출금']

export type PaymentMethod = 'credit' | 'debit' | 'cash' | 'unknown'

export function detectPaymentMethod(tx: Transaction): PaymentMethod {
  const desc = tx.description.toLowerCase()
  const merchant = (tx.merchant_name ?? '').toLowerCase()
  const combined = desc + ' ' + merchant

  for (const kw of DEBIT_KEYWORDS) {
    if (combined.includes(kw.toLowerCase())) return 'debit'
  }
  for (const kw of CREDIT_KEYWORDS) {
    if (combined.includes(kw.toLowerCase())) return 'credit'
  }
  for (const kw of CASH_KEYWORDS) {
    if (combined.includes(kw.toLowerCase())) return 'cash'
  }

  // 기본: 카드 결제는 대부분 신용카드로 추정 (한국 사용 패턴)
  if (tx.type === 'expense') return 'credit'
  return 'unknown'
}

/**
 * 연간 카드 사용 비율 분석
 */
export function analyzeCardRatio(
  yearTransactions: Transaction[],
  annualSalary: number = 50_000_000
): CardRatioAnalysis {
  const expenses = yearTransactions.filter(t => t.type === 'expense' && !t.excluded)

  let creditTotal = 0
  let debitTotal = 0
  let cashTotal = 0

  for (const tx of expenses) {
    const method = detectPaymentMethod(tx)
    switch (method) {
      case 'credit': creditTotal += tx.amount; break
      case 'debit': debitTotal += tx.amount; break
      case 'cash': cashTotal += tx.amount; break
      default: creditTotal += tx.amount; break // unknown은 신용카드로 추정
    }
  }

  const totalSpend = creditTotal + debitTotal + cashTotal
  const salaryThreshold = annualSalary * 0.25
  const overThreshold = totalSpend > salaryThreshold
  const amountToThreshold = Math.max(0, salaryThreshold - totalSpend)

  let recommendation: CardRecommendation = 'balanced'
  if (!overThreshold) {
    recommendation = 'use_credit'
  } else if (creditTotal > debitTotal * 2) {
    recommendation = 'switch_debit'
  }

  return {
    creditTotal,
    debitTotal,
    cashTotal,
    totalSpend,
    creditRatio: totalSpend > 0 ? (creditTotal / totalSpend) * 100 : 0,
    debitRatio: totalSpend > 0 ? ((debitTotal + cashTotal) / totalSpend) * 100 : 0,
    salaryThreshold,
    overThreshold,
    amountToThreshold,
    recommendation,
  }
}

/**
 * 카드 전환 시점 알림 체크
 */
export function checkCardSwitchAlert(
  yearTransactions: Transaction[],
  annualSalary: number = 50_000_000
): CardSwitchAlert {
  const expenses = yearTransactions.filter(t => t.type === 'expense' && !t.excluded)
  const totalSpend = expenses.reduce((s, t) => s + t.amount, 0)
  const threshold = annualSalary * 0.25
  const percentage = (totalSpend / threshold) * 100

  if (percentage >= 90 && percentage < 100) {
    return {
      triggered: true,
      message: `총 사용액이 최저사용액(${Math.round(threshold / 10000)}만원)의 ${Math.round(percentage)}%에 도달했습니다. 곧 체크카드로 전환하세요!`,
      currentTotal: totalSpend,
      threshold,
      percentage,
    }
  }

  if (percentage >= 100) {
    return {
      triggered: true,
      message: `최저사용액을 넘었습니다! 지금부터 체크카드/현금영수증을 사용하면 공제율이 2배(30%)입니다.`,
      currentTotal: totalSpend,
      threshold,
      percentage,
    }
  }

  return {
    triggered: false,
    message: `최저사용액까지 ${Math.round((threshold - totalSpend) / 10000)}만원 남았습니다. 신용카드 혜택을 활용하세요.`,
    currentTotal: totalSpend,
    threshold,
    percentage,
  }
}
