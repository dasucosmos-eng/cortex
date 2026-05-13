import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase'
import { adminDb } from '@/lib/firebase'

// POST /api/auth/google — called from client after Firebase popup sign-in
// Client sends the Firebase ID token, we verify it and create/update the user record
export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json()
    if (!idToken) return NextResponse.json({ error: 'No token provided' }, { status: 400 })

    // Verify the Firebase ID token
    const decoded = await adminAuth.verifyIdToken(idToken)
    const uid = decoded.uid
    const email = decoded.email || ''
    const name = decoded.name || 'User'
    const picture = decoded.picture || ''

    // Create or update user record in Firestore
    const userRef = adminDb.collection('users').doc(uid)
    const userDoc = await userRef.get()

    if (!userDoc.exists) {
      // New user — create profile with trial
      await userRef.set({
        uid,
        email,
        name,
        picture,
        createdAt: new Date().toISOString(),
        trialStart: new Date().toISOString(),
        subscriptionStatus: 'trialing', // trialing | active | expired | cancelled
        storageUsed: 0,
        browserFingerprint: null,
        lastLoginAt: new Date().toISOString(),
      })

      // Create default subscription record
      const trialEnd = new Date()
      trialEnd.setDate(trialEnd.getDate() + 2)
      await adminDb.collection('subscriptions').doc(uid).set({
        userId: uid,
        plan: 'trial',
        status: 'active',
        trialStart: new Date().toISOString(),
        trialEnd: trialEnd.toISOString(),
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: trialEnd.toISOString(),
        paypalSubscriptionId: null,
        createdAt: new Date().toISOString(),
      })
    } else {
      // Existing user — update last login
      await userRef.update({
        lastLoginAt: new Date().toISOString(),
        name: name !== 'User' ? name : userDoc.data()?.name,
        picture: picture || userDoc.data()?.picture,
      })
    }

    return NextResponse.json({
      success: true,
      uid,
      email,
      name,
      picture,
    })
  } catch (error: any) {
    console.error('Google auth error:', error)
    return NextResponse.json({ error: error.message || 'Authentication failed' }, { status: 401 })
  }
}
