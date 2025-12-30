"use client"
import { useMemo, useState } from "react"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area } from "recharts"
import { KpiCard } from "@/components/ui/kpi-card"
import { SectionHeader } from "@/components/ui/section-header"
import { Card, CardContent } from "@/components/ui/card"
import { NotificationRail } from "@/components/notifications/notification-center"
import { TrendAreaChart, ComparisonBarChart } from "@/components/dashboard/charts"
import { useDashboardAnalytics, useWeeklySales, useYearlySales, useMonthlySales } from "@/lib/hooks/use-dashboard-analytics"
import { useAppContext } from "@/components/context/app-context"
import { MonthYearPicker } from "@/components/ui/MonthYearPicker"
import SalesBarChart from "@/components/dashboard/charts"
import { Calendar, BarChart3, TrendingUp, Building2, FileCheck, Wallet, ShoppingCart } from "lucide-react"

// Professional Banking Tooltip
const BankingTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null
  
  return (
    <div className="bg-white border-2 border-slate-200 rounded-lg p-3 shadow-lg">
      <p className="text-slate-600 text-xs font-semibold uppercase tracking-wide mb-1.5">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold text-slate-900">
          ₨{payload[0].value.toLocaleString()}
        </span>
      </div>
    </div>
  )
}

// Weekly Sales Bar Chart - Banking Style
const WeeklySalesBarChart = ({ data }: { data: { label: string; value: number }[] }) => {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 10 }}>
          <defs>
            <linearGradient id="bankingBar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1e40af" stopOpacity={1} />
              <stop offset="100%" stopColor="#1e3a8a" stopOpacity={0.95} />
            </linearGradient>
          </defs>
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="#cbd5e1" 
            strokeOpacity={0.5}
            vertical={false} 
          />
          <XAxis 
            dataKey="label" 
            tickLine={false} 
            axisLine={{ stroke: "#94a3b8", strokeWidth: 1 }} 
            tickMargin={12} 
            tick={{ fill: "#475569", fontWeight: 600, fontSize: 12 }}
          />
          <YAxis 
            allowDecimals={false} 
            axisLine={false}
            tickLine={false} 
            tick={{ fill: "#475569", fontWeight: 600, fontSize: 12 }}
            tickFormatter={(value) => `₨${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip 
            content={<BankingTooltip />} 
            cursor={{ fill: "rgba(30, 64, 175, 0.08)" }} 
          />
          <Bar
            dataKey="value"
            radius={[6, 6, 0, 0]}
            fill="url(#bankingBar)"
            animationDuration={1200}
            animationEasing="ease-in-out"
            maxBarSize={50}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// Yearly Sales Line Chart - Banking Style
const YearlySalesLineChart = ({ data }: { data: { month: string; sales: number }[] }) => {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 10 }}>
          <defs>
            <linearGradient id="yearlyBankingGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#059669" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#059669" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="#cbd5e1" 
            strokeOpacity={0.5}
            vertical={false} 
          />
          <XAxis 
            dataKey="month" 
            tickLine={false} 
            axisLine={{ stroke: "#94a3b8", strokeWidth: 1 }} 
            tickMargin={12} 
            tick={{ fill: "#475569", fontWeight: 600, fontSize: 11 }}
          />
          <YAxis 
            allowDecimals={false} 
            axisLine={false}
            tickLine={false} 
            tick={{ fill: "#475569", fontWeight: 600, fontSize: 12 }}
            tickFormatter={(value) => `₨${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip 
            content={<BankingTooltip />} 
            cursor={{ stroke: "#059669", strokeWidth: 2, strokeDasharray: "4 4" }} 
          />
          <Area
            type="monotone"
            dataKey="sales"
            stroke="#059669"
            strokeWidth={2.5}
            fill="url(#yearlyBankingGradient)"
            animationDuration={1200}
            animationEasing="ease-in-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

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
  const { data } = useDashboardAnalytics()
  const { data: weeklySalesData } = useWeeklySales(organizationId, branchId)
  const currentYear = new Date().getFullYear()
  const { data: yearlySalesData } = useYearlySales(organizationId, branchId, currentYear)
  
  const trendData = data?.gmvSeries ?? []
  const branchData = data?.branchSeries ?? []
  const branchesCount = data?.branchCount ?? 0
  const pendingApprovals = data?.pendingApprovals ?? 0
  const ordersThisMonth = data?.ordersThisMonth ?? 0
  
  // Monthly sales state
  const [selectedMonths, setSelectedMonths] = useState<string[]>([])
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString())
  const [showPicker, setShowPicker] = useState(false)
  const { data: monthlySalesData } = useMonthlySales(organizationId, branchId, Number(selectedYear))

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

  return (
    <main className="min-h-screen bg-slate-50 p-6 space-y-6">
      <div className="space-y-6">
        {/* Header - Banking Style */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
          <SectionHeader
            title="Head Office Dashboard"
            subtitle="Overview of branches, approvals, budgets and orders"
          />
        </div>

        <NotificationRail className="bg-white border border-slate-200 rounded-lg shadow-sm px-4" />

        {/* KPI Cards - Professional Banking Design */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {/* Branches Card */}
          <div className="group bg-white rounded-lg border-2 border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-blue-300 transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <div className="w-11 h-11 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-700" strokeWidth={2} />
              </div>
            </div>
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">My Branches</p>
            <p className="text-4xl font-bold text-slate-900 mb-1">{branchesCount}</p>
            <div className="h-0.5 w-12 bg-blue-600 mt-3"></div>
          </div>

          {/* Pending Approvals Card */}
          <div className="group bg-white rounded-lg border-2 border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-amber-300 transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <div className="w-11 h-11 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center">
                <FileCheck className="w-5 h-5 text-amber-700" strokeWidth={2} />
              </div>
            </div>
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Pending Approvals</p>
            <p className="text-4xl font-bold text-slate-900 mb-1">{pendingApprovals}</p>
            <div className="h-0.5 w-12 bg-amber-600 mt-3"></div>
          </div>

          {/* Monthly Budget Card */}
          <div className="group bg-white rounded-lg border-2 border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <div className="w-11 h-11 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-emerald-700" strokeWidth={2} />
              </div>
            </div>
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Monthly Budget</p>
            <p className="text-4xl font-bold text-slate-900 mb-1">PKR 45K</p>
            <div className="h-0.5 w-12 bg-emerald-600 mt-3"></div>
          </div>

          {/* Orders This Month Card */}
          <div className="group bg-white rounded-lg border-2 border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-violet-300 transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <div className="w-11 h-11 rounded-lg bg-violet-50 border border-violet-200 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-violet-700" strokeWidth={2} />
              </div>
            </div>
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Orders This Month</p>
            <p className="text-4xl font-bold text-slate-900 mb-1">{ordersThisMonth}</p>
            <div className="h-0.5 w-12 bg-violet-600 mt-3"></div>
          </div>
        </div>

        {/* Charts Grid - Weekly and Yearly Sales */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Yearly Sales Chart */}
          <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-emerald-700" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Yearly Sales Performance</h3>
                  {yearlySalesData && (
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Complete year overview for {yearlySalesData.year}
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            {yearlySalesData && (
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Total Sales</p>
                  <p className="text-xl font-bold text-slate-900">
                    ₨{yearlySalesData.totalSales.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Total Orders</p>
                  <p className="text-xl font-bold text-slate-900">{yearlySalesData.totalOrders.toLocaleString()}</p>
                </div>
              </div>
            )}
            
            {yearlySalesChartData.length > 0 ? (
              <YearlySalesLineChart data={yearlySalesChartData} />
            ) : (
              <div className="h-80 flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <div className="w-14 h-14 bg-slate-100 rounded-lg flex items-center justify-center mx-auto mb-3 border border-slate-200">
                    <Calendar className="w-7 h-7 text-slate-400" />
                  </div>
                  <p className="font-medium text-sm">Loading yearly sales data...</p>
                </div>
              </div>
            )}
          </div>

          {/* Weekly Sales Chart */}
          <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-blue-700" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Weekly Sales Performance</h3>
                  {weeklySalesData && (
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {new Date(weeklySalesData.weekStart).toLocaleDateString("en-US", { month: "short", day: "numeric" })} - {new Date(weeklySalesData.weekEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            {weeklySalesData && (
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Total Sales</p>
                  <p className="text-xl font-bold text-slate-900">
                    ₨{weeklySalesData.totalSales.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Total Orders</p>
                  <p className="text-xl font-bold text-slate-900">{weeklySalesData.totalOrders}</p>
                </div>
              </div>
            )}
            
            {weeklySalesChartData.length > 0 ? (
              <WeeklySalesBarChart data={weeklySalesChartData} />
            ) : (
              <div className="h-80 flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <div className="w-14 h-14 bg-slate-100 rounded-lg flex items-center justify-center mx-auto mb-3 border border-slate-200">
                    <TrendingUp className="w-7 h-7 text-slate-400" />
                  </div>
                  <p className="font-medium text-sm">Loading sales data...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Monthly Sales Bar Chart with Month Picker */}
        <Card className="border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-300 bg-white">
          <CardContent className="p-6">
            <div className="space-y-6">
              {/* Header with Picker Toggle */}
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center">
                      <BarChart3 className="w-5 h-5 text-indigo-700" strokeWidth={2} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Monthly Sales Analytics</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {selectedMonths.length > 0 
                          ? `${selectedMonths.length} month${selectedMonths.length > 1 ? 's' : ''} selected • ${selectedYear}`
                          : `All months • ${selectedYear}`}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Picker Toggle Button */}
                <div className="relative">
                  <button
                    onClick={() => setShowPicker(!showPicker)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition-colors border border-indigo-700 shadow-sm"
                  >
                    <Calendar className="h-4 w-4" />
                    <span>Select Period</span>
                  </button>
                  
                  {/* Dropdown Picker */}
                  {showPicker && (
                    <div className="absolute right-0 top-full mt-2 z-50">
                      <div className="bg-white rounded-lg shadow-xl border-2 border-slate-200 overflow-hidden">
                        <MonthYearPicker 
                          selectedYear={selectedYear}
                          selectedMonths={selectedMonths}
                          onYearChange={setSelectedYear}
                          onMonthsChange={setSelectedMonths}
                        />
                        <div className="p-3 bg-slate-50 border-t border-slate-200">
                          <button
                            onClick={() => setShowPicker(false)}
                            className="w-full px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
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
              <div className="min-h-[350px] bg-slate-50 rounded-lg p-4 border border-slate-200">
                {monthlyBarChartData.length > 0 ? (
                  <SalesBarChart data={monthlyBarChartData} />
                ) : (
                  <div className="flex items-center justify-center h-[350px]">
                    <div className="text-center space-y-3">
                      <div className="w-14 h-14 bg-slate-100 rounded-lg flex items-center justify-center mx-auto border border-slate-200">
                        <BarChart3 className="w-7 h-7 text-slate-400" />
                      </div>
                      <p className="text-sm text-slate-500 font-medium">Loading monthly sales data...</p>
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