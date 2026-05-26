'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Brain, Loader2, Mail, Lock, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { auth, googleProvider } from '@/lib/firebase-client'
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'
import { generateBrowserFingerprint } from './fingerprint'
import { toast } from '@/hooks/use-toast'

export default function LoginPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromExtension = searchParams.get('from') === 'extension'

  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')

  const handleAuthSuccess = async (idToken: string) => {
    // Store token in localStorage
    localStorage.setItem('memora_token', idToken)

    // Set cookie so extension can read it
    document.cookie = `memora_token=${idToken}; path=/; domain=.${window.location.hostname.split('.').slice(-2).join('.')}; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`

    // POST to backend to create/update user record
    try {
      await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      })
    } catch {
      // Non-blocking — token is already stored locally
    }

    // Register browser fingerprint (non-blocking)
    try {
      const fingerprint = await generateBrowserFingerprint()
      await fetch('/api/auth/fingerprint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ fingerprint }),
      })
    } catch {
      // Fingerprint registration failure is non-blocking
    }

    toast({
      title: 'Welcome back!',
      description: fromExtension ? 'Your extension is now connected.' : 'You are now signed in.',
    })

    if (fromExtension) {
      router.push('/?extension=connected')
    } else {
      router.push('/')
    }
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const idToken = await result.user.getIdToken()
      await handleAuthSuccess(idToken)
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        return
      }
      toast({
        title: 'Sign in failed',
        description: error.message || 'Something went wrong. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()

    if (mode === 'signup' && password !== confirmPassword) {
      toast({ title: 'Passwords do not match', variant: 'destructive' })
      return
    }
    if (password.length < 6) {
      toast({ title: 'Password must be at least 6 characters', variant: 'destructive' })
      return
    }
    if (!email) {
      toast({ title: 'Please enter your email', variant: 'destructive' })
      return
    }

    setLoading(true)
    try {
      let userCredential
      if (mode === 'signup') {
        userCredential = await createUserWithEmailAndPassword(auth, email, password)
        if (name) {
          try { await userCredential.user.updateProfile({ displayName: name }) } catch { /* ignore */ }
        }
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password)
      }

      const idToken = await userCredential.user.getIdToken()
      await handleAuthSuccess(idToken)
    } catch (error: any) {
      let msg = 'Something went wrong. Please try again.'
      if (error.code === 'auth/user-not-found') msg = 'No account found with this email.'
      else if (error.code === 'auth/wrong-password') msg = 'Incorrect password.'
      else if (error.code === 'auth/email-already-in-use') msg = 'An account with this email already exists.'
      else if (error.code === 'auth/weak-password') msg = 'Password is too weak.'
      else if (error.code === 'auth/invalid-email') msg = 'Please enter a valid email address.'
      else if (error.code === 'auth/invalid-credential') msg = 'Invalid email or password.'
      else if (error.code === 'auth/too-many-requests') msg = 'Too many attempts. Please try again later.'
      else if (error.message) msg = error.message

      toast({ title: mode === 'signup' ? 'Sign up failed' : 'Sign in failed', description: msg, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="glass rounded-2xl p-8 shadow-2xl">
      {/* Logo / Branding */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center mb-4 shadow-lg shadow-violet-500/25">
          <Brain className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Welcome to Memora Bond
        </h1>
        <p className="text-sm text-zinc-400 mt-1.5">
          Your AI-Powered Memory Bond
        </p>
        {fromExtension && (
          <div className="mt-3 px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20">
            <p className="text-xs text-violet-300 text-center">Sign in to connect your extension</p>
          </div>
        )}
      </div>

      {/* Google Sign-In Button */}
      <Button
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="w-full h-12 bg-white/[0.06] border border-white/10 hover:bg-white/[0.1] hover:border-white/20 text-white font-medium rounded-xl shadow-lg transition-all duration-200 cursor-pointer group"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2.5 animate-spin text-violet-400" />
            <span className="text-zinc-300">Signing in...</span>
          </>
        ) : (
          <>
            <svg
              className="w-5 h-5 mr-2.5 group-hover:scale-105 transition-transform"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Sign in with Google
          </>
        )}
      </Button>

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/[0.06]" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-3 bg-[#0d0d15] text-zinc-500">or continue with email</span>
        </div>
      </div>

      {/* Email/Password Form */}
      <form onSubmit={handleEmailAuth} className="space-y-3">
        {mode === 'signup' && (
          <div className="relative">
            <input
              type="text"
              placeholder="Full name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-11 pl-10 pr-4 bg-white/[0.04] border border-white/10 rounded-xl text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/25 transition-all"
            />
          </div>
        )}

        <div className="relative">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full h-11 pl-10 pr-4 bg-white/[0.04] border border-white/10 rounded-xl text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/25 transition-all"
          />
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
        </div>

        <div className="relative">
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full h-11 pl-10 pr-4 bg-white/[0.04] border border-white/10 rounded-xl text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/25 transition-all"
          />
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
        </div>

        {mode === 'signup' && (
          <div className="relative">
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="w-full h-11 pl-10 pr-4 bg-white/[0.04] border border-white/10 rounded-xl text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/25 transition-all"
            />
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
          </div>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-11 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-medium rounded-xl shadow-lg transition-all duration-200 cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              <span>{mode === 'signup' ? 'Creating account...' : 'Signing in...'}</span>
            </>
          ) : (
            <>
              <span>{mode === 'signup' ? 'Create Account' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </form>

      {/* Toggle Sign In / Sign Up */}
      <div className="mt-5 text-center">
        <button
          type="button"
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          disabled={loading}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
        >
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <span className="text-violet-400 hover:text-violet-300 font-medium">
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </span>
        </button>
      </div>

      {/* Footer text */}
      <p className="mt-5 text-center text-xs text-zinc-600 leading-relaxed">
        By signing in, you agree to our{' '}
        <span className="text-zinc-500 hover:text-zinc-400 transition-colors cursor-pointer">
          Terms of Service
        </span>
        . 2-day free trial, then $12/month.
      </p>
    </div>
  )
}
