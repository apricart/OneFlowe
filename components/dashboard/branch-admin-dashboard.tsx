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

  const fulfilledCount = fulfilledData?.totalOrders ?? 0
  const refundedCount = refundedData?.totalOrders ?? 0
  const rejectedCount = rejectedData?.totalOrders ?? 0
  const approvedCount = approvedData?.totalOrders ?? 0

  const periodPurchases = perfData?.totalNetSales ?? perfData?.totalSales ?? 0
  const periodOrders = perfData?.totalOrders ?? 0

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
      <div className="relative z-10 grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
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
          icon={CheckCircle2} title="Approved"
          value={approvedCount.toLocaleString()}
          subtitle={getPresetLabel(activePreset, dateRange)}
          gradient="from-blue-400 to-indigo-500" iconBg="text-blue-600 bg-blue-600" delay={190}
          comparisonValue={compare && perfData?.comparison?.approvedCount != null ? perfData.comparison.approvedCount.toLocaleString() : undefined}
          comparisonLabel="Prev"
        />
        <BankingKPICard
          icon={CheckCircle2} title="Fulfilled"
          value={fulfilledCount.toLocaleString()}
          subtitle={getPresetLabel(activePreset, dateRange)}
          gradient="from-teal-500 to-cyan-600" iconBg="text-teal-600 bg-teal-600" delay={150}
          onClick={() => handleKPIOpen("FULFILLED")}
          comparisonValue={compare && perfData?.comparison?.fulfilledCount != null ? perfData.comparison.fulfilledCount.toLocaleString() : undefined}
          comparisonLabel="Prev"
        />
        <BankingKPICard
          icon={RotateCcw} title="Refunded"
          value={refundedCount.toLocaleString()}
          subtitle={getPresetLabel(activePreset, dateRange)}
          gradient="from-red-500 to-rose-600" iconBg="text-red-600 bg-red-600" delay={200}
          onClick={() => handleKPIOpen("REFUNDED")}
          comparisonValue={compare && perfData?.comparison?.refundedCount != null ? perfData.comparison.refundedCount.toLocaleString() : undefined}
          comparisonLabel="Prev"
        />
        <BankingKPICard
          icon={XCircle} title="Rejected"
          value={rejectedCount.toLocaleString()}
          subtitle={getPresetLabel(activePreset, dateRange)}
          gradient="from-slate-500 to-slate-700" iconBg="text-slate-600 bg-slate-600" delay={225}
          onClick={() => handleKPIOpen("REJECTED")}
          comparisonValue={compare && perfData?.comparison?.rejectedCount != null ? perfData.comparison.rejectedCount.toLocaleString() : undefined}
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