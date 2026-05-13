'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Brain, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Invalid email or password')
      } else {
        router.push('/')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="glass rounded-2xl p-8 shadow-2xl">
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center mb-4 shadow-lg shadow-violet-500/20">
          <Brain className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Cortex</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Sign in to your cognitive workspace
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-zinc-300 text-sm">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            className="h-11 bg-white/5 border-white/10 text-white placeholder:text-zinc-500 focus:border-violet-500/50 focus:ring-violet-500/20 focus-visible:ring-violet-500/20"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-zinc-300 text-sm">
            Password
          </Label>
          <Input
            id="password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            className="h-11 bg-white/5 border-white/10 text-white placeholder:text-zinc-500 focus:border-violet-500/50 focus:ring-violet-500/20 focus-visible:ring-violet-500/20"
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Submit */}
        <Button
          type="submit"
          disabled={loading}
          className="w-full h-11 bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white font-medium rounded-xl shadow-lg shadow-violet-500/20 transition-all duration-200 cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Signing in...
            </>
          ) : (
            'Sign In'
          )}
        </Button>
      </form>

      {/* Footer */}
      <p className="text-center text-sm text-zinc-500 mt-6">
        Don&apos;t have an account?{' '}
        <Link
          href="/signup"
          className="text-violet-400 hover:text-violet-300 transition-colors font-medium"
        >
          Sign Up
        </Link>
      </p>
    </div>
  )
}
