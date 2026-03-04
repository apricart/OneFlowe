"use client"

import { useEffect, useMemo, useState, useRef, useCallback, startTransition } from "react"
import { useOrganizations, useBranches, useUsers } from "@/lib/hooks/use-api"
import { useLifetimeStats } from "@/lib/hooks/use-dashboard-analytics"
import { useSalesPerformance, type DateRange, type DashboardStatus } from "@/lib/hooks/use-sales-performance"
import { Card, CardContent } from "@/components/ui/card"
import { NotificationRail } from "@/components/notifications/notification-center"
import { formatPKR } from "@/lib/utils"
import {
  Users,
  Building2,
  AlertCircle,
  TrendingDown,
  ShoppingCart,
  TrendingUp,
  Activity,
  Wallet,
  Building,
  ArrowUpRight,
  Sparkles,
  BarChart3,
  GitBranch,
  Warehouse,
  Package,
  ShieldCheck,
  RefreshCw,
  Filter,
} from "lucide-react"
import { SalesPerformanceLineChart, BranchSalesBarChart, OrganizationSalesBarChart } from "@/components/dashboard/charts"
import { BankingKPICard } from "@/components/dashboard/banking-kpi-card"
import { GlobalDateFilter, type FilterPreset } from "@/components/dashboard/global-date-filter"
import { MultiBranchFilter } from "@/components/dashboard/multi-branch-filter"
import { StatusFilter } from "@/components/dashboard/status-filter"
import { useAppContext } from "@/components/context/app-context"
import { startOfDay, endOfDay } from "date-fns"

const getDefaultDateRange = (): DateRange => ({
  startDate: startOfDay(new Date()),
  endDate: endOfDay(new Date()),
})

