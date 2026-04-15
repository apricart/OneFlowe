"use client"
import { useState, useEffect } from "react"
import type React from "react"
import { useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Spinner } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import Image from "next/image"
import { Eye, EyeOff, Lock, ShieldCheck } from "lucide-react"

export default function ChangePasswordPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const { toast } = useToast()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPasswords, setShowPasswords] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // If not authenticated, redirect to login
    if (status === "unauthenticated") {
      router.replace("/login")
    }
  }, [status, router])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match")
      setLoading(false)
      return
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long")
      setLoading(false)
      return
    }

    try {
      const res = await fetch("/api/v1/users/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to change password")

      toast({
        title: "Success",
        description: "Password changed successfully. Please sign in again.",
      })

      // Force sign out and redirect to login
      await signOut({ callbackUrl: "/login" })
    } catch (err: any) {
      setError(err.message || "An error occurred")
      setLoading(false)
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <Spinner size={32} />
      </div>
    )
  }

  return (
    <main className="min-h-[100svh] flex items-center justify-center relative overflow-hidden">
      {/* Background Overlay */}
      <div className="absolute inset-0 z-0 bg-slate-900">
        <Image
          src="/Background-Login.png"
          alt="Background"
          fill
          className="object-cover opacity-40"
          priority
        />
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      </div>

      <div className="relative z-10 w-full max-w-md mx-4">
        <Card className="w-full border-0 shadow-2xl bg-white/95 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="bg-white rounded-lg p-2 flex items-center justify-center border-2 shadow-lg" style={{ borderColor: "var(--color-brand-primary)" }}>
                <Image src="/logo-pos.png" alt="Apricart" width={32} height={32} />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-slate-800">
                  Update Password
                </CardTitle>
                <p className="text-xs text-slate-500 mt-1">
                  Ensure your account remains private & secure.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Lock className="h-3 w-3" /> Current Password
                </label>
                <div className="relative">
                  <Input
                    type={showPasswords ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="bg-white/80 border-slate-300 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(!showPasswords)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="h-px bg-slate-100 my-1" />

              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <ShieldCheck className="h-3 w-3" /> New Password
                </label>
                <Input
                  type={showPasswords ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="bg-white/80 border-slate-300"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  Confirm New Password
                </label>
                <Input
                  type={showPasswords ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="bg-white/80 border-slate-300"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600 font-medium">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-lg mt-2"
              >
                {loading ? <Spinner size={16} /> : "Update Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
