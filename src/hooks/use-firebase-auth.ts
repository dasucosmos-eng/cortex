'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { onAuthStateChanged, onIdTokenChanged, User, signOut as firebaseSignOut } from 'firebase/auth'
import { auth } from '@/lib/firebase-client'

interface AuthState {
  user: User | null
  token: string | null
  loading: boolean
}

function getCookieDomain() {
  try {
    const hostname = window.location.hostname
    // For domains like memora-bond.web.app, use the full hostname (not .web.app)
    const parts = hostname.split('.')
    // If the "TLD" is a known hosting domain like web.app, firebaseapp.com, etc.
    // use the full hostname as the cookie domain
    const knownPlatforms = ['web.app', 'firebaseapp.com', 'cloudfunctions.net', 'supabase.co']
    const tld = parts.slice(-2).join('.')
    if (knownPlatforms.includes(tld) && parts.length > 2) {
      return hostname  // Use full hostname for platform domains
    }
    return '.' + parts.slice(-2).join('.')
  } catch {
    return ''
  }
}

function setMemoraCookie(token: string | null) {
  const domain = getCookieDomain()
  if (token) {
    document.cookie = `memora_token=${token}; path=/; domain=${domain}; max-age=${60 * 60 * 24 * 7}; SameSite=Lax; Secure`
  } else {
    document.cookie = `memora_token=; path=/; domain=${domain}; max-age=0`
  }
}

export function useFirebaseAuth() {
  const [state, setState] = useState<AuthState>({ user: null, token: null, loading: true })
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    // Use onIdTokenChanged instead of onAuthStateChanged — this fires when the token
    // is automatically refreshed by the Firebase SDK (before expiry)
    const unsubscribeIdToken = onIdTokenChanged(auth, async (user) => {
      if (user) {
        try {
          // getIdToken() returns the cached valid token, or refreshes if expired
          const token = await user.getIdToken()
          setState({ user, token, loading: false })
          setMemoraCookie(token)
        } catch {
          setState({ user, token: null, loading: false })
        }
      } else {
        setState({ user, null, token: null, loading: false })
        setMemoraCookie(null)
        localStorage.removeItem('memora_token')
      }
    })

    // Also listen for auth state changes (sign-in, sign-out events)
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const token = await user.getIdToken()
          setState({ user, token, loading: false })
          setMemoraCookie(token)
        } catch {
          setState({ user, token: null, loading: false })
        }
      } else {
        setState({ user: null, token: null, loading: false })
        setMemoraCookie(null)
        localStorage.removeItem('memora_token')
      }
    })

    // Periodic token refresh every 50 minutes (Firebase tokens expire after 1 hour)
    // This ensures the cookie stays fresh even if onIdTokenChanged doesn't fire
    refreshTimerRef.current = setInterval(async () => {
      try {
        const user = auth.currentUser
        if (user) {
          // Force refresh the token
          const token = await user.getIdToken(true)
          setState({ user, token, loading: false })
          setMemoraCookie(token)
          console.log('[Memora Bond] Token refreshed proactively')
        }
      } catch (err) {
        console.error('[Memora Bond] Periodic token refresh failed:', err)
      }
    }, 50 * 60 * 1000) // Every 50 minutes

    return () => {
      unsubscribeIdToken()
      unsubscribeAuth()
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
    }
  }, [])

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth)
    localStorage.removeItem('memora_token')
    setMemoraCookie(null)
    window.location.href = '/login'
  }, [])

  return { ...state, signOut }
}

// Helper to get auth headers for API calls
export function getAuthHeaders(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {}
}
