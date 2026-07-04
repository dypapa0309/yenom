/**
 * 연말정산 시뮬레이션 엔진
 *
 * 2024년 귀속 소득세법 기준 전체 연말정산 흐름을 시뮬레이션한다.
 * 총급여 → 근로소득공제 → 소득공제 → 과세표준 → 산출세액 → 세액공제 → 결정세액 → 차감징수세액
 */

// ─────────────────────────────────────────────
// 인터페이스 정의
// ─────────────────────────────────────────────

/** 연말정산 입력값 */
export interface YearEndTaxInput {
  /** 총급여 (연간) */
  annualSalary: number
  /** 부양가족 수 (본인 제외) */
  dependents: number

  // 사대보험 (자동계산 or 직접입력)
  /** 국민연금 납부액 */
  nationalPension?: number
  /** 건강보험 납부액 */
  healthInsurance?: number
  /** 고용보험 납부액 */
  employmentInsurance?: number

  // 카드 사용
  /** 신용카드 사용액 */
  creditCardSpent: number
  /** 체크카드 사용액 */
  debitCardSpent: number
  /** 현금영수증 사용액 */
  cashReceiptSpent: number
  /** 대중교통 사용액 */
  transitSpent: number
  /** 전통시장 사용액 */
  traditionalMarketSpent: number
  /** 문화비 사용액 (도서, 공연, 영화 등 — 총급여 7천만 이하) */
  cultureSpent: number

  // 세액공제 항목
  /** 연금저축 납입액 */
  pensionSavings: number
  /** IRP 납입액 */
  irp: number
  /** 보장성 보험료 */
  insurancePremium: number
  /** 의료비 지출 */
  medicalExpense: number
  /** 교육비 (본인) */
  educationExpenseSelf: number
  /** 교육비 (자녀) */
  educationExpenseChild: number
  /** 법정기부금 */
  donationLegal: number
  /** 지정기부금 */
  donationDesignated: number
  /** 월세 납부액 (연간) */
  monthlyRent: number
  /** 주택청약 납입액 */
  housingSubscription: number
  /** 자녀 수 (세액공제 대상, 8세 이상) */
  children: number

  // 기납부세액 (원천징수된 세금)
  /** 기납부세액 */
  prepaidTax: number

  // 옵션
  /** 중소기업 취업 청년 (소득세 90% 감면) */
  isSMEYouth?: boolean
  /** 혼인 세액공제 적용 여부 (2024-2026, 50만원) */
  isNewlyWed?: boolean
}

/** 연말정산 결과 */
export interface YearEndTaxResult {
  /** 총급여 */
  grossSalary: number
  /** 근로소득공제액 */
  earnedIncomeDeduction: number
  /** 근로소득금액 (총급여 - 근로소득공제) */
  earnedIncome: number
  /** 소득공제 합계 */
  totalIncomeDeduction: number
  /** 과세표준 (근로소득금액 - 소득공제) */
  taxableIncome: number
  /** 산출세액 */
  calculatedTax: number
  /** 세액공제 합계 */
  totalTaxCredit: number
  /** 결정세액 (산출세액 - 세액공제, 최소 0) */
  determinedTax: number
  /** 기납부세액 */
  prepaidTax: number
  /** 차감징수세액 (양수: 추가납부, 음수: 환급) */
  finalTax: number

  // 상세 내역
  /** 소득공제 상세 */
  incomeDeductionBreakdown: { label: string; amount: number }[]
  /** 세액공제 상세 */
  taxCreditBreakdown: { label: string; amount: number }[]
  /** 실효세율 (결정세액 / 총급여 * 100) */
  effectiveTaxRate: number
}

// ─────────────────────────────────────────────
// 근로소득공제 계산 (단계별 공제율)
// ─────────────────────────────────────────────

/**
 * 근로소득공제 계산
 * - ~500만: 70%
 * - 500~1500만: 350만 + 초과분 40%
 * - 1500~4500만: 750만 + 초과분 15%
 * - 4500~1억: 1200만 + 초과분 5%
 * - 1억~: 1475만 + 초과분 2%
 */
