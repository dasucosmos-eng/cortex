import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { registerFingerprint } from '@/lib/fingerprint'

export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { fingerprint } = await req.json()
    if (!fingerprint || typeof fingerprint !== 'string') {
      return NextResponse.json({ error: 'Fingerprint required' }, { status: 400 })
    }

    const result = await registerFingerprint(fingerprint, user.uid)
    if (!result.allowed) {
      return NextResponse.json({ error: result.reason, code: 'FINGERPRINT_BLOCKED' }, { status: 403 })
    }

    // Also store fingerprint on user record
    const { adminDb } = await import('@/lib/firebase')
    await adminDb.collection('users').doc(user.uid).update({
      browserFingerprint: fingerprint,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
