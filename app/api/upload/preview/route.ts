import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/firebase/auth-session'
import { parseFile, PasswordRequiredError } from '@/lib/parsing/excel-parser'
import { detectColumns, detectColumnsByData } from '@/lib/parsing/column-detector'

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const password = formData.get('password') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const { headers, rows } = await parseFile(file, password ?? undefined)
    const isGeneric = headers.every(h => /^컬럼\d+$/.test(h))
    const mapping = isGeneric ? detectColumnsByData(headers, rows.slice(0, 20)) : detectColumns(headers)
    const preview = rows.slice(0, 5)

    return NextResponse.json({ headers, preview, mapping })
  } catch (err) {
    if (err instanceof PasswordRequiredError) {
      return NextResponse.json({ error: 'password_required' }, { status: 422 })
    }
    console.error('Preview error:', err)
    return NextResponse.json({ error: 'Failed to parse file' }, { status: 500 })
  }
}
