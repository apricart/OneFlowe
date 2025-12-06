"use client"
import Link from "next/link"
import { useOrganizations, useBranches, useUsers } from "@/lib/hooks/use-api"
import { KpiCard } from "@/components/ui/kpi-card"
import { Card, CardContent } from "@/components/ui/card"
import useSWR from "swr"
import { NotificationRail } from "@/components/notifications/notification-center"
import { formatPKR } from "@/lib/utils"
import { Building2, GitBranch, Users, Package, Warehouse, Wallet, BarChart3, ShieldCheck } from "lucide-react"
import { TrendAreaChart, ComparisonBarChart } from "@/components/dashboard/charts"
import { useAppContext } from "@/components/context/app-context"

const navTiles = [
  {
    title: "Organizations",
    description: "Configure groups and parent companies.",
    href: "/organizations",
    icon: Building2,
  },
  {
    title: "Branches",
    description: "Manage branches and assignments.",
    href: "/branches",
    icon: GitBranch,
  },
  {
    title: "Users & Roles",
    description: "Administer users and access levels.",
    href: "/users",
    icon: Users,
  },
  {
    title: "Global Inventory",
    description: "Master product catalog across orgs.",
    href: "/global-inventory",
    icon: Warehouse,
  },
  {
    title: "Orders",
    description: "Monitor and override orders.",
    href: "/orders",
    icon: Package,
  },
  {
    title: "Budgets",
    description: "Control branch spending limits.",
    href: "/budgets",
    icon: Wallet,
  },
  {
    title: "Reports",
    description: "Sales, refunds, and stock insights.",
    href: "/reports",
    icon: BarChart3,
  },
  {
    title: "System Settings",
    description: "Permissions, audit, and advanced config.",
    href: "/admin",
    icon: ShieldCheck,
  },
]
  
