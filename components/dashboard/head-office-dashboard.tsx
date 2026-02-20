"use client"
import { useMemo, useState, useEffect, useRef, useCallback } from "react"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area } from "recharts"
import { Card, CardContent } from "@/components/ui/card"
import { useDashboardAnalytics, useWeeklySales, useYearlySales, useMonthlySales, useLifetimeStats } from "@/lib/hooks/use-dashboard-analytics"
import { useAppContext } from "@/components/context/app-context"
import { MonthYearPicker } from "@/components/ui/MonthYearPicker"
import { YearPicker } from "@/components/ui/YearPicker"
import { formatPKR } from "@/lib/utils"
import SalesBarChart, { YearlySalesSplineChart, TrendAreaChart, ComparisonBarChart } from "@/components/dashboard/charts"
import { BankingKPICard } from "@/components/dashboard/banking-kpi-card"
import { Building2, AlertCircle, ShoppingCart, TrendingUp, TrendingDown, Calendar, ArrowUpRight, ArrowDownRight, BarChart3, Activity, FileCheck, Wallet, Sparkles } from "lucide-react"
import { useOrganizations } from "@/lib/hooks/use-api"
import { NotificationRail } from "@/components/notifications/notification-center"
import { GroupFilter } from "@/components/reports/group-filter"

const monthNames: Record<string, string> = {
  "01": "Jan",
  "02": "Feb",
  "03": "Mar",
  "04": "Apr",
  "05": "May",
  "06": "Jun",
  "07": "Jul",
  "08": "Aug",
  "09": "Sep",
  "10": "Oct",
  "11": "Nov",
  "12": "Dec",
}

