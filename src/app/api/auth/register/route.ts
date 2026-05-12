import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json()

    // Validate
    if (!name || !email || !password) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    // Check existing
    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    // Create user
    const hashedPassword = await bcrypt.hash(password, 12)
    const user = await db.user.create({
      data: { name, email, password: hashedPassword },
    })

    return NextResponse.json(
      { data: { id: user.id, name: user.name, email: user.email } },
      { status: 201 },
    )
  } catch (error) {
    console.error('[REGISTER] Error:', error)
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}
