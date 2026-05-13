import { adminDb } from './firebase'
import { FieldValue } from 'firebase-admin/firestore'

interface FingerprintRecord {
  fingerprint: string
  userIds: string[]
  firstSeenAt: string
  lastSeenAt: string
}

// Register a browser fingerprint for a user
export async function registerFingerprint(fingerprint: string, userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const fpRef = adminDb.collection('fingerprints').doc(fingerprint)
  const fpDoc = await fpRef.get()

  if (fpDoc.exists) {
    const data = fpDoc.data() as FingerprintRecord
    // Check if this browser already used a trial with a different account
    const hasUsedTrial = await Promise.all(
      data.userIds.map(async (uid) => {
        if (uid === userId) return false
        const subDoc = await adminDb.collection('subscriptions').doc(uid).get()
        if (!subDoc.exists) return false
        const subData = subDoc.data()!
        return subData.plan === 'trial' || subData.status === 'expired'
      })
    )

    if (hasUsedTrial.some(Boolean)) {
      return { allowed: false, reason: 'This browser already used a free trial with another account' }
    }

    // Add this user to the fingerprint
    if (!data.userIds.includes(userId)) {
      await fpRef.update({
        userIds: FieldValue.arrayUnion(userId),
        lastSeenAt: new Date().toISOString(),
      })
    }
  } else {
    // New fingerprint — register it
    await fpRef.set({
      fingerprint,
      userIds: [userId],
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    })
  }

  return { allowed: true }
}

// Check if a fingerprint has been used for trial abuse
export async function checkFingerprint(fingerprint: string): Promise<{ hasAbused: boolean; userIds: string[] }> {
  const fpDoc = await adminDb.collection('fingerprints').doc(fingerprint).get()
  if (!fpDoc.exists) return { hasAbused: false, userIds: [] }

  const data = fpDoc.data() as FingerprintRecord
  return { hasAbused: data.userIds.length > 1, userIds: data.userIds }
}