export function HeadOfficeDashboard() {
  const { organizationId, branchId } = useAppContext()
  const [groupId, setGroupId] = useState<string>("")
  const { data: orgsData } = useOrganizations()
  const orgs = orgsData?.items || []
  const selectedOrg = useMemo(() =>
    organizationId ? orgs.find(o => o.id?.toString() === organizationId) : null,
    [organizationId, orgs]
  )

  const { data } = useDashboardAnalytics(organizationId, branchId, groupId)
  const { data: lifetimeStats } = useLifetimeStats(organizationId, branchId, groupId)
  const { data: weeklySalesData } = useWeeklySales(organizationId, branchId, groupId)
  const currentYear = new Date().getFullYear()


  const trendData = data?.gmvSeries ?? []
  const branchData = data?.branchSeries ?? []
  const branchesCount = data?.branchCount ?? 0
  const pendingApprovals = data?.pendingApprovals ?? 0
  const ordersThisMonth = data?.ordersThisMonth ?? 0

  // Monthly sales state
  const [selectedMonths, setSelectedMonths] = useState<string[]>([])
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString())
  const [yearlyChartYear, setYearlyChartYear] = useState<string>(currentYear.toString())
  const { data: yearlySalesData } = useYearlySales(organizationId, branchId, Number(yearlyChartYear), groupId)
  const [showPicker, setShowPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const { data: monthlySalesData } = useMonthlySales(organizationId, branchId, Number(selectedYear), groupId)

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      // Check if click is inside picker reference OR inside a Radix Select/Portal content
      const isInsidePicker = pickerRef.current && pickerRef.current.contains(target)
      const isInsideRadixPortal = target.closest('[data-radix-portal]') || target.closest('[role="listbox"]') || target.closest('[data-radix-popper-content-wrapper]')

      if (!isInsidePicker && !isInsideRadixPortal) {
        setShowPicker(false)
      }
    }

    if (showPicker) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showPicker])

  const weeklySalesChartData = useMemo(() => {
    if (!weeklySalesData?.dailySales) return []
    return weeklySalesData.dailySales.map((day: { day: string; sales: number }) => ({
      label: day.day,
      value: day.sales,
    }))
  }, [weeklySalesData])

  const yearlySalesChartData = useMemo(() => {
    if (!yearlySalesData?.monthlySales) return []
    return yearlySalesData.monthlySales.map((month: { month: string; sales: number }) => ({
      month: month.month,
      sales: month.sales,
    }))
  }, [yearlySalesData])

  // Calculate average for YearlySalesSplineChart
  const averageYearlySales = useMemo(() => {
    if (!yearlySalesChartData.length) return 0
    const filtered = yearlySalesChartData.filter(d => d.sales > 0)
    if (filtered.length === 0) return 0
    const sum = filtered.reduce((acc, curr) => acc + curr.sales, 0)
    return sum / filtered.length
  }, [yearlySalesChartData])

  // Monthly sales bar chart data filtered by selected months
  const monthlyBarChartData = useMemo(() => {
    if (!monthlySalesData?.monthlySales) return []

    const monthsOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    const monthlySalesMap: Record<string, number> = {}

    // Initialize all months to 0
    monthsOrder.forEach(m => monthlySalesMap[m] = 0)

    // Populate from API data
    monthlySalesData.monthlySales.forEach((month: { month: string; sales: number }) => {
      monthlySalesMap[month.month] = month.sales
    })

    // If no months selected, show all months
    const monthsToShow = selectedMonths.length > 0
      ? selectedMonths.map(m => monthNames[m])
      : monthsOrder

    // Filter and format data for selected months
    return monthsToShow.map(month => ({
      month,
      value: monthlySalesMap[month] || 0
    }))
  }, [selectedMonths, monthlySalesData])

  const handleGroupChange = useCallback((newGroupId: string) => {
    setGroupId(newGroupId)
  }, [])

  const handleShowPickerToggle = useCallback(() => {
    setShowPicker(prev => !prev)
  }, [])

  const handleApplySelection = useCallback(() => {
    setShowPicker(false)
  }, [])

  const allBranchesSelected = !branchId
  const scopeText = selectedOrg?.name || `Organization #${organizationId}` || "All Organizations"

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-6 space-y-6">
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-down {
          animation: slideDown 0.4s ease-out;
        }
      `}</style>

      {/* Slim Premium Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm dark:shadow-slate-900/50 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 dark:from-indigo-900 dark:to-slate-900 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 bg-white opacity-20 blur-lg rounded-full animate-pulse"></div>
              <div className="relative w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 shadow-sm flex items-center justify-center group-hover:scale-110 transition-all duration-500">
                <Sparkles className="h-6 w-6 text-white" strokeWidth={2.5} />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Head Office Portal</h1>
              <p className="text-xs text-white/70 font-medium">Enterprise Overview • <span className="text-white">{scopeText}</span></p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-3">

          </div>
        </div>
      </div>

      <NotificationRail className="bg-transparent border-0 shadow-none px-0" />

      {/* KPI Cards - Professional Banking Design */}
      {allBranchesSelected && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5 animate-slide-down">
          <BankingKPICard
            icon={Building2}
            title={allBranchesSelected ? "All Branches" : "My Branches"}
            value={branchesCount}
            gradient="from-blue-500 to-indigo-600"
            iconBg="text-blue-600 bg-blue-600"
          />

          <BankingKPICard
            icon={ShoppingCart}
            title="Orders This Month"
            value={ordersThisMonth}
            gradient="from-violet-500 to-purple-600"
            iconBg="text-violet-600 bg-violet-600"
          />

          <BankingKPICard
            icon={FileCheck}
            title="Total Orders"
            value={lifetimeStats?.totalOrders?.toLocaleString() ?? "—"}
            gradient="from-emerald-500 to-teal-600"
            iconBg="text-emerald-600 bg-emerald-600"
          />

          <BankingKPICard
            icon={TrendingDown}
            title="Total Refunded"
            value={formatPKR(lifetimeStats?.totalRefunded || 0, { maximumFractionDigits: 0 })}
            gradient="from-red-500 to-rose-600"
            iconBg="text-red-600 bg-red-600"
          />

          <BankingKPICard
            icon={Wallet}
            title="Total Purchase Cost"
            value={lifetimeStats?.totalRevenue ? formatPKR(lifetimeStats.totalRevenue, { maximumFractionDigits: 0 }) : "—"}
            gradient="from-amber-500 to-orange-600"
            iconBg="text-amber-600 bg-amber-600"
          />
        </div>
      )}

      <div className="space-y-6">
        {/* Charts Grid - Weekly and Yearly Sales (Moved to top) */}
        {/* Charts Grid - Sync with Branch Admin */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Yearly Purchase Chart */}
          <Card className="border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-slate-900/50 hover:shadow-md transition-shadow duration-300 bg-white dark:bg-slate-900 overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Annual Performance</h3>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Yearly Analytics Overview</p>
                  </div>
                </div>
                <YearPicker
                  selectedYear={yearlyChartYear}
                  onYearChange={setYearlyChartYear}
                />
              </div>
              {yearlySalesChartData.length > 0 ? (
                <YearlySalesSplineChart yearlySalesData={yearlySalesChartData} avgSales={averageYearlySales} label="Purchase" />
              ) : (
                <div className="h-[500px] flex items-center justify-center bg-slate-50/50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
                    <p className="text-sm text-slate-500 font-medium">Loading yearly charts...</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Weekly Sales Chart */}
          <Card className="border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-slate-900/50 hover:shadow-md transition-shadow duration-300 bg-white dark:bg-slate-900 overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center">
                    <Activity className="w-5 h-5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Weekly Performance</h3>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">7-Day Purchase Trend</p>
                  </div>
                </div>
              </div>
              {weeklySalesChartData.length > 0 ? (
                <TrendAreaChart data={weeklySalesChartData} label="Purchase" />
              ) : (
                <div className="h-[500px] flex items-center justify-center bg-slate-50/50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mx-auto mb-3"></div>
                    <p className="text-sm text-slate-500 font-medium">Loading weekly trends...</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>


        {/* Monthly Sales Bar Chart with Month Picker */}
        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-slate-900/50 hover:shadow-md transition-shadow duration-300 bg-white dark:bg-slate-900">
          <CardContent className="p-6">
            <div className="space-y-6">
              {/* Header with Picker Toggle */}
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center">
                      <BarChart3 className="w-5 h-5 text-indigo-700 dark:text-indigo-400" strokeWidth={2} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Monthly Purchase Analytics</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {selectedMonths.length > 0
                          ? `${selectedMonths.length} month${selectedMonths.length > 1 ? 's' : ''} selected • ${selectedYear}`
                          : `All months • ${selectedYear}`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Picker Toggle Button */}
                <div className="relative" ref={pickerRef}>
                  <button
                    onClick={handleShowPickerToggle}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 dark:bg-indigo-500 text-white font-semibold text-sm hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors border border-indigo-700 dark:border-indigo-600 shadow-sm"
                  >
                    <Calendar className="h-4 w-4" />
                    <span>Select Period</span>
                  </button>

                  {showPicker && (
                    <div className="absolute right-0 top-full mt-2 z-50">
                      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl border-2 border-slate-200 dark:border-slate-700 overflow-hidden">
                        <MonthYearPicker
                          selectedYear={selectedYear}
                          selectedMonths={selectedMonths}
                          onYearChange={setSelectedYear}
                          onMonthsChange={setSelectedMonths}
                        />
                        <div className="p-3 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                          <button
                            onClick={handleApplySelection}
                            className="w-full px-4 py-2 rounded-lg bg-indigo-600 dark:bg-indigo-500 text-white text-sm font-semibold hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors"
                          >
                            Apply Selection
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Chart */}
              <div className="min-h-[350px] bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                {monthlyBarChartData.length > 0 ? (
                  <SalesBarChart data={monthlyBarChartData} label="Purchase" />
                ) : (
                  <div className="flex items-center justify-center h-[350px]">
                    <div className="text-center space-y-3">
                      <div className="w-14 h-14 bg-slate-100 rounded-lg flex items-center justify-center mx-auto border border-slate-200">
                        <BarChart3 className="w-7 h-7 text-slate-400" />
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Loading monthly purchase data...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}