"use client"
import { useOrganizations, useBranches, useUsers } from '@/lib/hooks/use-api'
import { SectionHeader } from '@/components/ui/section-header'
import { KpiCard } from '@/components/ui/kpi-card'
import { Card, CardContent } from '@/components/ui/card'
import useSWR from 'swr'
  
export function SuperAdminDashboard() {
  const { data: orgsData, isLoading: orgsLoading } = useOrganizations()
  const { data: usersData, isLoading: usersLoading } = useUsers()
  const { data: branchesData, isLoading: branchesLoading } = useBranches()

  const orgsCount = orgsData?.items?.length || 0
  const usersCount = usersData?.items?.length || 0
  const branchesCount = branchesData?.items?.length || 0
  const activeBranches = branchesData?.items?.filter((b: any) => b.status === 'active')?.length || 0

  const fetcher = (url: string) => fetch(url).then(r => r.json())
  const startOfToday = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString() })()
  const { data: todaysOrders } = useSWR<{ items: any[] }>(`/api/v1/orders?from=${encodeURIComponent(startOfToday)}`, fetcher)
  const { data: pendingOrders } = useSWR<{ items: any[] }>(`/api/v1/orders?status=pending`, fetcher)
  const { data: todaysRefunded } = useSWR<{ items: any[] }>(`/api/v1/orders?status=refunded&from=${encodeURIComponent(startOfToday)}`, fetcher)

  const todaysGMVCents = (todaysOrders?.items || []).reduce((sum, o) => sum + (o.totalCents || 0), 0)
  const todaysGMV = `$${(todaysGMVCents / 100).toFixed(2)}`
  const pendingCount = pendingOrders?.items?.length || 0
  const todaysRefundCount = todaysRefunded?.items?.length || 0

  const salesData = [
    { day: 'Mon', sales: 1200 },
    { day: 'Tue', sales: 1800 },
    { day: 'Wed', sales: 900 },
    { day: 'Thu', sales: 1600 },
    { day: 'Fri', sales: 2100 },
    { day: 'Sat', sales: 1400 },
    { day: 'Sun', sales: 1700 },
  ]

  const gmvTaxData = [
    { month: 'Jan', gmv: 12000, tax: 900 },
    { month: 'Feb', gmv: 13500, tax: 980 },
    { month: 'Mar', gmv: 15000, tax: 1100 },
    { month: 'Apr', gmv: 14200, tax: 1050 },
  ]

  return (
    <main className="p-6 space-y-6">
      <SectionHeader title="Super Admin Dashboard" subtitle="System-wide overview and activity" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Total Organizations" value={orgsCount} colorClass="text-blue-600" />
        <KpiCard title="Active Branches" value={activeBranches} colorClass="text-green-600" />
        <KpiCard title="Total Users" value={usersCount} colorClass="text-amber-600" />
        <KpiCard title="Pending Orders" value={pendingCount} colorClass="text-red-600" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Today's GMV" value={todaysGMV} colorClass="text-emerald-600" />
        <KpiCard title="Today's Orders" value={todaysOrders?.items?.length || 0} colorClass="text-indigo-600" />
        <KpiCard title="Today's Refunds" value={todaysRefundCount} colorClass="text-rose-600" />
        <KpiCard title="Total Branches" value={branchesCount} colorClass="text-slate-600" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium mb-2">Sales by Day</div>
            <div className="h-56 w-full">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                <defs>
                  <linearGradient id="lineGrad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.65 0.2 250)" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="oklch(0.65 0.2 250)" stopOpacity="0.05" />
                  </linearGradient>
                </defs>
                <polyline
                  fill="none"
                  stroke="oklch(0.65 0.2 250)"
                  strokeWidth="2"
                  points={salesData
                    .map((d, i) => {
                      const x = (i / (salesData.length - 1)) * 100
                      const max = Math.max(...salesData.map(s => s.sales))
                      const y = 100 - (d.sales / max) * 80 - 10
                      return `${x},${y}`
                    })
                    .join(' ')}
                />
                <polygon
                  fill="url(#lineGrad)"
                  points={(() => {
                    const pts = salesData.map((d, i) => {
                      const x = (i / (salesData.length - 1)) * 100
                      const max = Math.max(...salesData.map(s => s.sales))
                      const y = 100 - (d.sales / max) * 80 - 10
                      return `${x},${y}`
                    })
                    return `0,100 ${pts.join(' ')} 100,100`
                  })()}
                />
              </svg>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium mb-2">GMV vs Tax</div>
            <div className="h-56 w-full">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                {gmvTaxData.map((d, i) => {
                  const groupWidth = 100 / (gmvTaxData.length * 2)
                  const gap = groupWidth * 0.3
                  const baseX = i * (groupWidth * 2)
                  const max = Math.max(...gmvTaxData.map(v => Math.max(v.gmv, v.tax)))
                  const gmvH = (d.gmv / max) * 80
                  const taxH = (d.tax / max) * 80
                  return (
                    <g key={d.month}>
                      <rect x={baseX + gap} y={100 - gmvH - 10} width={groupWidth - gap} height={gmvH} fill="oklch(0.7 0.2 150)" rx="2" />
                      <rect x={baseX + groupWidth + gap} y={100 - taxH - 10} width={groupWidth - gap} height={taxH} fill="oklch(0.6 0.15 30)" rx="2" />
                    </g>
                  )
                })}
              </svg>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
