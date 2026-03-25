"use client"

import { useMemo, useState, useCallback } from "react"
import useSWR from "swr"
import { fetcher } from "@/lib/fetcher"
import { useOrganizations, useBranches, useUsers } from "@/lib/hooks/use-api"
import { useLifetimeStats } from "@/lib/hooks/use-dashboard-analytics"
import { useSalesPerformance, type DateRange, type DashboardStatus } from "@/lib/hooks/use-sales-performance"
import { Card, CardContent } from "@/components/ui/card"
import { NotificationRail } from "@/components/notifications/notification-center"
import { formatPKR, cn } from "@/lib/utils"
import {
  Users, Building2, TrendingDown, TrendingUp,
  BarChart3, Package, RefreshCw, Filter, CheckCircle2, RotateCcw, XCircle, Activity,
  Calendar, Layers, Clock
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { SalesPerformanceBarChart, BranchSalesBarChart, OrganizationSalesBarChart } from "@/components/dashboard/charts"
import { BankingKPICard } from "@/components/dashboard/banking-kpi-card"
import { GlobalDateFilter, type FilterPreset, getPresetLabel } from "@/components/dashboard/global-date-filter"
import { MultiBranchFilter } from "@/components/dashboard/multi-branch-filter"
import { OrganizationFilter } from "@/components/reports/organization-filter"
import { BranchFilter } from "@/components/reports/branch-filter"
import { DrillDownSheet, type DrillDownType } from "@/components/dashboard/drill-down-sheet"
import { MultiSelectFilter } from "@/components/reports/multi-select-filter"

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

  // Fetch all-time data to extract available years from the database
  const { data: allTimePerf } = useSWR(
    `/api/v1/analytics/sales-performance?startDate=2015-01-01T00:00:00.000Z&endDate=${new Date().toISOString()}&granularity=yearly&status=all`,
    fetcher
  )

  const chartYearsAvailable = useMemo(() => {
    const series = (allTimePerf as any)?.seriesData || []
    const years = new Set<number>()
    series.forEach((s: any) => {
      const y = parseInt(s.label)
      if (!isNaN(y)) years.add(y)
    })
    if (years.size === 0) years.add(new Date().getFullYear())
    return Array.from(years).sort((a, b) => b - a)
  }, [allTimePerf]);

  // ── Local Chart State (Fully Independent) ──
  type ChartQuickFilter = "today" | "7d" | null
  const [chartQuickFilter, setChartQuickFilter] = useState<ChartQuickFilter>("today")
  const [chartMonths, setChartMonths] = useState<number[]>([])
  const [chartYears, setChartYears] = useState<number[]>([])
  const [chartSelectedOrgIds, setChartSelectedOrgIds] = useState<string[]>([])
  const [chartSelectedBranchIds, setChartSelectedBranchIds] = useState<string[]>([])

  // Quick filter → date range, or null when using months/years
  const chartDateRange = useMemo(() => {
    if (chartQuickFilter === "today") return getDefaultDateRange()
    if (chartQuickFilter === "7d") {
      const end = endOfDay(new Date())
      const start = startOfDay(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000))
      return { startDate: start, endDate: end }
    }
    return null // months/years mode
  }, [chartQuickFilter])

  // When user picks months/years, clear the quick filter
  const handleChartMonths = useCallback((m: number[]) => {
    setChartMonths(m)
    if (m.length > 0) setChartQuickFilter(null)
  }, [])
  const handleChartYears = useCallback((y: number[]) => {
    setChartYears(y)
    if (y.length > 0) setChartQuickFilter(null)
  }, [])
  // When user picks a quick filter, clear months/years
  const handleQuickFilter = useCallback((f: ChartQuickFilter) => {
    setChartQuickFilter(f)
    setChartMonths([])
    setChartYears([])
  }, [])

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

  // ── Graph Data (Fully independent from global filters) ──
  // For API fetching: When months/years are selected, bypass dateRange 
  // (so it only uses month/year arrays). But for 'today'/'7d', we DO need to send dates.
  const hasChartFilters = chartMonths.length > 0 || chartYears.length > 0
  const effectiveChartDateRange = hasChartFilters ? null : chartDateRange

  // For Chart Rendering: When rendering 'today', we manually aggregated 1 bar labeled 'Today'
  // so we pass `null` to bypass the chart component's internal date padding logic.
  const chartComponentDateRange = chartQuickFilter === "today" || hasChartFilters ? null : chartDateRange

  const chartGranularity = chartYears.length > 1
    ? "yearly" as const
    : (chartMonths.length > 0 || chartYears.length === 1)
      ? "monthly" as const
      : "daily" as const

  const { data: chartPerfData, isLoading: isLoadingChart } = useSalesPerformance(
    undefined, undefined, // Super admin scope — no global org/branch
    chartSelectedBranchIds.length > 0 ? chartSelectedBranchIds : undefined,
    undefined, // groupId
    chartDateRange, "all", false, null,
    chartMonths, chartYears, [], [],
    chartGranularity,
    chartSelectedOrgIds.length > 0 ? chartSelectedOrgIds : undefined
  )

  // ── Client-Side Chart Normalization (Order Report Pattern) ──
  const normalizedChartData = useMemo(() => {
    const raw = chartPerfData?.seriesData ?? []

    // Today → single bar labeled "Today"
    if (chartQuickFilter === "today") {
      const totalSales = raw.reduce((s: number, r: any) => s + (r.sales || 0), 0)
      const totalOrders = raw.reduce((s: number, r: any) => s + (r.orders || 0), 0)
      return [{ label: "Today", sales: totalSales, orders: totalOrders }]
    }

    // 7D → days on X-axis (already comes as "DD Mon" from API)
    if (chartQuickFilter === "7d") {
      return raw
    }

    // Multiple years → year numbers on X-axis
    if (chartYears.length > 1) {
      return chartYears.sort((a, b) => a - b).map(y => {
        // API returns labels like "2024", "2025"
        const match = raw.find((r: any) => r.label === String(y) || r.label?.startsWith(String(y)))
        return {
          label: String(y),
          sales: match?.sales ?? 0,
          orders: match?.orders ?? 0,
        }
      })
    }

    // Single year or months selected → month names on X-axis (Jan, Feb, Mar...)
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    const monthsToShow = chartMonths.length > 0 && chartMonths.length < 12
      ? [...chartMonths].sort((a, b) => a - b)
      : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

    return monthsToShow.map(m => {
      // API returns labels like "Mar 2025" - match by month abbreviation
      const monthPrefix = monthNames[m - 1]
      const match = raw.find((r: any) => r.label?.startsWith(monthPrefix))
      return {
        label: monthPrefix,
        sales: match?.sales ?? 0,
        orders: match?.orders ?? 0,
      }
    })
  }, [chartPerfData, chartQuickFilter, chartMonths, chartYears])

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
          <div className="flex flex-wrap items-center gap-3 mb-6 p-3 bg-slate-50/50 dark:bg-slate-800/20 rounded-xl border border-slate-100 dark:border-slate-800/50">
            <div className="flex items-center gap-2 pr-3 border-r border-slate-200 dark:border-slate-800">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Filters</span>
            </div>

            {/* Quick date buttons */}
            <div className="flex items-center gap-1">
              <Button
                variant={chartQuickFilter === "today" ? "default" : "outline"}
                size="sm"
                onClick={() => handleQuickFilter("today")}
                className={cn(
                  "h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider",
                  chartQuickFilter === "today"
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                    : "border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-700"
                )}
              >
                <Clock className="h-3 w-3 mr-1" /> Today
              </Button>
              <Button
                variant={chartQuickFilter === "7d" ? "default" : "outline"}
                size="sm"
                onClick={() => handleQuickFilter("7d")}
                className={cn(
                  "h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider",
                  chartQuickFilter === "7d"
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                    : "border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-700"
                )}
              >
                7D
              </Button>
            </div>

            <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-700 mx-0.5" />
            
            <MonthFilter selected={chartMonths} onChange={handleChartMonths} />
            <YearFilter selected={chartYears} onChange={handleChartYears} availableYears={chartYearsAvailable} />

            <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-700 mx-0.5" />

            <OrganizationFilter
              selectedIds={chartSelectedOrgIds}
              onChange={(ids) => {
                setChartSelectedOrgIds(ids)
                setChartSelectedBranchIds([])
              }}
              placeholder="Organizations"
            />

            {chartSelectedOrgIds.length > 0 && (
              <BranchFilter
                organizationIds={chartSelectedOrgIds}
                selectedIds={chartSelectedBranchIds}
                onChange={setChartSelectedBranchIds}
                placeholder="Branches"
              />
            )}

            {isLoadingChart && (
              <div className="ml-auto flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                <RefreshCw className="h-3 w-3 animate-spin text-emerald-500" /> 
                Syncing Data
              </div>
            )}
          </div>

          {isLoadingChart ? (
            <div className="h-[400px] flex items-center justify-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/10">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 dark:border-slate-800 border-t-emerald-500" />
                <p className="text-sm font-medium text-slate-400 animate-pulse">Loading performance metrics...</p>
              </div>
            </div>
          ) : (
            <SalesPerformanceBarChart
              seriesData={normalizedChartData}
              totalSales={chartPerfData?.totalSales ?? 0}
              avgSales={chartPerfData?.avgSales ?? 0}
              totalOrders={chartPerfData?.totalOrders ?? 0}
              peakPeriod={chartPerfData?.peakPeriod ?? null}
              granularity={chartGranularity}
              label="Sales"
              dateRange={chartComponentDateRange}
              comparisonSeries={chartPerfData?.comparison?.seriesData}
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

function MonthFilter({ selected, onChange }: { selected: number[], onChange: (v: number[]) => void }) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const items = months.map((m, i) => ({ id: i + 1, label: m }))
  
  return (
    <MultiSelectFilter
      title="Months"
      items={items}
      selectedIds={selected}
      onChange={(ids) => onChange(ids.sort((a, b) => a - b))}
      icon={<Calendar className="h-3.5 w-3.5 mr-2 text-indigo-500" />}
      placeholder="Months"
      showSearch={false}
    />
  )
}

function YearFilter({ selected, onChange, availableYears }: { selected: number[], onChange: (v: number[]) => void, availableYears: number[] }) {
  const items = availableYears.map(y => ({ id: y, label: String(y) }))

  return (
    <MultiSelectFilter
      title="Years"
      items={items}
      selectedIds={selected}
      onChange={(ids) => onChange(ids.sort((a, b) => b - a))}
      icon={<Layers className="h-3.5 w-3.5 mr-2 text-indigo-500" />}
      placeholder="Years"
      showSearch={false}
    />
  )
}