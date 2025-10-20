import { KpiCard } from "@/components/ui/kpi-card"
import { SectionHeader } from "@/components/ui/section-header"
import { Boxes, AlertTriangle, Bell, Wallet } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export function BranchAdminDashboard() {
  return (
    <main className="p-6 space-y-6">
      <SectionHeader
        title="Branch Admin Dashboard"
        subtitle="Key metrics for inventory and orders"
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Inventory Items" value={342} icon={Boxes} colorClass="text-blue-600" />
        <KpiCard title="Low Stock Items" value={12} icon={AlertTriangle} colorClass="text-red-600" />
        <KpiCard title="Pending Orders" value={8} icon={Bell} colorClass="text-amber-600" />
        <KpiCard title="Monthly Budget" value="$8.5K" icon={Wallet} colorClass="text-green-600" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="h-48 grid place-items-center text-sm text-muted-foreground">
            Stock movement chart
          </CardContent>
        </Card>
        <Card>
          <CardContent className="h-48 grid place-items-center text-sm text-muted-foreground">
            Orders processing chart
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
