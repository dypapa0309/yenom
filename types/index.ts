export type TransactionType = 'income' | 'expense' | 'transfer'

export const CATEGORIES = [
  '식비',
  '카페/간식',
  '배달/외식',
  '교통',
  '쇼핑',
  '주거/관리비',
  '통신',
  '의료/약국',
  '교육',
  '육아',
  '구독/디지털',
  '금융/보험',
  '저축/투자',
  '여가/취미',   // 운동, 스포츠, 문화, 오락
  '뷰티/미용',   // 미용실, 네일, 화장품
  '기타',
] as const

export type Category = typeof CATEGORIES[number]

export interface Transaction {
  id: string
  user_id: string
  upload_id: string
  transaction_date: string
  description: string
  amount: number
  type: TransactionType
  merchant_name: string | null
  category: Category
  excluded: boolean
  memo: string | null
  created_at: string
}

export interface Upload {
  id: string
  user_id: string
  filename: string
  uploaded_at: string
  source_type: string
}

export interface Budget {
  id: string
  user_id: string
  month: string
  category: Category
  budget_amount: number
  created_at?: string
}

export interface UserRule {
  id: string
  user_id: string
  keyword: string | null
  merchant_name: string | null
  category: Category
  created_at?: string
}

export interface ParsedTransaction {
  transaction_date: string
  description: string
  amount: number
  type: TransactionType
  merchant_name: string | null
}

export interface ColumnMapping {
  date: string | null
  description: string | null
  amount: string | null
  income: string | null
  expense: string | null
  type: string | null
  bankCategory: string | null  // 은행 자체 거래구분 (이동이체, 체크카드결제 등)
}

export interface MonthlyStats {
  month: string
  income: number
  expense: number
  savings: number
  savingsRate: number
}

export interface CategoryStats {
  category: Category
  amount: number
  count: number
  percentage: number
}

export interface TopMerchant {
  merchant_name: string
  amount: number
  count: number
}

export interface RecurringTransaction {
  description: string
  merchant_name: string | null
  amount: number
  dates: string[]
  intervalDays: number
  category: Category
}

export interface DashboardData {
  totalIncome: number
  totalExpense: number
  netSavings: number
  savingsRate: number
  categoryStats: CategoryStats[]
  monthlyStats: MonthlyStats[]
  topMerchants: TopMerchant[]
  recurringItems: RecurringTransaction[]
  prevMonthIncome: number
  prevMonthExpense: number
  dailyAvgExpense: number
  smallTransactionCount: number
  smallTransactionTotal: number
}
