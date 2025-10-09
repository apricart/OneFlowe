export const revalidate = 60

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-pretty">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  )
}

export default async function DashboardPage() {
  // In a real app fetch metrics via RSC or SWR client components
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Metric title="Total Users" value="—" />
        <Metric title="Open Orders" value="—" />
        <Metric title="Low Stock Alerts" value="—" />
        <Metric title="Budget Spent" value="—" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">No data yet.</div>
        </CardContent>
      </Card>
    </div>
  )
}
