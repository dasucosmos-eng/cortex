'use client'

import { Suspense } from 'react'
import LoginPageInner from './login-inner'

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="glass rounded-2xl p-8 shadow-2xl flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      </div>
    }>
      <LoginPageInner />
    </Suspense>
  )
}
