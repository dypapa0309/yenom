import { Transaction } from '@/types'
import { Insight } from '@/lib/insights/generator'
import { DeductionProgress, calcDeductionProgress, calcTotalEstimatedRefund } from './deduction-calculator'
import { analyzeCardRatio, checkCardSwitchAlert } from './card-ratio'

/** 만원 단위로 포맷 (예: 396000 → "39.6만원") */
function formatMan(won: number): string {
  const man = won / 10000
  if (man >= 1 && man === Math.floor(man)) return `${man}만원`
  if (man >= 1) return `${parseFloat(man.toFixed(1))}만원`
  return `${won.toLocaleString()}원`
}

/**
 * 총급여 기반 세액공제율 반환
 * 총급여 5,500만원 이하: 16.5%, 초과: 13.2%
 */
function getPensionTaxCreditRate(annualSalary: number): number {
  return annualSalary <= 55_000_000 ? 0.165 : 0.132
}

/**
 * 공제 항목별 ROI 계산 (1원 납입 대비 환급액)
 */
interface DeductionROI {
  type: string
  label: string
  roi: number              // 환급 / 납입비용 비율
  additionalRefund: number // remaining 전부 채웠을 때 추가 환급
  remaining: number
  rate: string
}

function calcDeductionROIs(progress: DeductionProgress[]): DeductionROI[] {
  const rois: DeductionROI[] = []

  for (const p of progress) {
    if (p.remaining <= 0 || p.remaining === Infinity) continue

    // 세액공제율 파싱 (예: "13.2%" → 0.132, "15%" → 0.15)
    const rateMatch = p.rate.match(/([\d.]+)%/)
    if (!rateMatch) continue
    const rate = parseFloat(rateMatch[1]) / 100
    const additionalRefund = Math.round(p.remaining * rate)

    rois.push({
      type: p.type,
      label: p.label,
      roi: rate,
      additionalRefund,
      remaining: p.remaining,
      rate: p.rate,
    })
  }

  return rois.sort((a, b) => b.roi - a.roi)
}

/**
 * 절세 관련 인사이트 생성 (스마트 맞춤 팁 포함)
 */
