"use client"
import { Button } from "@/components/ui/button"

export function Topbar() {
  async function logout() {
    await fetch("/api/v1/auth/logout", { method: "POST" })
    window.location.href = "/login"
  }
  return (
    <header
      className="w-full h-14 flex items-center justify-between px-4 border-b"
      style={{ borderColor: "var(--color-border)" }}
    >
      <div className="text-sm">
        <span className="font-semibold">Super Admin</span>
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={logout} style={{ background: "var(--color-brand-accent)", color: "black" }}>
          Logout
        </Button>
      </div>
    </header>
  )
}
