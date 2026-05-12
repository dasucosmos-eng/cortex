import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

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
  },

  // Providers
  providers: [
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

        if (!user) {
          throw new Error('Invalid email or password')
        }

        // Verify password against stored hash
        if (!user.password) {
          throw new Error('Account was created with OAuth. Please use OAuth provider to sign in.')
        }

        const isValid = await bcrypt.compare(credentials.password, user.password)
        if (!isValid) {
          throw new Error('Invalid email or password')
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      },
    }),
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

import { getServerSession as nextAuthGetServerSession } from 'next-auth'

export async function getServerSession(options?: Record<string, unknown>) {
  return nextAuthGetServerSession(authOptions)
}

// Re-export for convenience
export { getServerSession as auth }
