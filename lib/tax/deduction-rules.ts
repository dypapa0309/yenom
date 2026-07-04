import { Category, Transaction } from '@/types'

// 소득공제/세액공제 구분
export type DeductionType =
  | 'medical'        // 의료비 세액공제
  | 'education'      // 교육비 세액공제
  | 'insurance'      // 보험료 세액공제
  | 'donation'       // 기부금 세액공제
  | 'pension'        // 연금저축 세액공제
  | 'irp'            // IRP 세액공제
  | 'transit'        // 대중교통 소득공제 (40%)
  | 'traditional_market' // 전통시장 소득공제 (40%)
  | 'credit_card'    // 신용카드 소득공제 (15%)
  | 'debit_card'     // 체크카드/현금 소득공제 (30%)

export interface DeductionTag {
  type: DeductionType
  label: string
  rate: string          // 공제율 표시용
  description: string
}

export const DEDUCTION_INFO: Record<DeductionType, DeductionTag> = {
  medical: {
    type: 'medical',
    label: '의료비',
    rate: '15%',
    description: '총급여 3% 초과분에 대해 15% 세액공제 (한도 700만원)',
  },
  education: {
    type: 'education',
    label: '교육비',
    rate: '15%',
    description: '본인 전액, 자녀 1인당 300만원 한도 세액공제',
  },
  insurance: {
    type: 'insurance',
    label: '보험료',
    rate: '12%',
    description: '보장성보험 연 100만원 한도 세액공제',
  },
  donation: {
    type: 'donation',
    label: '기부금',
    rate: '15~30%',
    description: '법정기부금 전액, 지정기부금 소득 30% 한도',
  },
  pension: {
    type: 'pension',
    label: '연금저축',
    rate: '13.2~16.5%',
    description: '연 600만원 한도 세액공제',
  },
  irp: {
    type: 'irp',
    label: 'IRP',
    rate: '13.2~16.5%',
    description: '연금저축 포함 연 900만원 한도 세액공제',
  },
  transit: {
    type: 'transit',
    label: '대중교통',
    rate: '40%',
    description: '대중교통 사용분 40% 소득공제',
  },
  traditional_market: {
    type: 'traditional_market',
    label: '전통시장',
    rate: '40%',
    description: '전통시장 사용분 40% 소득공제',
  },
  credit_card: {
    type: 'credit_card',
    label: '신용카드',
    rate: '15%',
    description: '총급여 25% 초과분에 대해 15% 소득공제',
  },
  debit_card: {
    type: 'debit_card',
    label: '체크카드/현금',
    rate: '30%',
    description: '총급여 25% 초과분에 대해 30% 소득공제',
  },
}

// 카테고리 → 공제 유형 매핑
const CATEGORY_DEDUCTION_MAP: Partial<Record<Category, DeductionType>> = {
  '의료/약국': 'medical',
  '교육': 'education',
}

// 키워드 기반 공제 감지 (카테고리보다 우선)
const KEYWORD_DEDUCTION_RULES: { keywords: string[]; type: DeductionType }[] = [
  // 의료비
  {
    keywords: ['병원', '의원', '한의원', '치과', '안과', '이비인후과', '피부과', '약국', '건강검진', '검진센터', '재활', '정형외과', '내과'],
    type: 'medical',
  },
  // 교육비
  {
    keywords: ['학원', '과외', '인강', '교재', '학습지', '클래스101', '유데미', 'udemy', 'coursera', '어학원'],
    type: 'education',
  },
  // 보험료
  {
    keywords: ['보험', '생명보험', '손해보험', '자동차보험', '실손', '의료실비'],
    type: 'insurance',
  },
  // 기부금
  {
    keywords: ['기부', '후원', '자선', '적십자', '유니세프', '월드비전', '굿네이버스', '초록우산', '사회복지'],
    type: 'donation',
  },
  // 연금저축
  {
    keywords: ['연금저축', '연금펀드', '연금보험'],
    type: 'pension',
  },
  // IRP
  {
    keywords: ['IRP', '퇴직연금', '개인형퇴직연금'],
    type: 'irp',
  },
  // 대중교통
  {
    keywords: ['버스', '지하철', 'T-money', '티머니', '후불교통', '교통카드', 'KTX', 'SRT', '코레일', '무궁화', '새마을', '고속버스', '시외버스', '공항버스'],
    type: 'transit',
  },
  // 전통시장
  {
    keywords: ['전통시장', '재래시장', '수산시장', '농수산물시장', '중앙시장', '남대문시장', '동대문시장', '광장시장'],
    type: 'traditional_market',
  },
]

/**
 * 거래에 대한 공제 유형을 판별한다.
 * 하나의 거래가 여러 공제 유형에 해당할 수 있다 (예: 대중교통 + 체크카드).
 */
export function detectDeductionTypes(tx: Transaction): DeductionType[] {
  if (tx.type !== 'expense' || tx.excluded) return []

  const types: DeductionType[] = []
  const desc = (tx.description + ' ' + (tx.merchant_name ?? '')).toLowerCase().replace(/\s/g, '')

  // 1. 키워드 매칭
  for (const rule of KEYWORD_DEDUCTION_RULES) {
    for (const kw of rule.keywords) {
      if (desc.includes(kw.toLowerCase().replace(/\s/g, ''))) {
        if (!types.includes(rule.type)) {
          types.push(rule.type)
        }
        break
      }
    }
  }

  // 2. 카테고리 매칭 (키워드에서 못 잡은 경우)
  const catType = CATEGORY_DEDUCTION_MAP[tx.category]
  if (catType && !types.includes(catType)) {
    types.push(catType)
  }

  return types
}

/**
 * 거래 목록에서 공제 유형별 합산을 계산한다.
 */
export interface DeductionSummary {
  type: DeductionType
  label: string
  totalAmount: number
  count: number
  rate: string
  description: string
}

export function calcDeductionSummary(transactions: Transaction[]): DeductionSummary[] {
  const map = new Map<DeductionType, { amount: number; count: number }>()

  for (const tx of transactions) {
    const types = detectDeductionTypes(tx)
    for (const type of types) {
      const entry = map.get(type) ?? { amount: 0, count: 0 }
      entry.amount += tx.amount
      entry.count += 1
      map.set(type, entry)
    }
  }

  const summaries: DeductionSummary[] = []
  for (const [type, { amount, count }] of map) {
    const info = DEDUCTION_INFO[type]
    summaries.push({
      type,
      label: info.label,
      totalAmount: amount,
      count,
      rate: info.rate,
      description: info.description,
    })
  }

  return summaries.sort((a, b) => b.totalAmount - a.totalAmount)
}
