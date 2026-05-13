import { adminDb } from './firebase'
import { FieldValue } from 'firebase-admin/firestore'

const STORAGE_LIMIT_FREE = 0 // No storage for expired users
const STORAGE_LIMIT_PAID = 2 * 1024 * 1024 * 1024 // 2GB in bytes
const TRIAL_DURATION_DAYS = 2
const MONTHLY_PRICE_USD = 12

export interface SubscriptionInfo {
  userId: string
  plan: 'trial' | 'pro'
  status: 'active' | 'expired' | 'cancelled'
  trialStart: string
  trialEnd: string
  currentPeriodStart: string
  currentPeriodEnd: string
  paypalSubscriptionId: string | null
  isLocked: boolean
  trialExpired: boolean
  daysRemaining: number
}

export async function getSubscription(userId: string): Promise<SubscriptionInfo | null> {
  const doc = await adminDb.collection('subscriptions').doc(userId).get()
  if (!doc.exists) return null

  const data = doc.data()!
  const now = new Date()
  const trialEnd = new Date(data.trialEnd)
  const periodEnd = new Date(data.currentPeriodEnd)
  const trialExpired = data.plan === 'trial' && now > trialEnd
  const isLocked = data.status === 'expired' || trialExpired

  const daysRemaining = (() => {
    if (data.plan === 'trial') {
      const diff = trialEnd.getTime() - now.getTime()
      return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
    }
    const diff = periodEnd.getTime() - now.getTime()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  })()

  return {
    userId,
    plan: data.plan,
    status: isLocked ? 'expired' : data.status,
    trialStart: data.trialStart,
    trialEnd: data.trialEnd,
    currentPeriodStart: data.currentPeriodStart,
    currentPeriodEnd: data.currentPeriodEnd,
    paypalSubscriptionId: data.paypalSubscriptionId,
    isLocked,
    trialExpired,
    daysRemaining,
  }
}

export async function canSyncData(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const sub = await getSubscription(userId)
  if (!sub) return { allowed: false, reason: 'No subscription found' }
  if (sub.isLocked) return { allowed: false, reason: 'Trial expired — upgrade to continue syncing' }

  // Check storage limit for paid users
  if (sub.plan === 'pro') {
    const userDoc = await adminDb.collection('users').doc(userId).get()
    const storageUsed = userDoc.data()?.storageUsed || 0
    if (storageUsed >= STORAGE_LIMIT_PAID) {
      return { allowed: false, reason: 'Storage limit reached (2GB)' }
    }
  }

  return { allowed: true }
}

export async function updateStorageUsed(userId: string, additionalBytes: number) {
  const userRef = adminDb.collection('users').doc(userId)
  await userRef.update({
    storageUsed: FieldValue.increment(additionalBytes),
  })
}

export { STORAGE_LIMIT_FREE, STORAGE_LIMIT_PAID, TRIAL_DURATION_DAYS, MONTHLY_PRICE_USD }
