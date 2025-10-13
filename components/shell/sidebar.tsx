"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Home, Building2, Users, Package, Boxes, Wallet, BarChart3, Settings, Warehouse } from "lucide-react"
import Image from "next/image"

import { useSession } from "next-auth/react"

const getNavigationByRole = (role: string) => {
  const baseNav = [
    { href: "/dashboard", label: "Dashboard", icon: Home },
  ]
  
  if (role === "SUPER_ADMIN") {
    return [
      ...baseNav,
      { href: "/organizations", label: "Organizations", icon: Building2 },
      { href: "/users", label: "Users", icon: Users },
      { href: "/orders", label: "Orders", icon: Package },
      { href: "/inventory", label: "Inventory", icon: Boxes },
      { href: "/budgets", label: "Budgets", icon: Wallet },
      { href: "/reports", label: "Reports", icon: BarChart3 },
      { href: "/settings", label: "Settings", icon: Settings },
    ]
  }
  
  if (role === "HEAD_OFFICE") {
    return [
      ...baseNav,
      { href: "/branches", label: "My Branches", icon: Building2 },
      { href: "/orders", label: "Orders", icon: Package },
      { href: "/inventory", label: "Inventory", icon: Boxes },
      { href: "/inventory/warehouse", label: "Warehouse", icon: Warehouse },
      { href: "/budgets", label: "Budgets", icon: Wallet },
      { href: "/reports", label: "Reports", icon: BarChart3 },
      { href: "/settings", label: "Settings", icon: Settings },
    ]
  }
  
  if (role === "BRANCH_ADMIN") {
    return [
      ...baseNav,
      { href: "/orders", label: "Orders", icon: Package },
      { href: "/inventory", label: "Inventory", icon: Boxes },
      { href: "/inventory/warehouse", label: "Warehouse", icon: Warehouse },
      { href: "/budgets", label: "Budgets", icon: Wallet },
      { href: "/settings", label: "Settings", icon: Settings },
    ]
  }
  
  return baseNav
}

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const role = (session?.user as any)?.role || "BRANCH_ADMIN"
  const nav = getNavigationByRole(role)
  
  return (
    <aside className="w-64 shrink-0 h-svh border-r" style={{ borderColor: "var(--color-border)" }}>
      <div className="px-4 py-3 flex items-center gap-2 font-semibold text-lg" style={{ color: "white", background: "var(--color-brand-primary)" }}>
        <Image src="/logo-pos.svg" alt="logo" width={24} height={24} />
        <span>OneFlowe {role === "SUPER_ADMIN" ? "Admin" : role === "HEAD_OFFICE" ? "Head Office" : "Branch"}</span>
      </div>
      <nav className="p-2 grid gap-1" aria-busy={!session} aria-live="polite">
        {nav.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn("rounded-md px-3 py-2 text-sm flex items-center gap-2", active ? "font-semibold" : "opacity-80 hover:opacity-100")}
              style={{
                color: active ? "var(--color-brand-primary)" : "inherit",
                background: active ? "color-mix(in oklab, var(--color-brand-accent), transparent 80%)" : "transparent",
              }}
            >
              {item.icon ? <item.icon size={16} /> : null}
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
