import { NextResponse } from 'next/server'

// This NextAuth route is no longer used — authentication is handled by Firebase.
// Return a JSON response indicating the migration.
export async function GET() {
  return NextResponse.json(
    { message: 'Authentication has been migrated to Firebase Auth. Please use /api/auth/* Firebase endpoints.' },
    { status: 410 }
  )
}

export async function POST() {
  return NextResponse.json(
    { message: 'Authentication has been migrated to Firebase Auth. Please use /api/auth/* Firebase endpoints.' },
    { status: 410 }
  )
}