function calcEarnedIncomeDeduction(grossSalary: number): number {
  if (grossSalary <= 5_000_000) {
    return Math.max(grossSalary * 0.7, 0)
  } else if (grossSalary <= 15_000_000) {
    return 3_500_000 + (grossSalary - 5_000_000) * 0.4
  } else if (grossSalary <= 45_000_000) {
    return 7_500_000 + (grossSalary - 15_000_000) * 0.15
  } else if (grossSalary <= 100_000_000) {
    return 12_000_000 + (grossSalary - 45_000_000) * 0.05
  } else {
    return 14_750_000 + (grossSalary - 100_000_000) * 0.02
  }
}

// ─────────────────────────────────────────────
// 사대보험 자동 계산
// ─────────────────────────────────────────────

/** 국민연금: 월 보수의 4.5%, 상한 기준소득월액 590만 (2024) */
function calcNationalPension(annualSalary: number): number {
  const monthlySalary = annualSalary / 12
  const cappedMonthly = Math.min(monthlySalary, 5_900_000)
  return Math.round(cappedMonthly * 0.045) * 12
}

/** 건강보험: 월 보수의 3.545% (2024, 장기요양포함 약 0.4541% 추가) */
function calcHealthInsurance(annualSalary: number): number {
  const monthlySalary = annualSalary / 12
  const healthBase = Math.round(monthlySalary * 0.03545)
  const longTermCare = Math.round(healthBase * 0.1281) // 장기요양보험 12.81%
  return (healthBase + longTermCare) * 12
}

/** 고용보험: 월 보수의 0.9% (2024) */
function calcEmploymentInsurance(annualSalary: number): number {
  return Math.round(annualSalary * 0.009)
}

// ─────────────────────────────────────────────
// 신용카드 등 소득공제 계산
// ─────────────────────────────────────────────

interface CardDeductionResult {
  /** 소득공제 금액 */
  deduction: number
  /** 상세 내역 */
  details: string
}

/**
 * 신용카드 등 소득공제 계산
 *
 * 총급여 25%를 최저사용금액으로, 초과분에 대해 결제수단별 공제율 적용:
 * - 신용카드: 15%
 * - 체크카드/현금영수증: 30%
 * - 대중교통: 40% (2024년 한시 80%)
 * - 전통시장: 40%
 * - 문화비: 30% (총급여 7천만 이하)
 *
 * 기본한도: 총급여 7천만이하 300만, 7천만~1.2억 250만, 1.2억초과 200만
 * 추가한도: 대중교통 100만, 전통시장 100만, 문화비 100만 (도서공연)
 */
function calcCardDeduction(input: YearEndTaxInput): CardDeductionResult {
  const { annualSalary } = input
  const threshold = annualSalary * 0.25 // 최저사용금액

  // 전체 카드 등 사용액 합산
  const totalSpent =
    input.creditCardSpent +
    input.debitCardSpent +
    input.cashReceiptSpent +
    input.transitSpent +
    input.traditionalMarketSpent +
    input.cultureSpent

  // 최저사용금액 미달 시 공제 없음
  if (totalSpent <= threshold) {
    return { deduction: 0, details: '최저사용금액 미달' }
  }

  // 초과분 계산 — 소비 순서: 신용카드(15%) → 체크/현금(30%) → 전통시장(40%) → 대중교통(40%) → 문화비(30%)
  // 세법상 최저사용금액은 공제율 낮은 것부터 차감
  let remainingThreshold = threshold

  // 신용카드부터 최저사용금액 차감
  const creditUsedForThreshold = Math.min(input.creditCardSpent, remainingThreshold)
  remainingThreshold -= creditUsedForThreshold

  const debitUsedForThreshold = Math.min(input.debitCardSpent + input.cashReceiptSpent, remainingThreshold)
  remainingThreshold -= debitUsedForThreshold

  // 나머지 (전통시장, 대중교통, 문화비)에서 차감
  const transitUsedForThreshold = Math.min(input.transitSpent, remainingThreshold)
  remainingThreshold -= transitUsedForThreshold

  const marketUsedForThreshold = Math.min(input.traditionalMarketSpent, remainingThreshold)
  remainingThreshold -= marketUsedForThreshold

  const cultureUsedForThreshold = Math.min(input.cultureSpent, remainingThreshold)
  remainingThreshold -= cultureUsedForThreshold

  // 공제 대상 금액 (초과분)
  const creditExcess = input.creditCardSpent - creditUsedForThreshold
  const debitExcess = (input.debitCardSpent + input.cashReceiptSpent) - debitUsedForThreshold
  const transitExcess = input.transitSpent - transitUsedForThreshold
  const marketExcess = input.traditionalMarketSpent - marketUsedForThreshold
  const cultureExcess = input.cultureSpent - cultureUsedForThreshold

  // 공제율 적용
  const creditDeduction = creditExcess * 0.15
  const debitDeduction = debitExcess * 0.30
  const transitDeduction = transitExcess * 0.80 // 2024년 한시 80%
  const marketDeduction = marketExcess * 0.40
  const cultureDeduction = annualSalary <= 70_000_000 ? cultureExcess * 0.30 : 0

  // 기본한도
  let basicLimit: number
  if (annualSalary <= 70_000_000) {
    basicLimit = 3_000_000
  } else if (annualSalary <= 120_000_000) {
    basicLimit = 2_500_000
  } else {
    basicLimit = 2_000_000
  }

  // 기본공제 대상 (신용카드 + 체크카드/현금)
  const basicDeduction = Math.min(creditDeduction + debitDeduction, basicLimit)

  // 추가한도 (각 100만원)
  const transitBonus = Math.min(transitDeduction, 1_000_000)
  const marketBonus = Math.min(marketDeduction, 1_000_000)
  const cultureBonus = Math.min(cultureDeduction, 1_000_000)

  const totalDeduction = basicDeduction + transitBonus + marketBonus + cultureBonus

  return {
    deduction: Math.round(totalDeduction),
    details: `기본 ${Math.round(basicDeduction).toLocaleString()}원 + 대중교통 ${Math.round(transitBonus).toLocaleString()}원 + 전통시장 ${Math.round(marketBonus).toLocaleString()}원 + 문화비 ${Math.round(cultureBonus).toLocaleString()}원`,
  }
}

