import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  const uid = searchParams.get('uid')

  if (!token) {
    return NextResponse.redirect(new URL('/settings?payment=failed', req.url))
  }

  // PayPal will send webhook separately — just redirect user to settings
  return NextResponse.redirect(new URL('/settings?payment=processing', req.url))
}
