import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { adminDb } from '@/lib/firebase'

const PAYPAL_BASE_URL = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com'

export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const subDoc = await adminDb.collection('subscriptions').doc(user.uid).get()
    const subData = subDoc.data()
    if (!subData?.paypalSubscriptionId) {
      return NextResponse.json({ error: 'No PayPal subscription' }, { status: 400 })
    }

    // Cancel on PayPal
    const accessToken = await getPayPalAccessToken()
    if (accessToken) {
      await fetch(
        `${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subData.paypalSubscriptionId}/cancel`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ reason: 'User cancelled' }),
        }
      )
    }

    await adminDb.collection('subscriptions').doc(user.uid).update({ status: 'cancelled' })
    await adminDb.collection('users').doc(user.uid).update({ subscriptionStatus: 'cancelled' })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function getPayPalAccessToken(): Promise<string | null> {
  try {
    const clientId = process.env.PAYPAL_CLIENT_ID
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET
    if (!clientId || !clientSecret) return null
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${auth}` },
      body: 'grant_type=client_credentials',
    })
    if (!response.ok) return null
    const data = await response.json()
    return data.access_token
  } catch { return null }
}
