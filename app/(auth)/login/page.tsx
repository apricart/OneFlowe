"use client"
import { useState } from "react"
import type React from "react"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Login failed")
      router.replace("/super-admin/dashboard")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-[100svh] flex items-center justify-center bg-background">
      <Card className="w-full max-w-md border border-[var(--color-border)]">
        <CardHeader>
          <CardTitle className="text-pretty text-2xl font-semibold" style={{ color: "var(--color-brand-primary)" }}>
            Apricart OneFlowe
          </CardTitle>
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
              disabled={loading}
              className="w-full"
              style={{ background: "var(--color-brand-primary)", color: "white" }}
            >
              {loading ? "Signing in…" : "Sign In"}
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
    </main>
  )
}
