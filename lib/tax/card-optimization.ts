import { Transaction } from '@/types'
import { detectPaymentMethod } from './card-ratio'
import { detectDeductionTypes } from './deduction-rules'

/**
 * 카드 소비 최적화 전략 — "문턱 채우기" (Threshold Filling)
 *
 * 한국 신용카드 소득공제 구조:
 * 1. 총급여의 25%(최저사용액)를 넘어야 공제 시작
 * 2. 초과분에 대해 결제수단별 공제율 적용:
 *    - 신용카드: 15%
 *    - 체크카드/현금영수증: 30%
 *    - 대중교통: 40%
 *    - 전통시장: 40%
 *    - 문화생활(도서/공연 등): 30%
 *
 * 최적 전략:
 * ① 25% 문턱까지는 신용카드로 채운다 (카드 혜택만 챙기기)
 * ② 문턱 초과 후에는 공제율 높은 순서로 전환:
 *    대중교통/전통시장(40%) → 체크카드/현금/문화(30%) → 신용카드(15%)
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CardOptimizationPlan {
  // 현재 상태
  currentTotal: number
  threshold: number           // 총급여의 25% (최저사용액)
  thresholdReached: boolean
  amountToThreshold: number

  // 문턱 초과 후 공제 현황
  deductibleAmount: number    // 공제 대상 금액 (threshold 초과분)
  basicLimit: number          // 기본 한도 (200/250/300만)
  transitBonus: number        // 대중교통 추가한도 100만
  marketBonus: number         // 전통시장 추가한도 100만
  totalLimit: number          // 합산 한도

  // 결제수단별 공제액 (문턱 초과분 기준)
  creditDeduction: number     // 신용카드 공제액 (spent * 15%)
  debitDeduction: number      // 체크카드/현금 공제액 (spent * 30%)
  transitDeduction: number    // 대중교통 공제액 (spent * 40%)
  marketDeduction: number     // 전통시장 공제액 (spent * 40%)
  cultureDeduction: number    // 문화생활 공제액 (spent * 30%)
  totalDeduction: number      // 실제 받을 공제 (min of sum vs limit)

  // 잔여 한도
  remainingBasicLimit: number
  remainingTransitBonus: number
  remainingMarketBonus: number

  // 최적화 추천
  recommendations: CardRecommendation[]
}

export interface CardRecommendation {
  priority: number
  action: string        // 한국어 행동 안내
  method: 'credit' | 'debit' | 'cash' | 'transit' | 'market' | 'culture'
  additionalAmount: number   // 추가로 사용해야 할 금액
  additionalDeduction: number  // 해당 금액으로 인한 추가 공제액
  rate: number              // 공제율 (0.15, 0.30, 0.40)
}

export interface MonthlyCardTarget {
  method: string
  monthlyAmount: number
  reason: string
}

// ─── Constants ──────────────────────────────────────────────────────────────

const RATE_CREDIT = 0.15
const RATE_DEBIT = 0.30
const RATE_TRANSIT = 0.40
const RATE_MARKET = 0.40
const RATE_CULTURE = 0.30

const TRANSIT_BONUS_LIMIT = 1_000_000
const MARKET_BONUS_LIMIT = 1_000_000

// 문화생활 키워드
const CULTURE_KEYWORDS = [
  '도서', '서점', '교보문고', '영풍문고', '알라딘', '예스24',
  '공연', '뮤지컬', '연극', '콘서트', '영화', 'CGV', '메가박스', '롯데시네마',
  '미술관', '박물관', '전시', '도서관',
]

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * 급여 구간에 따른 기본 공제 한도
 */
function getBasicLimit(annualSalary: number): number {
  if (annualSalary <= 70_000_000) return 3_000_000
  if (annualSalary <= 120_000_000) return 2_500_000
  return 2_000_000
}

/**
 * 문화생활 소비 여부 판별
 */
function isCultureSpending(tx: Transaction): boolean {
  const desc = (tx.description + ' ' + (tx.merchant_name ?? '')).toLowerCase()
  return CULTURE_KEYWORDS.some(kw => desc.includes(kw.toLowerCase()))
}

/**
 * 문턱 초과분에서 각 결제수단별 사용액을 계산한다.
 *
 * 25% 문턱은 신용카드로 채우는 게 최적이므로,
 * 문턱 소진 순서: 신용카드 → 체크카드 → 현금 → 대중교통/전통시장/문화
 * (낮은 공제율부터 문턱에 할당)
 */
interface SpendingBreakdown {
  creditSpent: number
  debitSpent: number
  transitSpent: number
  marketSpent: number
  cultureSpent: number
  // 문턱 초과분 (실제 공제 계산 대상)
  creditAfterThreshold: number
  debitAfterThreshold: number
  transitAfterThreshold: number
  marketAfterThreshold: number
  cultureAfterThreshold: number
}

