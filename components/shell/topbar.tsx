"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { signOut, useSession } from "next-auth/react"
import Image from "next/image"

export function Topbar() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  async function logout() {
    await signOut({ callbackUrl: "/login", redirect: true })
  }
  return (
    <header
      className="w-full h-14 flex items-center justify-between px-4 border-b"
      style={{ borderColor: "var(--color-border)" }}
    >
      <div className="text-sm flex items-center gap-2">
        <Image src="/logo-pos.svg" alt="logo" width={20} height={20} />
      </div>
      <div className="relative flex items-center gap-2">
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 rounded-full px-2 py-1 hover:bg-[oklch(0.95_0.01_250)]">
          <Image src="/placeholder-user.jpg" alt="avatar" width={28} height={28} className="rounded-full" />
          <span className="text-sm">{(session?.user as any)?.email || "Account"}</span>
        </button>
        {open && (
          <div className="absolute right-0 top-10 z-50 min-w-56 rounded-md border bg-white p-2 shadow-md">
            <div className="px-2 py-1 text-xs opacity-70">Signed in as {(session?.user as any)?.email || "user"}</div>
            <div className="h-px my-1 bg-gray-200" />
            <button className="w-full text-left px-2 py-1 rounded hover:bg-[oklch(0.96_0.01_250)]" onClick={() => (window.location.href = "/settings")}>Settings</button>
            <button className="w-full text-left px-2 py-1 rounded hover:bg-[oklch(0.96_0.01_250)]" onClick={logout}>Logout</button>
          </div>
        )}
      </div>
    </header>
  )
}
