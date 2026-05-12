import { withAuth } from 'next-auth/middleware'

export default withAuth({
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ req, token }) {
      const { pathname } = req.nextUrl
      const isLoggedIn = !!token

      // Allow auth API routes
      if (pathname.startsWith('/api/auth')) return true

      // Allow login and signup pages
      const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/signup')

      // Redirect logged-in users away from auth pages
      if (isLoggedIn && isAuthPage) return false

      // Allow unauthenticated users to access auth pages
      if (!isLoggedIn && isAuthPage) return true

      // Require auth for everything else
      return isLoggedIn
    },
  },
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|extension).*)'],
}