// ─────────────────────────────────────────────
// 산출세액 계산 (종합소득세 세율표 2024)
// ─────────────────────────────────────────────

/**
 * 과세표준에 대한 산출세액 계산
 * - ~1,400만: 6%
 * - 1,400~5,000만: 84만 + 15%
 * - 5,000~8,800만: 624만 + 24%
 * - 8,800~1.5억: 1,536만 + 35%
 * - 1.5억~3억: 3,706만 + 38%
 * - 3억~5억: 9,406만 + 40%
 * - 5억~10억: 17,406만 + 42%
 * - 10억~: 38,406만 + 45%
 */
function calcIncomeTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0

  if (taxableIncome <= 14_000_000) {
    return taxableIncome * 0.06
  } else if (taxableIncome <= 50_000_000) {
    return 840_000 + (taxableIncome - 14_000_000) * 0.15
  } else if (taxableIncome <= 88_000_000) {
    return 6_240_000 + (taxableIncome - 50_000_000) * 0.24
  } else if (taxableIncome <= 150_000_000) {
    return 15_360_000 + (taxableIncome - 88_000_000) * 0.35
  } else if (taxableIncome <= 300_000_000) {
    return 37_060_000 + (taxableIncome - 150_000_000) * 0.38
  } else if (taxableIncome <= 500_000_000) {
    return 94_060_000 + (taxableIncome - 300_000_000) * 0.40
  } else if (taxableIncome <= 1_000_000_000) {
    return 174_060_000 + (taxableIncome - 500_000_000) * 0.42
  } else {
    return 384_060_000 + (taxableIncome - 1_000_000_000) * 0.45
  }
}

// ─────────────────────────────────────────────
// 근로소득 세액공제 계산
// ─────────────────────────────────────────────

/**
 * 근로소득 세액공제
 * - 산출세액 130만 이하: 산출세액 × 55%
 * - 산출세액 130만 초과: 71.5만 + (산출세액 - 130만) × 30%
 *
 * 한도:
 * - 총급여 3,300만 이하: 74만
 * - 3,300만~7,000만: 74만 - (총급여-3,300만)×0.008, 최소 66만
 * - 7,000만 초과: 66만 - (총급여-7,000만)×0.5, 최소 50만
 */