function calcSpendingBreakdown(
  yearTransactions: Transaction[],
  threshold: number
): SpendingBreakdown {
  const expenses = yearTransactions.filter(t => t.type === 'expense' && !t.excluded)

  let creditSpent = 0
  let debitSpent = 0
  let transitSpent = 0
  let marketSpent = 0
  let cultureSpent = 0

  for (const tx of expenses) {
    const deductionTypes = detectDeductionTypes(tx)

    // 특수 카테고리 우선 분류
    if (deductionTypes.includes('transit')) {
      transitSpent += tx.amount
    } else if (deductionTypes.includes('traditional_market')) {
      marketSpent += tx.amount
    } else if (isCultureSpending(tx)) {
      cultureSpent += tx.amount
    } else {
      // 일반 결제수단 분류
      const method = detectPaymentMethod(tx)
      if (method === 'debit' || method === 'cash') {
        debitSpent += tx.amount
      } else {
        creditSpent += tx.amount
      }
    }
  }

  // 문턱 소진: 공제율이 낮은 신용카드부터 문턱에 할당
  let remainingThreshold = threshold

  // 1) 신용카드로 문턱 채우기 (최적 전략)
  const creditUsedForThreshold = Math.min(creditSpent, remainingThreshold)
  remainingThreshold -= creditUsedForThreshold

  // 2) 문턱이 남으면 체크카드/현금으로
  const debitUsedForThreshold = Math.min(debitSpent, remainingThreshold)
  remainingThreshold -= debitUsedForThreshold

  // 3) 그래도 남으면 문화생활
  const cultureUsedForThreshold = Math.min(cultureSpent, remainingThreshold)
  remainingThreshold -= cultureUsedForThreshold

  // 4) 대중교통/전통시장은 마지막 (공제율 높으므로 가급적 문턱에 안 쓰고 싶지만 총액이 부족하면)
  const transitUsedForThreshold = Math.min(transitSpent, remainingThreshold)
  remainingThreshold -= transitUsedForThreshold

  const marketUsedForThreshold = Math.min(marketSpent, remainingThreshold)
  remainingThreshold -= marketUsedForThreshold

  return {
    creditSpent,
    debitSpent,
    transitSpent,
    marketSpent,
    cultureSpent,
    creditAfterThreshold: creditSpent - creditUsedForThreshold,
    debitAfterThreshold: debitSpent - debitUsedForThreshold,
    transitAfterThreshold: transitSpent - transitUsedForThreshold,
    marketAfterThreshold: marketSpent - marketUsedForThreshold,
    cultureAfterThreshold: cultureSpent - cultureUsedForThreshold,
  }
}

// ─── Main Functions ─────────────────────────────────────────────────────────

/**
 * 연간 거래 내역과 연봉을 기반으로 카드 소비 최적화 계획을 생성한다.
 */
export function generateCardOptimizationPlan(
  yearTransactions: Transaction[],
  annualSalary: number
): CardOptimizationPlan {
  const threshold = annualSalary * 0.25
  const expenses = yearTransactions.filter(t => t.type === 'expense' && !t.excluded)
  const currentTotal = expenses.reduce((sum, t) => sum + t.amount, 0)

  const thresholdReached = currentTotal > threshold
  const amountToThreshold = Math.max(0, threshold - currentTotal)

  const basicLimit = getBasicLimit(annualSalary)
  const totalLimit = basicLimit + TRANSIT_BONUS_LIMIT + MARKET_BONUS_LIMIT

  // 문턱 초과분 계산
  const breakdown = calcSpendingBreakdown(yearTransactions, threshold)

  // 각 수단별 공제액
  const creditDeduction = Math.round(breakdown.creditAfterThreshold * RATE_CREDIT)
  const debitDeduction = Math.round(breakdown.debitAfterThreshold * RATE_DEBIT)
  const transitDeduction = Math.round(breakdown.transitAfterThreshold * RATE_TRANSIT)
  const marketDeduction = Math.round(breakdown.marketAfterThreshold * RATE_MARKET)
  const cultureDeduction = Math.round(breakdown.cultureAfterThreshold * RATE_CULTURE)

  // 기본한도 소진: 신용카드 + 체크카드 + 문화생활
  const basicUsed = Math.min(
    basicLimit,
    creditDeduction + debitDeduction + cultureDeduction
  )
  const remainingBasicLimit = Math.max(0, basicLimit - basicUsed)

  // 추가한도 소진
  const remainingTransitBonus = Math.max(
    0,
    TRANSIT_BONUS_LIMIT - transitDeduction
  )
  const remainingMarketBonus = Math.max(
    0,
    MARKET_BONUS_LIMIT - marketDeduction
  )

  // 실제 공제액 (한도 적용)
  const rawTotal = creditDeduction + debitDeduction + cultureDeduction + transitDeduction + marketDeduction
  const cappedBasic = Math.min(basicLimit, creditDeduction + debitDeduction + cultureDeduction)
  const cappedTransit = Math.min(TRANSIT_BONUS_LIMIT, transitDeduction)
  const cappedMarket = Math.min(MARKET_BONUS_LIMIT, marketDeduction)
  const totalDeduction = cappedBasic + cappedTransit + cappedMarket

  // 추천 생성
  const recommendations = generateRecommendations({
    thresholdReached,
    amountToThreshold,
    remainingBasicLimit,
    remainingTransitBonus,
    remainingMarketBonus,
    basicLimit,
    breakdown,
  })

  return {
    currentTotal,
    threshold,
    thresholdReached,
    amountToThreshold,
    deductibleAmount: Math.max(0, currentTotal - threshold),
    basicLimit,
    transitBonus: TRANSIT_BONUS_LIMIT,
    marketBonus: MARKET_BONUS_LIMIT,
    totalLimit,
    creditDeduction,
    debitDeduction,
    transitDeduction,
    marketDeduction,
    cultureDeduction,
    totalDeduction,
    remainingBasicLimit,
    remainingTransitBonus,
    remainingMarketBonus,
    recommendations,
  }
}

