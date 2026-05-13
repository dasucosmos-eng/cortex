import { adminDb, adminAuth } from '@/lib/firebase'
import { serverTimestamp } from '@/lib/db'
import { NextRequest } from 'next/server'

// ============================================================
// Auth Helpers (Firebase-based)
// ============================================================

type AuthUser = {
  id: string
  email?: string | null
  name?: string | null
  role?: string
  picture?: string | null
}

/**
 * Require authentication — throw if user is not authenticated.
 * Use in server-side code (API routes, server components).
 */
export async function requireAuth(request: Request): Promise<AuthUser> {
  const user = await getCurrentUser(request)
  if (!user) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return user
}

/**
 * Get the current authenticated user from session.
 * Extracts token from Authorization header.
 */
export async function getCurrentUser(request: Request): Promise<AuthUser | null> {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) return null

    const token = authHeader.split('Bearer ')[1]
    const decoded = await adminAuth.verifyIdToken(token)

    // Look up user record in Firestore for role info
    let role = 'user'
    try {
      const userDoc = await adminDb.collection('users').doc(decoded.uid).get()
      if (userDoc.exists) {
        const userData = userDoc.data()
        role = userData?.role || 'user'
      }
    } catch {
      // User doc may not exist yet (first login)
    }

    return {
      id: decoded.uid,
      email: decoded.email || null,
      name: decoded.name || null,
      role,
      picture: decoded.picture || null,
    }
  } catch {
    return null
  }
}

/**
 * Get the current user from a NextRequest (API route helper).
 */
export async function getUserFromRequest(req: NextRequest): Promise<AuthUser | null> {
  return getCurrentUser(req)
}

// ============================================================
// Permission Helpers
// ============================================================

/**
 * Check if a user can access a resource with a specific permission.
 */
export async function canAccess(
  userId: string,
  _resourceId: string,
  _permission: string
): Promise<boolean> {
  try {
    const userDoc = await adminDb.collection('users').doc(userId).get()
    if (!userDoc.exists) return false

    const userData = userDoc.data()
    const role = userData?.role || 'user'

    // Admins have full access
    if (role === 'admin' || role === 'owner') return true

    // Default: allow access for authenticated users
    return true
  } catch {
    return false
  }
}

// ============================================================
// Audit Logging
// ============================================================

/**
 * Create an audit log entry for tracking user actions.
 */
export async function createAuditLog(
  action: string,
  resource: string,
  resourceId?: string,
  details?: Record<string, unknown>
) {
  try {
    await adminDb.collection('auditLogs').add({
      action,
      resource,
      resourceId,
      details: details ? JSON.stringify(details) : null,
      createdAt: serverTimestamp,
    })
    return null
  } catch (error) {
    // Log errors silently to avoid blocking the main operation
    console.error('[AuditLog] Failed to create audit log:', error)
    return null
  }
}

/**
 * Create an audit log entry with user and request context.
 */
export async function createAuditLogWithContext(
  request: Request,
  action: string,
  resource: string,
  resourceId?: string,
  details?: Record<string, unknown>
) {
  const user = await getCurrentUser(request)

  return createAuditLog(action, resource, resourceId, {
    ...details,
    userId: user?.id,
    ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip'),
    userAgent: request.headers.get('user-agent'),
  })
}