function calcEarnedIncomeTaxCredit(calculatedTax: number, grossSalary: number): number {
  let credit: number
  if (calculatedTax <= 1_300_000) {
    credit = calculatedTax * 0.55
  } else {
    credit = 715_000 + (calculatedTax - 1_300_000) * 0.30
  }

  // 한도 적용
  let limit: number
  if (grossSalary <= 33_000_000) {
    limit = 740_000
  } else if (grossSalary <= 70_000_000) {
    limit = Math.max(660_000, 740_000 - (grossSalary - 33_000_000) * 0.008)
  } else {
    limit = Math.max(500_000, 660_000 - (grossSalary - 70_000_000) * 0.5)
  }

  return Math.min(credit, limit)
}

// ─────────────────────────────────────────────
// 자녀 세액공제 계산
// ─────────────────────────────────────────────

/**
 * 자녀 세액공제 (8세 이상)
 * - 1명: 15만원
 * - 2명: 35만원
 * - 3명 이상: 35만 + (3명째부터 1명당 30만)
 */
function calcChildTaxCredit(children: number): number {
  if (children <= 0) return 0
  if (children === 1) return 150_000
  if (children === 2) return 350_000
  return 350_000 + (children - 2) * 300_000
}

// ─────────────────────────────────────────────
// 연금저축/IRP 세액공제 계산
// ─────────────────────────────────────────────

/**
 * 연금저축/IRP 세액공제
 * - 연금저축 한도: 600만원
 * - IRP 포함 합산 한도: 900만원
 * - 공제율: 총급여 5,500만 이하 16.5%, 초과 13.2%
 */
function calcPensionTaxCredit(pensionSavings: number, irp: number, grossSalary: number): number {
  const pensionCapped = Math.min(pensionSavings, 6_000_000)
  const totalCapped = Math.min(pensionCapped + irp, 9_000_000)
  const rate = grossSalary <= 55_000_000 ? 0.165 : 0.132
  return Math.round(totalCapped * rate)
}

// ─────────────────────────────────────────────
// 의료비 세액공제 계산
// ─────────────────────────────────────────────

/**
 * 의료비 세액공제
 * - 총급여 3% 초과분에 대해 15%
 * - 한도: 700만원 (본인/장애인/난임은 무한도이나, 여기서는 일반 기준)
 */
function calcMedicalTaxCredit(medicalExpense: number, grossSalary: number): number {
  const threshold = grossSalary * 0.03
  const deductible = Math.max(0, medicalExpense - threshold)
  // 일반 한도 700만원 적용 (본인/장애인/난임 무한도는 별도 처리 필요)
  const capped = Math.min(deductible, 7_000_000)
  return Math.round(capped * 0.15)
}

// ─────────────────────────────────────────────
// 교육비 세액공제 계산
// ─────────────────────────────────────────────

/**
 * 교육비 세액공제
 * - 본인: 한도 없음, 15%
 * - 자녀: 1인당 300만원 한도, 15%
 */
function calcEducationTaxCredit(selfExpense: number, childExpense: number, children: number): number {
  const selfCredit = selfExpense * 0.15
  // 자녀 교육비: 자녀 수 × 300만원 한도
  const childLimit = children > 0 ? children * 3_000_000 : 3_000_000
  const childCredit = Math.min(childExpense, childLimit) * 0.15
  return Math.round(selfCredit + childCredit)
}

// ─────────────────────────────────────────────
// 기부금 세액공제 계산
// ─────────────────────────────────────────────

/**
 * 기부금 세액공제
 * - 법정기부금: 전액 (근로소득금액 한도)
 * - 지정기부금: 근로소득금액 30% 한도
 * - 공제율: 1,000만원 이하 15%, 초과분 30%
 */
function calcDonationTaxCredit(
  donationLegal: number,
  donationDesignated: number,
  earnedIncome: number
): number {
  // 법정기부금 (근로소득금액 전액 한도)
  const legalCapped = Math.min(donationLegal, earnedIncome)
  // 지정기부금 (근로소득금액 30% 한도)
  const designatedLimit = earnedIncome * 0.30
  const designatedCapped = Math.min(donationDesignated, designatedLimit)

  const totalDonation = legalCapped + designatedCapped

  // 1,000만원 이하 15%, 초과분 30%
  if (totalDonation <= 10_000_000) {
    return Math.round(totalDonation * 0.15)
  } else {
    return Math.round(10_000_000 * 0.15 + (totalDonation - 10_000_000) * 0.30)
  }
}

// ─────────────────────────────────────────────
// 월세 세액공제 계산
// ─────────────────────────────────────────────

