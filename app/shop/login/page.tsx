"use client"
import React, { useState, useEffect } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { ShoppingBag, ArrowRight, ChevronLeft } from "lucide-react"
import Image from "next/image"

export default function ShopLoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [otp, setOtp] = useState("")
  const [step, setStep] = useState<"credentials" | "mfa">("credentials")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  // Reset theme to light on mount
  useEffect(() => {
    localStorage.removeItem("theme")
  }, [])

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      return toast({ title: "Enter email and password", variant: "destructive" })
    }

    setIsLoading(true)
    try {
      // First sign in with credentials
      const result = await signIn("employee-credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        if (result.error.includes("MFA")) {
          setStep("mfa")
        } else {
          toast({ title: "Login failed", description: result.error, variant: "destructive" })
        }
      } else {
        toast({ title: "Logged in successfully" })
        router.push("/shop")
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otp || otp.length < 6) {
      return toast({ title: "Enter valid OTP", variant: "destructive" })
    }

    setIsLoading(true)
    try {
      const result = await signIn("employee-mfa-credentials", {
        email,
        password,
        otp,
        redirect: false,
      })

      if (result?.error) {
        toast({ title: "MFA verification failed", description: result.error, variant: "destructive" })
      } else {
        toast({ title: "Logged in successfully" })
        router.push("/shop")
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
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
                <label className="block text-sm font-medium mb-2 text-slate-700">Email</label>
                <Input
                  type="email"
                  placeholder="employee@branch.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="bg-white/80 border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700">Password</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="bg-white/80 border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                />
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
            onClick={() => router.push("/login")}
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
