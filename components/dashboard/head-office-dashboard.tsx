"use client"

import { useState, useCallback, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { useLifetimeStats } from "@/lib/hooks/use-dashboard-analytics"
import { useSalesPerformance, type DateRange, type DashboardStatus } from "@/lib/hooks/use-sales-performance"
import { useAppContext } from "@/components/context/app-context"
import { SalesPerformanceLineChart, BranchSalesBarChart } from "@/components/dashboard/charts"
import { BankingKPICard } from "@/components/dashboard/banking-kpi-card"
import { GlobalDateFilter, type FilterPreset, getPresetLabel } from "@/components/dashboard/global-date-filter"
import { MultiBranchFilter } from "@/components/dashboard/multi-branch-filter"
import { DrillDownSheet, type DrillDownType } from "@/components/dashboard/drill-down-sheet"
import { formatPKR } from "@/lib/utils"
import {
  Building2, Users, Package, TrendingUp, TrendingDown,
  BarChart3, RefreshCw, Filter, CheckCircle2, RotateCcw, XCircle, Activity,
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
    setBranchIds: setContextBranchIds
  } = useAppContext()

  const { data: orgsData } = useOrganizations()

  const { data: lifetimeStats } = useLifetimeStats(organizationId, contextBranchId)

  // Filter state
  const [dateRange, setDateRange] = useState<DateRange | null>(getDefaultDateRange())
  const [activePreset, setActivePreset] = useState<FilterPreset>("today")
  const [compare, setCompare] = useState(false)
  const [compareRange, setCompareRange] = useState<DateRange | null>(null)
  const [months, setMonths] = useState<number[]>([])
  const [years, setYears] = useState<number[]>([])
  const [compareMonths, setCompareMonths] = useState<number[]>([])
  const [compareYears, setCompareYears] = useState<number[]>([])

  const [drillDownType, setDrillDownType] = useState<DrillDownType | null>(null)
  const [isDrillDownOpen, setIsDrillDownOpen] = useState(false)

  const handleKPIOpen = (type: DrillDownType) => {
    setDrillDownType(type)
    setIsDrillDownOpen(true)
  }

  // Sync with global context
  const selectedBranchIds = contextBranchIds

  // Sync local selection back to context
  const handleBranchChange = useCallback((ids: string[]) => {
    setContextBranchIds(ids)
  }, [setContextBranchIds])

  // Sales performance data (dynamic)
  const { data: perfDataFull, isLoading: isLoadingPerf } = useSalesPerformance(
    organizationId,
    contextBranchId,
    selectedBranchIds.length > 0 ? selectedBranchIds : undefined,
    undefined,
    dateRange,
    "all",
    compare,
    compareRange,
    months,
    years,
    compareMonths,
    compareYears,
    activePreset === "all" ? "yearly" : undefined
  )

  // Comparative data for trends
  const analyticsUrl = useMemo(() => {
    const params = new URLSearchParams()
    if (organizationId) params.set("organizationId", organizationId)
    if (selectedBranchIds.length > 0) params.set("branchIds", selectedBranchIds.join(","))
    else if (contextBranchId) params.set("branchId", contextBranchId)
    if (dateRange) {
      params.set("startDate", dateRange.startDate.toISOString())
      params.set("endDate", dateRange.endDate.toISOString())
    }
    if (compare) {
      params.set("compare", "true")
      if (compareRange) {
        params.set("compareStartDate", compareRange.startDate.toISOString())
        params.set("compareEndDate", compareRange.endDate.toISOString())
      }
    }
    return `/api/v1/analytics/summary?${params.toString()}`
  }, [organizationId, contextBranchId, selectedBranchIds, dateRange, compare, compareRange])

  // Fetch summary for comparison trends
  const { data: summaryData } = useSalesPerformance(
    organizationId,
    contextBranchId,
    selectedBranchIds.length > 0 ? selectedBranchIds : undefined,
    undefined,
    dateRange,
    "all"
  )

  // Note: summaryData will be used for comparison from /api/v1/analytics/summary if we want specific counts
  // But useSalesPerformance calls /api/v1/analytics/sales-performance which doesn't have comparison logic yet.
  // I should probably follow the pattern in SalesSummaryPage and fetch /api/v1/analytics/summary
  // OR update useSalesPerformance hook. Since I already updated the summary API, I'll fetch that.

  const { data: mainSummary } = useSalesPerformance(
    organizationId,
    contextBranchId,
    selectedBranchIds.length > 0 ? selectedBranchIds : undefined,
    undefined,
    dateRange,
    "all"
  )

  // Actually, I'll use SWR with the analyticsUrl I just derived
  const { data: comparisonSummaryData, isLoading: isLoadingSummary } = useSalesPerformance(
    organizationId,
    contextBranchId,
    selectedBranchIds.length > 0 ? selectedBranchIds : undefined,
    undefined,
    dateRange,
    "all"
  )

  // I will update the analytics summary fetcher to match the one I used in sales-summary/page.tsx
  // But to keep it simple and reactive, I'll just use the compare flag in useSalesPerformance if I update that hook.
  // Let's check use-sales-performance.ts again to see if I can add 'compare' param.

  const { data: pendingData } = useSalesPerformance(
    organizationId,
    contextBranchId,
    selectedBranchIds.length > 0 ? selectedBranchIds : undefined,
    undefined,
    dateRange,
    "PENDING",
    compare,
    compareRange
  )

  const { data: fulfilledData } = useSalesPerformance(
    organizationId,
    contextBranchId,
    selectedBranchIds.length > 0 ? selectedBranchIds : undefined,
    undefined,
    dateRange,
    "FULFILLED",
    compare,
    compareRange,
    months,
    years,
    compareMonths,
    compareYears,
    activePreset === "all" ? "yearly" : undefined
  )

  const { data: refundedData } = useSalesPerformance(
    organizationId,
    contextBranchId,
    selectedBranchIds.length > 0 ? selectedBranchIds : undefined,
    undefined,
    dateRange,
    "REFUNDED",
    compare,
    compareRange,
    months,
    years,
    compareMonths,
    compareYears,
    activePreset === "all" ? "yearly" : undefined
  )

  const { data: rejectedData } = useSalesPerformance(
    organizationId,
    contextBranchId,
    selectedBranchIds.length > 0 ? selectedBranchIds : undefined,
    undefined,
    dateRange,
    "REJECTED",
    compare,
    compareRange,
    months,
    years,
    compareMonths,
    compareYears,
    activePreset === "all" ? "yearly" : undefined
  )

  const { data: approvedData } = useSalesPerformance(
    organizationId,
    contextBranchId,
    selectedBranchIds.length > 0 ? selectedBranchIds : undefined,
    undefined,
    dateRange,
    "APPROVED",
    compare,
    compareRange,
    months,
    years,
    compareMonths,
    compareYears,
    activePreset === "all" ? "yearly" : undefined
  )

  const { data: partialData } = useSalesPerformance(
    organizationId,
    contextBranchId,
    selectedBranchIds.length > 0 ? selectedBranchIds : undefined,
    undefined,
    dateRange,
    "PARTIAL",
    compare,
    compareRange
  )

  const perfData = perfDataFull
  const summary = perfDataFull?.comparison

  const getTrend = (current: number, prev: number) => {
    if (!prev || prev === 0) return null
    const diff = ((current - prev) / prev) * 100
    return {
      value: Math.abs(diff).toFixed(1),
      isUp: diff > 0,
      isDown: diff < 0
    }
  }

  const purchaseTrend = getTrend(perfData?.totalSales || 0, summary?.totalSales || 0)
  const orderTrend = getTrend(perfData?.totalOrders || 0, summary?.totalOrders || 0)

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
  }, [])

  const allBranchesSelected = !contextBranchId && selectedBranchIds.length === 0

  const totalPurchases = perfData?.totalNetSales ?? perfData?.totalSales ?? 0
  const totalOrders = perfData?.totalOrders ?? 0
  const pendingCount = pendingData?.totalOrders ?? 0
  const fulfilledCount = fulfilledData?.totalOrders ?? 0
  const partialCount = partialData?.totalOrders ?? 0
  const refundedCount = refundedData?.totalOrders ?? 0
  const rejectedCount = rejectedData?.totalOrders ?? 0
  const approvedCount = approvedData?.totalOrders ?? 0
  // Note: Head office scope typically doesn't load all users globally unless needed,
  // but we'll show branches count from the perfData as a proxy if we want, or hide it.
  const activeBranchesCount = perfData?.branchSales?.length ?? 0

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
            <MultiBranchFilter
              organizationId={organizationId}
              selectedBranchIds={selectedBranchIds}
              onChange={handleBranchChange}
            />
          </>
        )}
      </div>

      {/* ━━━ KPI Cards ━━━ */}
      <div className="relative z-10 grid gap-3 grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
        <BankingKPICard
          icon={TrendingUp} title="Purchases"
          value={formatPKR(totalPurchases, { maximumFractionDigits: 0 })}
          subtitle={getPresetLabel(activePreset, dateRange)}
          trend={purchaseTrend?.isUp ? "up" : purchaseTrend?.isDown ? "down" : undefined}
          trendValue={purchaseTrend ? `${purchaseTrend.value}%` : undefined}
          gradient="from-emerald-500 to-teal-600" iconBg="text-emerald-600 bg-emerald-600" delay={0}
          onClick={() => handleKPIOpen("REVENUE")}
          comparisonValue={compare && summary ? formatPKR(summary.totalNetSales ?? summary.totalSales) : undefined}
          comparisonLabel="Prev"
        />
        <BankingKPICard
          icon={Package} title="Orders"
          value={totalOrders.toLocaleString()}
          subtitle={getPresetLabel(activePreset, dateRange)}
          trend={orderTrend?.isUp ? "up" : orderTrend?.isDown ? "down" : undefined}
          trendValue={orderTrend ? `${orderTrend.value}%` : undefined}
          gradient="from-blue-500 to-indigo-600" iconBg="text-blue-600 bg-blue-600" delay={50}
          onClick={() => handleKPIOpen("ORDERS")}
          comparisonValue={compare && summary ? summary.totalOrders.toLocaleString() : undefined}
          comparisonLabel="Prev"
        />
        <BankingKPICard
          icon={Activity} title="Pending"
          value={pendingCount.toLocaleString()}
          subtitle={getPresetLabel(activePreset, dateRange)}
          gradient="from-amber-400 to-orange-500" iconBg="text-amber-600 bg-amber-600" delay={75}
          onClick={() => handleKPIOpen("PENDING" as any)} // Cast if PENDING is not in DrillDownType yet
          comparisonValue={compare && summary?.pendingCount != null ? summary.pendingCount.toLocaleString() : undefined}
          comparisonLabel="Prev"
        />
        <BankingKPICard
          icon={CheckCircle2} title="Approved"
          value={approvedCount.toLocaleString()}
          subtitle={getPresetLabel(activePreset, dateRange)}
          gradient="from-blue-400 to-indigo-500" iconBg="text-blue-600 bg-blue-600" delay={100}
          onClick={() => handleKPIOpen("APPROVED")}
          comparisonValue={compare && summary?.approvedCount != null ? summary.approvedCount.toLocaleString() : undefined}
          comparisonLabel="Prev"
        />
        <BankingKPICard
          icon={CheckCircle2} title="Fulfilled"
          value={fulfilledCount.toLocaleString()}
          subtitle={getPresetLabel(activePreset, dateRange)}
          gradient="from-teal-500 to-cyan-600" iconBg="text-teal-600 bg-teal-600" delay={125}
          onClick={() => handleKPIOpen("FULFILLED")}
          comparisonValue={compare && summary?.fulfilledCount != null ? summary.fulfilledCount.toLocaleString() : undefined}
          comparisonLabel="Prev"
        />
        <BankingKPICard
          icon={Package} title="Partial Fulfilled"
          value={partialCount.toLocaleString()}
          subtitle={getPresetLabel(activePreset, dateRange)}
          gradient="from-indigo-500 to-purple-600" iconBg="text-indigo-600 bg-indigo-600" delay={135}
          onClick={() => handleKPIOpen("PARTIAL" as any)}
          comparisonValue={compare && summary?.partialCount != null ? summary.partialCount.toLocaleString() : undefined}
          comparisonLabel="Prev"
        />
        <BankingKPICard
          icon={RotateCcw} title="Refunded"
          value={refundedCount.toLocaleString()}
          subtitle={getPresetLabel(activePreset, dateRange)}
          gradient="from-red-500 to-rose-600" iconBg="text-red-600 bg-red-600" delay={150}
          onClick={() => handleKPIOpen("REFUNDED")}
          comparisonValue={compare && summary?.refundedCount != null ? summary.refundedCount.toLocaleString() : undefined}
          comparisonLabel="Prev"
        />
        <BankingKPICard
          icon={XCircle} title="Rejected"
          value={rejectedCount.toLocaleString()}
          subtitle={getPresetLabel(activePreset, dateRange)}
          gradient="from-slate-500 to-slate-700" iconBg="text-slate-600 bg-slate-600" delay={175}
          onClick={() => handleKPIOpen("REJECTED")}
          comparisonValue={compare && summary?.rejectedCount != null ? summary.rejectedCount.toLocaleString() : undefined}
          comparisonLabel="Prev"
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
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Purchases Performance</h3>
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
              label="Purchases" dateRange={dateRange} comparisonSeries={compare ? summary?.seriesData : undefined}
            />
          )}
        </CardContent>
      </Card>

      {/* ━━━ Branch Sales Chart ━━━ */}
      {allBranchesSelected && (
        <Card className="border border-slate-200/80 dark:border-slate-800/60 shadow-sm bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
                <BarChart3 className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Branch Purchases Performance</h3>
            </div>
            {isLoadingPerf ? (
              <div className="h-56 flex items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 dark:border-slate-700 border-t-indigo-500" />
              </div>
            ) : (
              <BranchSalesBarChart branchSales={perfData?.branchSales ?? []} label="Purchases" />
            )}
          </CardContent>
        </Card>
      )}

      <DrillDownSheet
        isOpen={isDrillDownOpen}
        onOpenChange={setIsDrillDownOpen}
        type={drillDownType}
        organizationId={organizationId}
        branchId={contextBranchId}
        branchIds={selectedBranchIds}
        defaultDateRange={dateRange}
        activePreset={activePreset}
        compare={compare}
        compareRange={compareRange}
        months={months}
        years={years}
        compareMonths={compareMonths}
        compareYears={compareYears}
        title={drillDownType === "REVENUE" ? "Purchases Insights" : undefined}
      />
    </main>
  )
}