export function generateTaxInsights(
  yearTransactions: Transaction[],
  annualSalary: number = 50_000_000
): Insight[] {
  const insights: Insight[] = []
  const currentMonth = new Date().getMonth() + 1
  const remainingMonths = 12 - currentMonth

  // 공통 데이터 계산
  const progress = calcDeductionProgress(yearTransactions, { annualSalary })
  const cardRatio = analyzeCardRatio(yearTransactions, annualSalary)
  const pensionRate = getPensionTaxCreditRate(annualSalary)

  // ─────────────────────────────────────
  // 1. 카드 전환 알림
  // ─────────────────────────────────────
  const cardAlert = checkCardSwitchAlert(yearTransactions, annualSalary)
  if (cardAlert.triggered) {
    insights.push({
      id: 'tax-card-switch',
      severity: cardAlert.percentage >= 100 ? 'warning' : 'tip',
      title: cardAlert.percentage >= 100 ? '체크카드 전환 시점!' : '최저사용액 임박',
      description: cardAlert.message,
      amount: cardAlert.currentTotal,
    })
  }

  // ─────────────────────────────────────
  // 2. 공제 한도 도달 알림
  // ─────────────────────────────────────
  for (const p of progress) {
    if (p.percentage >= 100) {
      insights.push({
        id: `tax-limit-full-${p.type}`,
        severity: 'info',
        title: `${p.label} 공제 한도 달성`,
        description: `${p.label} 세액공제 한도를 모두 채웠습니다. 예상 환급 ${p.estimatedRefund.toLocaleString()}원`,
        amount: p.spent,
      })
    } else if (p.percentage >= 80) {
      insights.push({
        id: `tax-limit-near-${p.type}`,
        severity: 'tip',
        title: `${p.label} 공제 80% 도달`,
        description: `${p.label} 공제 한도의 ${Math.round(p.percentage)}%를 채웠습니다. ${p.remaining.toLocaleString()}원 더 사용하면 한도 달성!`,
        amount: p.spent,
      })
    }
  }

  // ─────────────────────────────────────
  // 3. IRP/연금저축 갭 계산 (환급 증가액 표시)
  // ─────────────────────────────────────
  const pensionProgress = progress.find(p => p.type === 'pension')
  const irpProgress = progress.find(p => p.type === 'irp')

  if (irpProgress && irpProgress.remaining > 0 && irpProgress.percentage < 100) {
    const additionalRefund = Math.round(irpProgress.remaining * pensionRate)
    insights.push({
      id: 'tax-irp-gap',
      severity: 'tip',
      title: `IRP에 ${formatMan(irpProgress.remaining)} 더 넣으면 환급 ${formatMan(additionalRefund)} 증가`,
      description: `현재 IRP(연금 포함) 납입액 ${formatMan(irpProgress.spent)}, 한도 ${formatMan(irpProgress.limit)}. `
        + `남은 ${formatMan(irpProgress.remaining)}을 채우면 세액공제 ${(pensionRate * 100).toFixed(1)}% 적용으로 `
        + `환급이 ${additionalRefund.toLocaleString()}원 더 늘어납니다.`,
      amount: additionalRefund,
    })
  }

  if (pensionProgress && pensionProgress.remaining > 0 && pensionProgress.percentage < 100) {
    const additionalRefund = Math.round(pensionProgress.remaining * pensionRate)

    // 월 단위 목표 (남은 달이 있을 때만)
    if (remainingMonths > 0) {
      const monthlyNeeded = Math.ceil(pensionProgress.remaining / remainingMonths)
      insights.push({
        id: 'tax-pension-monthly-goal',
        severity: 'tip',
        title: `연금저축 월 ${formatMan(monthlyNeeded)} 납입 → 한도 달성`,
        description: `연금저축 한도까지 ${formatMan(pensionProgress.remaining)} 남음. `
          + `남은 ${remainingMonths}개월간 매월 ${monthlyNeeded.toLocaleString()}원씩 납입하면 `
          + `한도 ${formatMan(pensionProgress.limit)} 달성, 추가 환급 ${additionalRefund.toLocaleString()}원.`,
        amount: pensionProgress.remaining,
      })
    } else {
      // 12월이면 한번에 납입 권고
      insights.push({
        id: 'tax-pension-yearend-push',
        severity: 'warning',
        title: `연금저축 ${formatMan(pensionProgress.remaining)} 납입하면 환급 ${formatMan(additionalRefund)} 추가`,
        description: `올해 마지막 달입니다! 연금저축에 ${pensionProgress.remaining.toLocaleString()}원을 `
          + `납입하면 세액공제 ${(pensionRate * 100).toFixed(1)}%로 ${additionalRefund.toLocaleString()}원 환급받을 수 있습니다.`,
        amount: additionalRefund,
      })
    }
  }

  // ─────────────────────────────────────
  // 4. 카드 최저사용액 문턱 정보
  // ─────────────────────────────────────
  if (!cardRatio.overThreshold && cardRatio.amountToThreshold > 0) {
    insights.push({
      id: 'tax-card-threshold-gap',
      severity: 'tip',
      title: `최저사용액까지 ${formatMan(cardRatio.amountToThreshold)} 남음`,
      description: `카드 소득공제 최저사용액(총급여 25% = ${formatMan(cardRatio.salaryThreshold)})까지 `
        + `${cardRatio.amountToThreshold.toLocaleString()}원 남았습니다. `
        + `신용카드로 채우면 포인트/혜택을 극대화하면서 최저사용액을 달성할 수 있습니다. `
        + `이후 체크카드로 전환하면 공제율 30% 적용!`,
      amount: cardRatio.amountToThreshold,
    })
  }

  // ─────────────────────────────────────
  // 5. 공제 항목별 ROI (효과 높은 순)
  // ─────────────────────────────────────
  const rois = calcDeductionROIs(progress)
  if (rois.length >= 2) {
    const top = rois[0]
    const topItems = rois
      .slice(0, 3)
      .map(r => `${r.label}(${r.rate}, +${formatMan(r.additionalRefund)})`)
      .join(' > ')
    insights.push({
      id: 'tax-deduction-roi-ranking',
      severity: 'info',
      title: `공제 효과 1위: ${top.label} (${top.rate} 환급률)`,
      description: `비용 대비 환급 효과 순위: ${topItems}. `
        + `${top.label}에 ${formatMan(top.remaining)} 더 납입하면 ${top.additionalRefund.toLocaleString()}원 추가 환급. `
        + `한도가 남은 항목 중 공제율이 높은 곳부터 채우는 것이 유리합니다.`,
      amount: top.additionalRefund,
    })
  }

  // ─────────────────────────────────────
  // 6. 카드 비율 개선 + 잔여 공제 효과 (연간 추가 사용 가능액)
  // ─────────────────────────────────────
  if (cardRatio.overThreshold) {
    const excessSpend = cardRatio.totalSpend - cardRatio.salaryThreshold
    const cardDeductionLimit = 3_000_000 // 기본 소득공제 한도
    const currentCreditDeduction = Math.min(excessSpend * 0.15, cardDeductionLimit)
    const usedDeductionRoom = currentCreditDeduction
    const remainingDeductionRoom = Math.max(0, cardDeductionLimit - usedDeductionRoom)

    if (remainingDeductionRoom > 0) {
      // 체크카드 30%면 나머지 한도 채우는데 필요한 금액
      const debitNeededForFullDeduction = Math.round(remainingDeductionRoom / 0.30)
      const additionalRefundFromDebit = Math.round(remainingDeductionRoom * 0.15) // 소득공제이므로 소득세율 적용 (약 15% 가정)
      const monthlyDebit = remainingMonths > 0 ? Math.ceil(debitNeededForFullDeduction / remainingMonths) : debitNeededForFullDeduction

      insights.push({
        id: 'tax-card-remaining-deduction',
        severity: 'tip',
        title: `체크카드 ${formatMan(debitNeededForFullDeduction)} 더 쓰면 카드공제 한도 달성`,
        description: `카드 소득공제 잔여 한도 ${formatMan(remainingDeductionRoom)}. `
          + `체크카드(30%)로 ${debitNeededForFullDeduction.toLocaleString()}원 추가 사용하면 공제 한도 달성. `
          + (remainingMonths > 0 ? `매월 약 ${monthlyDebit.toLocaleString()}원씩 체크카드 사용 목표. ` : '')
          + `예상 세금 절감 약 ${additionalRefundFromDebit.toLocaleString()}원.`,
        amount: debitNeededForFullDeduction,
      })
    }

    // 신용카드 비중 높으면 전환 효과를 금액으로 보여줌
    if (cardRatio.creditRatio > 70) {
      const creditExcess = cardRatio.creditTotal - cardRatio.salaryThreshold
      if (creditExcess > 0) {
        // 신용카드 15% vs 체크카드 30% → 차이 15%p
        const potentialGain = Math.round(Math.min(creditExcess, cardRatio.creditTotal * 0.3) * 0.15) // 30% 전환 시 추가 공제분
        insights.push({
          id: 'tax-card-ratio-savings',
          severity: 'tip',
          title: `체크카드 전환으로 최대 ${formatMan(potentialGain)} 추가 절세`,
          description: `현재 신용카드 비중 ${Math.round(cardRatio.creditRatio)}%. `
            + `최저사용액 초과분을 체크카드로 전환하면 공제율이 15%→30%로 2배. `
            + `전환 시 소득공제 추가분으로 최대 ${potentialGain.toLocaleString()}원 절세 가능합니다.`,
          amount: potentialGain,
        })
      }
    }
  }

  // ─────────────────────────────────────
  // 7. 연간 소비 속도 기반 카드공제 추가 효과 예측
  // ─────────────────────────────────────
  if (currentMonth >= 4 && remainingMonths > 0) {
    const monthlySpendRate = cardRatio.totalSpend / currentMonth
    const projectedYearTotal = monthlySpendRate * 12
    const projectedExcess = Math.max(0, projectedYearTotal - cardRatio.salaryThreshold)

    if (projectedExcess > 0 && !cardRatio.overThreshold) {
      // 아직 최저사용액 안 넘었지만 연말에는 넘을 예상
      const projectedDeduction = Math.round(projectedExcess * 0.15) // 신용카드 기준
      const projectedDeductionDebit = Math.round(projectedExcess * 0.30) // 체크카드 전환 시
      insights.push({
        id: 'tax-spend-projection',
        severity: 'info',
        title: `현재 속도면 연말 카드공제 ${formatMan(projectedDeduction)}~${formatMan(projectedDeductionDebit)} 예상`,
        description: `월평균 소비 ${formatMan(Math.round(monthlySpendRate))} 기준, `
          + `연말 총 사용 예상액 ${formatMan(Math.round(projectedYearTotal))}. `
          + `최저사용액 초과분 ${formatMan(Math.round(projectedExcess))}에 대해 `
          + `신용카드 ${projectedDeduction.toLocaleString()}원 / 체크카드 전환 시 ${projectedDeductionDebit.toLocaleString()}원 소득공제.`,
        amount: projectedDeduction,
      })
    }

    if (cardRatio.overThreshold) {
      const remainingSpend = monthlySpendRate * remainingMonths
      const additionalDeductionCredit = Math.round(remainingSpend * 0.15)
      const additionalDeductionDebit = Math.round(remainingSpend * 0.30)
      const savingsDiff = additionalDeductionDebit - additionalDeductionCredit

      if (savingsDiff > 10000) {
        insights.push({
          id: 'tax-spend-remaining-effect',
          severity: 'tip',
          title: `남은 ${remainingMonths}개월 체크카드 사용 시 공제 ${formatMan(savingsDiff)} 추가`,
          description: `월평균 소비 ${formatMan(Math.round(monthlySpendRate))} 기준, `
            + `남은 기간 예상 소비 ${formatMan(Math.round(remainingSpend))}. `
            + `전액 체크카드 사용 시 소득공제 ${additionalDeductionDebit.toLocaleString()}원 `
            + `(신용카드 대비 ${savingsDiff.toLocaleString()}원 추가 공제).`,
          amount: savingsDiff,
        })
      }
    }
  }

  // ─────────────────────────────────────
  // 8. 총 예상 환급 요약 (연말 가까울 때)
  // ─────────────────────────────────────
  if (currentMonth >= 10) {
    const totalRefund = calcTotalEstimatedRefund(progress)
    if (totalRefund > 0) {
      // 남은 항목 다 채웠을 때 최대 환급도 같이 보여줌
      const maxAdditional = rois.reduce((sum, r) => sum + r.additionalRefund, 0)
      const maxTotal = totalRefund + maxAdditional

      insights.push({
        id: 'tax-total-refund',
        severity: 'info',
        title: '연말정산 예상 환급',
        description: maxAdditional > 0
          ? `현재까지 예상 환급 약 ${totalRefund.toLocaleString()}원. `
            + `남은 공제 한도를 모두 채우면 최대 ${maxTotal.toLocaleString()}원까지 가능합니다.`
          : `현재까지 예상 세금 환급액은 약 ${totalRefund.toLocaleString()}원입니다.`,
        amount: totalRefund,
      })
    }
  }

  return insights
}
