import { Category, ParsedTransaction, UserRule } from '@/types'
import { classifyByKeyword } from './rules'

// 은행 거래구분에서 카테고리를 직접 추론할 수 있는 패턴
const BANK_CATEGORY_MAP: { keywords: string[]; category: Category }[] = [
  { keywords: ['주거', '관리비', '전기', '가스', '수도', '도시가스', '자동납부'], category: '주거/관리비' },
  { keywords: ['보험', '생명', '손해', '실손', '연금', '대출이자'], category: '금융/보험' },
  { keywords: ['통신', 'SKT', 'KT', 'LGU', 'U+'], category: '통신' },
  { keywords: ['적금', '예금', '펀드', '청약'], category: '저축/투자' },
]

export function classifyTransaction(
  tx: ParsedTransaction,
  userRules: UserRule[]
): Category {
  // 이체 타입은 카테고리 분류 대상이 아님 (대시보드에서 별도 처리)
  // 단, description 기반으로 실제 지출처를 알 수 있으면 분류
  if (tx.type === 'transfer') {
    // 이체라도 description으로 카테고리를 알 수 있으면 분류
    const byKeyword = classifyByKeyword(tx.description)
    if (byKeyword !== '기타') return byKeyword
    return '기타'
  }

  const descNorm = tx.description.toLowerCase().replace(/\s/g, '')
  const merchantNorm = (tx.merchant_name ?? '').toLowerCase().replace(/\s/g, '')

  // 1. 사용자 규칙 — 정확한 상호명 매칭
  for (const rule of userRules) {
    if (rule.merchant_name) {
      const ruleNorm = rule.merchant_name.toLowerCase().replace(/\s/g, '')
      if (merchantNorm === ruleNorm || descNorm.includes(ruleNorm)) {
        return rule.category as Category
      }
    }
  }

  // 2. 사용자 규칙 — 키워드 매칭
  for (const rule of userRules) {
    if (rule.keyword) {
      const kwNorm = rule.keyword.toLowerCase().replace(/\s/g, '')
      if (descNorm.includes(kwNorm)) {
        return rule.category as Category
      }
    }
  }

  // 3. 시스템 키워드 매칭
  const byKeyword = classifyByKeyword(tx.description)
  if (byKeyword !== '기타') return byKeyword

  // 4. merchant_name으로 한 번 더 시도
  if (tx.merchant_name && tx.merchant_name !== tx.description) {
    const byMerchant = classifyByKeyword(tx.merchant_name)
    if (byMerchant !== '기타') return byMerchant
  }

  // 5. 한글 2~4자 이름 패턴 (개인 간 이체) → 기타로 유지
  // 6. 기본값
  return '기타'
}

export function classifyBatch(
  transactions: ParsedTransaction[],
  userRules: UserRule[]
): Category[] {
  return transactions.map(tx => classifyTransaction(tx, userRules))
}
