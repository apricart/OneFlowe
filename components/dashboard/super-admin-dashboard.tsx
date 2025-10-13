"use client"
import { useOrganizations, useBranches, useUsers } from '@/lib/hooks/use-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Users as UsersIcon, Boxes, Bell } from 'lucide-react'

function StatCard({ title, value, color, isLoading, icon: Icon }: { 
  title: string
  value: number | string
  color: string
  isLoading?: boolean 
  icon?: any
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className={`text-2xl font-bold ${color}`}>
          {isLoading ? (
            <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
          ) : (
            value
          )}
          </div>
          {Icon ? <Icon className="opacity-70" size={24} /> : null}
        </div>
      </CardContent>
    </Card>
  )
}

export function SuperAdminDashboard() {
  // Parallel data fetching with SWR
  const { data: orgsData, isLoading: orgsLoading } = useOrganizations()
  const { data: usersData, isLoading: usersLoading } = useUsers()
  const { data: branchesData, isLoading: branchesLoading } = useBranches()

  const orgsCount = orgsData?.items?.length || 0
  const usersCount = usersData?.items?.length || 0
  const branchesCount = branchesData?.items?.length || 0
  const activeBranches = branchesData?.items?.filter((b: any) => b.status === 'active')?.length || 0

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border p-3 bg-[oklch(0.98_0.01_250)]">
          <div className="text-xs opacity-70">Remaining Budget</div>
          <div className="text-xl font-semibold">Rs. 60,000.00</div>
        </div>
        <div className="rounded-xl border p-3 bg-[oklch(0.98_0.01_250)]">
          <div className="text-xs opacity-70">License Validity</div>
          <div className="text-xl font-semibold">15 Days</div>
        </div>
        <div className="rounded-xl border p-3 bg-[oklch(0.98_0.01_250)]">
          <div className="text-xs opacity-70">Active Branch</div>
          <div className="text-xl font-semibold">Meezan (Head Office)</div>
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Organizations"
          value={orgsCount}
          color="text-blue-600"
          isLoading={orgsLoading}
          icon={Building2}
        />
        <StatCard
          title="Active Branches"
          value={activeBranches}
          color="text-green-600"
          isLoading={branchesLoading}
          icon={Boxes}
        />
        <StatCard
          title="Total Users"
          value={usersCount}
          color="text-yellow-600"
          isLoading={usersLoading}
          icon={UsersIcon}
        />
        <StatCard
          title="Pending Orders"
          value="23"
          color="text-red-600"
          isLoading={false}
          icon={Bell}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border p-4">
          <div className="text-sm font-medium mb-2">Sales by Day</div>
          <div className="h-40 grid place-items-center text-sm text-muted-foreground">Chart placeholder</div>
        </div>
        <div className="rounded-xl border p-4">
          <div className="text-sm font-medium mb-2">GMV vs Tax</div>
          <div className="h-40 grid place-items-center text-sm text-muted-foreground">Chart placeholder</div>
        </div>
      </div>
    </div>
  )
}
