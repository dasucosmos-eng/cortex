import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export default async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname

  // Allow API routes — auth checks happen inside route handlers
  if (pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  // Allow static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/icons') ||
    pathname.startsWith('/extension') ||
    pathname.startsWith('/download') ||
    pathname.includes('favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  try {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET || 'cortex-super-secret-key-2024-change-in-production',
      secureCookie: false,
    })

    const isLoggedIn = !!token
    const isAuthPage = pathname === '/login' || pathname === '/signup'

    if (isLoggedIn && isAuthPage) {
      return NextResponse.redirect(new URL('/', req.url))
    }

    if (!isLoggedIn && !isAuthPage) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
  } catch {
    // If token check fails, let the request through
    // Route-level auth will handle it
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|extension|download).*)'],
}
