// ============================================================
// Browser Fingerprint — Server-Side Only
// ============================================================
// Server-side fingerprint operations that interact with Firestore.
// DO NOT import this file in client components.
// ============================================================

import { adminDb } from './firebase'
import { FieldValue } from 'firebase-admin/firestore'

interface FingerprintRecord {
  fingerprint: string
  userIds: string[]
  firstSeenAt: string
  lastSeenAt: string
  trialUsed?: boolean
}

/**
 * Register a browser fingerprint for a user.
 * If the fingerprint already exists, check if a *different* account
 * has already consumed a trial from this browser.
 */
export async function registerFingerprint(
  fingerprint: string,
  userId: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const fpRef = adminDb.collection('fingerprints').doc(fingerprint)
  const fpDoc = await fpRef.get()

  if (fpDoc.exists) {
    const data = fpDoc.data() as FingerprintRecord

    if (data.trialUsed && !data.userIds.includes(userId)) {
      return { allowed: false, reason: 'This browser already used a free trial with another account' }
    }

    const otherUsers = data.userIds.filter((uid) => uid !== userId)
    if (otherUsers.length > 0) {
      const subChecks = await Promise.all(
        otherUsers.map(async (uid) => {
          const subDoc = await adminDb.collection('subscriptions').doc(uid).get()
          if (!subDoc.exists) return false
          const subData = subDoc.data()!
          return subData.plan === 'trial' && (subData.status === 'expired' || subData.status === 'cancelled')
        }),
      )
      if (subChecks.some(Boolean)) {
        return { allowed: false, reason: 'This browser already used a free trial with another account' }
      }
    }

    if (!data.userIds.includes(userId)) {
      await fpRef.update({
        userIds: FieldValue.arrayUnion(userId),
        lastSeenAt: new Date().toISOString(),
      })
    }
  } else {
    await fpRef.set({
      fingerprint,
      userIds: [userId],
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    })
  }

  return { allowed: true }
}

/**
 * Check if a fingerprint has been used for trial abuse.
 */
export async function checkFingerprintEligibility(
  fingerprint: string,
): Promise<{ eligible: boolean; reason: string }> {
  const fpDoc = await adminDb.collection('fingerprints').doc(fingerprint).get()

  if (!fpDoc.exists) {
    return { eligible: true, reason: 'Fingerprint not seen before' }
  }

  const data = fpDoc.data() as FingerprintRecord

  if (data.trialUsed) {
    return {
      eligible: false,
      reason: 'This browser has already been used for a free trial',
    }
  }

  if (data.userIds.length > 2) {
    return {
      eligible: false,
      reason: 'Too many accounts associated with this device',
    }
  }

  return { eligible: true, reason: 'Fingerprint eligible' }
}

/**
 * Check fingerprint for abuse — legacy alias.
 */
export async function checkFingerprint(
  fingerprint: string,
): Promise<{ hasAbused: boolean; userIds: string[] }> {
  const fpDoc = await adminDb.collection('fingerprints').doc(fingerprint).get()
  if (!fpDoc.exists) return { hasAbused: false, userIds: [] }

  const data = fpDoc.data() as FingerprintRecord
  return { hasAbused: data.userIds.length > 1 || !!data.trialUsed, userIds: data.userIds }
}
