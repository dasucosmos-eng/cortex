'use client'
import { useState, useEffect, useCallback } from 'react'
import { onAuthStateChanged, User, signOut as firebaseSignOut } from 'firebase/auth'
import { auth } from '@/lib/firebase-client'

interface AuthState {
  user: User | null
  token: string | null
  loading: boolean
}

export function useFirebaseAuth() {
  const [state, setState] = useState<AuthState>({ user: null, token: null, loading: true })

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const token = await user.getIdToken()
          setState({ user, token, loading: false })
          // Store token for middleware cookie
          document.cookie = `memora_token=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`
        } catch {
          setState({ user, token: null, loading: false })
        }
      } else {
        setState({ user: null, token: null, loading: false })
        document.cookie = 'memora_token=; path=/; max-age=0'
      }
    })
    return () => unsubscribe()
  }, [])

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth)
    localStorage.removeItem('memora_token')
    document.cookie = 'memora_token=; path=/; max-age=0'
    window.location.href = '/login'
  }, [])

  return { ...state, signOut }
}

// Helper to get auth headers for API calls
export function getAuthHeaders(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {}
}