export function SuperAdminDashboard() {
  const { organizationId, branchId } = useAppContext()

  // Scope org / branch data by context selector
  const { data: orgsData } = useOrganizations()
  const { data: usersData } = useUsers(organizationId || undefined)
  const { data: branchesData } = useBranches(organizationId || undefined)

  const orgs = orgsData?.items || []
  const branchesRaw = branchesData?.items || []
  const usersRaw = usersData?.items || []

  const branchesInScope = branchId
    ? branchesRaw.filter((b: any) => b.id?.toString() === branchId)
    : branchesRaw

  const usersInScope = branchId
    ? usersRaw.filter((u: any) => u.branchId?.toString() === branchId)
    : usersRaw

  const orgsCount = organizationId
    ? orgs.filter((o: any) => o.id?.toString() === organizationId).length
    : orgs.length

  const usersCount = usersInScope.length
  const branchesCount = branchesInScope.length
  const activeBranches = branchesInScope.filter((b: any) => b.status === "active").length

  const selectedOrg = organizationId
    ? orgs.find((o: any) => o.id?.toString() === organizationId)
    : null
  const selectedBranch = branchId
    ? branchesRaw.find((b: any) => b.id?.toString() === branchId)
    : null

  const scopeText = branchId
    ? selectedBranch?.name || `Branch #${branchId}`
    : organizationId
    ? selectedOrg?.name || `Organization #${organizationId}`
    : "All organizations & branches"

  const fetcher = (url: string) => fetch(url).then((r) => r.json())

  const buildOrdersUrl = (params: Record<string, string | undefined>) => {
    const search = new URLSearchParams()
    if (params.status) search.set("status", params.status)
    if (params.from) search.set("from", params.from)
    if (organizationId) search.set("organizationId", organizationId)
    if (branchId) search.set("branchId", branchId)
    const qs = search.toString()
    return `/api/v1/orders${qs ? `?${qs}` : ""}`
  }

  const startOfToday = (() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  })()

  const { data: todaysOrders } = useSWR<{ items: any[] }>(
    buildOrdersUrl({ from: startOfToday }),
    fetcher
  )
  const { data: pendingOrders } = useSWR<{ items: any[] }>(
    buildOrdersUrl({ status: "pending" }),
    fetcher
  )
  const { data: todaysRefunded } = useSWR<{ items: any[] }>(
    buildOrdersUrl({ status: "refunded", from: startOfToday }),
    fetcher
  )

  const todaysGMVCents = (todaysOrders?.items || []).reduce((sum, o) => sum + (o.totalCents || 0), 0)
  const todaysGMV = formatPKR(todaysGMVCents / 100, { maximumFractionDigits: 0 })
  const pendingCount = pendingOrders?.items?.length || 0
  const todaysRefundCount = todaysRefunded?.items?.length || 0

  const salesData = [
    { label: "Mon", value: 120000 },
    { label: "Tue", value: 180000 },
    { label: "Wed", value: 90000 },
    { label: "Thu", value: 160000 },
    { label: "Fri", value: 210000 },
    { label: "Sat", value: 140000 },
    { label: "Sun", value: 170000 },
  ]

  const gmvTaxData = [
    { label: "Jan", value: 120 },
    { label: "Feb", value: 135 },
    { label: "Mar", value: 150 },
    { label: "Apr", value: 142 },
  ]

  return (
    <main className="p-6 space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#141EAE] via-[#3E2FBF] to-[#7C3AED] px-6 py-6 text-white shadow-xl ring-1 ring-indigo-500/30">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.2em] text-white/70">SUPER ADMIN · CONTROL</p>
            <h1 className="text-3xl font-semibold">Super Admin dashboard</h1>
            <p className="text-sm text-white/80">
              System-wide overview and controls for {scopeText.toLowerCase()}.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-medium uppercase tracking-wide">
              <span className="text-white/80">Scope</span>
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold">
                {scopeText}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-white/80">
              <div className="rounded-xl bg-black/15 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide">Organizations</p>
                <p className="text-lg font-semibold text-white">{orgsCount}</p>
              </div>
              <div className="rounded-xl bg-black/15 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide">Branches</p>
                <p className="text-lg font-semibold text-white">{branchesCount}</p>
              </div>
              <div className="rounded-xl bg-black/15 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide">Users</p>
                <p className="text-lg font-semibold text-white">{usersCount}</p>
              </div>
              <div className="rounded-xl bg-black/15 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide">Pending orders</p>
                <p className="text-lg font-semibold text-white">{pendingCount}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <NotificationRail className="bg-transparent border-0 shadow-none px-0" />

      {/* Quick navigation tiles into all admin pages */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Admin control areas</h2>
        <p className="text-xs text-muted-foreground">
          Jump straight into configuration, users, inventory, orders, budgets, and reports.
        </p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {navTiles.map((tile) => {
            const Icon = tile.icon
            return (
              <Card
                key={tile.title}
                className="group border-dashed border-slate-200 hover:border-slate-400 hover:shadow-md transition-all"
              >
                <Link href={tile.href}>
                  <CardContent className="p-4 flex flex-col gap-3 h-full">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 group-hover:text-indigo-700">
                          {tile.title}
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">{tile.description}</p>
                      </div>
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <Icon className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="mt-auto pt-1 text-[11px] font-medium text-indigo-600 group-hover:text-indigo-700">
                      Open {tile.title}
                    </div>
                  </CardContent>
                </Link>
              </Card>
            )
          })}
      </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Today's GMV" value={todaysGMV} colorClass="text-emerald-600" />
        <KpiCard title="Today's Orders" value={todaysOrders?.items?.length || 0} colorClass="text-indigo-600" />
        <KpiCard title="Today's Refunds" value={todaysRefundCount} colorClass="text-rose-600" />
        <KpiCard title="Total Branches" value={branchesCount} colorClass="text-slate-600" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 text-sm font-medium">Sales by day (PKR)</div>
            <TrendAreaChart data={salesData} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <ComparisonBarChart
              title="Monthly GMV index"
              data={gmvTaxData}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
