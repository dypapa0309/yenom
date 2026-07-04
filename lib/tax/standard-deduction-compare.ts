import { Transaction } from '@/types'
import { Insight } from '@/lib/insights/generator'
import { detectDeductionTypes } from './deduction-rules'

/**
 * 표준세액공제(13만원) vs 항목별 세액공제 비교
 *
 * 한국 근로소득자는 연말정산 시 아래 중 하나를 선택:
 * - 표준세액공제: 13만원 일괄 적용 (증빙 불필요)
 * - 항목별 세액공제: 보험료/의료비/교육비/기부금 개별 계산 (증빙 필요)
 *
 * 항목별 합산이 13만원 미만이면 표준세액공제가 유리하므로
 * 공제 서류를 챙길 필요가 없다.
 */

const STANDARD_CREDIT = 130_000 // 표준세액공제 금액

export interface StandardDeductionComparison {
  // 항목별 세액공제 합산
  itemizedTotal: number
  // Breakdown
  insuranceCredit: number      // 보험료 * 12%
  medicalCredit: number        // (의료비 - 총급여3%) * 15%
  educationCredit: number      // 교육비 * 15%
  donationCredit: number       // 기부금 * 15~30%

  // 표준세액공제
  standardCredit: number       // 항상 130,000원

  // 비교 결과
  recommendation: 'standard' | 'itemized'
  difference: number           // 차이 금액
  message: string              // Korean explanation

  // 항목별이 유리해지려면 추가로 필요한 지출
  breakEvenAmounts?: {
    additionalMedical?: number    // 의료비 이만큼 더 쓰면 항목별이 유리
    additionalInsurance?: number
    additionalEducation?: number
  }
}

/**
 * 표준세액공제 vs 항목별 세액공제 비교 계산
 */
export function compareStandardVsItemized(
  yearTransactions: Transaction[],
  annualSalary: number,
  options?: {
    dependents?: number
    insurancePremiumTotal?: number  // 보험료 total (auto-detected from transactions or manual)
  }
): StandardDeductionComparison {
  // 유형별 지출 합산
  const totals = {
    insurance: 0,
    medical: 0,
    education: 0,
    donation: 0,
  }

  for (const tx of yearTransactions) {
    const types = detectDeductionTypes(tx)
    for (const type of types) {
      if (type === 'insurance') totals.insurance += tx.amount
      else if (type === 'medical') totals.medical += tx.amount
      else if (type === 'education') totals.education += tx.amount
      else if (type === 'donation') totals.donation += tx.amount
    }
  }

  // 보험료: 수동 입력값이 있으면 우선 사용 (자동이체 감지가 어려운 경우)
  const insuranceSpent = options?.insurancePremiumTotal ?? totals.insurance
  const insuranceLimit = 1_000_000 // 보장성보험 한도 100만원
  const insuranceCredit = Math.round(Math.min(insuranceSpent, insuranceLimit) * 0.12)

  // 의료비: 총급여 3% 초과분 * 15%, 한도 700만원
  const medicalThreshold = annualSalary * 0.03
  const medicalDeductible = Math.max(0, totals.medical - medicalThreshold)
  const medicalLimit = 7_000_000
  const medicalCredit = Math.round(Math.min(medicalDeductible, medicalLimit) * 0.15)

  // 교육비: 15% (자녀 1인 300만원 한도, 본인 무한도 - 여기서는 300만원 기준)
  const educationLimit = 3_000_000
  const educationCredit = Math.round(Math.min(totals.education, educationLimit) * 0.15)

  // 기부금: 1천만원 이하 15%, 초과분 30%
  const donationBase = Math.min(totals.donation, 10_000_000)
  const donationExcess = Math.max(0, totals.donation - 10_000_000)
  const donationCredit = Math.round(donationBase * 0.15 + donationExcess * 0.30)

  // 항목별 합계
  const itemizedTotal = insuranceCredit + medicalCredit + educationCredit + donationCredit

  // 비교
  const recommendation: 'standard' | 'itemized' = itemizedTotal > STANDARD_CREDIT ? 'itemized' : 'standard'
  const difference = Math.abs(itemizedTotal - STANDARD_CREDIT)

  // 메시지 생성
  let message: string
  if (recommendation === 'standard') {
    message = `표준세액공제(13만원)가 ${difference.toLocaleString()}원 더 유리합니다. 공제 증빙 서류를 준비하지 않아도 됩니다.`
  } else if (difference < 50_000) {
    message = `항목별 공제가 ${difference.toLocaleString()}원 더 유리하지만 차이가 적습니다. 증빙 부담을 고려해 판단하세요.`
  } else {
    message = `항목별 공제가 ${difference.toLocaleString()}원 더 유리합니다. 증빙 서류를 잘 챙기세요.`
  }

  // 표준세액공제가 유리한 경우: 항목별이 유리해지려면 추가로 필요한 금액 계산
  let breakEvenAmounts: StandardDeductionComparison['breakEvenAmounts'] | undefined
  if (recommendation === 'standard') {
    const shortfall = STANDARD_CREDIT - itemizedTotal // 부족한 세액공제 금액

    // 의료비로 만회하려면: shortfall / 0.15 = 추가 의료비 필요 (이미 threshold 넘은 경우)
    // threshold 안 넘은 경우: (threshold - 현재 의료비) + shortfall / 0.15
    let additionalMedical: number | undefined
    if (totals.medical >= medicalThreshold) {
      // 이미 threshold 넘었으므로 추가분 * 15%만큼 세액공제 증가
      additionalMedical = Math.ceil(shortfall / 0.15)
    } else {
      // threshold까지 남은 금액 + 추가 공제분
      const remainingToThreshold = medicalThreshold - totals.medical
      additionalMedical = Math.ceil(remainingToThreshold + shortfall / 0.15)
    }

    // 보험료로 만회하려면: shortfall / 0.12 (한도 100만원 이내)
    let additionalInsurance: number | undefined
    const insuranceRoom = insuranceLimit - insuranceSpent
    if (insuranceRoom > 0) {
      const neededInsurance = Math.ceil(shortfall / 0.12)
      if (neededInsurance <= insuranceRoom) {
        additionalInsurance = neededInsurance
      }
    }

    // 교육비로 만회하려면: shortfall / 0.15 (한도 300만원 이내)
    let additionalEducation: number | undefined
    const educationRoom = educationLimit - totals.education
    if (educationRoom > 0) {
      const neededEducation = Math.ceil(shortfall / 0.15)
      if (neededEducation <= educationRoom) {
        additionalEducation = neededEducation
      }
    }

    breakEvenAmounts = {
      ...(additionalMedical !== undefined && { additionalMedical }),
      ...(additionalInsurance !== undefined && { additionalInsurance }),
      ...(additionalEducation !== undefined && { additionalEducation }),
    }

    // 빈 객체면 undefined로
    if (Object.keys(breakEvenAmounts).length === 0) {
      breakEvenAmounts = undefined
    }
  }

  return {
    itemizedTotal,
    insuranceCredit,
    medicalCredit,
    educationCredit,
    donationCredit,
    standardCredit: STANDARD_CREDIT,
    recommendation,
    difference,
    message,
    breakEvenAmounts,
  }
}

