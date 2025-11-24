"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Home, Building2, Users, Package, Boxes, Wallet, BarChart3, Settings, ShieldCheck, ShoppingBag, FolderTree, FolderOpen, Tags, ChevronDown, ChevronRight } from "lucide-react"
import Image from "next/image"
import { useState } from "react"

import { useSession } from "next-auth/react"

const getNavigationByRole = (role: string) => {
  const baseNav = [
    { href: "/dashboard", label: "Dashboard", icon: Home },
  ]
  
  if (role === "SUPER_ADMIN") {
    return [
      ...baseNav,
      { href: "/admin", label: "Admin Control", icon: ShieldCheck },
      { href: "/organizations", label: "Organizations", icon: Building2 },
      { href: "/users", label: "Users", icon: Users },
      { href: "/orders", label: "Orders", icon: Package },
      { 
        href: "/products", 
        label: "Product Management", 
        icon: ShoppingBag,
        subItems: [
          { href: "/products/categories", label: "Categories", icon: FolderTree },
          { href: "/products/subcategories", label: "Sub Categories", icon: FolderOpen },
          { href: "/products/modifiers", label: "Modifiers", icon: Tags },
        ]
      },
      { href: "/global-inventory", label: "Global Inventory", icon: Boxes },
      { href: "/budgets", label: "Budgets", icon: Wallet },
      { 
        href: "/reports", 
        label: "Reports", 
        icon: BarChart3,
        subItems: [
          { href: "/reports/sales-summary", label: "Summary Report" },
          { href: "/reports/refund-orders", label: "Refund Order Report" },
          { href: "/reports/product-summary", label: "Product Summary" },
          { href: "/reports/product-summary-details", label: "Product Summary Details" },
          { href: "/reports/stock-store-summary", label: "Stock Store Summary" },
          { href: "/reports/stock-reports", label: "Stock Reports" },
          { href: "/reports/stock-logs", label: "Stock Logs" },
        ]
      },
      { href: "/settings", label: "Settings", icon: Settings },
    ]
  }
  
  if (role === "HEAD_OFFICE") {
    return [
      ...baseNav,
      { href: "/branches", label: "My Branches", icon: Building2 },
      { href: "/users", label: "Users", icon: Users },
      { href: "/head-office-orders", label: "Orders", icon: Package },
      { href: "/inventory", label: "Inventory", icon: Boxes },
      { href: "/budgets", label: "Budgets", icon: Wallet },
      { 
        href: "/reports", 
        label: "Reports", 
        icon: BarChart3,
        subItems: [
          { href: "/reports/sales-summary", label: "Summary Report" },
          { href: "/reports/refund-orders", label: "Refund Order Report" },
          { href: "/reports/product-summary", label: "Product Summary" },
          { href: "/reports/product-summary-details", label: "Product Summary Details" },
          { href: "/reports/stock-store-summary", label: "Stock Store Summary" },
          { href: "/reports/stock-reports", label: "Stock Reports" },
          { href: "/reports/stock-logs", label: "Stock Logs" },
        ]
      },
      { href: "/settings", label: "Settings", icon: Settings },
    ]
  }
  
  if (role === "BRANCH_ADMIN") {
    return [
      ...baseNav,
      { href: "/orders", label: "Orders", icon: Package },
      { href: "/branch-inventory", label: "Inventory", icon: Boxes },
      { href: "/employee-management", label: "Employee Management", icon: Users },
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
  const [expandedItems, setExpandedItems] = useState<string[]>([])

  const toggleExpanded = (href: string) => {
    setExpandedItems(prev => 
      prev.includes(href) 
        ? prev.filter(item => item !== href)
        : [...prev, href]
    )
  }

  const isItemActive = (item: any) => {
    if (item.subItems) {
      return item.subItems.some((subItem: any) => pathname.startsWith(subItem.href))
    }
    return pathname.startsWith(item.href)
  }

  const isSubItemActive = (subItem: any) => {
    return pathname.startsWith(subItem.href)
  }

  return (
    <aside className="w-64 shrink-0 h-svh border-r flex flex-col" style={{ borderColor: "var(--color-border)" }}>
      <div className="px-4 py-4 flex items-center gap-3" style={{ color: "white", background: "var(--color-brand-primary)" }}>
        <div className="bg-white rounded-lg p-1.5 flex items-center justify-center">
          <Image src="/logo-pos.png" alt="OneFlowe" width={32} height={32} />
        </div>
        <div className="leading-tight">
          <div className="text-base font-semibold tracking-tight">OneFlowe</div>
          <div className="text-xs opacity-90">{role === "SUPER_ADMIN" ? "Admin" : role === "HEAD_OFFICE" ? "Head Office" : "Branch"}</div>
        </div>
      </div>
      <nav className="p-2 grid gap-1 overflow-y-auto flex-1 min-h-0" aria-busy={!session} aria-live="polite">
        {nav.map((item) => {
          const active = isItemActive(item)
          const hasSubItems = 'subItems' in item && Array.isArray(item.subItems) && item.subItems.length > 0;
          const isExpanded = expandedItems.includes(item.href)
          
          if (hasSubItems) {
            const subItems = item.subItems;
            return (
              <div key={item.href}>
                <button
                  onClick={() => toggleExpanded(item.href)}
                  className={cn(
                    "w-full rounded-md px-3 py-2 text-sm flex items-center gap-2 text-left",
                    active ? "font-semibold" : "opacity-80 hover:opacity-100"
                  )}
                  style={{
                    color: active ? "var(--color-brand-primary)" : "inherit",
                    background: active ? "color-mix(in oklab, var(--color-brand-accent), transparent 80%)" : "transparent",
                  }}
                >
                  {item.icon ? <item.icon size={16} /> : null}
                  <span className="flex-1">{item.label}</span>
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                {isExpanded && Array.isArray(item.subItems) && (
                  <div className="ml-4 mt-1 space-y-1">
                    {item.subItems.map((subItem: any) => {
                      const subActive = isSubItemActive(subItem)
                      return (
                        <Link
                          key={subItem.href}
                          href={subItem.href}
                          className={cn(
                            "block rounded-md px-3 py-2 text-sm flex items-center gap-2",
                            subActive ? "font-semibold" : "opacity-80 hover:opacity-100"
                          )}
                          style={{
                            color: subActive ? "var(--color-brand-primary)" : "inherit",
                            background: subActive ? "color-mix(in oklab, var(--color-brand-accent), transparent 80%)" : "transparent",
                          }}
                        >
                          {subItem.icon ? <subItem.icon size={14} /> : null}
                          <span>{subItem.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

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
