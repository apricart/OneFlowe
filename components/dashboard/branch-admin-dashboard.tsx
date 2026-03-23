"use client"

import { useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { useLifetimeStats, useDashboardAnalytics } from "@/lib/hooks/use-dashboard-analytics"
import { useSalesPerformance, type DateRange } from "@/lib/hooks/use-sales-performance"
import { useAppContext } from "@/components/context/app-context"
import { SalesPerformanceLineChart } from "@/components/dashboard/charts"
import { BankingKPICard } from "@/components/dashboard/banking-kpi-card"
import { GlobalDateFilter, type FilterPreset, getPresetLabel } from "@/components/dashboard/global-date-filter"
import { DrillDownSheet, type DrillDownType } from "@/components/dashboard/drill-down-sheet"
import { NotificationRail } from "@/components/notifications/notification-center"
import { formatPKR } from "@/lib/utils"
import {
  AlertCircle, TrendingUp,
  Package, RefreshCw, Filter, CheckCircle2, RotateCcw, XCircle, Activity,
} from "lucide-react"
import { startOfDay, endOfDay } from "date-fns"

const getDefaultDateRange = (): DateRange => ({
  startDate: startOfDay(new Date()),
  endDate: endOfDay(new Date()),
})

export function BranchAdminDashboard() {
  const { organizationId, branchId } = useAppContext()

  const { data } = useDashboardAnalytics(organizationId, branchId)
  const { data: lifetimeStats } = useLifetimeStats(organizationId, branchId)

  const pendingApprovals = data?.pendingApprovals ?? 0

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

  // Sales performance data (dynamic)
  const { data: perfData, isLoading: isLoadingPerf } = useSalesPerformance(
    organizationId,
    branchId,
    undefined,
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

  const { data: pendingData } = useSalesPerformance(
    organizationId ?? undefined,
    branchId ?? undefined,
    undefined,
    undefined,
    dateRange,
    "PENDING",
    compare,
    compareRange
  )

  const { data: fulfilledData } = useSalesPerformance(
    organizationId, branchId, undefined, undefined, dateRange, "FULFILLED", compare, compareRange, months, years, compareMonths, compareYears, activePreset === "all" ? "yearly" : undefined
  )

  const { data: refundedData } = useSalesPerformance(
    organizationId, branchId, undefined, undefined, dateRange, "REFUNDED", compare, compareRange, months, years, compareMonths, compareYears, activePreset === "all" ? "yearly" : undefined
  )

  const { data: rejectedData } = useSalesPerformance(
    organizationId, branchId, undefined, undefined, dateRange, "REJECTED", compare, compareRange, months, years, compareMonths, compareYears, activePreset === "all" ? "yearly" : undefined
  )

  const { data: approvedData } = useSalesPerformance(
    organizationId, branchId, undefined, undefined, dateRange, "APPROVED", compare, compareRange, months, years, compareMonths, compareYears, activePreset === "all" ? "yearly" : undefined
  )

  const { data: pendingData } = useSalesPerformance(
    organizationId, branchId, undefined, undefined, dateRange, "PENDING", compare, compareRange, months, years, compareMonths, compareYears, activePreset === "all" ? "yearly" : undefined
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
  }, [])

  const totalOrders = perfData?.totalOrders ?? 0
  const pendingCount = pendingData?.totalOrders ?? 0
  const fulfilledCount = fulfilledData?.totalOrders ?? 0
  const partialCount = partialData?.totalOrders ?? 0
  const refundedCount = refundedData?.totalOrders ?? 0
  const rejectedCount = rejectedData?.totalOrders ?? 0
  const approvedCount = approvedData?.totalOrders ?? 0

  const periodPurchases = perfData?.totalNetSales ?? perfData?.totalSales ?? 0
  const periodOrders = perfData?.totalOrders ?? 0

  const pendingTrend = pendingData?.comparison ? {
    type: (pendingData.totalOrders ?? 0) > (pendingData.comparison.totalOrders ?? 0) ? "up" : "down",
    value: Math.abs((pendingData.totalOrders ?? 0) - (pendingData.comparison.totalOrders ?? 0)),
    label: pendingData.comparison.totalOrders.toLocaleString()
  } : undefined

  const approvedTrend = approvedData?.comparison ? {
    type: (approvedData.totalOrders ?? 0) > (approvedData.comparison.totalOrders ?? 0) ? "up" : "down",
    value: Math.abs((approvedData.totalOrders ?? 0) - (approvedData.comparison.totalOrders ?? 0)),
    label: approvedData.comparison.totalOrders.toLocaleString()
  } : undefined

  const fulfilledTrend = fulfilledData?.comparison ? {
    type: (fulfilledData.totalOrders ?? 0) > (fulfilledData.comparison.totalOrders ?? 0) ? "up" : "down",
    value: Math.abs((fulfilledData.totalOrders ?? 0) - (fulfilledData.comparison.totalOrders ?? 0)),
    label: fulfilledData.comparison.totalOrders.toLocaleString()
  } : undefined

  const partialTrend = partialData?.comparison ? {
    type: (partialData.totalOrders ?? 0) > (partialData.comparison.totalOrders ?? 0) ? "up" : "down",
    value: Math.abs((partialData.totalOrders ?? 0) - (partialData.comparison.totalOrders ?? 0)),
    label: partialData.comparison.totalOrders.toLocaleString()
  } : undefined

  const refundedTrend = refundedData?.comparison ? {
    type: (refundedData.totalOrders ?? 0) > (refundedData.comparison.totalOrders ?? 0) ? "up" : "down",
    value: Math.abs((refundedData.totalOrders ?? 0) - (refundedData.comparison.totalOrders ?? 0)),
    label: refundedData.comparison.totalOrders.toLocaleString()
  } : undefined

  const rejectedTrend = rejectedData?.comparison ? {
    type: (rejectedData.totalOrders ?? 0) > (rejectedData.comparison.totalOrders ?? 0) ? "up" : "down",
    value: Math.abs((rejectedData.totalOrders ?? 0) - (rejectedData.comparison.totalOrders ?? 0)),
    label: rejectedData.comparison.totalOrders.toLocaleString()
  } : undefined

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
      </div>

      {/* ━━━ KPI Cards ━━━ */}
      <div className="relative z-10 grid gap-3 grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
        <BankingKPICard
          icon={TrendingUp} title="Purchases"
          value={formatPKR(periodPurchases, { maximumFractionDigits: 0 })}
          subtitle={getPresetLabel(activePreset, dateRange)}
          gradient="from-emerald-500 to-teal-600" iconBg="text-emerald-600 bg-emerald-600" delay={0}
          onClick={() => handleKPIOpen("REVENUE")}
          comparisonValue={compare && perfData?.comparison ? formatPKR(perfData.comparison.totalNetSales ?? perfData.comparison.totalSales) : undefined}
          comparisonLabel="Prev"
        />
        <BankingKPICard
          icon={Package} title="Orders"
          value={periodOrders.toLocaleString()}
          subtitle={getPresetLabel(activePreset, dateRange)}
          gradient="from-blue-500 to-indigo-600" iconBg="text-blue-600 bg-blue-600" delay={50}
          onClick={() => handleKPIOpen("ORDERS")}
          comparisonValue={compare && perfData?.comparison ? perfData.comparison.totalOrders.toLocaleString() : undefined}
          comparisonLabel="Prev"
        />
        <BankingKPICard
          icon={Activity} title="Pending"
          value={pendingCount.toLocaleString()}
          subtitle={getPresetLabel(activePreset, dateRange)}
          gradient="from-amber-400 to-orange-500" iconBg="text-amber-600 bg-amber-600" delay={75}
          onClick={() => handleKPIOpen("PENDING" as any)}
          trend={pendingTrend?.type as "up" | "down" | undefined}
          trendValue={pendingTrend?.value?.toString()}
          comparisonValue={pendingTrend?.label}
          comparisonLabel="Period Comparison"
        />
        <BankingKPICard
          icon={CheckCircle2} title="Approved"
          value={approvedCount.toLocaleString()}
          subtitle={getPresetLabel(activePreset, dateRange)}
          gradient="from-blue-400 to-indigo-500" iconBg="text-blue-600 bg-blue-600" delay={100}
          onClick={() => handleKPIOpen("APPROVED" as any)}
          trend={approvedTrend?.type as "up" | "down" | undefined}
          trendValue={approvedTrend?.value?.toString()}
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
          trendValue={fulfilledTrend?.value?.toString()}
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
          trendValue={partialTrend?.value?.toString()}
          comparisonValue={partialTrend?.label}
          comparisonLabel="Period Comparison"
        />
        <BankingKPICard
          icon={RotateCcw} title="Refunded"
          value={refundedCount.toLocaleString()}
          subtitle={getPresetLabel(activePreset, dateRange)}
          gradient="from-red-500 to-rose-600" iconBg="text-red-600 bg-red-600" delay={200}
          onClick={() => handleKPIOpen("REFUNDED")}
          trend={refundedTrend?.type as "up" | "down" | undefined}
          trendValue={refundedTrend?.value?.toString()}
          comparisonValue={refundedTrend?.label}
        />
        <BankingKPICard
          icon={XCircle} title="Rejected"
          value={rejectedCount.toLocaleString()}
          subtitle={getPresetLabel(activePreset, dateRange)}
          gradient="from-slate-500 to-slate-700" iconBg="text-slate-600 bg-slate-600" delay={225}
          onClick={() => handleKPIOpen("REJECTED")}
          trend={rejectedTrend?.type as "up" | "down" | undefined}
          trendValue={rejectedTrend?.value?.toString()}
          comparisonValue={rejectedTrend?.label}
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
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Purchases Performance</h3>
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
              label="Purchases" dateRange={dateRange} comparisonSeries={compare ? perfData?.comparison?.seriesData : undefined}
            />
          )}
        </CardContent>
      </Card>

      <DrillDownSheet
        isOpen={isDrillDownOpen}
        onOpenChange={setIsDrillDownOpen}
        type={drillDownType}
        organizationId={organizationId}
        branchId={branchId}
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