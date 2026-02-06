"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, useRef } from "react"
import { useOrganizations, useBranches, useUsers } from "@/lib/hooks/use-api"
import { useMonthlySales, useYearlySales, useDashboardAnalytics } from "@/lib/hooks/use-dashboard-analytics"
import { KpiCard } from "@/components/ui/kpi-card"
import { Card, CardContent } from "@/components/ui/card"
import { MonthYearPicker } from "@/components/ui/MonthYearPicker"
import { YearPicker } from "@/components/ui/YearPicker"
import useSWR from "swr"
import { NotificationRail } from "@/components/notifications/notification-center"
import { formatPKR } from "@/lib/utils"
import { Building2, GitBranch, Users, Package, Warehouse, Wallet, BarChart3, ShieldCheck, TrendingUp, ArrowUpRight, ArrowDownRight, Sparkles, Calendar, Activity, AlertCircle } from "lucide-react"
import SalesBarChart, { TrendAreaChart, YearlySalesSplineChart, ComparisonBarChart } from "@/components/dashboard/charts"
import { BankingKPICard } from "@/components/dashboard/banking-kpi-card"
import { GroupFilter } from "@/components/reports/group-filter"
import { useAppContext } from "@/components/context/app-context"
import { startOfDay, subDays, endOfDay, eachDayOfInterval, format, parseISO, getYear } from "date-fns"

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

