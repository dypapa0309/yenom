export { detectDeductionTypes, calcDeductionSummary, DEDUCTION_INFO } from './deduction-rules'
export type { DeductionType, DeductionTag, DeductionSummary } from './deduction-rules'

export { calcDeductionProgress, calcTotalEstimatedRefund } from './deduction-calculator'
export type { DeductionLimits, DeductionProgress } from './deduction-calculator'

export { analyzeCardRatio, checkCardSwitchAlert, detectPaymentMethod } from './card-ratio'
export type { CardRatioAnalysis, CardRecommendation, CardSwitchAlert, PaymentMethod } from './card-ratio'

export { generateTaxInsights } from './tax-insights'

export { simulateYearEndTax, estimatePrepaidTax, quickSimulate } from './year-end-simulator'
export type { YearEndTaxInput, YearEndTaxResult } from './year-end-simulator'

export { generateCardOptimizationPlan, getMonthlyCardTarget } from './card-optimization'
export type { CardOptimizationPlan } from './card-optimization'

export { compareStandardVsItemized, generateStandardDeductionInsight } from './standard-deduction-compare'
export type { StandardDeductionComparison } from './standard-deduction-compare'
