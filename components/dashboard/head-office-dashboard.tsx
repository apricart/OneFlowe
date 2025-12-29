"use client"
import { useMemo } from "react"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Area, AreaChart } from "recharts"
import { Building2, AlertCircle, ShoppingCart, TrendingUp, Calendar, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { NotificationRail } from "@/components/notifications/notification-center"
import { useDashboardAnalytics, useWeeklySales, useYearlySales } from "@/lib/hooks/use-dashboard-analytics"
import { useAppContext } from "@/components/context/app-context"

// Premium Chart Tooltip
const PremiumTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null
  
  return (
    <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-xl p-4 shadow-2xl">
      <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-white">
          ₨{payload[0].value.toLocaleString()}
        </span>
      </div>
    </div>
  )
}

// Weekly Sales Bar Chart with Premium Design
const WeeklySalesBarChart = ({ data }: { data: { label: string; value: number }[] }) => {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 10 }}>
          <defs>
            <linearGradient id="premiumBar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity={1} />
              <stop offset="100%" stopColor="#0891b2" stopOpacity={0.8} />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="#e2e8f0" 
            strokeOpacity={0.3}
            vertical={false} 
          />
          <XAxis 
            dataKey="label" 
            tickLine={false} 
            axisLine={{ stroke: "#cbd5e1", strokeWidth: 1 }} 
            tickMargin={12} 
            tick={{ fill: "#64748b", fontWeight: 600, fontSize: 13 }}
          />
          <YAxis 
            allowDecimals={false} 
            axisLine={false}
            tickLine={false} 
            tick={{ fill: "#64748b", fontWeight: 600, fontSize: 13 }}
            tickFormatter={(value) => `₨${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip 
            content={<PremiumTooltip />} 
            cursor={{ fill: "rgba(6, 182, 212, 0.1)", radius: 8 }} 
          />
          <Bar
            dataKey="value"
            radius={[10, 10, 0, 0]}
            fill="url(#premiumBar)"
            filter="url(#glow)"
            animationDuration={2000}
            animationEasing="ease-out"
            maxBarSize={60}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// Revenue Trend Chart
const RevenueTrendChart = ({ data }: any) => {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 10 }}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="#e2e8f0" 
            strokeOpacity={0.3}
            vertical={false} 
          />
          <XAxis 
            dataKey="date" 
            tickLine={false} 
            axisLine={{ stroke: "#cbd5e1", strokeWidth: 1 }} 
            tickMargin={12} 
            tick={{ fill: "#64748b", fontWeight: 600, fontSize: 13 }}
          />
          <YAxis 
            allowDecimals={false} 
            axisLine={false}
            tickLine={false} 
            tick={{ fill: "#64748b", fontWeight: 600, fontSize: 13 }}
            tickFormatter={(value) => `₨${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<PremiumTooltip />} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#8b5cf6"
            strokeWidth={3}
            fill="url(#revenueGradient)"
            animationDuration={2000}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// Yearly Sales Line Chart Component (Slim Chart)
const YearlySalesLineChart = ({ data }: { data: { month: string; sales: number }[] }) => {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 10 }}>
          <defs>
            <linearGradient id="yearlyLineGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
            </linearGradient>
            <filter id="yearlyLineGlow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="#e2e8f0" 
            strokeOpacity={0.3}
            vertical={false} 
          />
          <XAxis 
            dataKey="month" 
            tickLine={false} 
            axisLine={{ stroke: "#cbd5e1", strokeWidth: 1 }} 
            tickMargin={12} 
            tick={{ fill: "#64748b", fontWeight: 600, fontSize: 12 }}
          />
          <YAxis 
            allowDecimals={false} 
            axisLine={false}
            tickLine={false} 
            tick={{ fill: "#64748b", fontWeight: 600, fontSize: 13 }}
            tickFormatter={(value) => `₨${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip 
            content={<PremiumTooltip />} 
            cursor={{ stroke: "#10b981", strokeWidth: 2, strokeDasharray: "5 5" }} 
          />
          <Area
            type="monotone"
            dataKey="sales"
            stroke="#10b981"
            strokeWidth={3}
            fill="url(#yearlyLineGradient)"
            animationDuration={2000}
            animationEasing="ease-out"
            filter="url(#yearlyLineGlow)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// Premium KPI Card Component
const PremiumKPICard = ({ 
  icon: Icon, 
  title, 
  value, 
  trend, 
  trendValue,
  gradient,
  iconBg
}: any) => {
  const isPositive = trend === "up"
  
  return (
    <div className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-[1px] hover:scale-[1.02] transition-all duration-500`}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="relative bg-white rounded-2xl p-6 h-full">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-slate-50 to-transparent rounded-full -mr-16 -mt-16 opacity-50" />
        
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-6">
            <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${iconBg} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
              <Icon className="w-7 h-7 text-white" strokeWidth={2.5} />
            </div>
            
            {trend && (
              <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full ${isPositive ? 'bg-emerald-50' : 'bg-red-50'}`}>
                {isPositive ? (
                  <ArrowUpRight className={`w-4 h-4 ${isPositive ? 'text-emerald-600' : 'text-red-600'}`} />
                ) : (
                  <ArrowDownRight className={`w-4 h-4 ${isPositive ? 'text-emerald-600' : 'text-red-600'}`} />
                )}
                <span className={`text-xs font-bold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                  {trendValue}
                </span>
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
              {title}
            </p>
            <p className="text-4xl font-bold text-slate-900 tracking-tight">
              {value}
            </p>
          </div>
          
          {/* Progress indicator */}
          <div className="mt-6 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className={`h-full bg-gradient-to-r ${gradient} rounded-full transition-all duration-1000 group-hover:w-full`}
              style={{ width: '60%' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export function HeadOfficeDashboard() {
  const { organizationId, branchId } = useAppContext()
  const { data } = useDashboardAnalytics()
  const { data: weeklySalesData } = useWeeklySales(organizationId, branchId)
  const currentYear = new Date().getFullYear()
  const { data: yearlySalesData } = useYearlySales(organizationId, branchId, currentYear)
  
  const trendData = data?.gmvSeries ?? []
  const branchesCount = data?.branchCount ?? 0
  const pendingApprovals = data?.pendingApprovals ?? 0
  const ordersThisMonth = data?.ordersThisMonth ?? 0

  const weeklySalesChartData = useMemo(() => {
    if (!weeklySalesData?.dailySales) return []
    return weeklySalesData.dailySales.map(day => ({
      label: day.day,
      value: day.sales,
    }))
  }, [weeklySalesData])

  const yearlySalesChartData = useMemo(() => {
    if (!yearlySalesData?.monthlySales) return []
    return yearlySalesData.monthlySales.map(month => ({
      month: month.month,
      sales: month.sales,
    }))
  }, [yearlySalesData])

  // Calculate average revenue from trend data
  const averageRevenue = useMemo(() => {
    if (!trendData.length) return 0
    const sum = trendData.reduce((acc, curr) => acc + curr.value, 0)
    return Math.round(sum / trendData.length / 1000)
  }, [trendData])

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20">
      {/* Sophisticated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-cyan-200/30 to-blue-300/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-gradient-to-br from-purple-200/30 to-pink-300/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute -bottom-40 right-1/3 w-96 h-96 bg-gradient-to-br from-amber-200/20 to-orange-300/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '4s' }} />
        
        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      <div className="relative z-10 p-8 space-y-8 max-w-[1600px] mx-auto">
        {/* Premium Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-8 shadow-2xl border border-slate-700/50">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40" />
          
          <div className="relative flex items-center justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg">
                  <Building2 className="w-6 h-6 text-white" strokeWidth={2.5} />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white tracking-tight">
                    Head Office Dashboard
                  </h1>
                  <p className="text-slate-400 text-sm font-medium mt-0.5">
                    Real-time analytics and business intelligence
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="px-5 py-2.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
                <div className="flex items-center gap-2 text-white">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm font-semibold">
                    {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </div>
              
              <div className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer hover:scale-105">
                <span className="text-sm font-bold text-white">View Reports</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notification Rail */}
        <NotificationRail className="bg-white/90 backdrop-blur-sm border border-slate-200/60 rounded-2xl shadow-lg px-4" />

        {/* Premium KPI Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <PremiumKPICard
            icon={Building2}
            title="Active Branches"
            value={branchesCount}
           
            gradient="from-cyan-400 to-blue-600"
            iconBg="from-cyan-400 to-blue-600"
          />
          
          <PremiumKPICard
            icon={AlertCircle}
            title="Pending Approvals"
            value={pendingApprovals}
          
            gradient="from-amber-400 to-orange-600"
            iconBg="from-amber-400 to-orange-600"
          />
          
          <PremiumKPICard
            icon={ShoppingCart}
            title="Orders This Month"
            value={ordersThisMonth.toLocaleString()}
            gradient="from-purple-500 to-pink-600"
            iconBg="from-purple-500 to-pink-600"
          />
        </div>

        {/* Charts Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Yearly Sales Chart */}
          <div className="group relative overflow-hidden rounded-3xl bg-white p-8 shadow-xl border border-slate-200/60 hover:shadow-2xl transition-all duration-500">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-emerald-50 to-transparent rounded-full -mr-32 -mt-32 opacity-50" />
            
            <div className="relative">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-white" strokeWidth={2.5} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">Yearly Sales Performance</h3>
                  </div>
                  {yearlySalesData && (
                    <p className="text-sm text-slate-500 font-medium ml-13">
                      Complete year overview for {yearlySalesData.year}
                    </p>
                  )}
                </div>
              </div>
              
              {yearlySalesData && (
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-100">
                    <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-1">Total Sales</p>
                    <p className="text-2xl font-bold text-emerald-900">
                      ₨{yearlySalesData.totalSales.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100">
                    <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-1">Total Orders</p>
                    <p className="text-2xl font-bold text-green-900">{yearlySalesData.totalOrders.toLocaleString()}</p>
                  </div>
                </div>
              )}
              
              {yearlySalesChartData.length > 0 ? (
                <YearlySalesLineChart data={yearlySalesChartData} />
              ) : (
                <div className="h-80 flex items-center justify-center text-slate-400">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Calendar className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="font-medium">Loading yearly sales data...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Weekly Sales Chart */}
          <div className="group relative overflow-hidden rounded-3xl bg-white p-8 shadow-xl border border-slate-200/60 hover:shadow-2xl transition-all duration-500">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-cyan-50 to-transparent rounded-full -mr-32 -mt-32 opacity-50" />
            
            <div className="relative">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-white" strokeWidth={2.5} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">Weekly Sales Performance</h3>
                  </div>
                  {weeklySalesData && (
                    <p className="text-sm text-slate-500 font-medium ml-13">
                      {new Date(weeklySalesData.weekStart).toLocaleDateString("en-US", { month: "short", day: "numeric" })} - {new Date(weeklySalesData.weekEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  )}
                </div>
              </div>
              
              {weeklySalesData && (
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-100">
                    <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-1">Total Sales</p>
                    <p className="text-2xl font-bold text-emerald-900">
                      ₨{weeklySalesData.totalSales.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100">
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-1">Total Orders</p>
                    <p className="text-2xl font-bold text-blue-900">{weeklySalesData.totalOrders}</p>
                  </div>
                </div>
              )}
              
              {weeklySalesChartData.length > 0 ? (
                <WeeklySalesBarChart data={weeklySalesChartData} />
              ) : (
                <div className="h-80 flex items-center justify-center text-slate-400">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <TrendingUp className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="font-medium">Loading sales data...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

        
             
             
        </div>
      </div>
    </main>
  )
}