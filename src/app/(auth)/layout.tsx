export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#07070d]">
      {/* Animated gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-violet-950/30 via-[#07070d] to-cyan-950/30" />
      <div className="fixed inset-0 dot-pattern opacity-30" />
      <div className="relative z-10 w-full max-w-md px-4">
        {children}
      </div>
    </div>
  )
}
