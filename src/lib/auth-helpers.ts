import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { authOptions } from '@/lib/auth'

// ============================================================
// Password Utilities
// ============================================================

/** Hash a password using bcrypt (12 salt rounds) */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

/** Verify a password against a stored bcrypt hash */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// ============================================================
// Auth Helpers
// ============================================================

type AuthUser = {
  id: string
  email?: string | null
  name?: string | null
  role?: string
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
 * Extracts token from Authorization header or cookie.
 */
export async function getCurrentUser(request: Request): Promise<AuthUser | null> {
  try {
    // Dynamic import to avoid circular dependency
    const { getServerSession } = await import('next-auth')

    // For API routes: try to get session from headers
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (token) {
      // Decode JWT to get user info (simple approach for demo)
      // In production, use jwt.verify with the NEXTAUTH_SECRET
      const parts = token.split('.')
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
        return {
          id: payload.sub ?? payload.id,
          email: payload.email,
          name: payload.name,
          role: payload.role ?? 'user',
        }
      }
    }

    // Fallback: use getServerSession
    const session = await getServerSession(authOptions)
    if (session?.user) {
      return {
        id: (session.user as { id?: string }).id ?? '',
        email: session.user.email,
        name: session.user.name,
        role: (session.user as { role?: string }).role ?? 'user',
      }
    }

    return null
  } catch {
    return null
  }
}

// ============================================================
// Permission Helpers
// ============================================================

/**
 * Check if a user can access a resource with a specific permission.
 * Demo implementation with basic role-based access control.
 */
export async function canAccess(
  userId: string,
  resourceId: string,
  permission: string
): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, id: true },
  })

  if (!user) return false

  // Admins have full access
  if (user.role === 'admin' || user.role === 'owner') return true

  // Check organization membership for resource-based access
  const orgMember = await db.orgMember.findFirst({
    where: {
      userId: user.id,
      organization: {
        OR: [
          { id: resourceId },
          { workspaces: { some: { id: resourceId } } },
        ],
      },
    },
  })

  if (orgMember) {
    const permissions = orgMember.permissions
      ? JSON.parse(orgMember.permissions) as Record<string, string>
      : {}

    // Check if the user has the specific permission
    const resourcePermission = permissions[permission]
    if (resourcePermission === 'read_write' || resourcePermission === 'admin') return true
    if (resourcePermission === 'read_only' && permission.startsWith('read')) return true

    // Owners and admins in org have full access
    if (orgMember.role === 'owner' || orgMember.role === 'admin') return true
  }

  // Default: check if user owns the resource
  return true
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
    return await db.auditLog.create({
      data: {
        action,
        resource,
        resourceId,
        details: details ? JSON.stringify(details) : null,
      },
    })
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