export function SuperAdminDashboard() {
  const { organizationId, branchId } = useAppContext()

  // Global filter state
  const [dateRange, setDateRange] = useState<DateRange | null>(getDefaultDateRange())
  const [activePreset, setActivePreset] = useState<FilterPreset>("today")
  const [status, setStatus] = useState<DashboardStatus>("all")
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([])

  // Data hooks
  const { data: orgsData } = useOrganizations()
  const { data: usersData } = useUsers(organizationId || undefined)
  const { data: branchesData } = useBranches(organizationId || undefined)
  const { data: lifetimeStats } = useLifetimeStats(organizationId, branchId)

  const orgs = orgsData?.items || []
  const branchesRaw = branchesData?.items || []
  const usersRaw = usersData?.items || []

  const branchesInScope = branchId ? branchesRaw.filter(b => b.id?.toString() === branchId) : branchesRaw
  const usersInScope = branchId ? usersRaw.filter(u => u.branchId?.toString() === branchId) : usersRaw

  const orgsCount = organizationId ? orgs.filter(o => o.id?.toString() === organizationId).length : orgs.length
  const usersCount = usersInScope.length
  const branchesCount = branchesInScope.length

  const selectedOrg = organizationId ? orgs.find(o => o.id?.toString() === organizationId) : null
  const selectedBranch = branchId ? branchesRaw.find(b => b.id?.toString() === branchId) : null
  const scopeText = branchId ? selectedBranch?.name || `Branch #${branchId}` : organizationId ? selectedOrg?.name || `Organization #${organizationId}` : "All organizations & branches"

  // Sales performance data (dynamic, cached)
  const { data: perfData, isLoading: isLoadingPerf } = useSalesPerformance(
    organizationId,
    branchId,
    selectedBranchIds.length > 0 ? selectedBranchIds : undefined,
    undefined, // groupId
    dateRange,
    status
  )

  const handleDateChange = useCallback((range: DateRange | null, preset: FilterPreset) => {
    setDateRange(range)
    setActivePreset(preset)
    setSelectedBranchIds([]) // reset multi-branch on date change
  }, [])

  const handleStatusChange = useCallback((s: DashboardStatus) => {
    setStatus(s)
  }, [])

  const handleBranchIdsChange = useCallback((ids: string[]) => {
    setSelectedBranchIds(ids)
  }, [])

  // KPI derived values from sales performance
  const totalRevenue = perfData?.totalSales ?? 0
  const totalOrders = perfData?.totalOrders ?? 0
  const peakPeriod = perfData?.peakPeriod

  // Status-specific counts from lifetimeStats (global context) for the KPI badges
  const pendingCount = lifetimeStats ? (lifetimeStats.totalOrders - lifetimeStats.fulfilledOrders - lifetimeStats.refundedOrders) : 0
  const fulfilledCount = lifetimeStats?.fulfilledOrders ?? 0
  const refundedCount = lifetimeStats?.refundedOrders ?? 0

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-6 space-y-5">
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes countUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-down { animation: slideDown 0.4s ease-out; }
        .animate-count-up { animation: countUp 0.5s ease-out; }
        .kpi-card-hover { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .kpi-card-hover:hover { transform: translateY(-2px); }
      `}</style>

      {/* Premium Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 dark:from-indigo-900 dark:to-slate-900 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 bg-white opacity-20 blur-xl rounded-full animate-pulse" />
              <div className="relative w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 shadow-sm flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-white" strokeWidth={2.5} />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Super Admin Portal</h1>
              <p className="text-xs text-white/70 font-medium mt-0.5">Enterprise Overview • <span className="text-white font-semibold">{scopeText}</span></p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">Live</span>
            </div>
          </div>
        </div>
      </div>

      <NotificationRail className="bg-transparent border-0 shadow-none px-0" />

      {/* ━━ Global Filter Bar ━━ */}
      <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider shrink-0">
              <Filter className="h-3.5 w-3.5" />
              Filters
            </div>
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />
            <GlobalDateFilter
              value={dateRange}
              onChange={handleDateChange}
              activePreset={activePreset}
            />
            {organizationId && (
              <>
                <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />
                <MultiBranchFilter
                  organizationId={organizationId}
                  selectedBranchIds={selectedBranchIds}
                  onChange={handleBranchIdsChange}
                />
              </>
            )}
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />
            <StatusFilter value={status} onChange={handleStatusChange} />
          </div>
        </CardContent>
      </Card>

      {/* ━━ KPI Cards ━━ */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 animate-slide-down">
        <div className="kpi-card-hover">
          <BankingKPICard
            icon={TrendingUp}
            title="Revenue"
            value={formatPKR(totalRevenue, { maximumFractionDigits: 0 })}
            subtitle={activePreset === "today" ? "Today" : "Selected Period"}
            gradient="from-blue-500 to-indigo-600"
            iconBg="text-blue-600 bg-blue-600"
          />
        </div>
        <div className="kpi-card-hover">
          <BankingKPICard
            icon={Package}
            title="Orders"
            value={totalOrders.toLocaleString()}
            subtitle="Selected Period"
            gradient="from-violet-500 to-purple-600"
            iconBg="text-violet-600 bg-violet-600"
          />
        </div>
        <div className="kpi-card-hover">
          <BankingKPICard
            icon={Users}
            title="Users"
            value={usersCount.toLocaleString()}
            subtitle="In scope"
            gradient="from-emerald-500 to-teal-600"
            iconBg="text-emerald-600 bg-emerald-600"
          />
        </div>
        <div className="kpi-card-hover">
          <BankingKPICard
            icon={Building2}
            title="Branches"
            value={branchesCount.toLocaleString()}
            subtitle="In scope"
            gradient="from-orange-500 to-amber-600"
            iconBg="text-orange-600 bg-orange-600"
          />
        </div>
      </div>

      {/* ━━ Order Status Summary ━━ */}
      <div className="grid gap-3 grid-cols-3 sm:grid-cols-3">
        <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
          <div className="h-9 w-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">Fulfilled</p>
            <p className="text-xl font-bold text-emerald-900 dark:text-emerald-200">{fulfilledCount.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900 rounded-xl p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
          <div className="h-9 w-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">Pending</p>
            <p className="text-xl font-bold text-amber-900 dark:text-amber-200">{Math.max(0, pendingCount).toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900 rounded-xl p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
          <div className="h-9 w-9 rounded-xl bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center flex-shrink-0">
            <TrendingDown className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider">Refunded</p>
            <p className="text-xl font-bold text-rose-900 dark:text-rose-200">{refundedCount.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* ━━ Sales Performance Chart ━━ */}
      <Card className="border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Sales Performance</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                {activePreset === "today" ? "Today's performance" :
                  activePreset === "3d" ? "Last 3 days" :
                    activePreset === "7d" ? "Last 7 days" :
                      activePreset === "monthly" ? "This month" :
                        activePreset === "yearly" ? "This year" : "Custom period"} • Total sales, peak & average
              </p>
            </div>
            {isLoadingPerf && (
              <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Updating...</span>
              </div>
            )}
          </div>
          {isLoadingPerf ? (
            <div className="h-[420px] flex items-center justify-center bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
                <p className="text-sm text-slate-500 font-medium">Loading sales data...</p>
              </div>
            </div>
          ) : (
            <SalesPerformanceLineChart
              seriesData={perfData?.seriesData ?? []}
              totalSales={perfData?.totalSales ?? 0}
              avgSales={perfData?.avgSales ?? 0}
              totalOrders={perfData?.totalOrders ?? 0}
              peakPeriod={perfData?.peakPeriod ?? null}
              granularity={perfData?.granularity ?? "daily"}
              label="Sales"
            />
          )}
        </CardContent>
      </Card>

      {/* ━━ Organization or Branch Sales Chart ━━ */}
      {(!branchId) && (
        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
          <CardContent className="p-6">
            {!organizationId ? (
              // ── Organization Chart for Global View ──
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-amber-600 flex items-center justify-center flex-shrink-0">
                    <Building className="w-5 h-5 text-white" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Organization Sales Performance</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">Top performing organizations across the enterprise</p>
                  </div>
                </div>
                {isLoadingPerf ? (
                  <div className="h-64 flex items-center justify-center bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
                  </div>
                ) : (
                  <OrganizationSalesBarChart organizationSales={perfData?.organizationSales ?? []} label="Sales" />
                )}
              </>
            ) : (
              // ── Branch Chart for Specific Organization ──
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="w-5 h-5 text-white" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Branch Sales Performance</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">Hover on bars for total sales & order count per branch</p>
                  </div>
                </div>
                {isLoadingPerf ? (
                  <div className="h-64 flex items-center justify-center bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                  </div>
                ) : (
                  <BranchSalesBarChart branchSales={perfData?.branchSales ?? []} label="Sales" />
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  )
}