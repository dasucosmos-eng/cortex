import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { adminDb } from '@/lib/firebase'
import { FieldValue } from 'firebase-admin/firestore'

const PAYPAL_BASE_URL = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com'
const PLAN_ID = process.env.PAYPAL_PLAN_ID || '' // PayPal plan ID created in PayPal Developer Dashboard

export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const accessToken = await getPayPalAccessToken()
    if (!accessToken) return NextResponse.json({ error: 'PayPal unavailable' }, { status: 503 })

    // Create subscription
    const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        plan_id: PLAN_ID,
        application_context: {
          brand_name: 'Memora Bond — AI Browser Memory',
          locale: 'en-US',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'SUBSCRIBE_NOW',
          return_url: `${process.env.NEXT_PUBLIC_MEMORA_SERVER_URL}/api/paypal/return?uid=${user.uid}`,
          cancel_url: `${process.env.NEXT_PUBLIC_MEMORA_SERVER_URL}/settings?cancelled=true`,
        },
        custom_id: user.uid,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('PayPal subscription creation failed:', data)
      return NextResponse.json({ error: 'Failed to create subscription', details: data }, { status: 500 })
    }

    // Find the approve link
    const approveLink = data.links?.find((link: any) => link.rel === 'approve')
    if (!approveLink?.href) {
      return NextResponse.json({ error: 'No approval URL returned' }, { status: 500 })
    }

    return NextResponse.json({
      subscriptionId: data.id,
      approveUrl: approveLink.href,
    })
  } catch (error: any) {
    console.error('PayPal create subscription error:', error)
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
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${auth}`,
      },
      body: 'grant_type=client_credentials',
    })

    if (!response.ok) return null
    const data = await response.json()
    return data.access_token
  } catch {
    return null
  }
}
