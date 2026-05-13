import { NextRequest, NextResponse } from 'next/server'

const PAYPAL_BASE_URL = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com'

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const headers = req.headers

    // Verify webhook signature
    const isValid = await verifyWebhookSignature(body, headers)
    if (!isValid) {
      console.error('Invalid PayPal webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const event = JSON.parse(body)
    const eventType = event.event_type

    console.log(`PayPal webhook: ${eventType}`, event.id)

    switch (eventType) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
      case 'BILLING.SUBSCRIPTION.RE_ACTIVATED':
        await handleSubscriptionActivated(event)
        break
      case 'BILLING.SUBSCRIPTION.CANCELLED':
        await handleSubscriptionCancelled(event)
        break
      case 'BILLING.SUBSCRIPTION.EXPIRED':
        await handleSubscriptionExpired(event)
        break
      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        await handleSubscriptionSuspended(event)
        break
      case 'PAYMENT.SALE.COMPLETED':
        await handlePaymentCompleted(event)
        break
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('PayPal webhook error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function verifyWebhookSignature(body: string, headers: Headers): Promise<boolean> {
  try {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID
    if (!webhookId) {
      // In development, skip verification
      console.warn('No PAYPAL_WEBHOOK_ID set, skipping webhook verification')
      return true
    }

    const accessToken = await getAccessToken()
    if (!accessToken) return false

    const response = await fetch(`${PAYPAL_BASE_URL}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        auth_algo: headers.get('paypal-auth-algo'),
        cert_url: headers.get('paypal-cert-url'),
        transmission_id: headers.get('paypal-transmission-id'),
        transmission_sig: headers.get('paypal-transmission-sig'),
        transmission_time: headers.get('paypal-transmission-time'),
        webhook_id: webhookId,
        webhook_event: JSON.parse(body),
      }),
    })

    const data = await response.json()
    return data.verification_status === 'SUCCESS'
  } catch {
    return false
  }
}

async function getAccessToken(): Promise<string | null> {
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

async function handleSubscriptionActivated(event: any) {
  const { adminDb } = await import('@/lib/firebase')
  const userId = event.resource?.custom_id
  const paypalSubId = event.resource?.id
  if (!userId) return

  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setMonth(periodEnd.getMonth() + 1)

  await adminDb.collection('subscriptions').doc(userId).set({
    userId,
    plan: 'pro',
    status: 'active',
    paypalSubscriptionId: paypalSubId,
    currentPeriodStart: now.toISOString(),
    currentPeriodEnd: periodEnd.toISOString(),
    trialStart: null,
    trialEnd: null,
    createdAt: now.toISOString(),
  }, { merge: true })

  await adminDb.collection('users').doc(userId).update({
    subscriptionStatus: 'active',
  })
}

async function handleSubscriptionCancelled(event: any) {
  const { adminDb } = await import('@/lib/firebase')
  const userId = event.resource?.custom_id
  if (!userId) return

  await adminDb.collection('subscriptions').doc(userId).update({
    status: 'cancelled',
  })
  await adminDb.collection('users').doc(userId).update({
    subscriptionStatus: 'cancelled',
  })
}

async function handleSubscriptionExpired(event: any) {
  const { adminDb } = await import('@/lib/firebase')
  const userId = event.resource?.custom_id
  if (!userId) return

  await adminDb.collection('subscriptions').doc(userId).update({
    status: 'expired',
  })
  await adminDb.collection('users').doc(userId).update({
    subscriptionStatus: 'expired',
  })
}

async function handleSubscriptionSuspended(event: any) {
  const { adminDb } = await import('@/lib/firebase')
  const userId = event.resource?.custom_id
  if (!userId) return

  await adminDb.collection('subscriptions').doc(userId).update({
    status: 'expired',
  })
  await adminDb.collection('users').doc(userId).update({
    subscriptionStatus: 'expired',
  })
}

async function handlePaymentCompleted(event: any) {
  const { adminDb } = await import('@/lib/firebase')
  const userId = event.resource?.custom_id
  if (!userId) return

  // Renew subscription period
  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setMonth(periodEnd.getMonth() + 1)

  await adminDb.collection('subscriptions').doc(userId).update({
    status: 'active',
    plan: 'pro',
    currentPeriodStart: now.toISOString(),
    currentPeriodEnd: periodEnd.toISOString(),
  })
  await adminDb.collection('users').doc(userId).update({
    subscriptionStatus: 'active',
  })
}
