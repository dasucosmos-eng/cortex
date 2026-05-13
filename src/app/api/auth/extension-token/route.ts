import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, createCustomToken } from '@/lib/auth'

// POST /api/auth/extension-token — generate a custom token for the Chrome extension
export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check if account is locked (trial expired, no subscription)
    const { adminDb } = await import('@/lib/firebase')
    const subDoc = await adminDb.collection('subscriptions').doc(user.uid).get()
    const subData = subDoc.exists ? subDoc.data() : null

    if (subData && subData.status === 'expired') {
      return NextResponse.json({ error: 'Account locked — subscription expired', code: 'LOCKED' }, { status: 403 })
    }

    const customToken = await createCustomToken(user.uid)
    return NextResponse.json({ token: customToken, serverUrl: process.env.NEXT_PUBLIC_CORTEX_SERVER_URL })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
