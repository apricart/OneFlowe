"use client"

import { useMemo, useEffect, useState } from "react"
import { useTheme } from "next-themes"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  BarChart,
  Bar,
  LabelList,
  Cell,
} from "recharts"
import { TrendingUp, BarChart3, DollarSign, Activity, Award } from "lucide-react"

type Props = {
  data: {
    month: string
    value: number
  }[]
}

const barColors = [
  "#1e40af", "#1d4ed8", "#2563eb", "#3b82f6",
  "#60a5fa", "#93c5fd", "#1e3a8a", "#1e40af",
  "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd"
]

const barColorsDark = [
  "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8",
  "#1e40af", "#1e3a8a", "#60a5fa", "#3b82f6",
  "#2563eb", "#1d4ed8", "#1e40af", "#1e3a8a"
]

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl">
      <div className="bg-slate-50 dark:bg-slate-900 px-4 py-2 border-b border-slate-200 dark:border-slate-700">
        <p className="font-semibold text-slate-700 dark:text-slate-300 text-xs">{payload[0].payload.month}</p>
      </div>
      <div className="px-4 py-3">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Revenue</p>
        <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
          ₨{payload[0].value.toLocaleString()}
        </p>
      </div>
    </div>
  )
}

type TrendPoint = { label: string; value: number }
type ChartDatum = { label: string; value: number }

const currencyFormatter = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  maximumFractionDigits: 0,
})

// ----------------- Yearly Sales Spline Chart -----------------
export type SalesData = { month: string; sales: number }
export type YearlySalesSplineChartProps = {
  yearlySalesData: SalesData[]
  avgSales: number
}

