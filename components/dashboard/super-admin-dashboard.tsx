"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useOrganizations, useBranches, useUsers } from "@/lib/hooks/use-api"
import { KpiCard } from "@/components/ui/kpi-card"
import { Card, CardContent } from "@/components/ui/card"
import MonthYearPicker from "@/components/ui/MonthYearPicker"
import useSWR from "swr"
import { NotificationRail } from "@/components/notifications/notification-center"
import { formatPKR } from "@/lib/utils"
import { Building2, GitBranch, Users, Package, Warehouse, Wallet, BarChart3, ShieldCheck, TrendingUp, ArrowUpRight, Sparkles, Calendar } from "lucide-react"
import { TrendAreaChart, YearlySalesSplineChart } from "@/components/dashboard/charts"
import SalesBarChart from "@/components/dashboard/charts"
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
  { title: "Organizations", description: "Configure groups and parent companies.", href: "/organizations", icon: Building2, gradient: "from-violet-500 to-purple-600" },
  { title: "Branches", description: "Manage branches and assignments.", href: "/branches", icon: GitBranch, gradient: "from-blue-500 to-cyan-600" },
  { title: "Users & Roles", description: "Administer users and access levels.", href: "/users", icon: Users, gradient: "from-emerald-500 to-teal-600" },
  { title: "Global Inventory", description: "Master product catalog across orgs.", href: "/global-inventory", icon: Warehouse, gradient: "from-orange-500 to-red-600" },
  { title: "Orders", description: "Monitor and override orders.", href: "/orders", icon: Package, gradient: "from-pink-500 to-rose-600" },
  { title: "Budgets", description: "Control branch spending limits.", href: "/budgets", icon: Wallet, gradient: "from-amber-500 to-yellow-600" },
  { title: "Reports", description: "Sales, refunds, and stock insights.", href: "/reports", icon: BarChart3, gradient: "from-indigo-500 to-blue-600" },
  { title: "System Settings", description: "Permissions, audit, and advanced config.", href: "/admin", icon: ShieldCheck, gradient: "from-slate-500 to-gray-600" },
]

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function SuperAdminDashboard() {
  const [selectedMonths, setSelectedMonths] = useState<string[]>([])
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString())
  const [showPicker, setShowPicker] = useState(false)
  const { organizationId, branchId } = useAppContext()

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

  // ---------------- Bar Chart Data (Based on Selected Months AND Year) ----------------
  const yearlyUrl = `/api/v1/orders?mode=monthlySales${organizationId ? `&organizationId=${organizationId}` : ""}${branchId ? `&branchId=${branchId}` : ""}`
  const { data: yearlySalesRaw, isLoading: isLoadingYearly, error: yearlyError } = useSWR(yearlyUrl, fetcher, { refreshInterval: 60_000 })

  // Create bar chart data based on selected months AND year
  const barChartData = useMemo(() => {
    const monthsOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlySalesMap: Record<string, number> = {};
    
    // Initialize all months to 0
    monthsOrder.forEach(m => monthlySalesMap[m] = 0);

    // Calculate sales for each month from API data - FILTER BY SELECTED YEAR
    (yearlySalesRaw?.items || []).forEach((order: any) => {
      if (!order.fulfilledAt || order.status !== "fulfilled") return
      
      const date = parseISO(order.fulfilledAt)
      const orderYear = getYear(date).toString()
      
      // Only process orders from the selected year
      if (orderYear !== selectedYear) return
      
      const month = format(date, "MMM") 
      if (monthlySalesMap.hasOwnProperty(month)) {
        monthlySalesMap[month] += order.totalCents || 0
      }
    })

    // If no months selected, show last 6 months (Jul-Dec)
    const defaultMonths = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    const monthsToShow = selectedMonths.length > 0 
      ? selectedMonths.map(m => monthNames[m])
      : defaultMonths

    // Filter and format data for selected months
    return monthsToShow.map(month => ({
      month,
      value: monthlySalesMap[month] / 100
    }))
  }, [selectedMonths, selectedYear, yearlySalesRaw])

  // ---------------- Yearly Sales Chart Data (ALSO FILTERED BY YEAR) ----------------
  const monthsOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
  const yearlySalesData = useMemo(() => {
    const monthlySalesMap: Record<string, number> = {};
    monthsOrder.forEach(m => monthlySalesMap[m] = 0);

    // Filter by selected year
    (yearlySalesRaw?.items || []).forEach((order: any) => {
      if (!order.fulfilledAt || order.status !== "fulfilled") return
      
      const date = parseISO(order.fulfilledAt)
      const orderYear = getYear(date).toString()
      
      // Only process orders from the selected year
      // if (orderYear !== selectedYear) return
      
      const month = format(date, "MMM") 
      if (monthlySalesMap.hasOwnProperty(month)) {
        monthlySalesMap[month] += order.totalCents || 0
      }
    })

    return monthsOrder.map(month => ({
      month,
      sales: monthlySalesMap[month] / 100
    }))
  }, [selectedYear, yearlySalesRaw])
  
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
    const qs = search.toString()
    return `/api/v1/orders${qs ? `?${qs}` : ""}`
  }

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const { data: todaysOrders } = useSWR<{ items: any[] }>(buildOrdersUrl({ from: startOfToday.toISOString() }), fetcher)
  const { data: pendingOrders } = useSWR<{ items: any[] }>(buildOrdersUrl({ status: "PENDING" }), fetcher)

  const todaysGMVCents = (todaysOrders?.items || []).reduce((sum, o) => sum + (o.totalCents || 0), 0)
  const todaysGMV = formatPKR(todaysGMVCents / 100, { maximumFractionDigits: 0 })
  const pendingCount = pendingOrders?.items?.length || 0

  const scopeText = branchId ? selectedBranch?.name || `Branch #${branchId}` : organizationId ? selectedOrg?.name || `Organization #${organizationId}` : "All organizations & branches"

  // ---------------- JSX ----------------
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 p-4 md:p-6 space-y-6">
      {/* Header Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-6 md:p-8 shadow-2xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-20"></div>
        
        <div className="relative flex flex-col lg:flex-row items-start justify-between gap-6">
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm ring-2 ring-white/30">
                <Sparkles className="h-6 w-6 text-white animate-pulse" />
              </div>
              <div>
                <p className="text-xs font-semibold tracking-[0.2em] text-white/70 uppercase">Super Admin Portal</p>
                <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Command Center</h1>
              </div>
            </div>
            <p className="text-sm md:text-base text-white/90 max-w-xl">
              System-wide overview and controls for <span className="font-semibold">{scopeText}</span>
            </p>
          </div>

          <div className="flex flex-col gap-3 w-full lg:w-auto">
            <div className="inline-flex items-center gap-2 rounded-2xl bg-white/15 backdrop-blur-md px-5 py-2 ring-1 ring-white/20">
              <span className="text-xs font-medium text-white/80 uppercase tracking-wider">Active Scope</span>
              <span className="rounded-xl bg-white/25 px-3 py-1 text-xs font-bold text-white truncate max-w-[200px]">{scopeText}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="group rounded-2xl bg-white/10 backdrop-blur-md px-4 py-3 ring-1 ring-white/20 hover:bg-white/20 transition-all duration-300">
                <p className="text-[10px] uppercase tracking-wider text-white/70 font-semibold">Organizations</p>
                <p className="text-2xl font-bold text-white mt-1">{orgsCount}</p>
              </div>
              <div className="group rounded-2xl bg-white/10 backdrop-blur-md px-4 py-3 ring-1 ring-white/20 hover:bg-white/20 transition-all duration-300">
                <p className="text-[10px] uppercase tracking-wider text-white/70 font-semibold">Branches</p>
                <p className="text-2xl font-bold text-white mt-1">{branchesCount}</p>
              </div>
              <div className="group rounded-2xl bg-white/10 backdrop-blur-md px-4 py-3 ring-1 ring-white/20 hover:bg-white/20 transition-all duration-300">
                <p className="text-[10px] uppercase tracking-wider text-white/70 font-semibold">Active Users</p>
                <p className="text-2xl font-bold text-white mt-1">{usersCount}</p>
              </div>
              <div className="group rounded-2xl bg-white/10 backdrop-blur-md px-4 py-3 ring-1 ring-white/20 hover:bg-white/20 transition-all duration-300">
                <p className="text-[10px] uppercase tracking-wider text-white/70 font-semibold">Pending</p>
                <p className="text-2xl font-bold text-white mt-1">{pendingCount}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <NotificationRail className="bg-transparent border-0 shadow-none px-0" />

      {/* Month Picker & Bar Chart Section */}
      <Card className="border-0 shadow-xl overflow-hidden bg-white/80 backdrop-blur-sm">
        <CardContent className="p-4 md:p-6">
          <div className="space-y-6">
            {/* Header with Picker Toggle */}
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                    <BarChart3 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl md:text-2xl font-bold text-slate-900">Monthly Sales Analytics</h3>
                    <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                      {selectedMonths.length > 0 
                        ? `${selectedMonths.length} month${selectedMonths.length > 1 ? 's' : ''} • ${selectedYear}`
                        : `Last 6 months (Jul-Dec) • ${selectedYear}`}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Picker Toggle Button */}
              <div className="relative">
                <button
                  onClick={() => setShowPicker(!showPicker)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold text-sm hover:from-indigo-600 hover:to-purple-600 transition-all shadow-lg hover:shadow-xl"
                >
                  <Calendar className="h-4 w-4" />
                  <span>Select Period</span>
                </button>
                
                {/* Dropdown Picker */}
                {showPicker && (
                  <div className="absolute right-0 top-full mt-2 z-50 animate-in slide-in-from-top-2 duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl border-2 border-indigo-100 overflow-hidden">
                      <MonthYearPicker 
                        selectedYear={selectedYear}
                        selectedMonths={selectedMonths}
                        onYearChange={setSelectedYear}
                        onMonthsChange={setSelectedMonths}
                      />
                      <div className="p-3 bg-slate-50 border-t">
                        <button
                          onClick={() => setShowPicker(false)}
                          className="w-full px-4 py-2 rounded-lg bg-indigo-500 text-white text-sm font-semibold hover:bg-indigo-600 transition-colors"
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
            <div className="min-h-[350px] bg-white rounded-2xl p-4 shadow-inner">
              {isLoadingYearly ? (
                <div className="flex items-center justify-center h-[350px]">
                  <div className="text-center space-y-3">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="text-sm text-muted-foreground font-medium">Loading sales data...</p>
                  </div>
                </div>
              ) : yearlyError ? (
                <div className="flex items-center justify-center h-[350px]">
                  <div className="text-center space-y-2">
                    <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                      <span className="text-2xl">⚠️</span>
                    </div>
                    <p className="text-sm text-red-600 font-medium">Error loading sales data</p>
                  </div>
                </div>
              ) : (
                <SalesBarChart data={barChartData} />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid gap-4 md:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 md:p-6 shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/80">Today's GMV</p>
              <TrendingUp className="h-5 w-5 text-white/80" />
            </div>
            <p className="text-2xl md:text-3xl font-bold text-white mb-1">{todaysGMV}</p>
            <p className="text-xs text-white/70">Gross Merchandise Value</p>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 p-5 md:p-6 shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/80">Today's Orders</p>
              <Package className="h-5 w-5 text-white/80" />
            </div>
            <p className="text-2xl md:text-3xl font-bold text-white mb-1">{todaysOrders?.items?.length || 0}</p>
            <p className="text-xs text-white/70">Total orders today</p>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-500 to-pink-600 p-5 md:p-6 shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/80">Week's Sales</p>
              <BarChart3 className="h-5 w-5 text-white/80" />
            </div>
            <p className="text-2xl md:text-3xl font-bold text-white mb-1">{formatPKR(totalWeekSales, { maximumFractionDigits: 0 })}</p>
            <p className="text-xs text-white/70">Last 7 days revenue</p>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 to-red-600 p-5 md:p-6 shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/80">Week's Orders</p>
              <TrendingUp className="h-5 w-5 text-white/80" />
            </div>
            <p className="text-2xl md:text-3xl font-bold text-white mb-1">{totalWeekOrders}</p>
            <p className="text-xs text-white/70">Weekly order count</p>
          </div>
        </div>
      </div>
       
      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Yearly Sales */}
        <Card className="lg:col-span-2 border-0 shadow-xl overflow-hidden bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4 md:p-6">
            {isLoadingYearly ? (
              <div className="flex items-center justify-center h-96">
                <div className="text-center space-y-3">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                  <p className="text-sm text-muted-foreground">Loading yearly sales...</p>
                </div>
              </div>
            ) : yearlyError ? (
              <div className="flex items-center justify-center h-96 text-sm text-red-600">Error loading yearly sales</div>
            ) : (
              <YearlySalesSplineChart yearlySalesData={yearlySalesData} avgSales={average} />
            )}
          </CardContent>
        </Card>

        {/* Weekly Sales */}
        <Card className="border-0 shadow-xl overflow-hidden bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4 md:p-6">
            <div className="mb-6 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <div className="text-base md:text-lg font-bold text-slate-900">Weekly Sales Trend</div>
              </div>
              <div className="text-xs text-muted-foreground">Last 7 days • {scopeText}</div>
              {!isLoadingSales && !salesError && (
                <div className="flex items-baseline gap-2 pt-2">
                  <div className="text-xl md:text-2xl font-bold text-emerald-600">{formatPKR(totalWeekSales, { maximumFractionDigits: 0 })}</div>
                  <div className="text-xs text-muted-foreground">total revenue</div>
                </div>
              )}
            </div>
            {isLoadingSales ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center space-y-3">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mx-auto"></div>
                  <p className="text-sm text-muted-foreground">Loading sales data...</p>
                </div>
              </div>
            ) : salesError ? (
              <div className="flex items-center justify-center h-64 text-sm text-red-600">Error loading sales data</div>
            ) : (
              <TrendAreaChart data={salesData} />
            )}
          </CardContent>
        </Card>
      </div>
      {/* Navigation Tiles */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-1 w-12 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"></div>
          <h2 className="text-xl font-bold text-slate-900">Admin Control Areas</h2>
        </div>
        <p className="text-sm text-muted-foreground">Quick access to configuration, users, inventory, orders, budgets, and system reports</p>
        
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {navTiles.map(tile => {
            const Icon = tile.icon
            return (
              <Link key={tile.title} href={tile.href}>
                <Card className="group relative overflow-hidden border-2 border-slate-100 hover:border-transparent hover:shadow-2xl transition-all duration-300 hover:scale-105 h-full">
                  <div className={`absolute inset-0 bg-gradient-to-br ${tile.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
                  <CardContent className="relative p-6 flex flex-col gap-4 h-full">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h3 className="text-base font-bold text-slate-900 group-hover:text-white transition-colors mb-2">
                          {tile.title}
                        </h3>
                        <p className="text-xs text-muted-foreground group-hover:text-white/80 transition-colors leading-relaxed">
                          {tile.description}
                        </p>
                      </div>
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${tile.gradient} text-white shadow-lg group-hover:scale-110 group-hover:rotate-6 transition-all duration-300`}>
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
      </section>
    </main>
  )
}