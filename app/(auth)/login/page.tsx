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

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mfaRequired, setMfaRequired] = useState(false)
  const [pendingUser, setPendingUser] = useState<{ email: string; password: string } | null>(null)
  const [isProcessingMFA, setIsProcessingMFA] = useState(false)

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
        throw new Error(result.error)
      }
      
      const cb = searchParams.get("callbackUrl")
      router.replace(cb || "/dashboard")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleMFASuccess = () => {
    setIsProcessingMFA(true)
    setMfaRequired(false)
    setPendingUser(null)
    const cb = searchParams.get("callbackUrl")
    router.replace(cb || "/dashboard")
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
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4 text-center">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Redirecting to Dashboard</h3>
            <p className="text-sm text-gray-600">Please wait while we prepare your workspace...</p>
          </div>
        </div>
      )}
      
      <Card className="w-full max-w-md border border-[var(--color-border)]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="bg-white rounded-lg p-2 flex items-center justify-center border-2" style={{ borderColor: "var(--color-brand-primary)" }}>
              <Image src="/logo-pos.png" alt="Apricart" width={32} height={32} />
            </div>
            <CardTitle className="text-pretty text-2xl font-semibold" style={{ color: "var(--color-brand-primary)" }}>
              Apricart OneFlowe
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <label htmlFor="email" className="text-sm">
                Email
              </label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <label htmlFor="password" className="text-sm">
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="text-sm" style={{ color: "var(--color-destructive)" }}>
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={loading || isProcessingMFA}
              className="w-full"
              style={{ background: "var(--color-brand-primary)", color: "white" }}
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
        <CardFooter className="text-xs">
          <span className="mr-2">Forgot password?</span>
          <a href="#" className="underline" style={{ color: "var(--color-brand-accent)" }}>
            Recover
          </a>
        </CardFooter>
      </Card>

      {/* Order Portal Button */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <Button variant="outline" onClick={() => router.push("/shop/login")} className="gap-2">
          🛒 Order Portal Login
        </Button>
      </div>

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
    <main className="min-h-[100svh] flex items-center justify-center bg-background relative">
      <Suspense fallback={
        <Card className="w-full max-w-md border border-[var(--color-border)]">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="bg-white rounded-lg p-2 flex items-center justify-center border-2" style={{ borderColor: "var(--color-brand-primary)" }}>
                <Image src="/logo-pos.png" alt="Apricart" width={32} height={32} />
              </div>
              <CardTitle className="text-2xl font-semibold" style={{ color: "var(--color-brand-primary)" }}>
                Loading...
              </CardTitle>
            </div>
          </CardHeader>
        </Card>
      }>
        <LoginForm />
      </Suspense>
    </main>
  )
}