/**
 * 월세 세액공제
 * - 총급여 5,500만 이하: 17%
 * - 총급여 5,500만 ~ 8,000만: 15%
 * - 총급여 8,000만 초과: 적용 불가
 * - 한도: 연 1,000만원
 */
function calcRentTaxCredit(monthlyRent: number, grossSalary: number): number {
  if (grossSalary > 80_000_000) return 0
  const capped = Math.min(monthlyRent, 10_000_000)
  const rate = grossSalary <= 55_000_000 ? 0.17 : 0.15
  return Math.round(capped * rate)
}

// ─────────────────────────────────────────────
// 주택청약 소득공제 계산
// ─────────────────────────────────────────────

/**
 * 주택청약 소득공제
 * - 무주택 세대주, 총급여 7,000만 이하
 * - 납입액의 40%, 한도 300만원 (연 납입 240만원 한도 → 공제 96만원)
 */
function calcHousingSubscriptionDeduction(housingSubscription: number, grossSalary: number): number {
  if (grossSalary > 70_000_000) return 0
  const annualCapped = Math.min(housingSubscription, 2_400_000) // 납입한도 연 240만원
  const deduction = annualCapped * 0.40
  return Math.min(deduction, 3_000_000) // 공제한도 300만원
}

// ─────────────────────────────────────────────
// 메인 시뮬레이션 함수
// ─────────────────────────────────────────────

/**
 * 연말정산 전체 시뮬레이션 실행
 *
 * @param input 연말정산 입력값
 * @returns 연말정산 결과 (환급/추납 포함)
 */
