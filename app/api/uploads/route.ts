import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/firebase/auth-session'
import { adminDb } from '@/lib/firebase/admin'

// 업로드 목록 조회
export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const snap = await adminDb
      .collection('uploads')
      .where('user_id', '==', user.uid)
      .orderBy('uploaded_at', 'desc')
      .get()

    const data = snap.docs.map(d => ({
      id: d.id,
      filename: d.data().filename,
      uploaded_at: d.data().uploaded_at,
      source_type: d.data().source_type,
    }))

    return NextResponse.json({ data })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// 특정 업로드 삭제 (연결된 거래내역도 삭제)
export async function DELETE(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const uploadId = searchParams.get('id')

    if (uploadId) {
      // 특정 업로드만 삭제
      const docRef = adminDb.collection('uploads').doc(uploadId)
      const doc = await docRef.get()
      if (!doc.exists || doc.data()?.user_id !== user.uid) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }

      // 연결된 거래내역 삭제
      const txSnap = await adminDb
        .collection('transactions')
        .where('upload_id', '==', uploadId)
        .where('user_id', '==', user.uid)
        .get()

      const batch = adminDb.batch()
      txSnap.docs.forEach(d => batch.delete(d.ref))
      batch.delete(docRef)
      await batch.commit()
    } else {
      // 전체 삭제
      const uploadsSnap = await adminDb
        .collection('uploads')
        .where('user_id', '==', user.uid)
        .get()

      const uploadIds = uploadsSnap.docs.map(d => d.id)

      // 모든 거래내역 삭제
      const txSnap = await adminDb
        .collection('transactions')
        .where('user_id', '==', user.uid)
        .get()

      // Batch delete in chunks of 500
      const allDocs = [...txSnap.docs, ...uploadsSnap.docs]
      for (let i = 0; i < allDocs.length; i += 500) {
        const batch = adminDb.batch()
        allDocs.slice(i, i + 500).forEach(d => batch.delete(d.ref))
        await batch.commit()
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
