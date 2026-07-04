import { Transaction } from '@/types'
import { DeductionType, DEDUCTION_INFO, detectDeductionTypes } from './deduction-rules'

/**
 * 연말정산 공제 한도 설정
 */
export interface DeductionLimits {
  annualSalary: number           // 총급여액
  // 세액공제 한도
  medicalLimit: number           // 의료비 한도 (700만원, 본인/장애인/난임 무한도)
  educationLimitSelf: number     // 교육비 본인 (무한도)
  educationLimitChild: number    // 교육비 자녀 1인 300만원
  insuranceLimit: number         // 보장성보험 100만원
  donationLimit: number          // 지정기부금 소득 30%
  pensionLimit: number           // 연금저축 600만원
  irpLimit: number               // IRP 포함 900만원
  // 소득공제 한도
  cardTotalLimit: number         // 신용카드 등 소득공제 한도 (300만원 기본)
  transitBonus: number           // 대중교통 추가한도 (100만원)
  marketBonus: number            // 전통시장 추가한도 (100만원)
}

const DEFAULT_LIMITS: DeductionLimits = {
  annualSalary: 50_000_000,      // 기본 5천만원 가정 (사용자 설정 가능)
  medicalLimit: 7_000_000,
  educationLimitSelf: Infinity,
  educationLimitChild: 3_000_000,
  insuranceLimit: 1_000_000,
  donationLimit: Infinity,
  pensionLimit: 6_000_000,
  irpLimit: 9_000_000,
  cardTotalLimit: 3_000_000,
  transitBonus: 1_000_000,
  marketBonus: 1_000_000,
}

export interface DeductionProgress {
  type: DeductionType
  label: string
  spent: number
  limit: number
  percentage: number
  remaining: number
  estimatedRefund: number
  rate: string
}

/**
 * 공제 한도 대비 현재 진행률을 계산한다.
 * 연간 거래를 기준으로 계산.
 */
export function calcDeductionProgress(
  yearTransactions: Transaction[],
  limits: Partial<DeductionLimits> = {}
): DeductionProgress[] {
  const config = { ...DEFAULT_LIMITS, ...limits }
  const progress: DeductionProgress[] = []

  // 유형별 합산
  const totals = new Map<DeductionType, number>()
  for (const tx of yearTransactions) {
    const types = detectDeductionTypes(tx)
    for (const type of types) {
      totals.set(type, (totals.get(type) ?? 0) + tx.amount)
    }
  }

  // 의료비: 총급여 3% 초과분부터 공제
  const medicalSpent = totals.get('medical') ?? 0
  const medicalThreshold = config.annualSalary * 0.03
  const medicalDeductible = Math.max(0, medicalSpent - medicalThreshold)
  progress.push({
    type: 'medical',
    label: '의료비',
    spent: medicalSpent,
    limit: config.medicalLimit + medicalThreshold,
    percentage: medicalSpent > 0 ? Math.min(100, (medicalDeductible / config.medicalLimit) * 100) : 0,
    remaining: Math.max(0, config.medicalLimit - medicalDeductible),
    estimatedRefund: Math.round(Math.min(medicalDeductible, config.medicalLimit) * 0.15),
    rate: '15%',
  })

  // 교육비
  const eduSpent = totals.get('education') ?? 0
  const eduLimit = config.educationLimitChild // 자녀 기준 (본인은 무한도)
  progress.push({
    type: 'education',
    label: '교육비',
    spent: eduSpent,
    limit: eduLimit,
    percentage: eduLimit === Infinity ? 0 : Math.min(100, (eduSpent / eduLimit) * 100),
    remaining: eduLimit === Infinity ? Infinity : Math.max(0, eduLimit - eduSpent),
    estimatedRefund: Math.round(Math.min(eduSpent, eduLimit) * 0.15),
    rate: '15%',
  })

  // 보험료
  const insSpent = totals.get('insurance') ?? 0
  progress.push({
    type: 'insurance',
    label: '보험료',
    spent: insSpent,
    limit: config.insuranceLimit,
    percentage: Math.min(100, (insSpent / config.insuranceLimit) * 100),
    remaining: Math.max(0, config.insuranceLimit - insSpent),
    estimatedRefund: Math.round(Math.min(insSpent, config.insuranceLimit) * 0.12),
    rate: '12%',
  })

  // 연금저축
  const pensionSpent = totals.get('pension') ?? 0
  progress.push({
    type: 'pension',
    label: '연금저축',
    spent: pensionSpent,
    limit: config.pensionLimit,
    percentage: Math.min(100, (pensionSpent / config.pensionLimit) * 100),
    remaining: Math.max(0, config.pensionLimit - pensionSpent),
    estimatedRefund: Math.round(Math.min(pensionSpent, config.pensionLimit) * 0.132),
    rate: '13.2%',
  })

  // IRP (연금저축 포함)
  const irpSpent = totals.get('irp') ?? 0
  const irpCombined = pensionSpent + irpSpent
  progress.push({
    type: 'irp',
    label: 'IRP(연금 포함)',
    spent: irpCombined,
    limit: config.irpLimit,
    percentage: Math.min(100, (irpCombined / config.irpLimit) * 100),
    remaining: Math.max(0, config.irpLimit - irpCombined),
    estimatedRefund: Math.round(Math.min(irpCombined, config.irpLimit) * 0.132),
    rate: '13.2%',
  })

  // 기부금
  const donationSpent = totals.get('donation') ?? 0
  if (donationSpent > 0) {
    progress.push({
      type: 'donation',
      label: '기부금',
      spent: donationSpent,
      limit: config.donationLimit === Infinity ? donationSpent * 2 : config.donationLimit,
      percentage: 0,
      remaining: Infinity,
      estimatedRefund: Math.round(donationSpent * 0.15),
      rate: '15%',
    })
  }

  // 대중교통 (소득공제)
  const transitSpent = totals.get('transit') ?? 0
  if (transitSpent > 0) {
    progress.push({
      type: 'transit',
      label: '대중교통',
      spent: transitSpent,
      limit: config.transitBonus,
      percentage: Math.min(100, (transitSpent / config.transitBonus) * 100),
      remaining: Math.max(0, config.transitBonus - transitSpent),
      estimatedRefund: Math.round(Math.min(transitSpent, config.transitBonus) * 0.4),
      rate: '40%',
    })
  }

  // 전통시장 (소득공제)
  const marketSpent = totals.get('traditional_market') ?? 0
  if (marketSpent > 0) {
    progress.push({
      type: 'traditional_market',
      label: '전통시장',
      spent: marketSpent,
      limit: config.marketBonus,
      percentage: Math.min(100, (marketSpent / config.marketBonus) * 100),
      remaining: Math.max(0, config.marketBonus - marketSpent),
      estimatedRefund: Math.round(Math.min(marketSpent, config.marketBonus) * 0.4),
      rate: '40%',
    })
  }

  return progress.filter(p => p.spent > 0 || ['medical', 'insurance', 'pension', 'irp'].includes(p.type))
}

/**
 * 총 예상 환급액 계산
 */
export function calcTotalEstimatedRefund(progress: DeductionProgress[]): number {
  return progress.reduce((sum, p) => sum + p.estimatedRefund, 0)
}
