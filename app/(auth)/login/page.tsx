"use client"
import { useState, useEffect, Suspense } from "react"
import type React from "react"

import { useRouter, useSearchParams } from "next/navigation"
import { signIn, getSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { Spinner } from "@/components/ui/skeleton"
import { MFAVerificationDialog } from "@/components/mfa/mfa-verification-dialog"
import { useToast } from "@/components/ui/use-toast"
import Image from "next/image"
import { Eye, EyeOff } from "lucide-react"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mfaRequired, setMfaRequired] = useState(false)
  const [pendingUser, setPendingUser] = useState<{ email: string; password: string } | null>(null)
  const [isProcessingMFA, setIsProcessingMFA] = useState(false)

  // Clear theme preference on mount and FORCE light mode
  useEffect(() => {
    localStorage.removeItem("theme")
    document.documentElement.classList.remove("dark")
    document.documentElement.style.colorScheme = "light"
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMfaRequired(false)
    setPendingUser(null)

    try {
      const result = await signIn("credentials", { redirect: false, email, password })

      if (result?.error) {
        if (result.error === "MFA_REQUIRED") {
          console.log("Login: MFA required for", email)
          setPendingUser({ email, password })
          setMfaRequired(true)
          return
        }
        // Improve error message for invalid credentials
        if (result.error === "CredentialsSignin") {
          throw new Error("Invalid credentials. Please check your email and password.")
        }
        throw new Error(result.error)
      }

      const role = (result as any)?.role // Note: signIn doesn't return the session/role directly, we might need to rely on callback or fetch session. 
      // Actually, standard NextAuth pattern is to let client side handle redirect or use router.
      // Since we disabled redirect in signIn, we need to decide where to go.
      // We can fetch the session to check role, or just let middleware handle it if we go to dashboard and get bounced.
      // Better: fetch session or just check URL.

      // Let's rely on getSession to be sure
      const session = await getSession()
      const userRole = (session?.user as any)?.role

      if (userRole === "ORDER_PORTAL") {
        router.replace("/shop")
      } else {
        const cb = searchParams.get("callbackUrl")
        router.replace(cb || "/dashboard")
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during login")
    } finally {
      setLoading(false)
    }
  }

  const handleMFASuccess = async () => {
    setIsProcessingMFA(true)
    setMfaRequired(false)
    setPendingUser(null)

    // Check role for redirect
    const session = await getSession()
    const userRole = (session?.user as any)?.role

    if (userRole === "ORDER_PORTAL") {
      router.replace("/shop")
    } else {
      const cb = searchParams.get("callbackUrl")
      router.replace(cb || "/dashboard")
    }
  }

  const handleMFACancel = () => {
    setMfaRequired(false)
    setPendingUser(null)
    setIsProcessingMFA(false)
  }

  return (
    <>
      {/* Loading Overlay for MFA Processing */}
      {isProcessingMFA && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4 text-center shadow-2xl">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Redirecting to Dashboard</h3>
            <p className="text-sm text-slate-600">Please wait while we prepare your workspace...</p>
          </div>
        </div>
      )}

      <Card className="w-full border-0 shadow-2xl bg-white/95 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="bg-white rounded-lg p-2 flex items-center justify-center border-2 shadow-lg" style={{ borderColor: "var(--color-brand-primary)" }}>
              <Image src="/logo-pos.png" alt="Apricart" width={32} height={32} />
            </div>
            <CardTitle className="text-pretty text-2xl font-semibold text-slate-800">
              Apricart OneFlowe
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4" suppressHydrationWarning>
            <div className="grid gap-2">
              <label htmlFor="email" className="text-sm font-medium text-slate-700">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white/80 border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500"
                suppressHydrationWarning
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="password" className="text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-white/80 border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500 pr-10"
                  suppressHydrationWarning
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 focus:outline-none"
                  suppressHydrationWarning
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600 font-medium flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-alert-circle"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
                  {error}
                </p>
              </div>
            )}
            <Button
              type="submit"
              disabled={loading || isProcessingMFA}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-lg"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2"><Spinner size={16} /> Signing in…</span>
              ) : isProcessingMFA ? (
                <span className="inline-flex items-center gap-2"><Spinner size={16} /> Redirecting…</span>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="text-xs text-slate-600">
          <span className="mr-2">Forgot password?</span>
          <a href="#" className="underline text-blue-600 hover:text-blue-700 font-medium">
            Recover
          </a>
        </CardFooter>
      </Card>



      {/* MFA Verification Dialog */}
      {mfaRequired && pendingUser && (
        <MFAVerificationDialog
          open={mfaRequired}
          userEmail={pendingUser.email}
          userPassword={pendingUser.password}
          onSuccess={handleMFASuccess}
          onClose={handleMFACancel}
          type="LOGIN"
        />
      )}
    </>
  )
}

export default function LoginPage() {
  return (
    <main className="min-h-[100svh] flex items-center justify-center relative overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/Background-Login.png"
          alt="Login Background"
          fill
          className="object-cover"
          priority
        />
        {/* Overlay for better text readability */}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <Suspense fallback={
          <Card className="w-full border-0 shadow-2xl bg-white/95 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="bg-white rounded-lg p-2 flex items-center justify-center border-2 shadow-lg" style={{ borderColor: "var(--color-brand-primary)" }}>
                  <Image src="/logo-pos.png" alt="Apricart" width={32} height={32} />
                </div>
                <CardTitle className="text-2xl font-semibold text-slate-800">
                  Loading...
                </CardTitle>
              </div>
            </CardHeader>
          </Card>
        }>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  )
}