export function simulateYearEndTax(input: YearEndTaxInput): YearEndTaxResult {
  const { annualSalary } = input

  // ────── 1. 총급여 ──────
  const grossSalary = annualSalary

  // ────── 2. 근로소득공제 ──────
  const earnedIncomeDeduction = calcEarnedIncomeDeduction(grossSalary)

  // ────── 3. 근로소득금액 ──────
  const earnedIncome = grossSalary - earnedIncomeDeduction

  // ────── 4. 소득공제 ──────
  const incomeDeductionBreakdown: { label: string; amount: number }[] = []

  // 4-1. 인적공제 (본인 150만 + 부양가족 1인당 150만)
  const personalExemption = (1 + input.dependents) * 1_500_000
  incomeDeductionBreakdown.push({ label: '인적공제', amount: personalExemption })

  // 4-2. 국민연금
  const nationalPension = input.nationalPension ?? calcNationalPension(grossSalary)
  incomeDeductionBreakdown.push({ label: '국민연금', amount: nationalPension })

  // 4-3. 건강보험 (장기요양 포함)
  const healthInsurance = input.healthInsurance ?? calcHealthInsurance(grossSalary)
  incomeDeductionBreakdown.push({ label: '건강보험', amount: healthInsurance })

  // 4-4. 고용보험
  const employmentInsurance = input.employmentInsurance ?? calcEmploymentInsurance(grossSalary)
  incomeDeductionBreakdown.push({ label: '고용보험', amount: employmentInsurance })

  // 4-5. 신용카드 등 소득공제
  const cardDeduction = calcCardDeduction(input)
  if (cardDeduction.deduction > 0) {
    incomeDeductionBreakdown.push({ label: '신용카드 등 소득공제', amount: cardDeduction.deduction })
  }

  // 4-6. 주택청약 소득공제
  const housingDeduction = calcHousingSubscriptionDeduction(input.housingSubscription, grossSalary)
  if (housingDeduction > 0) {
    incomeDeductionBreakdown.push({ label: '주택청약 소득공제', amount: housingDeduction })
  }

  // 4-7. 주택임차차입금 원리금 (간소화: 별도 입력 없이 월세와 통합하지 않음)
  // 한도 400만원 — 향후 확장 가능

  // 소득공제 합계
  const totalIncomeDeduction = incomeDeductionBreakdown.reduce((sum, item) => sum + item.amount, 0)

  // ────── 5. 과세표준 ──────
  const taxableIncome = Math.max(0, earnedIncome - totalIncomeDeduction)

  // ────── 6. 산출세액 ──────
  let calculatedTax = calcIncomeTax(taxableIncome)

  // 중소기업 취업 청년 소득세 감면 (90%)
  if (input.isSMEYouth) {
    calculatedTax = Math.round(calculatedTax * 0.10) // 10%만 납부 (90% 감면)
  }

  // ────── 7. 세액공제 ──────
  const taxCreditBreakdown: { label: string; amount: number }[] = []

  // 7-1. 근로소득 세액공제
  const earnedIncomeTaxCredit = calcEarnedIncomeTaxCredit(calculatedTax, grossSalary)
  taxCreditBreakdown.push({ label: '근로소득 세액공제', amount: Math.round(earnedIncomeTaxCredit) })

  // 7-2. 자녀 세액공제
  const childCredit = calcChildTaxCredit(input.children)
  if (childCredit > 0) {
    taxCreditBreakdown.push({ label: '자녀 세액공제', amount: childCredit })
  }

  // 7-3. 연금저축/IRP 세액공제
  const pensionCredit = calcPensionTaxCredit(input.pensionSavings, input.irp, grossSalary)
  if (pensionCredit > 0) {
    taxCreditBreakdown.push({ label: '연금저축/IRP 세액공제', amount: pensionCredit })
  }

  // 7-4. 보험료 세액공제 (보장성 100만원 한도, 12%)
  const insuranceCredit = Math.round(Math.min(input.insurancePremium, 1_000_000) * 0.12)
  if (insuranceCredit > 0) {
    taxCreditBreakdown.push({ label: '보험료 세액공제', amount: insuranceCredit })
  }

  // 7-5. 의료비 세액공제
  const medicalCredit = calcMedicalTaxCredit(input.medicalExpense, grossSalary)
  if (medicalCredit > 0) {
    taxCreditBreakdown.push({ label: '의료비 세액공제', amount: medicalCredit })
  }

  // 7-6. 교육비 세액공제
  const educationCredit = calcEducationTaxCredit(
    input.educationExpenseSelf,
    input.educationExpenseChild,
    input.children
  )
  if (educationCredit > 0) {
    taxCreditBreakdown.push({ label: '교육비 세액공제', amount: educationCredit })
  }

  // 7-7. 기부금 세액공제
  const donationCredit = calcDonationTaxCredit(
    input.donationLegal,
    input.donationDesignated,
    earnedIncome
  )
  if (donationCredit > 0) {
    taxCreditBreakdown.push({ label: '기부금 세액공제', amount: donationCredit })
  }

  // 7-8. 월세 세액공제
  const rentCredit = calcRentTaxCredit(input.monthlyRent, grossSalary)
  if (rentCredit > 0) {
    taxCreditBreakdown.push({ label: '월세 세액공제', amount: rentCredit })
  }

  // 7-9. 혼인 세액공제 (2024-2026, 50만원)
  if (input.isNewlyWed) {
    taxCreditBreakdown.push({ label: '혼인 세액공제', amount: 500_000 })
  }

  // 표준세액공제 판단: 항목별 공제 합계가 13만원 미만이면 표준세액공제 적용
  const itemizedCredits = taxCreditBreakdown
    .filter(item => item.label !== '근로소득 세액공제' && item.label !== '자녀 세액공제')
    .reduce((sum, item) => sum + item.amount, 0)

  if (itemizedCredits < 130_000) {
    // 항목별 공제 제거 후 표준세액공제 적용
    const toRemove = taxCreditBreakdown.filter(
      item => item.label !== '근로소득 세액공제' && item.label !== '자녀 세액공제'
    )
    for (const item of toRemove) {
      const idx = taxCreditBreakdown.indexOf(item)
      if (idx !== -1) taxCreditBreakdown.splice(idx, 1)
    }
    taxCreditBreakdown.push({ label: '표준세액공제', amount: 130_000 })
  }

  // 세액공제 합계
  const totalTaxCredit = taxCreditBreakdown.reduce((sum, item) => sum + item.amount, 0)

  // ────── 8. 결정세액 ──────
  const determinedTax = Math.max(0, Math.round(calculatedTax - totalTaxCredit))

  // ────── 9. 기납부세액 ──────
  const prepaidTax = input.prepaidTax

  // ────── 10. 차감징수세액 (양수: 추납, 음수: 환급) ──────
  const finalTax = determinedTax - prepaidTax

  // 실효세율
  const effectiveTaxRate = grossSalary > 0
    ? Math.round((determinedTax / grossSalary) * 10000) / 100
    : 0

  return {
    grossSalary,
    earnedIncomeDeduction: Math.round(earnedIncomeDeduction),
    earnedIncome: Math.round(earnedIncome),
    totalIncomeDeduction: Math.round(totalIncomeDeduction),
    taxableIncome: Math.round(taxableIncome),
    calculatedTax: Math.round(calculatedTax),
    totalTaxCredit: Math.round(totalTaxCredit),
    determinedTax,
    prepaidTax,
    finalTax,
    incomeDeductionBreakdown: incomeDeductionBreakdown.map(item => ({
      label: item.label,
      amount: Math.round(item.amount),
    })),
    taxCreditBreakdown: taxCreditBreakdown.map(item => ({
      label: item.label,
      amount: Math.round(item.amount),
    })),
    effectiveTaxRate,
  }
}

