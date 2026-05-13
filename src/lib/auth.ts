import { adminAuth } from './firebase'
import { NextRequest } from 'next/server'

// Verify Firebase ID token from request
export async function verifyAuth(req: NextRequest): Promise<{ uid: string; email: string | null; name: string | null; picture: string | null } | null> {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) return null

    const token = authHeader.split('Bearer ')[1]
    const decoded = await adminAuth.verifyIdToken(token)

    return {
      uid: decoded.uid,
      email: decoded.email || null,
      name: decoded.name || null,
      picture: decoded.picture || null,
    }
  } catch {
    return null
  }
}

// Get user from Firebase Auth by UID
export async function getUser(uid: string) {
  try {
    return await adminAuth.getUser(uid)
  } catch {
    return null
  }
}

// Create a custom token for the extension (so the extension can auth as the user)
export async function createCustomToken(uid: string): Promise<string> {
  return adminAuth.createCustomToken(uid)
}

export { adminAuth }
