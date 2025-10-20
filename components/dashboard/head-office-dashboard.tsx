"use client"
import { KpiCard } from "@/components/ui/kpi-card"
import { SectionHeader } from "@/components/ui/section-header"
import { Card, CardContent } from "@/components/ui/card"

export function HeadOfficeDashboard() {
  return (
    <main className="p-6 space-y-6">
      <SectionHeader
        title="Head Office Dashboard"
        subtitle="Overview of branches, approvals, budgets and orders"
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="My Branches" value={8} colorClass="text-blue-600" />
        <KpiCard title="Pending Approvals" value={15} colorClass="text-amber-600" />
        <KpiCard title="Monthly Budget" value="$45K" colorClass="text-green-600" />
        <KpiCard title="Orders This Month" value={127} colorClass="text-violet-600" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="h-48 grid place-items-center text-sm text-muted-foreground">
            Sales trend chart
          </CardContent>
        </Card>
        <Card>
          <CardContent className="h-48 grid place-items-center text-sm text-muted-foreground">
            Orders by branch chart
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
