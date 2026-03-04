"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { useLifetimeStats } from "@/lib/hooks/use-dashboard-analytics"
import { useSalesPerformance, type DateRange, type DashboardStatus } from "@/lib/hooks/use-sales-performance"
import { useAppContext } from "@/components/context/app-context"
import { SalesPerformanceLineChart, BranchSalesBarChart } from "@/components/dashboard/charts"
import { BankingKPICard } from "@/components/dashboard/banking-kpi-card"
import { GlobalDateFilter, type FilterPreset } from "@/components/dashboard/global-date-filter"
import { MultiBranchFilter } from "@/components/dashboard/multi-branch-filter"
import { StatusFilter } from "@/components/dashboard/status-filter"
import { formatPKR } from "@/lib/utils"
import {
  Building2, AlertCircle, ShoppingCart, TrendingUp, TrendingDown,
  BarChart3, Activity, Wallet, Sparkles, RefreshCw, Filter, Package, Users
} from "lucide-react"
import { useOrganizations } from "@/lib/hooks/use-api"
import { NotificationRail } from "@/components/notifications/notification-center"
import { startOfDay, endOfDay } from "date-fns"

const getDefaultDateRange = (): DateRange => ({
  startDate: startOfDay(new Date()),
  endDate: endOfDay(new Date()),
})

export function HeadOfficeDashboard() {
  const {
    organizationId,
    branchId: contextBranchId,
    branchIds: contextBranchIds,
    setBranchId: setContextBranchId,
    setBranchIds: setContextBranchIds
  } = useAppContext()
  const { data: orgsData } = useOrganizations()
  const orgs = orgsData?.items || []
  const selectedOrg = useMemo(() =>
    organizationId ? orgs.find(o => o.id?.toString() === organizationId) : null,
    [organizationId, orgs]
  )

  const { data: lifetimeStats } = useLifetimeStats(organizationId, contextBranchId)

  // Filter state
  const [dateRange, setDateRange] = useState<DateRange | null>(getDefaultDateRange())
  const [activePreset, setActivePreset] = useState<FilterPreset>("today")
  const [status, setStatus] = useState<DashboardStatus>("all")

  // Sync with global context
  const selectedBranchIds = contextBranchIds

  // Sync local selection back to context
  const handleBranchChange = useCallback((ids: string[]) => {
    setContextBranchIds(ids)
  }, [setContextBranchIds])

  // Sales performance data (dynamic)
  const { data: perfData, isLoading: isLoadingPerf } = useSalesPerformance(
    organizationId,
    contextBranchId,
    selectedBranchIds.length > 0 ? selectedBranchIds : undefined,
    undefined,
    dateRange,
    status
  )

  const handleDateChange = useCallback((range: DateRange | null, preset: FilterPreset) => {
    setDateRange(range)
    setActivePreset(preset)
  }, [])

  const scopeText = selectedOrg?.name || `Organization #${organizationId}` || "All Organizations"
  const allBranchesSelected = !contextBranchId && selectedBranchIds.length === 0

  // Status counts from lifetime stats
  const fulfilledCount = lifetimeStats?.fulfilledOrders ?? 0
  const refundedCount = lifetimeStats?.refundedOrders ?? 0
  const pendingCount = Math.max(0, (lifetimeStats?.totalOrders ?? 0) - fulfilledCount - refundedCount)

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-6 space-y-5">
      <style>{`
        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-slide-down { animation: slideDown 0.4s ease-out; }
        .kpi-card-hover { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .kpi-card-hover:hover { transform: translateY(-2px); }
      `}</style>

      {/* Header */}
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
              <h1 className="text-xl font-bold text-white">Head Office Portal</h1>
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

      {/* Global Filter Bar */}
      <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider shrink-0">
              <Filter className="h-3.5 w-3.5" />
              Filters
            </div>
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />
            <GlobalDateFilter value={dateRange} onChange={handleDateChange} activePreset={activePreset} />
            {organizationId && (
              <>
                <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />
                <MultiBranchFilter
                  organizationId={organizationId}
                  selectedBranchIds={selectedBranchIds}
                  onChange={handleBranchChange}
                />
              </>
            )}
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />
            <StatusFilter value={status} onChange={setStatus} />
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-2 lg:grid-cols-4 animate-slide-down">
        <div className="kpi-card-hover">
          <BankingKPICard
            icon={TrendingUp}
            title="Revenue"
            value={formatPKR(perfData?.totalSales ?? 0, { maximumFractionDigits: 0 })}
            subtitle={activePreset === "today" ? "Today" : "Selected Period"}
            gradient="from-blue-500 to-indigo-600"
            iconBg="text-blue-600 bg-blue-600"
          />
        </div>
        <div className="kpi-card-hover">
          <BankingKPICard
            icon={Package}
            title="Orders"
            value={(perfData?.totalOrders ?? 0).toLocaleString()}
            subtitle="Selected Period"
            gradient="from-violet-500 to-purple-600"
            iconBg="text-violet-600 bg-violet-600"
          />
        </div>
        <div className="kpi-card-hover">
          <BankingKPICard
            icon={Building2}
            title="Branches"
            value={lifetimeStats?.totalOrders !== undefined ? (perfData?.branchSales?.length ?? 0).toString() : "—"}
            subtitle="In scope"
            gradient="from-emerald-500 to-teal-600"
            iconBg="text-emerald-600 bg-emerald-600"
          />
        </div>
        <div className="kpi-card-hover">
          <BankingKPICard
            icon={TrendingDown}
            title="Total Refunded"
            value={formatPKR(lifetimeStats?.totalRefunded || 0, { maximumFractionDigits: 0 })}
            subtitle="All time"
            gradient="from-red-500 to-rose-600"
            iconBg="text-red-600 bg-red-600"
          />
        </div>
      </div>

      {/* Status Summary */}
      <div className="grid gap-3 grid-cols-3">
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
            <p className="text-xl font-bold text-amber-900 dark:text-amber-200">{pendingCount.toLocaleString()}</p>
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

      {/* Sales Performance Chart */}
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
                  activePreset === "3d" ? "Last 3 days" : activePreset === "7d" ? "Last 7 days" :
                    activePreset === "monthly" ? "This month" : activePreset === "yearly" ? "This year" : "Custom period"} • Total sales, peak & average
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

      {/* Branch Sales Chart */}
      {allBranchesSelected && (
        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
          <CardContent className="p-6">
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
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
              </div>
            ) : (
              <BranchSalesBarChart branchSales={perfData?.branchSales ?? []} label="Sales" />
            )}
          </CardContent>
        </Card>
      )}
    </main>
  )
}