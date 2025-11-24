"use client"
import { KpiCard } from "@/components/ui/kpi-card"
import { SectionHeader } from "@/components/ui/section-header"
import { Card, CardContent } from "@/components/ui/card"
import { NotificationRail } from "@/components/notifications/notification-center"
import { TrendAreaChart, ComparisonBarChart } from "@/components/dashboard/charts"
import { useDashboardAnalytics } from "@/lib/hooks/use-dashboard-analytics"

const FALLBACK_TREND = [
  { label: "Mon", value: 42000 },
  { label: "Tue", value: 51000 },
  { label: "Wed", value: 46000 },
  { label: "Thu", value: 61000 },
  { label: "Fri", value: 72000 },
  { label: "Sat", value: 64000 },
  { label: "Sun", value: 58000 },
]

const FALLBACK_BRANCHES = [
  { label: "Gulshan", value: 62 },
  { label: "Clifton", value: 54 },
  { label: "Hyderabad", value: 31 },
  { label: "Islamabad", value: 44 },
  { label: "Lahore", value: 68 },
]

export function HeadOfficeDashboard() {
  const { data } = useDashboardAnalytics()
  const trendData = data?.gmvSeries?.length ? data.gmvSeries : FALLBACK_TREND
  const branchData = data?.branchSeries?.length ? data.branchSeries : FALLBACK_BRANCHES

  return (
    <main className="p-6 space-y-6">
      <SectionHeader
        title="Head Office Dashboard"
        subtitle="Overview of branches, approvals, budgets and orders"
      />

      <NotificationRail className="bg-transparent border-0 shadow-none px-0" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="My Branches" value={8} colorClass="text-blue-600" />
        <KpiCard title="Pending Approvals" value={15} colorClass="text-amber-600" />
        <KpiCard title="Monthly Budget" value="PKR 45K" colorClass="text-green-600" />
        <KpiCard title="Orders This Month" value={127} colorClass="text-violet-600" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
              <span>Weekly GMV trend</span>
              <span>Live</span>
            </div>
            <TrendAreaChart data={trendData} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <ComparisonBarChart title="Orders by branch" data={branchData} />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
