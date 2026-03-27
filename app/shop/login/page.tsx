"use client"
import React, { useState, useEffect } from "react"
import { signIn, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { ShoppingBag, ArrowRight, ChevronLeft, Eye, EyeOff } from "lucide-react"
import Image from "next/image"

/**
 * Clear stale NextAuth session cookies to prevent "Invalid URL" errors.
 * After a password/email change the old JWT becomes invalid, but if the cookie
 * still exists NextAuth internals may call `new URL(undefined)` and crash.
 */
function clearAuthCookies() {
  try {
    const cookieNames = [
      "next-auth.session-token",
      "__Secure-next-auth.session-token",
      "next-auth.csrf-token",
      "__Host-next-auth.csrf-token",
      "next-auth.callback-url",
      "__Secure-next-auth.callback-url",
    ]
    cookieNames.forEach((name) => {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
      // Also clear with domain variations for Vercel
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; secure`
    })
  } catch (_) {
    // Cookie access may fail in some contexts — safe to ignore
  }
}

/**
 * Detect NextAuth internal URL constructor errors.
 * These happen when `signIn()` or `signOut()` internally calls `new URL(data.url)`
 * with an undefined value from a stale/invalidated session.
 */
function isUrlConstructorError(err: any): boolean {
  const msg = String(err?.message || err || "").toLowerCase()
  return msg.includes("url") && (msg.includes("invalid") || msg.includes("undefined") || msg.includes("failed to construct"))
}

export default function ShopLoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [otp, setOtp] = useState("")
  const [step, setStep] = useState<"credentials" | "mfa">("credentials")
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  // Reset theme to light on mount and sign out any existing session
  useEffect(() => {
    localStorage.removeItem("theme")

    // Clear stale auth cookies BEFORE calling signOut to prevent URL constructor crash
    clearAuthCookies()

    signOut({ redirect: false }).catch((err) => {
      console.warn("[ShopLogin] signOut on mount failed (expected after password/email change):", err?.message)
    })
  }, [])

  const [providerType, setProviderType] = useState<"user" | "employee" | null>(null)

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) {
      return toast({ title: "Enter username and password", variant: "destructive" })
    }

    setIsLoading(true)
    try {
      // Clear cookies again before sign-in to guarantee a clean state
      clearAuthCookies()

      // 1. Try Standard User Login (New System - ORDER_PORTAL role)
      let result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      })

      if (result?.error) {
        if (result.error === "MFA_REQUIRED") {
          setProviderType("user")
          setStep("mfa")
          setIsLoading(false)
          return
        }

        if (result.error === "ORGANIZATION_INACTIVE") {
          setIsLoading(false)
          return toast({ title: "Login failed", description: "Company has been de-activated by the Admin.", variant: "destructive" })
        }
        if (result.error === "BRANCH_INACTIVE") {
          setIsLoading(false)
          return toast({ title: "Login failed", description: "Branch has been de-activated by the Admin.", variant: "destructive" })
        }
        if (result.error === "USER_INACTIVE") {
          setIsLoading(false)
          return toast({ title: "Login failed", description: "Your account has been deactivated.", variant: "destructive" })
        }

        // 2. Fallback to Employee Login (Legacy System)
        // Only try fallback if standard login failed with specific credential error, 
        // essentially treating the first failure as "user not found in users table"
        console.log("Standard login failed, trying employee login fallback...")

        result = await signIn("employee-credentials", {
          username,
          password,
          redirect: false,
        })

        if (result?.error) {
          if (result.error.includes("MFA")) { // Employee MFA error text might differ, auth-options throws "MFA_REQUIRED"
            setProviderType("employee")
            setStep("mfa")
          } else if (result.error === "ORGANIZATION_INACTIVE") {
            toast({ title: "Login failed", description: "Company has been de-activated by the Admin.", variant: "destructive" })
          } else if (result.error === "BRANCH_INACTIVE") {
            toast({ title: "Login failed", description: "Branch has been de-activated by the Admin.", variant: "destructive" })
          } else if (result.error === "USER_INACTIVE") {
            toast({ title: "Login failed", description: "Your account has been deactivated.", variant: "destructive" })
          } else {
            // Both failed
            toast({ title: "Login failed", description: "Invalid username or password", variant: "destructive" })
          }
        } else {
          // Employee Login Success
          toast({ title: "Logged in successfully" })
          window.location.replace("/shop")
        }
      } else {
        // Standard User Login Success
        toast({ title: "Logged in successfully" })
        window.location.replace("/shop")
      }
    } catch (error: any) {
      if (isUrlConstructorError(error)) {
        console.warn("[ShopLogin] Caught URL constructor error — clearing cookies and prompting retry:", error?.message)
        clearAuthCookies()
        toast({ title: "Session Expired", description: "Please try signing in again.", variant: "destructive" })
      } else {
        toast({ title: "Error", description: error.message, variant: "destructive" })
      }
    } finally {
      if (step !== "mfa") setIsLoading(false)
    }
  }

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otp || otp.length < 6) {
      return toast({ title: "Enter valid OTP", variant: "destructive" })
    }

    if (!providerType) {
      return toast({ title: "Error", description: "Unknown login provider", variant: "destructive" })
    }

    setIsLoading(true)
    try {
      const providerId = providerType === "user" ? "mfa-credentials" : "employee-mfa-credentials"

      const result = await signIn(providerId, {
        username,
        password,
        otp,
        redirect: false,
      })

      if (result?.error) {
        const errorMessage = result.error === "CredentialsSignin"
          ? "Invalid or expired OTP code. Please check and try again."
          : result.error
        toast({ title: "MFA verification failed", description: errorMessage, variant: "destructive" })
      } else {
        toast({ title: "Logged in successfully" })
        window.location.replace("/shop")
      }
    } catch (error: any) {
      if (isUrlConstructorError(error)) {
        console.warn("[ShopLogin] Caught URL constructor error during MFA — clearing cookies and prompting retry:", error?.message)
        clearAuthCookies()
        setStep("credentials")
        setOtp("")
        toast({ title: "Session Expired", description: "Please try signing in again from the beginning.", variant: "destructive" })
      } else {
        toast({ title: "Error", description: error.message, variant: "destructive" })
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
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
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="bg-white/90 p-2 rounded-lg shadow-lg">
              <ShoppingBag className="h-8 w-8 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-white drop-shadow-lg">Order Portal</h1>
          </div>
          <p className="text-white/90 drop-shadow-md">Employee Portal for Quick Ordering</p>
        </div>

        {/* Login Card */}
        <Card className="p-6 space-y-6 border-0 shadow-2xl bg-white/95 backdrop-blur-sm">
          {step === "credentials" ? (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700">Username</label>
                <Input
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                  className="bg-white/80 border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700">Password</label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="bg-white/80 border-slate-300 focus:border-blue-500 focus:ring-blue-500 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-slate-400 hover:text-slate-600"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-lg" disabled={isLoading}>
                {isLoading ? "Signing In..." : "Sign In"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          ) : (
            <form onSubmit={handleMfaSubmit} className="space-y-4">
              <div className="text-center mb-4">
                <p className="text-sm text-slate-600">
                  Enter the code sent to your authenticator app
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700">Verification Code</label>
                <Input
                  type="text"
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                  disabled={isLoading}
                  className="text-center text-2xl tracking-widest bg-white/80 border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-lg" disabled={isLoading}>
                {isLoading ? "Verifying..." : "Verify"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full border-slate-300 text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setStep("credentials")
                  setOtp("")
                }}
                disabled={isLoading}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </form>
          )}

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-slate-500">or</span>
            </div>
          </div>

          {/* Back to Dashboard */}
          <Button
            variant="outline"
            className="w-full gap-2 border-slate-300 text-slate-700 hover:bg-slate-50"
            onClick={() => window.location.replace("/login")}
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Dashboard Login
          </Button>
        </Card>

        {/* Footer Info */}
        <div className="mt-8 text-center text-xs text-white/80 drop-shadow-md">
          <p>Employee credentials provided by Branch Admin</p>
          <p className="mt-2">Multi-factor authentication enabled for security</p>
        </div>
      </div>
    </div>
  )
}
