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
  BarChart,
  Bar,
  LabelList,
  Cell,
  LineChart,
  Line,
  ReferenceArea,
  ReferenceLine
} from "recharts"
import { TrendingUp, BarChart3, DollarSign, Activity, Award, Trophy, Zap, MousePointerClick } from "lucide-react"
import type { SalesSeriesPoint, BranchSalesPoint } from "@/lib/hooks/use-sales-performance"

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

const CustomTooltip = ({ active, payload, labelText = "Purchase" }: any) => {
  if (!active || !payload?.length) return null

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl">
      <div className="bg-slate-50 dark:bg-slate-900 px-4 py-2 border-b border-slate-200 dark:border-slate-700">
        <p className="font-semibold text-slate-700 dark:text-slate-300 text-xs">{payload[0].payload.month}</p>
      </div>
      <div className="px-4 py-3">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{labelText}</p>
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

// ----------------- Dynamic Font Size Helper -----------------
export const getValueFontSize = (val: string | number) => {
  const str = String(val);
  if (str.length >= 13) return 'text-xs sm:text-xs md:text-sm lg:text-base tracking-tight';
  if (str.length >= 10) return 'text-sm sm:text-sm md:text-base lg:text-lg tracking-tight';
  if (str.length >= 7) return 'text-base sm:text-base md:text-lg lg:text-xl tracking-tight';
  return 'text-lg sm:text-lg md:text-xl lg:text-2xl';
}

// ----------------- Yearly Sales Spline Chart -----------------
export type SalesData = { month: string; sales: number }
export type YearlySalesSplineChartProps = {
  yearlySalesData: SalesData[]
  avgSales: number
  label?: string
}

export function YearlySalesSplineChart({ yearlySalesData, avgSales, label = "Purchase" }: YearlySalesSplineChartProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  // Add null safety checks
  if (!yearlySalesData || yearlySalesData.length === 0) {
    return (
      <div className="animate-fade-in p-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
        <p className="text-slate-500 dark:text-slate-400 text-center">No sales data available</p>
      </div>
    )
  }

  const totalSales = yearlySalesData.reduce((sum, item) => sum + item.sales, 0)
  const peakMonth = yearlySalesData.reduce((max, item) => item.sales > max.sales ? item : max, yearlySalesData[0])

  return (
    <div className="animate-fade-in space-y-6">
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

      <div className="px-1">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 animate-slide-in">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 hover:shadow-md transition-shadow flex flex-col justify-between min-h-[110px]">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-blue-600 dark:bg-blue-500 p-1.5 rounded flex-shrink-0">
                <DollarSign className="h-3.5 w-3.5 text-white" />
              </div>
              <p className="text-[10px] font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider truncate">
                Total {label}
              </p>
            </div>
            <div>
              <p className={`${getValueFontSize('₨' + totalSales.toLocaleString())} font-bold text-blue-900 dark:text-blue-200 break-words leading-tight`}>
                ₨{totalSales.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/30 dark:to-indigo-800/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4 hover:shadow-md transition-shadow flex flex-col justify-between min-h-[110px]">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-indigo-600 dark:bg-indigo-500 p-1.5 rounded flex-shrink-0">
                <Activity className="h-3.5 w-3.5 text-white" />
              </div>
              <p className="text-[10px] font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider truncate">
                Average
              </p>
            </div>
            <div>
              <p className={`${getValueFontSize('₨' + Math.round(avgSales).toLocaleString())} font-bold text-indigo-900 dark:text-indigo-200 break-words leading-tight`}>
                ₨{Math.round(avgSales).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 hover:shadow-md transition-shadow flex flex-col justify-between min-h-[110px]">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-emerald-600 dark:bg-emerald-500 p-1.5 rounded flex-shrink-0">
                <Award className="h-3.5 w-3.5 text-white" />
              </div>
              <p className="text-[10px] font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider truncate">
                Peak Period
              </p>
            </div>
            <div>
              <p className="text-xl lg:text-2xl font-bold text-emerald-900 dark:text-emerald-200 break-words">
                {peakMonth.month}
              </p>
              <p className="text-xs lg:text-sm text-emerald-700 dark:text-emerald-400 font-semibold break-words mt-0.5">
                ₨{peakMonth.sales.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Chart Container */}
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full"></div>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Performance Trend</span>
          </div>

          <div className="h-[320px] bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 p-4">
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
                  tickFormatter={(value) => `₨${value / 1000}k`}
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
                  formatter={(value: number) => [`₨${value.toLocaleString()}`, label]}
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
  labelText,
}: {
  active?: boolean
  payload?: any[]
  label?: string
  prefix?: "currency" | "count" | ""
  labelText?: string
}) {
  if (!active || !payload?.length) return null
  const value = payload[0].value as number
  const formatted =
    prefix === "currency"
      ? currencyFormatter.format(value)
      : prefix === "count"
        ? `${value.toLocaleString()} orders`
        : value.toLocaleString()

  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden">
      <div className="bg-slate-50 dark:bg-slate-900 px-4 py-2 border-b border-slate-200 dark:border-slate-700">
        <p className="font-semibold text-slate-700 dark:text-slate-300 text-xs">{label}</p>
      </div>
      <div className="px-4 py-3">
        {labelText && <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{labelText}</p>}
        <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{formatted}</p>
      </div>
    </div>
  )
}

// ----------------- Trend Area Chart -----------------
export function TrendAreaChart({ data, className, label = "Purchase" }: { data: TrendPoint[]; className?: string; label?: string }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const chartData: ChartDatum[] = useMemo(
    () => data?.map((point) => ({ label: point.label, value: point.value })) || [],
    [data]
  )

  if (!chartData || chartData.length === 0) {
    return (
      <div className={className}>
        <div className="p-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
          <p className="text-slate-500 dark:text-slate-400 text-center">No data available</p>
        </div>
      </div>
    )
  }

  const totalValue = chartData.reduce((sum, item) => sum + item.value, 0)
  const peakDay = chartData.reduce((max, item) => item.value > max.value ? item : max, chartData[0])

  return (
    <div className={className}>
      <div className="space-y-6">
        <div className="px-1">
          {/* Mini Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 hover:shadow-md transition-shadow flex flex-col justify-between min-h-[110px]">
              <div className="flex items-center gap-2 mb-2">
                <div className="bg-emerald-600 dark:bg-emerald-500 p-1.5 rounded flex-shrink-0">
                  <DollarSign className="h-3.5 w-3.5 text-white" />
                </div>
                <p className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider truncate">
                  Total Value
                </p>
              </div>
              <div>
                <p className={`${getValueFontSize('₨' + totalValue.toLocaleString())} font-bold text-emerald-900 dark:text-emerald-200 break-words leading-tight`}>
                  ₨{totalValue.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 hover:shadow-md transition-shadow flex flex-col justify-between min-h-[110px]">
              <div className="flex items-center gap-2 mb-2">
                <div className="bg-blue-600 dark:bg-blue-500 p-1.5 rounded flex-shrink-0">
                  <Award className="h-3.5 w-3.5 text-white" />
                </div>
                <p className="text-[10px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider truncate">
                  Peak Day
                </p>
              </div>
              <div>
                <p className="text-xl lg:text-2xl font-bold text-blue-900 dark:text-blue-200 break-words">
                  {peakDay.label}
                </p>
                <p className="text-xs lg:text-sm text-blue-700 dark:text-blue-400 font-semibold break-words mt-0.5">
                  ₨{peakDay.value.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/30 dark:to-indigo-800/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4 hover:shadow-md transition-shadow flex flex-col justify-between min-h-[110px]">
              <div className="flex items-center gap-2 mb-2">
                <div className="bg-indigo-600 dark:bg-indigo-500 p-1.5 rounded flex-shrink-0">
                  <Activity className="h-3.5 w-3.5 text-white" />
                </div>
                <p className="text-[10px] font-bold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider truncate">
                  Average
                </p>
              </div>
              <div>
                <p className={`${getValueFontSize('₨' + Math.round(totalValue / (chartData.length || 1)).toLocaleString())} font-bold text-indigo-900 dark:text-indigo-200 break-words leading-tight`}>
                  ₨{Math.round(totalValue / (chartData.length || 1)).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
            <div className="h-[320px] bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 p-3">
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
                    tickFormatter={(value) => `₨${value / 1000}k`}
                    width={60}
                    axisLine={{ stroke: isDark ? "#475569" : "#cbd5e1", strokeWidth: 1 }}
                    tickLine={false}
                    tickMargin={8}
                    tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontWeight: 600, fontSize: 10 }}
                  />
                  <Tooltip content={<ChartTooltip prefix="currency" labelText={label} />} />
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
  const { theme } = useTheme()
  const isDark = theme === 'dark'
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
export default function SalesBarChart({ data, label = "Purchase" }: Props & { label?: string }) {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted && theme === "dark"

  if (!data || data.length === 0) {
    return (
      <div className="p-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
        <p className="text-slate-500 dark:text-slate-400 text-center">No data available</p>
      </div>
    )
  }

  const totalRevenue = data.reduce((sum, item) => sum + item.value, 0)
  const avgRevenue = Math.round(totalRevenue / data.length)
  const peakMonth = data.reduce((max, item) => item.value > max.value ? item : max, data[0])

  return (
    <div className="space-y-6">
      <div className="px-1">
        {/* Chart */}
        <div className="mb-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
          <div className="h-[320px] bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 p-4">
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
                  tickFormatter={(value) => `₨${value / 1000}k`}
                />

                <Tooltip content={<CustomTooltip labelText={label} />} cursor={{ fill: isDark ? "rgba(51, 65, 85, 0.3)" : "rgba(226, 232, 240, 0.3)" }} />

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
                    formatter={(value: number) => `₨${(value / 1000).toFixed(1)}k`}
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 hover:shadow-md transition-shadow flex flex-col justify-between min-h-[110px]">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-blue-600 dark:bg-blue-500 p-1.5 rounded flex-shrink-0">
                <DollarSign className="h-3.5 w-3.5 text-white" />
              </div>
              <p className="text-[10px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider truncate">Total {label}</p>
            </div>
            <div>
              <p className={`${getValueFontSize('₨' + totalRevenue.toLocaleString())} font-bold text-blue-900 dark:text-blue-200 break-words leading-tight`}>
                ₨{totalRevenue.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/30 dark:to-indigo-800/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4 hover:shadow-md transition-shadow flex flex-col justify-between min-h-[110px]">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-indigo-600 dark:bg-indigo-500 p-1.5 rounded flex-shrink-0">
                <Activity className="h-3.5 w-3.5 text-white" />
              </div>
              <p className="text-[10px] font-bold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider truncate">Average</p>
            </div>
            <div>
              <p className={`${getValueFontSize('₨' + avgRevenue.toLocaleString())} font-bold text-indigo-900 dark:text-indigo-200 break-words leading-tight`}>
                ₨{avgRevenue.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 hover:shadow-md transition-shadow flex flex-col justify-between min-h-[110px]">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-emerald-600 dark:bg-emerald-500 p-1.5 rounded flex-shrink-0">
                <Award className="h-3.5 w-3.5 text-white" />
              </div>
              <p className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider truncate">Peak Month</p>
            </div>
            <div>
              <p className="text-xl lg:text-2xl font-bold text-emerald-900 dark:text-emerald-200 break-words">
                {peakMonth.month}
              </p>
              <p className="text-xs lg:text-sm text-emerald-700 dark:text-emerald-400 font-semibold break-words mt-0.5">
                ₨{peakMonth.value.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export type SalesPerformanceLineChartProps = {
  seriesData: SalesSeriesPoint[]
  totalSales: number
  avgSales: number
  totalOrders: number
  peakPeriod: { label: string; sales: number; orders: number } | null
  label?: string
  granularity?: "hourly" | "daily" | "monthly"
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `₨${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `₨${(value / 1000).toFixed(1)}k`
  return `₨${value}`
}

const SalesPerfTooltip = ({ active, payload, label: tooltipLabel }: any) => {
  if (!active || !payload?.length) return null
  const sales = payload.find((p: any) => p.dataKey === 'sales')?.value ?? 0
  const orders = payload.find((p: any) => p.dataKey === 'orders')?.value ?? 0
  return (
    <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-4 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100 dark:border-slate-800 min-w-[200px]">
      <p className="font-bold text-slate-800 dark:text-slate-200 text-base mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">{tooltipLabel}</p>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-emerald-400 shadow-sm" />
          <div className="flex-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">Sales Amount</span>
            <span className="text-base font-black text-slate-900 dark:text-white">₨{sales.toLocaleString()}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-blue-500 shadow-sm" />
          <div className="flex-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">Orders Count</span>
            <span className="text-base font-black text-slate-900 dark:text-white">{orders.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function SalesPerformanceLineChart({
  seriesData,
  totalSales,
  avgSales,
  totalOrders,
  peakPeriod,
  label = "Sales",
  granularity = "daily",
}: SalesPerformanceLineChartProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const safeData = useMemo(() => {
    if (!seriesData || seriesData.length === 0) {
      return Array.from({ length: 7 }).map((_, i) => ({
        label: `Day ${i + 1}`,
        sales: 0,
        orders: 0
      }))
    }
    return seriesData
  }, [seriesData])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
            Sales Performance
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Analyze revenue trends and order volume over time
          </p>
        </div>

        <div className="flex items-center gap-6 bg-slate-50 dark:bg-slate-900/50 px-4 py-2 rounded-xl border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-full bg-emerald-400" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Sales Amount</span>
          </div>
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-full bg-blue-500" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Order Volume</span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="h-[380px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={safeData}
              margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
            >
              <defs>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" vertical={false} stroke={isDark ? "#334155" : "#f1f5f9"} />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontSize: 12, fontWeight: 600 }}
                dy={15}
                minTickGap={25}
              />
              <YAxis
                yAxisId="sales"
                axisLine={false}
                tickLine={false}
                tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontSize: 12, fontWeight: 600 }}
                tickFormatter={formatCurrency}
                dx={-15}
              />
              <YAxis
                yAxisId="orders"
                orientation="right"
                axisLine={false}
                tickLine={false}
                tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontSize: 12, fontWeight: 600 }}
                dx={15}
              />
              <Tooltip
                content={<SalesPerfTooltip />}
                cursor={{ stroke: isDark ? "#475569" : "#cbd5e1", strokeWidth: 1, strokeDasharray: "4 4" }}
              />

              {/* Sales Area */}
              <Line
                yAxisId="sales"
                type="monotone"
                dataKey="sales"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 0, fill: "#10b981" }}
                activeDot={{ r: 7, strokeWidth: 0, fill: "#34d399" }}
                animationDuration={1500}
              />

              {/* Orders Line */}
              <Line
                yAxisId="orders"
                type="monotone"
                dataKey="orders"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 0, fill: "#3b82f6" }}
                activeDot={{ r: 7, strokeWidth: 0, fill: "#60a5fa" }}
                animationDuration={1500}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ── Branch Sales Bar Chart ──
const BranchTooltipContent = ({ active, payload, label: bLabel }: any) => {
  if (!active || !payload?.length) return null
  const sales = payload.find((p: any) => p.dataKey === 'sales')?.value ?? 0
  const ordersVal = payload.find((p: any) => p.dataKey === 'orders')?.value ?? 0
  return (
    <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-4 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100 dark:border-slate-800 min-w-[200px]">
      <p className="font-bold text-slate-800 dark:text-slate-200 text-base mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">{bLabel}</p>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: payload[0].payload.branchId === payload[0].payload.topBranchId ? '#f59e0b' : '#3b82f6' }} />
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Sales</span>
          </div>
          <span className="text-sm font-black text-slate-900 dark:text-white">₨{sales.toLocaleString()}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-emerald-400" />
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Orders Finished</span>
          </div>
          <span className="text-sm font-black text-slate-900 dark:text-white">{ordersVal.toLocaleString()}</span>
        </div>
      </div>
    </div>
  )
}

export function BranchSalesBarChart({ branchSales, label = "Sales" }: { branchSales: BranchSalesPoint[]; label?: string }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const filteredBranches = branchSales.filter(b => b.sales > 0 || b.orders > 0)

  if (!filteredBranches || filteredBranches.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center bg-slate-50 dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No branch data available for this period</p>
      </div>
    )
  }

  const sortedBranches = [...filteredBranches].sort((a, b) => b.sales - a.sales).map(d => ({
    ...d,
    topBranchId: filteredBranches.sort((x, y) => y.sales - x.sales)[0]?.branchId
  }))

  const topBranch = sortedBranches[0]

  const barColor = (b: any, dark: boolean) => {
    if (b.branchId === b.topBranchId) return dark ? "#fbbf24" : "#f59e0b" // gold
    return dark ? "#818cf8" : "#3b82f6" // blue
  }

  return (
    <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex items-start gap-3 mb-6">
        <div className="p-2.5 bg-blue-600 rounded-xl mt-1">
          <BarChart3 className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Branch Sales Performance</h3>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-1">
            <MousePointerClick className="h-3.5 w-3.5" />
            Hover on bars for total sales & order count per branch
          </p>
        </div>
      </div>

      {topBranch && (
        <div className="flex items-center justify-between px-6 py-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl mb-8 border-l-4 border-l-amber-400">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-6 w-6 rounded-md bg-amber-500 flex items-center justify-center">
                <Trophy className="h-3 w-3 text-white" />
              </div>
              <p className="text-[11px] font-bold text-amber-700 dark:text-amber-500 uppercase tracking-widest">Highest Sales Branch</p>
            </div>
            <p className="text-base font-bold text-amber-900 dark:text-amber-400 ml-8">{topBranch.branchName}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black text-amber-900 dark:text-amber-400 leading-none tracking-tight">₨{topBranch.sales.toLocaleString()}</p>
            <p className="text-sm font-bold text-amber-600 dark:text-amber-500 mt-2 bg-amber-100 dark:bg-amber-900/40 inline-block px-2 py-0.5 rounded-md">{topBranch.orders} orders</p>
          </div>
        </div>
      )}

      <div className="h-[340px] w-full mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={sortedBranches}
            margin={{ top: 20, right: 0, left: -20, bottom: 20 }}
            barGap={0}
          >
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke={isDark ? "#334155" : "#f1f5f9"} />
            <XAxis
              dataKey="branchName"
              axisLine={{ stroke: isDark ? "#475569" : "#cbd5e1" }}
              tickLine={false}
              tick={{ fill: isDark ? "#64748b" : "#64748b", fontSize: 11, fontWeight: 600 }}
              interval={0}
              angle={-35}
              textAnchor="end"
              dy={15}
              dx={-5}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: isDark ? "#64748b" : "#64748b", fontSize: 11, fontWeight: 600 }}
              tickFormatter={(v) => `₨${v >= 1000 ? (v / 1000) + 'k' : v}`}
              dx={-10}
            />
            <Tooltip
              content={<BranchTooltipContent />}
              cursor={{ fill: isDark ? "rgba(51,65,85,0.05)" : "rgba(241,245,249,0.5)" }}
            />

            {/* Sales Bar */}
            <Bar
              dataKey="sales"
              radius={[4, 4, 0, 0]}
              barSize={32}
              animationDuration={1500}
            >
              {sortedBranches.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={barColor(entry, isDark)} />
              ))}
            </Bar>

            {/* Orders Data for Tooltip (Transparent) */}
            <Bar
              dataKey="orders"
              radius={[4, 4, 0, 0]}
              barSize={0}
              fill="transparent"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-center gap-6 mt-8 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded bg-amber-500 shadow-sm" />
          <span className="text-[13px] font-bold text-slate-600 dark:text-slate-400">Top Branch (Sales)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded bg-blue-500 shadow-sm" />
          <span className="text-[13px] font-bold text-slate-600 dark:text-slate-400">Other Branches</span>
        </div>
      </div>
    </div>
  )
}

// ── Organization Sales Bar Chart ──
const OrgTooltipContent = ({ active, payload, label: bLabel }: any) => {
  if (!active || !payload?.length) return null
  const sales = payload.find((p: any) => p.dataKey === 'sales')?.value ?? 0
  const ordersVal = payload.find((p: any) => p.dataKey === 'orders')?.value ?? 0

  return (
    <div className="bg-slate-900/95 dark:bg-slate-800/95 border border-slate-700 p-3 rounded-xl shadow-2xl backdrop-blur-sm text-sm">
      <div className="font-bold text-white mb-2">{bLabel}</div>
      <div className="flex justify-between gap-4 text-emerald-400">
        <span className="font-medium">Total Sales</span>
        <span className="font-bold">₨{sales.toLocaleString()}</span>
      </div>
      <div className="flex justify-between gap-4 text-blue-400 mt-1">
        <span className="font-medium">Orders Finished</span>
        <span className="font-bold">{ordersVal}</span>
      </div>
    </div>
  )
}

export const OrganizationSalesBarChart = ({
  organizationSales,
  label = "Organization Sales",
}: {
  organizationSales: { organizationId: number; organizationName: string; sales: number; orders: number }[]
  label?: string
}) => {
  const isDark = true;

  // Find highest selling org
  const maxSales = Math.max(...organizationSales.map(b => b.sales), 0)

  const formattedData = organizationSales.map((b) => ({
    name: b.organizationName,
    sales: b.sales,
    orders: b.orders,
    isTop: b.sales === maxSales && b.sales > 0, // Highlight the best
  }))

  const barColor = (entry: any, isDarkTheme: boolean) => {
    if (entry.isTop) return isDarkTheme ? "#fbbf24" : "#f59e0b"
    return isDarkTheme ? "#3b82f6" : "#2563eb"
  }

  return (
    <div className="relative">
      {/* Decorative background glow */}
      <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 via-transparent to-amber-500/5 blur-3xl rounded-3xl -z-10" />

      {formattedData.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 bg-white/50 dark:bg-slate-900/50 p-4 lg:p-6 rounded-2xl border border-slate-100 dark:border-slate-800/60 shadow-sm backdrop-blur-md">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              <p className="text-[11px] font-bold text-amber-700 dark:text-amber-500 uppercase tracking-widest">Highest Sales Org</p>
            </div>
            <p className="text-base font-bold text-amber-900 dark:text-amber-400 ml-6">{formattedData.find(d => d.isTop)?.name || "N/A"}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black text-amber-900 dark:text-amber-400 leading-none tracking-tight">₨{(formattedData.find(d => d.isTop)?.sales || 0).toLocaleString()}</p>
            <p className="text-sm font-bold text-amber-600 dark:text-amber-500 mt-2 bg-amber-100 dark:bg-amber-900/40 inline-block px-2 py-0.5 rounded-md">{(formattedData.find(d => d.isTop)?.orders || 0)} orders</p>
          </div>
        </div>
      )}

      <div className="h-[340px] w-full mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={formattedData}
            margin={{ top: 20, right: 0, left: -20, bottom: 20 }}
            barGap={0}
          >
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke={isDark ? "#334155" : "#f1f5f9"} />
            <XAxis
              dataKey="name"
              axisLine={{ stroke: isDark ? "#475569" : "#cbd5e1" }}
              tickLine={false}
              tick={{ fill: isDark ? "#64748b" : "#64748b", fontSize: 11, fontWeight: 600 }}
              interval={0}
              angle={-35}
              textAnchor="end"
              dy={15}
              dx={-5}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: isDark ? "#64748b" : "#64748b", fontSize: 11, fontWeight: 600 }}
              tickFormatter={(v) => `₨${v >= 1000 ? (v / 1000) + 'k' : v}`}
              dx={-10}
            />
            <Tooltip
              content={<OrgTooltipContent />}
              cursor={{ fill: isDark ? "rgba(51,65,85,0.05)" : "rgba(241,245,249,0.5)" }}
            />

            <Bar
              dataKey="sales"
              radius={[4, 4, 0, 0]}
              barSize={32}
              animationDuration={1500}
            >
              {formattedData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={barColor(entry, isDark)} />
              ))}
            </Bar>
            <Bar
              dataKey="orders"
              radius={[4, 4, 0, 0]}
              barSize={0}
              fill="transparent"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-center gap-6 mt-8 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded bg-amber-500 shadow-sm" />
          <span className="text-[13px] font-bold text-slate-600 dark:text-slate-400">Top Organization (Sales)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded bg-blue-500 shadow-sm" />
          <span className="text-[13px] font-bold text-slate-600 dark:text-slate-400">Other Organizations</span>
        </div>
      </div>
    </div>
  )
}
