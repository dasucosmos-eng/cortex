import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { adminDb } from '@/lib/firebase'

export async function GET(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const subDoc = await adminDb.collection('subscriptions').doc(user.uid).get()
    if (!subDoc.exists) {
      return NextResponse.json({ error: 'No subscription' }, { status: 404 })
    }

    const data = subDoc.data()
    const now = new Date()

    // Check if trial expired
    let status = data.status
    if (data.plan === 'trial' && new Date(data.trialEnd) < now) {
      status = 'expired'
      await adminDb.collection('subscriptions').doc(user.uid).update({ status: 'expired' })
      await adminDb.collection('users').doc(user.uid).update({ subscriptionStatus: 'expired' })
    }

    const isLocked = status === 'expired'
    const isTrial = data.plan === 'trial'
    const trialEnd = data.trialEnd ? new Date(data.trialEnd) : null
    const daysRemaining = isTrial && trialEnd
      ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : 0

    return NextResponse.json({
      plan: data.plan,
      status,
      isLocked,
      isTrial,
      trialEnd: data.trialEnd,
      currentPeriodEnd: data.currentPeriodEnd,
      daysRemaining,
      paypalSubscriptionId: data.paypalSubscriptionId,
      price: data.plan === 'pro' ? '$6/month' : 'Free trial',
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