// ─── Recommendations ────────────────────────────────────────────────────────

interface RecommendationInput {
  thresholdReached: boolean
  amountToThreshold: number
  remainingBasicLimit: number
  remainingTransitBonus: number
  remainingMarketBonus: number
  basicLimit: number
  breakdown: SpendingBreakdown
}

function generateRecommendations(input: RecommendationInput): CardRecommendation[] {
  const recs: CardRecommendation[] = []
  let priority = 1

  // Case 1: 문턱 미도달
  if (!input.thresholdReached) {
    recs.push({
      priority: priority++,
      action: `최저사용액까지 ${formatWon(input.amountToThreshold)} 남았습니다. 신용카드로 채우세요 (카드 혜택만 챙기고, 공제에는 영향 없음).`,
      method: 'credit',
      additionalAmount: input.amountToThreshold,
      additionalDeduction: 0, // 문턱 이전이므로 공제 없음
      rate: RATE_CREDIT,
    })
    return recs
  }

  // Case 2: 문턱 도달 후 — 공제율 높은 순서로 추천

  // 2-1. 대중교통 추가한도 남은 경우
  if (input.remainingTransitBonus > 0) {
    const additionalNeeded = Math.ceil(input.remainingTransitBonus / RATE_TRANSIT)
    recs.push({
      priority: priority++,
      action: `대중교통 추가한도 ${formatWon(input.remainingTransitBonus)} 남음. 대중교통을 적극 이용하세요 (공제율 40%).`,
      method: 'transit',
      additionalAmount: additionalNeeded,
      additionalDeduction: input.remainingTransitBonus,
      rate: RATE_TRANSIT,
    })
  }

  // 2-2. 전통시장 추가한도 남은 경우
  if (input.remainingMarketBonus > 0) {
    const additionalNeeded = Math.ceil(input.remainingMarketBonus / RATE_MARKET)
    recs.push({
      priority: priority++,
      action: `전통시장 추가한도 ${formatWon(input.remainingMarketBonus)} 남음. 전통시장에서 장보기를 활용하세요 (공제율 40%).`,
      method: 'market',
      additionalAmount: additionalNeeded,
      additionalDeduction: input.remainingMarketBonus,
      rate: RATE_MARKET,
    })
  }

  // 2-3. 기본한도 남은 경우 — 체크카드/현금 우선
  if (input.remainingBasicLimit > 0) {
    // 체크카드 30%로 채우는 것이 효율적
    const debitNeeded = Math.ceil(input.remainingBasicLimit / RATE_DEBIT)
    recs.push({
      priority: priority++,
      action: `기본 공제한도 ${formatWon(input.remainingBasicLimit)} 남음. 체크카드/현금영수증으로 전환하세요 (공제율 30%, 신용카드 대비 2배).`,
      method: 'debit',
      additionalAmount: debitNeeded,
      additionalDeduction: input.remainingBasicLimit,
      rate: RATE_DEBIT,
    })

    // 문화생활도 30%
    recs.push({
      priority: priority++,
      action: `도서·공연·영화 등 문화생활비도 30% 공제됩니다. 문화비를 적극 활용하세요.`,
      method: 'culture',
      additionalAmount: debitNeeded, // 같은 금액 필요
      additionalDeduction: input.remainingBasicLimit,
      rate: RATE_CULTURE,
    })
  }

  // 2-4. 한도가 다 찼으면
  if (input.remainingBasicLimit === 0 && input.remainingTransitBonus === 0 && input.remainingMarketBonus === 0) {
    recs.push({
      priority: priority++,
      action: `공제 한도를 모두 채웠습니다! 이제 혜택 좋은 신용카드를 사용하세요 (추가 공제 불가).`,
      method: 'credit',
      additionalAmount: 0,
      additionalDeduction: 0,
      rate: RATE_CREDIT,
    })
  }

  return recs
}

