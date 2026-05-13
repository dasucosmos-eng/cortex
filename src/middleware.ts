import { NextRequest, NextResponse } from 'next/server'

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

  // Check for Firebase token in localStorage (sent via cookie or header)
  // For middleware, we check for a cookie
  const token = req.cookies.get('memora_token')?.value

  const isAuthPage = pathname === '/login' || pathname === '/signup'

  if (token) {
    // Has token — redirect away from auth pages
    if (isAuthPage) {
      return NextResponse.redirect(new URL('/', req.url))
    }
    return NextResponse.next()
  }

  // No token
  if (!isAuthPage) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|extension|download).*)'],
}
