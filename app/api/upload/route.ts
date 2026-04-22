import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseFile, applyMapping } from '@/lib/parsing/excel-parser'
import { classifyBatch } from '@/lib/categorization/classifier'
import { detectColumns } from '@/lib/parsing/column-detector'
import { enrichWithKakao } from '@/lib/categorization/kakao-classifier'
import { ColumnMapping } from '@/types'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const mappingRaw = formData.get('mapping') as string | null
    const password = formData.get('password') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Parse the file
    const { headers, rows } = await parseFile(file, password ?? undefined)

    // Auto-detect or use provided mapping
    const mapping: ColumnMapping = mappingRaw
      ? JSON.parse(mappingRaw)
      : detectColumns(headers)

    // Create upload record
    const { data: upload, error: uploadError } = await supabase
      .from('uploads')
      .insert({
        user_id: user.id,
        filename: file.name,
        source_type: file.name.endsWith('.csv') ? 'csv' : 'xlsx',
      })
      .select()
      .single()

    if (uploadError) throw uploadError

    // Parse transactions
    const parsed = applyMapping(rows, mapping)

    // Get user rules for classification
    const { data: userRules } = await supabase
      .from('user_rules')
      .select('*')
      .eq('user_id', user.id)

    // Classify
    const categories = classifyBatch(parsed, userRules ?? [])

    // Build transaction records
    const transactionRecords = parsed.map((t, i) => ({
      user_id: user.id,
      upload_id: upload.id,
      transaction_date: t.transaction_date,
      description: t.description,
      amount: t.amount,
      type: t.type,
      merchant_name: t.merchant_name,
      category: categories[i],
      excluded: false,
      memo: null,
    }))

    const makeKey = (r: { transaction_date: string; amount: number; description: string }) =>
      `${r.transaction_date}|${r.amount}|${r.description}`

    // Deduplicate against existing transactions (건수 기반)
    // 같은 날 같은 금액 같은 적요가 DB에 N건 있으면, 신규 배치에서도 N건까지는 허용
    if (transactionRecords.length > 0) {
      const dates = transactionRecords.map(r => r.transaction_date)
      const minDate = dates.reduce((a, b) => (a < b ? a : b))
      const maxDate = dates.reduce((a, b) => (a > b ? a : b))

      const { data: existing } = await supabase
        .from('transactions')
        .select('transaction_date, amount, description')
        .eq('user_id', user.id)
        .gte('transaction_date', minDate)
        .lte('transaction_date', maxDate)

      // DB에 이미 있는 건수 집계
      const dbCounts = new Map<string, number>()
      for (const e of existing ?? []) {
        const k = makeKey(e)
        dbCounts.set(k, (dbCounts.get(k) ?? 0) + 1)
      }

      // 신규 배치에서 건수 초과분만 제거
      const usedCounts = new Map<string, number>()
      const before = transactionRecords.length
      const deduped = transactionRecords.filter(r => {
        const k = makeKey(r)
        const used = usedCounts.get(k) ?? 0
        const alreadyInDb = dbCounts.get(k) ?? 0
        usedCounts.set(k, used + 1)
        return used >= alreadyInDb  // DB에 있는 것보다 많으면 허용
      })
      transactionRecords.splice(0, transactionRecords.length, ...deduped)
      const skipped = before - transactionRecords.length
      if (skipped > 0) console.log(`Skipped ${skipped} duplicate transactions`)
    }

    if (transactionRecords.length === 0) {
      // 실제로 저장할 거래가 없으면 업로드 레코드도 삭제
      await supabase.from('uploads').delete().eq('id', upload.id)
      return NextResponse.json({ uploadId: null, count: 0, skipped: true })
    }

    // Kakao enrichment for 기타 expense transactions
    if (process.env.KAKAO_REST_API_KEY) {
      const miscExpenses = transactionRecords
        .map((r, idx) => ({ idx, r }))
        .filter(({ r }) => r.category === '기타' && r.type === 'expense')

      if (miscExpenses.length > 0) {
        const lookupItems = miscExpenses.map(({ idx, r }) => ({
          id: String(idx),
          merchant_name: r.merchant_name,
          description: r.description,
        }))
        const kakaoMap = await enrichWithKakao(lookupItems)
        for (const { idx } of miscExpenses) {
          const found = kakaoMap.get(String(idx))
          if (found) transactionRecords[idx].category = found
        }
      }
    }

    // Insert in batches of 500
    const batchSize = 500
    for (let i = 0; i < transactionRecords.length; i += batchSize) {
      const batch = transactionRecords.slice(i, i + batchSize)
      const { error } = await supabase.from('transactions').insert(batch)
      if (error) throw error
    }

    return NextResponse.json({
      uploadId: upload.id,
      count: transactionRecords.length,
      headers,
      mapping,
    })

  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: 'Failed to process file' }, { status: 500 })
  }
}