const navTiles = [
  { title: "Organizations", description: "Configure groups and parent companies.", href: "/organizations", icon: Building2, gradient: "from-blue-600 to-blue-700" },
  { title: "Branches", description: "Manage branches and assignments.", href: "/branches", icon: GitBranch, gradient: "from-indigo-600 to-indigo-700" },
  { title: "Users & Roles", description: "Administer users and access levels.", href: "/users", icon: Users, gradient: "from-emerald-600 to-emerald-700" },
  { title: "Global Inventory", description: "Master product catalog across orgs.", href: "/global-inventory", icon: Warehouse, gradient: "from-orange-600 to-orange-700" },
  { title: "Orders", description: "Monitor and override orders.", href: "/orders", icon: Package, gradient: "from-purple-600 to-purple-700" },
  { title: "Budgets", description: "Control branch spending limits.", href: "/budgets", icon: Wallet, gradient: "from-amber-600 to-amber-700" },
  { title: "Reports", description: "Sales, refunds, and stock insights.", href: "/reports", icon: BarChart3, gradient: "from-blue-700 to-indigo-700" },
  { title: "System Settings", description: "Permissions, audit, and advanced config.", href: "/admin", icon: ShieldCheck, gradient: "from-slate-700 to-slate-800" },
]

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function SuperAdminDashboard() {
  const [selectedMonths, setSelectedMonths] = useState<string[]>([])
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString())
  const [yearlyChartYear, setYearlyChartYear] = useState<string>(new Date().getFullYear().toString())
  const [groupId, setGroupId] = useState<string>("")
  const [showPicker, setShowPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const { organizationId, branchId } = useAppContext()

  const { data: dashboardData } = useDashboardAnalytics(organizationId, branchId, groupId)
  const branchData = dashboardData?.branchSeries ?? []

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      // Check if click is inside picker reference OR inside a Radix Select/Portal content (Year/Month pickers)
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

  // ---------------- Scope Data ----------------
  const { data: orgsData } = useOrganizations()
  const { data: usersData } = useUsers(organizationId || undefined)
  const { data: branchesData } = useBranches(organizationId || undefined)

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

  // ---------------- Bar Chart Data (from useMonthlySales with selectedYear) ----------------
  // Convert selectedYear string to number for the hook
  const { data: monthlySalesData, isLoading: isLoadingMonthly } = useMonthlySales(organizationId, branchId, Number(selectedYear), groupId)

  const barChartData = useMemo(() => {
    // If no months selected, show last 6 months (Jul-Dec) or all if preference
    // Logic: If user selects specific months, show them. Else show all available in data or specific default?
    // The previous logic defaulted to Jul-Dec if empty. Let's keep it similar but based on data.

    const monthsOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    if (!monthlySalesData?.monthlySales) return []

    // Create map
    const monthlySalesMap: Record<string, number> = {}
    monthsOrder.forEach(m => monthlySalesMap[m] = 0)
    monthlySalesData.monthlySales.forEach(item => {
      monthlySalesMap[item.month] = item.sales
    })

    const currentYear = new Date().getFullYear().toString()
    const currentMonth = new Date().getMonth() // 0-11

    let defaultMonths: string[]

    if (selectedYear === currentYear) {
      if (currentMonth < 6) {
        // Jan-Jun
        defaultMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
      } else {
        // Jul-Dec
        defaultMonths = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
      }
    } else {
      // Past/Future years: Show All Months
      defaultMonths = monthsOrder
    }

    const monthsToShow = selectedMonths.length > 0
      ? selectedMonths.map(m => monthNames[m])
      : defaultMonths

    return monthsToShow.map(month => ({
      month,
      value: (monthlySalesMap[month] || 0) // Convert cents/PKR scaling? Verify if hook returns cents or units. 
      // The hook types say "sales: number // Sales in PKR". 
      // The previous code divided by 100: "value: monthlySalesMap[month] / 100".
      // Let's check hook implementation. The hook API usually returns standard units or cents.
      // If previous code was dividing by 100, "totalCents" was likely the source.
      // useMonthlySales hook returns "sales". Usually in analytics APIs "sales" is already in main currency unit or cents?
      // Let's assume the hook returns what we need. 
      // WAIT! The previous code: "monthlySalesMap[month] += order.totalCents || 0 ... value: monthlySalesMap[month] / 100"
      // So previous code expected Cents and converted to PKR.
      // The Hook useMonthlySales: "sales: number // Sales in PKR".
      // So if hook returns PKR, we DO NOT divide by 100.
      // Let's check BranchAdminDashboard: "value: monthlySalesMap[month] || 0" (NO DIVISION).
      // So for hook data, we DO NOT divide by 100.
    }))
  }, [selectedMonths, monthlySalesData])


  // ---------------- Yearly Sales Chart Data (from useYearlySales with yearlyChartYear) ----------------
  const { data: yearlySalesHookData, isLoading: isLoadingYearly } = useYearlySales(organizationId, branchId, Number(yearlyChartYear), groupId)

  const yearlySalesData = useMemo(() => {
    const monthsOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    if (!yearlySalesHookData?.monthlySales) return []

    // Map hook data to chart format
    // yearlySalesHookData.monthlySales has { month, sales }
    // We just need to ensure all months are present or just map what we have?
    // Spline chart usually expects ordered months.

    const monthlySalesMap: Record<string, number> = {}
    monthsOrder.forEach(m => monthlySalesMap[m] = 0)
    yearlySalesHookData.monthlySales.forEach(item => {
      monthlySalesMap[item.month] = item.sales
    })

    return monthsOrder.map(month => ({
      month,
      sales: monthlySalesMap[month] // Again, assume PKR
    }))
  }, [yearlySalesHookData])

  const average =
    yearlySalesData.filter(d => d.sales > 0).length > 0
      ? yearlySalesData.reduce((sum, item) => sum + item.sales, 0) / yearlySalesData.filter(d => d.sales > 0).length
      : 0

  // ---------------- Weekly Sales ----------------
  const today = new Date()
  const startDate = startOfDay(subDays(today, 6))
  const endDate = endOfDay(today)

  const buildWeeklySalesUrl = () => {
    const params = new URLSearchParams()
    params.set("status", "FULFILLED")
    params.set("startDate", startDate.toISOString())
    params.set("endDate", endDate.toISOString())
    if (organizationId) params.set("organizationId", organizationId)
    if (branchId) params.set("branchId", branchId)
    if (groupId && groupId !== "all") params.set("groupId", groupId)
    return `/api/v1/orders?${params.toString()}`
  }

  const { data: weeklySalesData, isLoading: isLoadingSales, error: salesError } = useSWR(buildWeeklySalesUrl(), fetcher, {
    refreshInterval: 60_000,
  })

  const weekDays = eachDayOfInterval({ start: startDate, end: endDate })
  const weeklyData = weekDays.map(day => {
    const dayKey = format(day, "yyyy-MM-dd")
    const dayData = Array.isArray(weeklySalesData) ? weeklySalesData.find(d => d.day === dayKey) : null
    return {
      day: format(day, "EEE"),
      ordersCount: dayData?.ordersCount ?? 0,
      totalSales: (dayData?.totalSales ?? 0) / 100,
    }
  })

  const totalWeekSales = weeklyData.reduce((sum, day) => sum + day.totalSales, 0)
  const totalWeekOrders = weeklyData.reduce((sum, day) => sum + day.ordersCount, 0)
  const salesData = weeklyData.map(day => ({ label: day.day, value: day.totalSales }))

  // ---------------- Other Orders ----------------
  const buildOrdersUrl = (params: Record<string, string | undefined>) => {
    const search = new URLSearchParams()
    if (params.status) search.set("status", params.status)
    if (params.from) search.set("from", params.from)
    if (organizationId) search.set("organizationId", organizationId)
    if (branchId) search.set("branchId", branchId)
    if (groupId && groupId !== "all") search.set("groupId", groupId)
    const qs = search.toString()
    return `/api/v1/orders${qs ? `?${qs}` : ""}`
  }

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const { data: todaysOrders } = useSWR<{ items: any[] }>(buildOrdersUrl({ from: startOfToday.toISOString() }), fetcher)
  const { data: approvedOrders } = useSWR<{ items: any[] }>(buildOrdersUrl({ status: "APPROVED" }), fetcher)

  // Filter out PENDING, REJECTED, and REFUNDED orders from today's metrics
  // Refunded orders (partial or full) are excluded entirely from GMV and order count
  const validTodaysOrders = (todaysOrders?.items || []).filter(o =>
    ['APPROVED', 'FULFILLED'].includes(o.status?.toUpperCase())
  )

  // Calculate GMV from non-refunded orders only
  const todaysGMVCents = validTodaysOrders.reduce((sum, o) => sum + (o.totalCents || 0), 0)
  const todaysGMV = formatPKR(todaysGMVCents / 100, { maximumFractionDigits: 0 })
  const approvedCount = approvedOrders?.items?.length || 0

  const scopeText = branchId ? selectedBranch?.name || `Branch #${branchId}` : organizationId ? selectedOrg?.name || `Organization #${organizationId}` : "All organizations & branches"
  const allBranchesSelected = !branchId

  // ---------------- JSX ----------------
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
              <h1 className="text-xl font-bold text-white">Super Admin Portal</h1>
              <p className="text-xs text-white/70 font-medium">Enterprise Overview • <span className="text-white">{scopeText}</span></p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></div>
              <span className="text-xs font-bold text-white uppercase tracking-wider">System Live</span>
            </div>
          </div>
        </div>
      </div>

      <NotificationRail className="bg-transparent border-0 shadow-none px-0" />

      {/* Top 4-Column KPI Grid - Only shown when all branches are selected */}
      {allBranchesSelected && (
        <div className="grid gap-6 md:grid-cols-2 animate-slide-down">
          <BankingKPICard
            icon={TrendingUp}
            title="Today's GMV"
            value={todaysGMV}
            gradient="from-emerald-500 to-teal-600"
            iconBg="text-emerald-600 bg-emerald-600"
            trend="up"
            trendValue="12.5%"
          />

          <BankingKPICard
            icon={Package}
            title="Today's Orders"
            value={validTodaysOrders.length}
            gradient="from-blue-500 to-indigo-600"
            iconBg="text-blue-600 bg-blue-600"
          />






        </div>
      )}

      {/* Main Analytics Grid - Yearly & Weekly */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Yearly Sales Chart */}
        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-slate-900/50 hover:shadow-md transition-shadow duration-300 bg-white dark:bg-slate-900 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Annual Sales Performance</h3>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Revenue Trends • {yearlyChartYear}</p>
                </div>
              </div>
              <YearPicker
                selectedYear={yearlyChartYear}
                onYearChange={setYearlyChartYear}
              />
            </div>
            {isLoadingYearly ? (
              <div className="h-[450px] flex items-center justify-center bg-slate-50/50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
                  <p className="text-sm text-slate-500 font-medium">Loading annual analytics...</p>
                </div>
              </div>
            ) : (
              <YearlySalesSplineChart yearlySalesData={yearlySalesData} avgSales={average} label="Sales" />
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
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Weekly Analytics</h3>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Last 7 Days Revenue</p>
                </div>
              </div>
            </div>
            {isLoadingSales ? (
              <div className="h-[450px] flex items-center justify-center bg-slate-50/50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mx-auto mb-3"></div>
                  <p className="text-sm text-slate-500 font-medium">Loading weekly data...</p>
                </div>
              </div>
            ) : (
              <TrendAreaChart data={salesData} label="Sales" />
            )}
          </CardContent>
        </Card>
      </div>


      {/* Month Picker & Bar Chart Section */}
      <Card className="border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-slate-900/50 overflow-hidden bg-white dark:bg-slate-900">
        <CardContent className="p-6">
          <div className="space-y-6">
            {/* Header with Picker Toggle */}
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-lg bg-blue-600 flex items-center justify-center">
                    <BarChart3 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Monthly Sales Analytics</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {selectedMonths.length > 0
                        ? `${selectedMonths.length} month${selectedMonths.length > 1 ? 's' : ''} • ${selectedYear}`
                        : selectedYear === new Date().getFullYear().toString()
                          ? (new Date().getMonth() < 6 ? `First Half (Jan-Jun) • ${selectedYear}` : `Second Half (Jul-Dec) • ${selectedYear}`)
                          : `All Months • ${selectedYear}`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Picker Toggle Button */}
              <div className="relative" ref={pickerRef}>
                <button
                  onClick={() => setShowPicker(!showPicker)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 dark:bg-blue-500 text-white font-semibold text-sm hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors border border-blue-700 dark:border-blue-600"
                >
                  <Calendar className="h-4 w-4" />
                  <span>Select Period</span>
                </button>

                {/* Dropdown Picker */}
                {showPicker && (
                  <div className="absolute right-0 top-full mt-2 z-50 animate-slide-down">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                      <MonthYearPicker
                        selectedYear={selectedYear}
                        selectedMonths={selectedMonths}
                        onYearChange={setSelectedYear}
                        onMonthsChange={setSelectedMonths}
                      />
                      <div className="p-3 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                        <button
                          onClick={() => setShowPicker(false)}
                          className="w-full px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
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
            <div className="min-h-[400px]">
              {isLoadingMonthly ? (
                <div className="flex items-center justify-center h-[400px]">
                  <div className="text-center space-y-3">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-500 mx-auto"></div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Loading sales data...</p>
                  </div>
                </div>
              ) : (
                <SalesBarChart data={barChartData} label="Sales" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation Tiles */}
      {/* <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-1 w-12 rounded-full bg-blue-600"></div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Admin Control Areas</h2>
        </div>
        <p className="text-sm text-slate-600">Quick access to configuration, users, inventory, orders, budgets, and system reports</p>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {navTiles.map(tile => {
            const Icon = tile.icon
            return (
              <Link key={tile.title} href={tile.href}>
                <Card className="group relative overflow-hidden border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-lg dark:hover:shadow-slate-900/50 transition-all duration-300 h-full bg-white dark:bg-slate-900">
                  <div className={`absolute inset-0 bg-gradient-to-br ${tile.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
                  <CardContent className="relative p-6 flex flex-col gap-4 h-full">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-white transition-colors mb-2">
                          {tile.title}
                        </h3>
                        <p className="text-xs text-slate-600 group-hover:text-white/90 transition-colors leading-relaxed">
                          {tile.description}
                        </p>
                      </div>
                      <div className={`flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br ${tile.gradient} text-white shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                        <Icon className="h-6 w-6" />
                      </div>
                    </div>
                    <div className="mt-auto pt-2 flex items-center gap-2 text-xs font-semibold text-slate-600 group-hover:text-white transition-colors">
                      <span>Open {tile.title}</span>
                      <ArrowUpRight className="h-3 w-3 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </section> */}
    </main>
  )
}