"use client"

import { useMemo } from "react"
import { KpiCard } from "@/components/ui/kpi-card"
import { SectionHeader } from "@/components/ui/section-header"
import { Boxes, AlertTriangle, Bell, Wallet } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { NotificationRail } from "@/components/notifications/notification-center"
import { TrendAreaChart, ComparisonBarChart } from "@/components/dashboard/charts"
import { useOrders } from "@/lib/hooks/use-api"
import { useAppContext } from "@/components/context/app-context"
import { useDashboardAnalytics } from "@/lib/hooks/use-dashboard-analytics"

function buildBranchWeeklySeries(orders: any[] | undefined) {
  if (!orders?.length) {
    return [
      { label: "Mon", value: 180 },
      { label: "Tue", value: 220 },
      { label: "Wed", value: 170 },
      { label: "Thu", value: 260 },
      { label: "Fri", value: 310 },
      { label: "Sat", value: 280 },
      { label: "Sun", value: 245 },
    ]
  }
  const today = new Date()
  const days = Array.from({ length: 7 }).map((_, idx) => {
    const d = new Date(today)
    d.setDate(today.getDate() - (6 - idx))
    return {
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
      key: d.toISOString().slice(0, 10),
    }
  })
  const totals: Record<string, number> = {}
  for (const order of orders) {
    const created = order.createdAt ? new Date(order.createdAt).toISOString().slice(0, 10) : null
    if (!created) continue
    totals[created] = (totals[created] || 0) + 1
  }
  return days.map(day => ({ label: day.label, value: totals[day.key] || 0 }))
}

function buildStageSeries(orders: any[] | undefined) {
  if (!orders?.length) {
    return [
      { label: "Draft", value: 9 },
      { label: "Picking", value: 14 },
      { label: "Packed", value: 11 },
      { label: "Dispatched", value: 17 },
      { label: "Delivered", value: 21 },
    ]
  }
  const map: Record<string, number> = {}
  for (const order of orders) {
    const status = (order.status || "PENDING").toUpperCase()
    map[status] = (map[status] || 0) + 1
  }
  const friendly: Record<string, string> = {
    PENDING: "Draft",
    APPROVED: "Picking",
    FULFILLED: "Delivered",
    DISPATCHED: "Dispatched",
    PACKED: "Packed",
  }
  return Object.entries(map)
    .map(([status, value]) => ({
      label: friendly[status] || status.toLowerCase().replace("_", " "),
      value,
    }))
    .sort((a, b) => b.value - a.value)
}

export function BranchAdminDashboard() {
  const { branchId } = useAppContext()
  const { data: analytics } = useDashboardAnalytics()
  const { data: ordersData } = useOrders(branchId ? { branchId } : undefined)

  const branchTrend =
    analytics?.gmvSeries?.length ? analytics.gmvSeries : buildBranchWeeklySeries(ordersData?.items)
  const stageSeries = useMemo(() => buildStageSeries(ordersData?.items), [ordersData?.items])

  return (
    <main className="p-6 space-y-6">
      <SectionHeader
        title="Branch Admin Dashboard"
        subtitle="Key metrics for inventory and orders"
      />

      <NotificationRail className="bg-transparent border-0 shadow-none px-0" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Inventory Items" value={342} icon={Boxes} colorClass="text-blue-600" />
        <KpiCard title="Low Stock Items" value={12} icon={AlertTriangle} colorClass="text-red-600" />
        <KpiCard title="Pending Orders" value={8} icon={Bell} colorClass="text-amber-600" />
        <KpiCard title="Monthly Budget" value="PKR 8.5K" icon={Wallet} colorClass="text-green-600" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
              <span>Stock movement (last 7 days)</span>
              <span className="font-semibold text-green-600">+12%</span>
            </div>
            <TrendAreaChart data={branchTrend} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <ComparisonBarChart title="Fulfilment stages" data={stageSeries} />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
