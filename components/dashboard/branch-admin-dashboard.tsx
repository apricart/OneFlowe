"use client"

import { useMemo, useState, useCallback, useEffect } from "react"
import { motion } from "framer-motion"
import useSWR from "swr"
import { fetcher } from "@/lib/fetcher"
import { useLifetimeStats } from "@/lib/hooks/use-dashboard-analytics"
import { useSalesPerformance, type DateRange } from "@/lib/hooks/use-sales-performance"
import { Card, CardContent } from "@/components/ui/card"
import { NotificationRail } from "@/components/notifications/notification-center"
import { formatPKR, cn } from "@/lib/utils"
import {
  TrendingUp, Package, RefreshCw, Filter, CheckCircle2, RotateCcw, XCircle, Activity,
  Layers, Clock, Calendar
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { SalesPerformanceBarChart } from "@/components/dashboard/charts"
import { BankingKPICard } from "@/components/dashboard/banking-kpi-card"
import { GlobalDateFilter, type FilterPreset, getPresetLabel, getPresetRange } from "@/components/dashboard/global-date-filter"
import { DrillDownSheet, type DrillDownType } from "@/components/dashboard/drill-down-sheet"
import { MultiSelectFilter } from "@/components/reports/multi-select-filter"

import { useAppContext } from "@/components/context/app-context"
import { startOfDay, endOfDay, format } from "date-fns"

export function BranchAdminDashboard() {
  const { organizationId, branchId } = useAppContext()

  // Branch Admin defaults to 'Today'
  const defaultPreset = "today" as const
  
  const [dateRange, setDateRange] = useState<DateRange | null>(getPresetRange(defaultPreset))
  const [activePreset, setActivePreset] = useState<FilterPreset>(defaultPreset)
  const [compare, setCompare] = useState(false)
  const [compareRange, setCompareRange] = useState<DateRange | null>(null)
  const [months, setMonths] = useState<number[]>([])
  const [years, setYears] = useState<number[]>([])
  const [compareMonths, setCompareMonths] = useState<number[]>([])
  const [compareYears, setCompareYears] = useState<number[]>([])

  const [drillDownType, setDrillDownType] = useState<DrillDownType | null>(null)
  const [isDrillDownOpen, setIsDrillDownOpen] = useState(false)

  // Fetch all-time data to extract available years from the database for this branch
  const { data: allTimePerf } = useSWR(
    `/api/v1/analytics/sales-performance?startDate=2015-01-01T00:00:00.000Z&endDate=${new Date().toISOString()}&granularity=yearly&status=all&branchId=${branchId}`,
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

  // ── Local Chart State ──
  type ChartQuickFilter = "today" | "7d" | null
  
  const [chartQuickFilter, setChartQuickFilter] = useState<ChartQuickFilter>("today")
  const [chartMonths, setChartMonths] = useState<number[]>([])
  const [chartYears, setChartYears] = useState<number[]>([])

  const handleChartMonths = useCallback((m: number[]) => {
    setChartMonths(m)
    if (m.length > 0) setChartQuickFilter(null)
  }, [])
  const handleChartYears = useCallback((y: number[]) => {
    setChartYears(y)
    if (y.length > 0) setChartQuickFilter(null)
  }, [])
  const handleQuickFilter = useCallback((f: ChartQuickFilter) => {
    setChartQuickFilter(f)
    setChartMonths([])
    setChartYears([])
  }, [])

  // Sync Global Filters to Local Chart Filters
  useEffect(() => {
    if (activePreset === "today") {
      setChartQuickFilter("today")
      setChartMonths([])
      setChartYears([])
    } else if (activePreset === "7d") {
      setChartQuickFilter("7d")
      setChartMonths([])
      setChartYears([])
    } else if (activePreset === "all") {
      setChartQuickFilter(null)
      setChartMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
      setChartYears(chartYearsAvailable)
    } else {
      setChartQuickFilter(null)
      setChartMonths(months)
      setChartYears(years)
    }
  }, [activePreset, months, years, chartYearsAvailable])

  const handleKPIOpen = (type: DrillDownType) => {
    setDrillDownType(type)
    setIsDrillDownOpen(true)
  }

  // Sales performance data for KPIs (Global Filter)
  const { data: perfData, isLoading: isLoadingPerf } = useSalesPerformance(
    organizationId, branchId,
    undefined,
    undefined, dateRange, "all", compare, compareRange,
    months, years, compareMonths, compareYears,
    activePreset === "all" ? "yearly" : undefined
  )

  // Chart Logic (Local Filters)
  const chartDateRange = useMemo(() => {
    if (chartQuickFilter === "today") return getPresetRange("today")
    if (chartQuickFilter === "7d") {
      const end = endOfDay(new Date())
      const start = startOfDay(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000))
      return { startDate: start, endDate: end }
    }
    if (chartMonths.length > 0 || chartYears.length > 0) return null
    return dateRange
  }, [chartQuickFilter, chartMonths, chartYears, dateRange])

  const hasChartFilters = chartMonths.length > 0 || chartYears.length > 0
  const chartComponentDateRange = chartQuickFilter === "today" ? getPresetRange("today") : (hasChartFilters ? null : chartDateRange)

  const isBroadRange = !chartQuickFilter && ["all", "yearly", "monthly", "custom"].includes(activePreset)

  const chartGranularity = (chartQuickFilter === "today" || (activePreset === "today" && !hasChartFilters))
    ? "daily" as const
    : (chartYears.length > 1 || (chartYears.length === 0 && years.length > 1 && !chartQuickFilter && chartMonths.length === 0))
      ? "yearly" as const
      : (chartMonths.length > 0 || chartYears.length === 1 || (!chartQuickFilter && (months.length > 0 || years.length === 1)) || isBroadRange)
        ? "monthly" as const
        : "daily" as const

  const { data: chartPerfData, isLoading: isLoadingChart } = useSalesPerformance(
    organizationId, branchId,
    undefined,
    undefined, chartDateRange, "all", false, null,
    chartMonths, chartYears, [], [],
    chartGranularity
  )

  const normalizedChartData = useMemo(() => {
    const raw = chartPerfData?.seriesData ?? []

    if (chartQuickFilter === "today" || (chartQuickFilter === null && activePreset === "today" && !hasChartFilters)) {
      return raw
    }

    if (chartQuickFilter === "7d" || (chartQuickFilter === null && activePreset === "7d" && !hasChartFilters)) {
      return raw
    }

    const activeYears = chartYears.length > 0 ? chartYears : years
    const activeMonths = chartMonths.length > 0 ? chartMonths : months

    if (activeYears.length > 1) {
      return [...activeYears].sort((a, b) => a - b).map(y => {
        const match = raw.find((r: any) => r.label === String(y) || r.label?.startsWith(String(y)))
        return {
          label: String(y),
          sales: match?.sales ?? 0,
          orders: match?.orders ?? 0,
        }
      })
    }

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    const monthsToShow = activeMonths.length > 0 && activeMonths.length < 12
      ? [...activeMonths].sort((a, b) => a - b)
      : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

    return monthsToShow.map(m => {
      const monthPrefix = monthNames[m - 1]
      const match = raw.find((r: any) => r.label?.startsWith(monthPrefix))
      return {
        label: monthPrefix,
        sales: match?.sales ?? 0,
        orders: match?.orders ?? 0,
      }
    })
  }, [chartPerfData, chartQuickFilter, chartMonths, chartYears, activePreset, months, years, hasChartFilters])

  // KPI Breakdown Queries
  const { data: pendingData } = useSalesPerformance(organizationId, branchId, undefined, undefined, dateRange, "PENDING", compare, compareRange)
  const { data: fulfilledData } = useSalesPerformance(organizationId, branchId, undefined, undefined, dateRange, "FULFILLED", compare, compareRange)
  const { data: refundedData } = useSalesPerformance(organizationId, branchId, undefined, undefined, dateRange, "REFUNDED", compare, compareRange)
  const { data: rejectedData } = useSalesPerformance(organizationId, branchId, undefined, undefined, dateRange, "REJECTED", compare, compareRange)
  const { data: approvedData } = useSalesPerformance(organizationId, branchId, undefined, undefined, dateRange, "APPROVED", compare, compareRange)
  const { data: partialData } = useSalesPerformance(organizationId, branchId, undefined, undefined, dateRange, "PARTIAL", compare, compareRange)

  const handleDateChange = useCallback((range: DateRange | null, preset: FilterPreset, compareMode?: boolean, compRange?: DateRange | null, m?: number[], y?: number[], cm?: number[], cy?: number[]) => {
    setDateRange(range)
    setActivePreset(preset)
    if (compareMode !== undefined) setCompare(compareMode)
    if (compRange !== undefined) setCompareRange(compRange)
    setMonths(m || [])
    setYears(y || [])
    setCompareMonths(cm || [])
    setCompareYears(cy || [])
  }, [])

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

  const totalRevenue = perfData?.totalNetSales ?? perfData?.totalSales ?? 0
  const totalOrders = perfData?.totalOrders ?? 0
  const pendingCount = pendingData?.totalOrders ?? 0
  const fulfilledCount = fulfilledData?.totalOrders ?? 0
  const partialCount = partialData?.totalOrders ?? 0
  const refundedCount = refundedData?.totalOrders || 0
  const rejectedCount = rejectedData?.totalOrders || 0
  const approvedCount = approvedData?.totalOrders || 0

  return (
    <motion.main 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 lg:p-6 space-y-6 max-w-[2000px] mx-auto overflow-x-hidden"
    >
      <NotificationRail className="bg-transparent border-0 shadow-none px-0" />

      {/* ━━━ Header & Filters ━━━ */}
      <div className="relative z-30 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-3 px-2">
          <Layers className="w-5 h-5 text-indigo-500" />
          <h2 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Branch Metrics</h2>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
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
      </div>

      {/* ━━━ KPI Cards ━━━ */}
      <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <BankingKPICard
          icon={TrendingUp} title="Revenue"
          value={formatPKR(totalRevenue, { maximumFractionDigits: 0 })}
          subtitle={getPresetLabel(activePreset, dateRange)}
          gradient="from-emerald-500 to-teal-600" iconBg="text-emerald-600 bg-emerald-600" delay={0}
          onClick={() => handleKPIOpen("REVENUE")}
          trend={buildTrend(totalRevenue, perfData?.comparison?.totalNetSales ?? perfData?.comparison?.totalSales)?.type as "up" | "down" | undefined}
          trendValue={buildTrend(totalRevenue, perfData?.comparison?.totalNetSales ?? perfData?.comparison?.totalSales)?.value}
          comparisonValue={buildTrend(totalRevenue, perfData?.comparison?.totalNetSales ?? perfData?.comparison?.totalSales)?.label}
          comparisonLabel="VS LAST"
        />
        <BankingKPICard
          icon={Package} title="Orders"
          value={totalOrders.toLocaleString()}
          subtitle={getPresetLabel(activePreset, dateRange)}
          gradient="from-blue-500 to-indigo-600" iconBg="text-blue-600 bg-blue-600" delay={50}
          onClick={() => handleKPIOpen("ORDERS")}
          trend={buildTrend(totalOrders, perfData?.comparison?.totalOrders)?.type as "up" | "down" | undefined}
          trendValue={buildTrend(totalOrders, perfData?.comparison?.totalOrders)?.value}
          comparisonValue={buildTrend(totalOrders, perfData?.comparison?.totalOrders)?.label}
          comparisonLabel="VS LAST"
        />
        <BankingKPICard
          icon={Activity} title="Pending"
          value={pendingCount.toLocaleString()}
          subtitle={getPresetLabel(activePreset, dateRange)}
          gradient="from-amber-400 to-orange-500" iconBg="text-amber-600 bg-amber-600" delay={75}
          onClick={() => handleKPIOpen("PENDING" as any)}
          trend={buildTrend(pendingCount, perfData?.comparison?.pendingCount)?.type as "up" | "down" | undefined}
          trendValue={buildTrend(pendingCount, perfData?.comparison?.pendingCount)?.value}
          comparisonValue={buildTrend(pendingCount, perfData?.comparison?.pendingCount)?.label}
          comparisonLabel="VS LAST"
        />
        <BankingKPICard
          icon={CheckCircle2} title="Approved"
          value={approvedCount.toLocaleString()}
          subtitle={getPresetLabel(activePreset, dateRange)}
          gradient="from-blue-400 to-indigo-500" iconBg="text-blue-600 bg-blue-600" delay={100}
          onClick={() => handleKPIOpen("APPROVED")}
          trend={buildTrend(approvedCount, perfData?.comparison?.approvedCount)?.type as "up" | "down" | undefined}
          trendValue={buildTrend(approvedCount, perfData?.comparison?.approvedCount)?.value}
          comparisonValue={buildTrend(approvedCount, perfData?.comparison?.approvedCount)?.label}
          comparisonLabel="VS LAST"
        />
        <BankingKPICard
          icon={CheckCircle2} title="Fulfilled"
          value={fulfilledCount.toLocaleString()}
          subtitle={getPresetLabel(activePreset, dateRange)}
          gradient="from-teal-500 to-cyan-600" iconBg="text-teal-600 bg-teal-600" delay={125}
          onClick={() => handleKPIOpen("FULFILLED")}
          trend={buildTrend(fulfilledCount, perfData?.comparison?.fulfilledCount)?.type as "up" | "down" | undefined}
          trendValue={buildTrend(fulfilledCount, perfData?.comparison?.fulfilledCount)?.value}
          comparisonValue={buildTrend(fulfilledCount, perfData?.comparison?.fulfilledCount)?.label}
          comparisonLabel="VS LAST"
        />
        <BankingKPICard
          icon={Package} title="Partial"
          value={partialCount.toLocaleString()}
          subtitle={getPresetLabel(activePreset, dateRange)}
          gradient="from-indigo-500 to-purple-600" iconBg="text-indigo-600 bg-indigo-600" delay={135}
          onClick={() => handleKPIOpen("PARTIAL" as any)}
          trend={buildTrend(partialCount, perfData?.comparison?.partialCount)?.type as "up" | "down" | undefined}
          trendValue={buildTrend(partialCount, perfData?.comparison?.partialCount)?.value}
          comparisonValue={buildTrend(partialCount, perfData?.comparison?.partialCount)?.label}
          comparisonLabel="VS LAST"
        />
        <BankingKPICard
          icon={RotateCcw} title="Refunded"
          value={refundedCount.toLocaleString()}
          subtitle={getPresetLabel(activePreset, dateRange)}
          gradient="from-red-500 to-rose-600" iconBg="text-red-600 bg-red-600" delay={150}
          onClick={() => handleKPIOpen("REFUNDED")}
          trend={buildTrend(refundedCount, perfData?.comparison?.refundedCount)?.type as "up" | "down" | undefined}
          trendValue={buildTrend(refundedCount, perfData?.comparison?.refundedCount)?.value}
          comparisonValue={buildTrend(refundedCount, perfData?.comparison?.refundedCount)?.label}
          comparisonLabel="VS LAST"
        />
        <BankingKPICard
          icon={XCircle} title="Rejected"
          value={rejectedCount.toLocaleString()}
          subtitle={getPresetLabel(activePreset, dateRange)}
          gradient="from-slate-500 to-slate-700" iconBg="text-slate-600 bg-slate-600" delay={175}
          onClick={() => handleKPIOpen("REJECTED")}
          trend={buildTrend(rejectedCount, perfData?.comparison?.rejectedCount)?.type as "up" | "down" | undefined}
          trendValue={buildTrend(rejectedCount, perfData?.comparison?.rejectedCount)?.value}
          comparisonValue={buildTrend(rejectedCount, perfData?.comparison?.rejectedCount)?.label}
          comparisonLabel="VS LAST"
        />
      </div>

      {/* ━━━ Sales Performance Chart ━━━ */}
      <div className="space-y-6">
        <Card className="border border-slate-200/80 dark:border-slate-800/60 shadow-sm bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl overflow-hidden glass-card">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-center gap-3 mb-6 p-3 bg-slate-50/50 dark:bg-slate-800/20 rounded-xl border border-slate-100 dark:border-slate-800/50">
              <div className="flex items-center gap-2 pr-3 border-r border-slate-200 dark:border-slate-800">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Filters</span>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant={chartQuickFilter === "today" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleQuickFilter("today")}
                  className={cn("h-8 px-3 rounded-lg text-[10px] font-semibold uppercase tracking-wider", chartQuickFilter === "today" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500")}
                >
                  <Clock className="h-3 w-3 mr-1" /> Today
                </Button>
                <Button
                  variant={chartQuickFilter === "7d" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleQuickFilter("7d")}
                  className={cn("h-8 px-3 rounded-lg text-[10px] font-semibold uppercase tracking-wider", chartQuickFilter === "7d" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500")}
                >
                  7D
                </Button>
              </div>

              <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-700 mx-0.5" />
              
              <MonthFilter selected={chartMonths} onChange={handleChartMonths} />
              <YearFilter selected={chartYears} onChange={handleChartYears} availableYears={chartYearsAvailable} />

              {isLoadingChart && (
                <div className="ml-auto flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                  <RefreshCw className="h-3 w-3 animate-spin text-emerald-500" /> Syncing Data
                </div>
              )}
            </div>

            {isLoadingChart ? (
              <div className="h-[400px] flex items-center justify-center rounded-[2.5rem] border border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 dark:border-slate-800 border-t-emerald-500" />
              </div>
            ) : (
              <SalesPerformanceBarChart
                seriesData={normalizedChartData}
                totalSales={chartPerfData?.totalNetSales ?? chartPerfData?.totalSales ?? 0}
                avgSales={chartPerfData?.avgSales ?? 0}
                totalOrders={chartPerfData?.totalOrders ?? 0}
                peakPeriod={chartPerfData?.peakPeriod ?? null}
                granularity={chartGranularity}
                label="Sales"
                dateRange={chartComponentDateRange}
                comparisonSeries={chartPerfData?.comparison?.seriesData}
                showOrgView={false}
              />
            )}
          </CardContent>
        </Card>
      </div>

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
      />
    </motion.main>
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
      onChange={(ids) => onChange(ids.sort((a, b) => a - b))}
      icon={<Layers className="h-3.5 w-3.5 mr-2 text-indigo-500" />}
      placeholder="Years"
      showSearch={false}
    />
  )
}