export function YearlySalesSplineChart({ yearlySalesData, avgSales }: YearlySalesSplineChartProps) {
  const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
  const totalSales = yearlySalesData.reduce((sum, item) => sum + item.sales, 0)
  const peakMonth = yearlySalesData.reduce((max, item) => item.sales > max.sales ? item : max, yearlySalesData[0])
  
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm dark:shadow-slate-900/50 overflow-hidden">
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-slide-in {
          animation: slideIn 0.4s ease-out;
        }
        .animate-fade-in {
          animation: fadeIn 0.5s ease-out;
        }
      `}</style>

      {/* Header */}
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Annual Revenue Performance
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Fiscal Year Overview
              </p>
            </div>
          </div>
          <div className="bg-blue-50 px-3 py-1.5 rounded-md border border-blue-100">
            <p className="text-xs text-blue-700 font-semibold">Active</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-4 mb-6 animate-slide-in">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-blue-600 dark:bg-blue-500 p-1.5 rounded">
                <DollarSign className="h-3.5 w-3.5 text-white" />
              </div>
              <p className="text-xs font-semibold text-blue-900 dark:text-blue-300 uppercase tracking-wide">
                Total Revenue
              </p>
            </div>
            <p className="text-2xl font-bold text-blue-900 dark:text-blue-200 mb-1">
              ₨{totalSales.toLocaleString()}
            </p>
            <div className="w-full h-1 bg-blue-200 dark:bg-blue-900/50 rounded-full overflow-hidden">
              <div className="w-full h-full bg-blue-600 dark:bg-blue-500 rounded-full"></div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/30 dark:to-indigo-800/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-indigo-600 dark:bg-indigo-500 p-1.5 rounded">
                <Activity className="h-3.5 w-3.5 text-white" />
              </div>
              <p className="text-xs font-semibold text-indigo-900 dark:text-indigo-300 uppercase tracking-wide">
                Average
              </p>
            </div>
            <p className="text-2xl font-bold text-indigo-900 dark:text-indigo-200 mb-1">
              ₨{Math.round(avgSales).toLocaleString()}
            </p>
            <div className="w-full h-1 bg-indigo-200 dark:bg-indigo-900/50 rounded-full overflow-hidden">
              <div className="w-3/4 h-full bg-indigo-600 dark:bg-indigo-500 rounded-full"></div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-emerald-600 dark:bg-emerald-500 p-1.5 rounded">
                <Award className="h-3.5 w-3.5 text-white" />
              </div>
              <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-300 uppercase tracking-wide">
                Peak Period
              </p>
            </div>
            <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-200 mb-1">
              {peakMonth.month}
            </p>
            <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
              ₨{peakMonth.sales.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Chart Container */}
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full"></div>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Performance Trend</span>
          </div>
          
          <div className="h-[380px] bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={yearlySalesData}
                margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
              >
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="salesGradientDark" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.1} />
                  </linearGradient>
                </defs>

                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke={isDark ? "#475569" : "#e2e8f0"} 
                  vertical={false}
                />
                <XAxis 
                  dataKey="month" 
                  tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontWeight: 600, fontSize: 11 }}
                  axisLine={{ stroke: isDark ? "#475569" : "#cbd5e1", strokeWidth: 1 }}
                  tickLine={false}
                  dy={5}
                />
                <YAxis
                  tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontWeight: 600, fontSize: 11 }}
                  tickFormatter={(value) => `₨${value/1000}k`}
                  axisLine={{ stroke: isDark ? "#475569" : "#cbd5e1", strokeWidth: 1 }}
                  tickLine={false}
                  dx={-5}
                />

                <Tooltip 
                  contentStyle={{
                    background: isDark ? "#1e293b" : "white",
                    borderRadius: "8px",
                    border: isDark ? "1px solid #475569" : "1px solid #e2e8f0",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                    padding: "8px 12px",
                  }}
                  labelStyle={{ 
                    color: isDark ? "#cbd5e1" : "#334155", 
                    fontWeight: "600",
                    fontSize: "12px",
                    marginBottom: "4px"
                  }}
                  formatter={(value: number) => [`₨${value.toLocaleString()}`, "Revenue"]}
                />

                <ReferenceLine 
                  y={avgSales} 
                  label={{ 
                    value: `Avg: ₨${Math.round(avgSales).toLocaleString()}`, 
                    position: "right",
                    fill: isDark ? "#fbbf24" : "#f59e0b",
                    fontWeight: "600",
                    fontSize: 10
                  }} 
                  stroke={isDark ? "#fbbf24" : "#f59e0b"} 
                  strokeWidth={1.5}
                  strokeDasharray="5 5"
                />

                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke={isDark ? "#60a5fa" : "#2563eb"}
                  strokeWidth={2.5}
                  fill={isDark ? "url(#salesGradientDark)" : "url(#salesGradient)"}
                  dot={{ 
                    r: 4, 
                    fill: isDark ? "#1e293b" : "#ffffff",
                    stroke: isDark ? "#60a5fa" : "#2563eb", 
                    strokeWidth: 2
                  }}
                  activeDot={{ 
                    r: 6,
                    fill: isDark ? "#60a5fa" : "#2563eb",
                    stroke: "#ffffff",
                    strokeWidth: 2
                  }}
                  animationDuration={1200}
                  animationEasing="ease-in-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}

// ----------------- Chart Tooltip Component -----------------
export function ChartTooltip({
  active,
  payload,
  label,
  prefix = "",
}: {
  active?: boolean
  payload?: any[]
  label?: string
  prefix?: "currency" | "count" | ""
}) {
  if (!active || !payload?.length) return null
  const value = payload[0].value as number
  const formatted =
    prefix === "currency"
      ? currencyFormatter.format(value)
      : prefix === "count"
      ? `${value.toLocaleString()} orders`
      : value.toLocaleString()

  const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
  
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden">
      <div className="bg-slate-50 dark:bg-slate-900 px-4 py-2 border-b border-slate-200 dark:border-slate-700">
        <p className="font-semibold text-slate-700 dark:text-slate-300 text-xs">{label}</p>
      </div>
      <div className="px-4 py-3">
        <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{formatted}</p>
      </div>
    </div>
  )
}

// ----------------- Trend Area Chart -----------------
export function TrendAreaChart({ data, className }: { data: TrendPoint[]; className?: string }) {
  const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
  const chartData: ChartDatum[] = useMemo(
    () => data.map((point) => ({ label: point.label, value: point.value })),
    [data]
  )

  const totalValue = chartData.reduce((sum, item) => sum + item.value, 0)
  const peakDay = chartData.reduce((max, item) => item.value > max.value ? item : max, chartData[0])

  return (
    <div className={className}>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm dark:shadow-slate-900/50 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600 dark:bg-emerald-500 p-2 rounded-lg">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Weekly Performance
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Last 7 Days Analysis
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Mini Stats */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-300 uppercase tracking-wide">
                  Total Value
                </p>
              </div>
              <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-200 mb-1">
                ₨{totalValue.toLocaleString()}
              </p>
              <div className="w-full h-1 bg-emerald-200 dark:bg-emerald-900/50 rounded-full overflow-hidden">
                <div className="w-full h-full bg-emerald-600 dark:bg-emerald-500 rounded-full"></div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <Award className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                <p className="text-xs font-semibold text-blue-900 dark:text-blue-300 uppercase tracking-wide">
                  Peak Day
                </p>
              </div>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-200 mb-1">
                {peakDay.label}
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-400 font-medium">
                ₨{peakDay.value.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
            <div className="h-64 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 p-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
                  <defs>
                    <linearGradient id="weeklyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="weeklyGradientDark" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#34d399" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke={isDark ? "#475569" : "#e2e8f0"} 
                    vertical={false} 
                  />
                  <XAxis 
                    dataKey="label" 
                    tickLine={false} 
                    axisLine={{ stroke: isDark ? "#475569" : "#cbd5e1", strokeWidth: 1 }} 
                    tickMargin={8} 
                    tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontWeight: 600, fontSize: 10 }}
                  />
                  <YAxis
                    tickFormatter={(value) => `₨${value/1000}k`}
                    width={60}
                    axisLine={{ stroke: isDark ? "#475569" : "#cbd5e1", strokeWidth: 1 }}
                    tickLine={false}
                    tickMargin={8}
                    tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontWeight: 600, fontSize: 10 }}
                  />
                  <Tooltip content={<ChartTooltip prefix="currency" />} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={isDark ? "#34d399" : "#10b981"}
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill={isDark ? "url(#weeklyGradientDark)" : "url(#weeklyGradient)"}
                    animationDuration={1200}
                    animationEasing="ease-in-out"
                    dot={{ 
                      r: 4, 
                      fill: isDark ? "#1e293b" : "#ffffff",
                      stroke: isDark ? "#34d399" : "#10b981", 
                      strokeWidth: 2
                    }}
                    activeDot={{ 
                      r: 6,
                      fill: isDark ? "#34d399" : "#10b981",
                      stroke: "#ffffff",
                      strokeWidth: 2
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ----------------- Comparison Bar Chart -----------------
export function ComparisonBarChart({
  data,
  className,
  title,
}: {
  data: TrendPoint[]
  className?: string
  title?: string
}) {
  const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
  const chartData: ChartDatum[] = useMemo(
    () => data.map((point) => ({ label: point.label, value: point.value })),
    [data]
  )

  return (
    <div className={className}>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm dark:shadow-slate-900/50 overflow-hidden">
        {title && (
          <div className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 dark:bg-blue-500 p-2 rounded-lg">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {title}
              </p>
            </div>
          </div>
        )}
        <div className="h-72 bg-slate-50 dark:bg-slate-900 p-6">
          <div className="h-full bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
                <defs>
                  <linearGradient id="comparisonBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                  <linearGradient id="comparisonBarDark" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke={isDark ? "#475569" : "#e2e8f0"} 
                  vertical={false} 
                />
                <XAxis 
                  dataKey="label" 
                  tickLine={false} 
                  axisLine={{ stroke: isDark ? "#475569" : "#cbd5e1", strokeWidth: 1 }} 
                  tickMargin={8} 
                  tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontWeight: 600, fontSize: 10 }}
                />
                <YAxis 
                  allowDecimals={false} 
                  axisLine={{ stroke: isDark ? "#475569" : "#cbd5e1", strokeWidth: 1 }} 
                  tickLine={false} 
                  tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontWeight: 600, fontSize: 10 }}
                />
                <Tooltip 
                  content={<ChartTooltip prefix="count" />} 
                  cursor={{ fill: isDark ? "rgba(51, 65, 85, 0.3)" : "rgba(226, 232, 240, 0.3)" }} 
                />
                <Bar
                  dataKey="value"
                  radius={[6, 6, 0, 0]}
                  fill={isDark ? "url(#comparisonBarDark)" : "url(#comparisonBar)"}
                  animationDuration={1000}
                  animationEasing="ease-in-out"
                  label={{ 
                    position: "top", 
                    fill: isDark ? "#cbd5e1" : "#334155", 
                    fontSize: 10, 
                    fontWeight: "600",
                    offset: 8
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}

// ----------------- Sales Bar Chart -----------------
export default function SalesBarChart({ data }: Props) {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])
  
  const isDark = mounted && theme === "dark"
  const totalRevenue = data.reduce((sum, item) => sum + item.value, 0)
  const avgRevenue = Math.round(totalRevenue / data.length)
  const peakMonth = data.reduce((max, item) => item.value > max.value ? item : max, data[0])

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm dark:shadow-slate-900/50 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
        <div className="flex items-center justify-center gap-3">
          <div className="bg-blue-600 dark:bg-blue-500 p-2 rounded-lg">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Monthly Revenue Performance
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Financial Overview
            </p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Chart */}
        <div className="mb-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
          <div className="h-[380px] bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={data} 
                barSize={40}
                margin={{ top: 20, right: 20, left: 10, bottom: 10 }}
              >
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>

                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke={isDark ? "#475569" : "#e2e8f0"} 
                  vertical={false}
                />
                
                <XAxis 
                  dataKey="month" 
                  tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontWeight: 600, fontSize: 11 }}
                  axisLine={{ stroke: isDark ? "#475569" : "#cbd5e1", strokeWidth: 1 }}
                  tickLine={false}
                  dy={8}
                />
                
                <YAxis
                  tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontWeight: 600, fontSize: 11 }}
                  axisLine={{ stroke: isDark ? "#475569" : "#cbd5e1", strokeWidth: 1 }}
                  tickLine={false}
                  tickFormatter={(value) => `₨${value/1000}k`}
                />

                <Tooltip content={<CustomTooltip />} cursor={{ fill: isDark ? "rgba(51, 65, 85, 0.3)" : "rgba(226, 232, 240, 0.3)" }} />

                <Bar
                  dataKey="value"
                  radius={[6, 6, 0, 0]}
                  animationDuration={1000}
                  animationEasing="ease-in-out"
                >
                  {data.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={isDark ? barColorsDark[index % barColorsDark.length] : barColors[index % barColors.length]}
                    />
                  ))}
                  <LabelList 
                    dataKey="value" 
                    position="top" 
                    formatter={(value: number) => `₨${(value/1000).toFixed(1)}k`}
                    style={{ 
                      fill: isDark ? "#cbd5e1" : "#334155", 
                      fontWeight: "600", 
                      fontSize: 10,
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Summary Statistics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-blue-600 dark:bg-blue-500 p-1.5 rounded">
                <DollarSign className="h-3.5 w-3.5 text-white" />
              </div>
              <p className="text-xs font-semibold text-blue-900 dark:text-blue-300 uppercase tracking-wide">Total Revenue</p>
            </div>
            <p className="text-2xl font-bold text-blue-900 dark:text-blue-200">
              ₨{totalRevenue.toLocaleString()}
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/30 dark:to-indigo-800/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-indigo-600 dark:bg-indigo-500 p-1.5 rounded">
                <Activity className="h-3.5 w-3.5 text-white" />
              </div>
              <p className="text-xs font-semibold text-indigo-900 dark:text-indigo-300 uppercase tracking-wide">Average</p>
            </div>
            <p className="text-2xl font-bold text-indigo-900 dark:text-indigo-200">
              ₨{avgRevenue.toLocaleString()}
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-emerald-600 dark:bg-emerald-500 p-1.5 rounded">
                <Award className="h-3.5 w-3.5 text-white" />
              </div>
              <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-300 uppercase tracking-wide">Peak Month</p>
            </div>
            <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-200">
              {peakMonth.month}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}