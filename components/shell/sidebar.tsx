"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const nav = [
  { href: "/super-admin/dashboard", label: "Dashboard" },
  { href: "/super-admin/organizations", label: "Companies" },
  { href: "/super-admin/users", label: "Users" },
  { href: "/super-admin/orders", label: "Orders" },
  { href: "/super-admin/inventory", label: "Inventory" },
  { href: "/super-admin/budgets", label: "Budgets" },
  { href: "/super-admin/reports", label: "Reports" },
  { href: "/super-admin/settings", label: "Settings" },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="w-64 shrink-0 h-svh border-r" style={{ borderColor: "var(--color-border)" }}>
      <div
        className="px-4 py-3 font-semibold text-lg"
        style={{ color: "white", background: "var(--color-brand-primary)" }}
      >
        OneFlowe Admin
      </div>
      <nav className="p-2 grid gap-1">
        {nav.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn("rounded-md px-3 py-2 text-sm", active ? "font-semibold" : "opacity-80 hover:opacity-100")}
              style={{
                color: active ? "var(--color-brand-primary)" : "inherit",
                background: active ? "color-mix(in oklab, var(--color-brand-accent), transparent 80%)" : "transparent",
              }}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
