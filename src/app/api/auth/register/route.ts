import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase'
import { generateId, serverTimestamp } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { name, email } = await request.json()

    // Validate
    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email required' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }

    // Check existing user in Firestore
    const existingSnapshot = await adminDb.collection('users')
      .where('email', '==', email)
      .limit(1)
      .get()

    if (!existingSnapshot.empty) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    // Create user record in Firestore
    const userId = generateId()
    await adminDb.collection('users').doc(userId).set({
      name,
      email,
      role: 'user',
      createdAt: serverTimestamp,
      updatedAt: serverTimestamp,
    })

    return NextResponse.json(
      { data: { id: userId, name, email } },
      { status: 201 },
    )
  } catch (error) {
    console.error('[REGISTER] Error:', error)
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}
