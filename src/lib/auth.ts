import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { db } from '@/lib/db'
import crypto from 'crypto'

export const authOptions: NextAuthOptions = {
  // Prisma Adapter for database storage
  adapter: PrismaAdapter(db) as NextAuthOptions['adapter'],

  // Session strategy: JWT for scalability (no db session lookups)
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  // Pages configuration
  pages: {
    signIn: '/login',
    signOut: '/login',
    error: '/login',
    newUser: '/signup',
  },

  // Providers
  providers: [
    // Credentials provider — email + password with SHA-256 hash comparison
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required')
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(credentials.email)) {
          throw new Error('Invalid email format')
        }

        // Find user by email
        const user = await db.user.findUnique({
          where: { email: credentials.email },
        })

        // Auto-create account if not exists (for demo purposes)
        if (!user) {
          const hashedPassword = hashPassword(credentials.password)
          const newUser = await db.user.create({
            data: {
              email: credentials.email,
              name: credentials.email.split('@')[0],
              password: hashedPassword,
              role: 'user',
            },
          })
          return {
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
            role: newUser.role,
          }
        }

        // Verify password against stored hash
        if (!user.password) {
          throw new Error('Account was created with OAuth. Please use OAuth provider to sign in.')
        }

        const isValid = verifyPassword(credentials.password, user.password)
        if (!isValid) {
          throw new Error('Invalid password')
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      },
    }),

    // Google provider placeholder — configured but disabled
    // Uncomment and add env vars to enable:
    // GoogleProvider({
    //   clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    //   clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    // }),

    // GitHub provider placeholder — configured but disabled
    // Uncomment and add env vars to enable:
    // GitHubProvider({
    //   clientId: process.env.GITHUB_CLIENT_ID ?? '',
    //   clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
    // }),
  ],

  // Custom JWT callback — include user.id and user.role in token
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role?: string }).role ?? 'user'
        token.email = user.email
        token.name = user.name
      }
      return token
    },

    // Custom session callback — include user.id and user.role in session
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string
        (session.user as { role?: string }).role = token.role as string
      }
      return session
    },
  },

  // Secret for JWT signing
  secret: process.env.NEXTAUTH_SECRET ?? 'cortex-demo-secret-change-in-production',

  // Debug in development
  debug: process.env.NODE_ENV === 'development',
}

// ============================================================
// Server-side helpers
// ============================================================

export async function getServerSession(options?: Record<string, unknown>) {
  // Dynamic import to avoid circular dependency
  const { getServerSession: nextAuthGetServerSession } = await import('next-auth')
  return nextAuthGetServerSession(authOptions)
}

// ============================================================
// Password utilities
// ============================================================

/** Hash a password using SHA-256 (demo only — use bcrypt in production) */
export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

/** Verify a password against a stored SHA-256 hash */
export function verifyPassword(password: string, hash: string): boolean {
  const computedHash = crypto.createHash('sha256').update(password).digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(computedHash),
    Buffer.from(hash)
  )
}
