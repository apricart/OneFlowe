"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { signOut, useSession } from "next-auth/react"
import Image from "next/image"
import { useEffect } from "react"
import { useOrganizations, useBranches } from "@/lib/hooks/use-api"

export function Topbar() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const [organizationId, setOrganizationId] = useState<string>("")
  const [branchId, setBranchId] = useState<string>("")
  const { data: orgs } = useOrganizations()
  const { data: brs } = useBranches(organizationId || undefined)

  useEffect(() => {
    const oid = localStorage.getItem("ctx.organizationId") || ""
    const bid = localStorage.getItem("ctx.branchId") || ""
    setOrganizationId(oid)
    setBranchId(bid)
  }, [])

  useEffect(() => {
    if (organizationId) localStorage.setItem("ctx.organizationId", organizationId)
  }, [organizationId])
  useEffect(() => {
    if (branchId) localStorage.setItem("ctx.branchId", branchId)
  }, [branchId])
  async function logout() {
    await signOut({ callbackUrl: "/login", redirect: true })
  }
  return (
    <header
      className="sticky top-0 z-40 w-full h-14 flex items-center justify-between px-4 border-b backdrop-blur supports-[backdrop-filter]:bg-white/70"
      style={{ borderColor: "var(--color-border)" }}
    >
      <div className="text-sm flex items-center gap-3">
        <Image src="/logo-pos.svg" alt="logo" width={32} height={32} />
        <span className="hidden md:inline font-semibold tracking-tight" style={{ color: "var(--color-brand-primary)" }}>OneFlowe Admin</span>
      </div>
      <div className="hidden md:flex items-center gap-2">
        <select
          value={organizationId}
          onChange={(e) => {
            setOrganizationId(e.target.value)
            setBranchId("")
          }}
          className="border rounded-md px-3 py-1.5 text-sm shadow-sm hover:bg-[oklch(0.98_0.01_250)]"
          aria-label="Select organization"
        >
          <option value="">Organization</option>
          {(orgs?.items || []).map((o: any) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
        <select
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          className="border rounded-md px-3 py-1.5 text-sm shadow-sm hover:bg[oklch(0.98_0.01_250)]"
          aria-label="Select branch"
          disabled={!organizationId}
        >
          <option value="">Branch</option>
          {(brs?.items || []).map((b: any) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
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