// ─────────────────────────────────────────────
// 기납부세액 추정 (간이세액표 기반)
// ─────────────────────────────────────────────

/**
 * 간이세액표 기반 기납부세액(원천징수세액) 추정
 *
 * 실제 간이세액표는 매우 세밀하지만, 여기서는 간소화된 공식으로 추정한다.
 * 매월 원천징수되는 세금을 연간으로 합산한 값을 반환.
 *
 * 추정 방식:
 * 1. 연간 기준 과세표준 산출 (인적공제만 반영)
 * 2. 세율 적용 후 근로소득 세액공제 적용
 * 3. 결과를 12개월 원천징수 합산으로 반환
 *
 * @param annualSalary 연간 총급여
 * @param dependents 부양가족 수 (본인 제외)
 * @returns 연간 추정 기납부세액 (원천징수세 합산)
 */
export function estimatePrepaidTax(annualSalary: number, dependents: number): number {
  // 근로소득공제
  const earnedIncomeDeduction = calcEarnedIncomeDeduction(annualSalary)
  const earnedIncome = annualSalary - earnedIncomeDeduction

  // 기본 소득공제 (인적공제 + 사대보험 추정)
  const personalExemption = (1 + dependents) * 1_500_000
  const socialInsurance =
    calcNationalPension(annualSalary) +
    calcHealthInsurance(annualSalary) +
    calcEmploymentInsurance(annualSalary)

  const estimatedDeductions = personalExemption + socialInsurance

  // 과세표준
  const taxableIncome = Math.max(0, earnedIncome - estimatedDeductions)

  // 산출세액
  const calculatedTax = calcIncomeTax(taxableIncome)

  // 근로소득 세액공제
  const earnedIncomeTaxCredit = calcEarnedIncomeTaxCredit(calculatedTax, annualSalary)

  // 결정세액 (원천징수 기준은 약간의 보정 적용 — 간이세액표는 약 80% 수준으로 원천징수)
  const determinedTax = Math.max(0, calculatedTax - earnedIncomeTaxCredit)

  // 간이세액표는 일반적으로 결정세액의 약 100% 수준 (2020년 이후 조정)
  // 실무에서는 근로자가 80%/100%/120% 중 선택 가능, 기본은 100%
  return Math.round(determinedTax)
}

// ─────────────────────────────────────────────
// 유틸리티: 기본값으로 빠른 시뮬레이션
// ─────────────────────────────────────────────

/**
 * 최소 입력으로 연말정산 시뮬레이션 실행
 * 미입력 항목은 0으로 처리
 */
export function quickSimulate(
  annualSalary: number,
  dependents: number = 0,
  overrides: Partial<YearEndTaxInput> = {}
): YearEndTaxResult {
  const defaultInput: YearEndTaxInput = {
    annualSalary,
    dependents,
    creditCardSpent: 0,
    debitCardSpent: 0,
    cashReceiptSpent: 0,
    transitSpent: 0,
    traditionalMarketSpent: 0,
    cultureSpent: 0,
    pensionSavings: 0,
    irp: 0,
    insurancePremium: 0,
    medicalExpense: 0,
    educationExpenseSelf: 0,
    educationExpenseChild: 0,
    donationLegal: 0,
    donationDesignated: 0,
    monthlyRent: 0,
    housingSubscription: 0,
    children: 0,
    prepaidTax: estimatePrepaidTax(annualSalary, dependents),
    ...overrides,
  }

  return simulateYearEndTax(defaultInput)
}