/**
 * 표준세액공제 비교 결과를 Insight로 변환
 */
export function generateStandardDeductionInsight(comparison: StandardDeductionComparison): Insight | null {
  const { recommendation, difference, itemizedTotal, breakEvenAmounts } = comparison

  if (recommendation === 'standard') {
    // 표준세액공제가 유리한 경우
    if (breakEvenAmounts?.additionalMedical && breakEvenAmounts.additionalMedical < 500_000) {
      // 의료비 조금만 더 쓰면 항목별이 유리해지는 경우
      return {
        id: 'standard-deduction-breakeven',
        severity: 'tip',
        title: '표준세액공제 vs 항목별 공제',
        description: `현재 표준세액공제(13만원)가 유리하지만, 의료비를 ${breakEvenAmounts.additionalMedical.toLocaleString()}원 더 사용하면 항목별 공제가 유리해집니다.`,
        amount: difference,
      }
    }

    return {
      id: 'standard-deduction-better',
      severity: 'info',
      title: '표준세액공제가 유리',
      description: `표준세액공제(13만원)가 더 유리합니다. 공제 서류 준비 안 해도 됩니다. (항목별 합계: ${itemizedTotal.toLocaleString()}원)`,
      amount: comparison.standardCredit,
    }
  }

  // 항목별이 유리한 경우
  if (difference < 50_000) {
    return {
      id: 'standard-deduction-marginal',
      severity: 'tip',
      title: '항목별 공제 소폭 유리',
      description: `항목별 공제가 ${difference.toLocaleString()}원 더 유리하지만 차이가 적습니다. 증빙 부담을 고려해 판단하세요.`,
      amount: itemizedTotal,
    }
  }

  return {
    id: 'standard-deduction-itemized',
    severity: 'tip',
    title: '항목별 공제가 유리',
    description: `항목별 공제가 ${difference.toLocaleString()}원 더 유리합니다. 증빙 서류를 잘 챙기세요.`,
    amount: itemizedTotal,
  }
}
