"use client"

import { useMemo, useState, useCallback } from "react"
import { useOrganizations, useBranches, useUsers } from "@/lib/hooks/use-api"
import { useLifetimeStats } from "@/lib/hooks/use-dashboard-analytics"
import { useSalesPerformance, type DateRange, type DashboardStatus } from "@/lib/hooks/use-sales-performance"
import { Card, CardContent } from "@/components/ui/card"
import { NotificationRail } from "@/components/notifications/notification-center"
import { formatPKR } from "@/lib/utils"
import {
  Users, Building2, TrendingDown, TrendingUp,
  BarChart3, Package, RefreshCw, Filter, CheckCircle2, RotateCcw, XCircle, Activity,
} from "lucide-react"
import { SalesPerformanceLineChart, BranchSalesBarChart, OrganizationSalesBarChart } from "@/components/dashboard/charts"
import { BankingKPICard } from "@/components/dashboard/banking-kpi-card"
import { GlobalDateFilter, type FilterPreset, getPresetLabel } from "@/components/dashboard/global-date-filter"
import { MultiBranchFilter } from "@/components/dashboard/multi-branch-filter"
import { DrillDownSheet, type DrillDownType } from "@/components/dashboard/drill-down-sheet"

import { useAppContext } from "@/components/context/app-context"
import { startOfDay, endOfDay } from "date-fns"

const getDefaultDateRange = (): DateRange => ({
  startDate: startOfDay(new Date()),
  endDate: endOfDay(new Date()),
})