// ─── Monthly Target ─────────────────────────────────────────────────────────

/**
 * 남은 개월 수를 고려해 월별 카드 사용 목표를 산출한다.
 * plan의 추천사항을 월 단위로 분배해서 실행 가능한 안내를 제공한다.
 */
export function getMonthlyCardTarget(
  plan: CardOptimizationPlan,
  remainingMonths: number
): MonthlyCardTarget[] {
  if (remainingMonths <= 0) {
    return [{
      method: '없음',
      monthlyAmount: 0,
      reason: '올해 남은 기간이 없습니다. 내년 전략을 세우세요.',
    }]
  }

  const targets: MonthlyCardTarget[] = []

  // Case 1: 문턱 미도달
  if (!plan.thresholdReached) {
    const monthlyCredit = Math.ceil(plan.amountToThreshold / remainingMonths)
    targets.push({
      method: '신용카드',
      monthlyAmount: monthlyCredit,
      reason: `최저사용액까지 ${formatWon(plan.amountToThreshold)} 남음. 월 ${formatWon(monthlyCredit)}씩 신용카드로 사용하면 문턱 도달 (혜택·포인트 적립 우선).`,
    })

    return targets
  }

  // Case 2: 문턱 도달 후 — 한도 잔여분을 월별로 분배

  // 대중교통 (자연스러운 이용량 기반)
  if (plan.remainingTransitBonus > 0) {
    const neededSpend = Math.ceil(plan.remainingTransitBonus / RATE_TRANSIT)
    const monthly = Math.ceil(neededSpend / remainingMonths)
    targets.push({
      method: '대중교통',
      monthlyAmount: monthly,
      reason: `대중교통 추가한도 ${formatWon(plan.remainingTransitBonus)} 잔여. 월 ${formatWon(monthly)}씩 이용 시 추가 공제 확보 (40%).`,
    })
  }

  // 전통시장
  if (plan.remainingMarketBonus > 0) {
    const neededSpend = Math.ceil(plan.remainingMarketBonus / RATE_MARKET)
    const monthly = Math.ceil(neededSpend / remainingMonths)
    targets.push({
      method: '전통시장',
      monthlyAmount: monthly,
      reason: `전통시장 추가한도 ${formatWon(plan.remainingMarketBonus)} 잔여. 월 ${formatWon(monthly)}씩 전통시장 이용 권장 (40%).`,
    })
  }

  // 체크카드/현금 (기본한도 잔여분)
  if (plan.remainingBasicLimit > 0) {
    const neededSpend = Math.ceil(plan.remainingBasicLimit / RATE_DEBIT)
    const monthly = Math.ceil(neededSpend / remainingMonths)
    targets.push({
      method: '체크카드/현금영수증',
      monthlyAmount: monthly,
      reason: `기본 공제한도 ${formatWon(plan.remainingBasicLimit)} 잔여. 월 ${formatWon(monthly)}씩 체크카드로 전환하면 한도 도달 (30%).`,
    })
  }

  // 기본한도 다 찬 경우
  if (plan.remainingBasicLimit === 0 && plan.remainingTransitBonus === 0 && plan.remainingMarketBonus === 0) {
    targets.push({
      method: '신용카드 (자유)',
      monthlyAmount: 0,
      reason: `모든 공제 한도를 채웠습니다. 남은 기간은 혜택 좋은 신용카드를 자유롭게 사용하세요.`,
    })
  }

  // 한도가 남아있더라도, 신용카드는 최저 우선순위로 안내
  if (plan.remainingBasicLimit > 0) {
    targets.push({
      method: '신용카드',
      monthlyAmount: 0,
      reason: `공제 한도가 남아있으므로 신용카드 사용은 최소화하세요 (공제율 15%로 체크카드의 절반).`,
    })
  }

  return targets
}

// ─── Utility ────────────────────────────────────────────────────────────────

function formatWon(amount: number): string {
  if (amount >= 10_000) {
    const man = Math.round(amount / 10_000)
    return `${man.toLocaleString()}만원`
  }
  return `${amount.toLocaleString()}원`
}
