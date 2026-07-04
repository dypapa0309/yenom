import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/firebase/auth-session'
import { adminDb } from '@/lib/firebase/admin'
import { parseFile, applyMapping } from '@/lib/parsing/excel-parser'
import { classifyBatch } from '@/lib/categorization/classifier'
import { detectColumns } from '@/lib/parsing/column-detector'
import { enrichWithKakao } from '@/lib/categorization/kakao-classifier'
import { ColumnMapping } from '@/types'

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
    const uploadRef = await adminDb.collection('uploads').add({
      user_id: user.uid,
      filename: file.name,
      uploaded_at: new Date().toISOString(),
      source_type: file.name.endsWith('.csv') ? 'csv' : 'xlsx',
    })

    // Parse transactions
    const parsed = applyMapping(rows, mapping)

    // Get user rules for classification
    const rulesSnap = await adminDb
      .collection('user_rules')
      .where('user_id', '==', user.uid)
      .get()
    const userRules = rulesSnap.docs.map(d => ({ id: d.id, ...d.data() }))

    // Classify
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const categories = classifyBatch(parsed, userRules as any)

    // Build transaction records
    const transactionRecords = parsed.map((t, i) => ({
      user_id: user.uid,
      upload_id: uploadRef.id,
      transaction_date: t.transaction_date,
      description: t.description,
      amount: t.amount,
      type: t.type,
      merchant_name: t.merchant_name,
      category: categories[i],
      excluded: false,
      memo: null,
      created_at: new Date().toISOString(),
    }))

    const makeKey = (r: { transaction_date: string; amount: number; description: string }) =>
      `${r.transaction_date}|${r.amount}|${r.description}`

    // Deduplicate against existing transactions
    if (transactionRecords.length > 0) {
      const dates = transactionRecords.map(r => r.transaction_date)
      const minDate = dates.reduce((a, b) => (a < b ? a : b))
      const maxDate = dates.reduce((a, b) => (a > b ? a : b))

      const existingSnap = await adminDb
        .collection('transactions')
        .where('user_id', '==', user.uid)
        .where('transaction_date', '>=', minDate)
        .where('transaction_date', '<=', maxDate)
        .get()

      const dbCounts = new Map<string, number>()
      for (const doc of existingSnap.docs) {
        const e = doc.data()
        const k = makeKey(e as { transaction_date: string; amount: number; description: string })
        dbCounts.set(k, (dbCounts.get(k) ?? 0) + 1)
      }

      const usedCounts = new Map<string, number>()
      const before = transactionRecords.length
      const deduped = transactionRecords.filter(r => {
        const k = makeKey(r)
        const used = usedCounts.get(k) ?? 0
        const alreadyInDb = dbCounts.get(k) ?? 0
        usedCounts.set(k, used + 1)
        return used >= alreadyInDb
      })
      transactionRecords.splice(0, transactionRecords.length, ...deduped)
      const skipped = before - transactionRecords.length
      if (skipped > 0) console.log(`Skipped ${skipped} duplicate transactions`)
    }

    if (transactionRecords.length === 0) {
      await uploadRef.delete()
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

    // Insert in batches of 500 (Firestore batch limit)
    const batchSize = 500
    for (let i = 0; i < transactionRecords.length; i += batchSize) {
      const chunk = transactionRecords.slice(i, i + batchSize)
      const batch = adminDb.batch()
      for (const record of chunk) {
        const ref = adminDb.collection('transactions').doc()
        batch.set(ref, record)
      }
      await batch.commit()
    }

    return NextResponse.json({
      uploadId: uploadRef.id,
      count: transactionRecords.length,
      headers,
      mapping,
    })

  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: 'Failed to process file' }, { status: 500 })
  }
}