export function SuperAdminDashboard() {
  const { organizationId, branchId } = useAppContext()

  const [dateRange, setDateRange] = useState<DateRange | null>(getDefaultDateRange())
  const [activePreset, setActivePreset] = useState<FilterPreset>("today")
  const [compare, setCompare] = useState(false)
  const [compareRange, setCompareRange] = useState<DateRange | null>(null)
  const [months, setMonths] = useState<number[]>([])
  const [years, setYears] = useState<number[]>([])
  const [compareMonths, setCompareMonths] = useState<number[]>([])
  const [compareYears, setCompareYears] = useState<number[]>([])
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([])

  const [drillDownType, setDrillDownType] = useState<DrillDownType | null>(null)
  const [isDrillDownOpen, setIsDrillDownOpen] = useState(false)

  const handleKPIOpen = (type: DrillDownType) => {
    setDrillDownType(type)
    setIsDrillDownOpen(true)
  }

  const { data: orgsData } = useOrganizations()
  const { data: usersData } = useUsers(organizationId || undefined)
  const { data: branchesData } = useBranches(organizationId || undefined)
  const { data: lifetimeStats } = useLifetimeStats(organizationId, branchId)

  const orgs = orgsData?.items || []
  const branchesRaw = branchesData?.items || []
  const usersRaw = usersData?.items || []

  const branchesInScope = branchId ? branchesRaw.filter(b => b.id?.toString() === branchId) : branchesRaw
  const usersInScope = branchId ? usersRaw.filter(u => u.branchId?.toString() === branchId) : usersRaw
  const usersCount = usersInScope.length
  const branchesCount = branchesInScope.length

  const { data: perfData, isLoading: isLoadingPerf } = useSalesPerformance(
    organizationId, branchId,
    selectedBranchIds.length > 0 ? selectedBranchIds : undefined,
    undefined, dateRange, "all", compare, compareRange,
    months, years, compareMonths, compareYears,
    activePreset === "all" ? "yearly" : undefined
  )

  const { data: pendingData } = useSalesPerformance(
    organizationId, branchId,
    selectedBranchIds.length > 0 ? selectedBranchIds : undefined,
    undefined, dateRange, "PENDING", compare, compareRange
  )

  const { data: fulfilledData } = useSalesPerformance(
    organizationId, branchId,
    selectedBranchIds.length > 0 ? selectedBranchIds : undefined,
    undefined, dateRange, "FULFILLED", compare, compareRange,
    months, years, compareMonths, compareYears,
    activePreset === "all" ? "yearly" : undefined
  )

  const { data: refundedData } = useSalesPerformance(
    organizationId, branchId,
    selectedBranchIds.length > 0 ? selectedBranchIds : undefined,
    undefined, dateRange, "REFUNDED", compare, compareRange,
    months, years, compareMonths, compareYears,
    activePreset === "all" ? "yearly" : undefined
  )

  const { data: rejectedData } = useSalesPerformance(
    organizationId, branchId,
    selectedBranchIds.length > 0 ? selectedBranchIds : undefined,
    undefined, dateRange, "REJECTED", compare, compareRange,
    months, years, compareMonths, compareYears,
    activePreset === "all" ? "yearly" : undefined
  )

  const { data: approvedData } = useSalesPerformance(
    organizationId, branchId,
    selectedBranchIds.length > 0 ? selectedBranchIds : undefined,
    undefined, dateRange, "APPROVED", compare, compareRange,
    months, years, compareMonths, compareYears,
    activePreset === "all" ? "yearly" : undefined
  )

  const { data: partialData } = useSalesPerformance(
    organizationId, branchId,
    selectedBranchIds.length > 0 ? selectedBranchIds : undefined,
    undefined, dateRange, "PARTIAL", compare, compareRange
  )


  const handleDateChange = useCallback((
    range: DateRange | null, 
    preset: FilterPreset, 
    compareMode?: boolean, 
    compRange?: DateRange | null,
    m?: number[],
    y?: number[],
    cm?: number[],
    cy?: number[]
  ) => {
    setDateRange(range)
    setActivePreset(preset)
    if (compareMode !== undefined) setCompare(compareMode)
    if (compRange !== undefined) setCompareRange(compRange)
    setMonths(m || [])
    setYears(y || [])
    setCompareMonths(cm || [])
    setCompareYears(cy || [])
    setSelectedBranchIds([])
  }, [])

  const totalRevenue = perfData?.totalNetSales ?? perfData?.totalSales ?? 0
  const totalOrders = perfData?.totalOrders ?? 0
  const pendingCount = pendingData?.totalOrders ?? 0
  const fulfilledCount = fulfilledData?.totalOrders ?? 0
  const partialCount = partialData?.totalOrders ?? 0
  const refundedCount = refundedData?.totalOrders || 0
  const rejectedCount = rejectedData?.totalOrders || 0
  const approvedCount = approvedData?.totalOrders || 0

  // Helper for building trend data
  const buildTrend = useCallback((current: number, prev: number | undefined, formatFn?: (v: number) => string) => {
    if (!compare || prev === undefined || prev === null) return undefined
    const diff = current - prev
    const percentage = prev > 0 ? (diff / prev) * 100 : (current > 0 ? 100 : 0)
    const fmt = formatFn || ((v: number) => v.toLocaleString())
    return {
      type: diff >= 0 ? "up" : "down" as const,
      value: `${Math.abs(percentage).toFixed(1)}%`,
      label: `${fmt(current)} vs ${fmt(prev)}`
    }
  }, [compare])

  // Trend Calculations for all KPI cards
  const revenueTrend = useMemo(() => buildTrend(
    totalRevenue, perfData?.comparison?.totalNetSales ?? perfData?.comparison?.totalSales,
    (v) => formatPKR(v, { maximumFractionDigits: 0 })
  ), [buildTrend, totalRevenue, perfData?.comparison])

  const ordersTrend = useMemo(() => buildTrend(
    totalOrders, perfData?.comparison?.totalOrders
  ), [buildTrend, totalOrders, perfData?.comparison])

  const pendingTrend = useMemo(() => buildTrend(
    pendingCount, perfData?.comparison?.pendingCount
  ), [buildTrend, pendingCount, perfData?.comparison])

  const fulfilledTrend = useMemo(() => buildTrend(
    fulfilledCount, perfData?.comparison?.fulfilledCount
  ), [buildTrend, fulfilledCount, perfData?.comparison])

  const partialTrend = useMemo(() => buildTrend(
    partialCount, perfData?.comparison?.partialCount
  ), [buildTrend, partialCount, perfData?.comparison])

  const refundedTrend = useMemo(() => buildTrend(
    refundedCount, perfData?.comparison?.refundedCount
  ), [buildTrend, refundedCount, perfData?.comparison])

  const rejectedTrend = useMemo(() => buildTrend(
    rejectedCount, perfData?.comparison?.rejectedCount
  ), [buildTrend, rejectedCount, perfData?.comparison])

  const approvedTrend = useMemo(() => buildTrend(
    approvedCount, perfData?.comparison?.approvedCount
  ), [buildTrend, approvedCount, perfData?.comparison])

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-6 space-y-4">
      <style>{`
        @keyframes kpiEntrance {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      <NotificationRail className="bg-transparent border-0 shadow-none px-0" />

      {/* ━━━ Compact Filter Bar ━━━ */}
      <div className="relative z-30 flex items-center gap-2 flex-wrap bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/60 rounded-xl px-3 py-2 shadow-sm">
        <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        <GlobalDateFilter 
          value={dateRange} 
          onChange={handleDateChange} 
          activePreset={activePreset} 
          compare={compare} 
          compareRange={compareRange}
          months={months}
          years={years}
          compareMonths={compareMonths}
          compareYears={compareYears}
        />
        {organizationId && (
          <>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
            <MultiBranchFilter organizationId={organizationId} selectedBranchIds={selectedBranchIds} onChange={setSelectedBranchIds} />
          </>
        )}
      </div>

      {/* ━━━ KPI Cards ━━━ */}
      <div className="relative z-10 grid gap-3 grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
        <BankingKPICard
          icon={TrendingUp} title="Revenue"
          value={formatPKR(totalRevenue, { maximumFractionDigits: 0 })}
          subtitle={getPresetLabel(activePreset, dateRange)}
          gradient="from-emerald-500 to-teal-600" iconBg="text-emerald-600 bg-emerald-600" delay={0}
          onClick={() => handleKPIOpen("REVENUE")}
          trend={revenueTrend?.type as "up" | "down" | undefined}
          trendValue={revenueTrend?.value}
          comparisonValue={revenueTrend?.label}
          comparisonLabel="Period Comparison"
        />
        <BankingKPICard
          icon={Package} title="Orders"
          value={totalOrders.toLocaleString()}
          subtitle={getPresetLabel(activePreset, dateRange)}
          gradient="from-blue-500 to-indigo-600" iconBg="text-blue-600 bg-blue-600" delay={50}
          onClick={() => handleKPIOpen("ORDERS")}
          trend={ordersTrend?.type as "up" | "down" | undefined}
          trendValue={ordersTrend?.value}
          comparisonValue={ordersTrend?.label}
          comparisonLabel="Period Comparison"
        />
        <BankingKPICard
          icon={Activity} title="Pending"
          value={pendingCount.toLocaleString()}
          subtitle={getPresetLabel(activePreset, dateRange)}
          gradient="from-amber-400 to-orange-500" iconBg="text-amber-600 bg-amber-600" delay={75}
          onClick={() => handleKPIOpen("PENDING" as any)} // Cast if PENDING is not in DrillDownType yet
          trend={pendingTrend?.type as "up" | "down" | undefined}
          trendValue={pendingTrend?.value}
          comparisonValue={pendingTrend?.label}
          comparisonLabel="Period Comparison"
        />
        <BankingKPICard
          icon={CheckCircle2} title="Approved"
          value={approvedCount.toLocaleString()}
          subtitle={getPresetLabel(activePreset, dateRange)}
          gradient="from-blue-400 to-indigo-500" iconBg="text-blue-600 bg-blue-600" delay={100}
          trend={approvedTrend?.type as "up" | "down" | undefined}
          trendValue={approvedTrend?.value}
          comparisonValue={approvedTrend?.label}
          comparisonLabel="Period Comparison"
        />
        <BankingKPICard
          icon={CheckCircle2} title="Fulfilled"
          value={fulfilledCount.toLocaleString()}
          subtitle={getPresetLabel(activePreset, dateRange)}
          gradient="from-teal-500 to-cyan-600" iconBg="text-teal-600 bg-teal-600" delay={125}
          onClick={() => handleKPIOpen("FULFILLED")}
          trend={fulfilledTrend?.type as "up" | "down" | undefined}
          trendValue={fulfilledTrend?.value}
          comparisonValue={fulfilledTrend?.label}
          comparisonLabel="Period Comparison"
        />
        <BankingKPICard
          icon={Package} title="Partial Fulfilled"
          value={partialCount.toLocaleString()}
          subtitle={getPresetLabel(activePreset, dateRange)}
          gradient="from-indigo-500 to-purple-600" iconBg="text-indigo-600 bg-indigo-600" delay={135}
          onClick={() => handleKPIOpen("PARTIAL" as any)}
          trend={partialTrend?.type as "up" | "down" | undefined}
          trendValue={partialTrend?.value}
          comparisonValue={partialTrend?.label}
          comparisonLabel="Period Comparison"
        />
        <BankingKPICard
          icon={RotateCcw} title="Refunded"
          value={refundedCount.toLocaleString()}
          subtitle={getPresetLabel(activePreset, dateRange)}
          gradient="from-red-500 to-rose-600" iconBg="text-red-600 bg-red-600" delay={150}
          onClick={() => handleKPIOpen("REFUNDED")}
          trend={refundedTrend?.type as "up" | "down" | undefined}
          trendValue={refundedTrend?.value}
          comparisonValue={refundedTrend?.label}
          comparisonLabel="Period Comparison"
        />
        <BankingKPICard
          icon={XCircle} title="Rejected"
          value={rejectedCount.toLocaleString()}
          subtitle={getPresetLabel(activePreset, dateRange)}
          gradient="from-slate-500 to-slate-700" iconBg="text-slate-600 bg-slate-600" delay={175}
          onClick={() => handleKPIOpen("REJECTED")}
          trend={rejectedTrend?.type as "up" | "down" | undefined}
          trendValue={rejectedTrend?.value}
          comparisonValue={rejectedTrend?.label}
          comparisonLabel="Period Comparison"
        />

      </div>

      {/* ━━━ Sales Performance Chart ━━━ */}
      <Card className="border border-slate-200/80 dark:border-slate-800/60 shadow-sm bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
              <TrendingUp className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Sales Performance</h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                {activePreset === "today" ? "Today" : activePreset === "3d" ? "Last 3 days" : activePreset === "7d" ? "Last 7 days" : activePreset === "monthly" ? "This month" : activePreset === "yearly" ? "This year" : "Custom period"}
              </p>
            </div>
            {isLoadingPerf && (
              <div className="ml-auto flex items-center gap-1.5 text-xs text-slate-400">
                <RefreshCw className="h-3 w-3 animate-spin" /> Updating
              </div>
            )}
          </div>
          {isLoadingPerf ? (
            <div className="h-[360px] flex items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 dark:border-slate-700 border-t-emerald-500" />
            </div>
          ) : (
            <SalesPerformanceLineChart
              seriesData={perfData?.seriesData ?? []}
              totalSales={perfData?.totalSales ?? 0}
              avgSales={perfData?.avgSales ?? 0} totalOrders={perfData?.totalOrders ?? 0}
              peakPeriod={perfData?.peakPeriod ?? null} granularity={perfData?.granularity ?? "daily"}
              label="Sales" dateRange={dateRange}
              comparisonSeries={perfData?.comparison?.seriesData}
            />
          )}
        </CardContent>
      </Card>

      {/* ━━━ Org / Branch Chart ━━━ */}
      {!branchId && (
        <Card className="border border-slate-200/80 dark:border-slate-800/60 shadow-sm bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
                <BarChart3 className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {!organizationId ? "Organization Sales" : "Branch Sales"}
              </h3>
            </div>
            {isLoadingPerf ? (
              <div className="h-56 flex items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 dark:border-slate-700 border-t-indigo-500" />
              </div>
            ) : !organizationId ? (
              <OrganizationSalesBarChart organizationSales={perfData?.organizationSales ?? []} label="Sales" />
            ) : (
              <BranchSalesBarChart branchSales={perfData?.branchSales ?? []} label="Sales" />
            )}
          </CardContent>
        </Card>
      )}

      {/* ━━━ Drill Down Sheet ━━━ */}
      <DrillDownSheet
        isOpen={isDrillDownOpen}
        onOpenChange={setIsDrillDownOpen}
        type={drillDownType}
        organizationId={organizationId}
        branchId={branchId}
        branchIds={selectedBranchIds}
        defaultDateRange={dateRange}
        activePreset={activePreset}
        compare={compare}
        compareRange={compareRange}
        months={months}
        years={years}
        compareMonths={compareMonths}
        compareYears={compareYears}
      />
    </main>
  )
}