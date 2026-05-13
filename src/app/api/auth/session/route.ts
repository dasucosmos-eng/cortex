import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase'
import { adminDb } from '@/lib/firebase'

// GET /api/auth/session — verify current session and return user + subscription info
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token' }, { status: 401 })
    }

    const token = authHeader.split('Bearer ')[1]
    const decoded = await adminAuth.verifyIdToken(token)
    const uid = decoded.uid

    // Get user profile
    const userDoc = await adminDb.collection('users').doc(uid).get()
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const userData = userDoc.data()

    // Get subscription
    const subDoc = await adminDb.collection('subscriptions').doc(uid).get()
    const subData = subDoc.exists ? subDoc.data() : null

    // Check trial status
    const now = new Date()
    let trialExpired = false
    let isLocked = false

    if (subData && subData.status === 'active' && subData.plan === 'trial') {
      const trialEnd = new Date(subData.trialEnd)
      if (now > trialEnd) {
        trialExpired = true
        // Auto-expire the trial
        await adminDb.collection('subscriptions').doc(uid).update({
          status: 'expired',
        })
        await adminDb.collection('users').doc(uid).update({
          subscriptionStatus: 'expired',
        })
        isLocked = true
      }
    }

    if (subData && subData.status === 'expired') {
      isLocked = true
    }

    return NextResponse.json({
      user: {
        uid,
        email: userData?.email,
        name: userData?.name,
        picture: userData?.picture,
        createdAt: userData?.createdAt,
        subscriptionStatus: userData?.subscriptionStatus,
        storageUsed: userData?.storageUsed || 0,
      },
      subscription: subData ? {
        plan: subData.plan,
        status: subData.status,
        trialStart: subData.trialStart,
        trialEnd: subData.trialEnd,
        currentPeriodEnd: subData.currentPeriodEnd,
        trialExpired,
        isLocked,
      } : null,
    })
  } catch (error: any) {
    console.error('Session error:', error)
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }
}
