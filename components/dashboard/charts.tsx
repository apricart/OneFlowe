"use client"

import { useMemo } from "react"
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
import { TrendingUp, BarChart3, FileText, DollarSign, Activity, PieChart, Award } from "lucide-react"

type Props = {
  data: {
    month: string
    value: number
  }[]
}

const barColors = [
  { start: "#3B82F6", end: "#2563EB" },
  { start: "#8B5CF6", end: "#7C3AED" },
  { start: "#06B6D4", end: "#0891B2" },
  { start: "#10B981", end: "#059669" },
  { start: "#F59E0B", end: "#D97706" },
  { start: "#EF4444", end: "#DC2626" },
  { start: "#EC4899", end: "#DB2777" },
  { start: "#6366F1", end: "#4F46E5" },
  { start: "#14B8A6", end: "#0D9488" },
  { start: "#F97316", end: "#EA580C" },
  { start: "#A855F7", end: "#9333EA" },
  { start: "#22C55E", end: "#16A34A" },
]

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  
  return (
    <div className="relative overflow-hidden rounded-xl border border-blue-200 bg-white/95 backdrop-blur-xl shadow-2xl">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-indigo-50/30 to-white/50"></div>
      <div className="relative bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 border-b border-blue-500/30">
        <p className="font-bold text-white text-xs uppercase tracking-wider">{payload[0].payload.month}</p>
      </div>
      <div className="relative px-5 py-3">
        <p className="text-xs text-slate-600 font-semibold mb-1 uppercase tracking-wide">Revenue</p>
        <p className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
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
  const totalSales = yearlySalesData.reduce((sum, item) => sum + item.sales, 0)
  const peakMonth = yearlySalesData.reduce((max, item) => item.sales > max.sales ? item : max, yearlySalesData[0])
  
  return (
    <div className="relative overflow-hidden rounded-2xl border border-indigo-200/60 bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/40 shadow-2xl hover:shadow-indigo-200/50 transition-all duration-500">
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideRight {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
        .animate-slide-down {
          animation: slideDown 0.6s ease-out;
        }
        .animate-fade-in {
          animation: fadeIn 0.8s ease-out;
        }
        .animate-slide-right {
          animation: slideRight 0.6s ease-out;
        }
        .animate-shimmer {
          animation: shimmer 3s infinite;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
          background-size: 1000px 100%;
        }
      `}</style>

      {/* Decorative background elements */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-gradient-to-br from-blue-200/30 to-indigo-200/30 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-gradient-to-br from-purple-200/30 to-pink-200/30 rounded-full blur-3xl"></div>

      {/* Header Section */}
      <div className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 px-8 py-6 border-b border-blue-500/30">
        <div className="absolute inset-0 animate-shimmer"></div>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-400 rounded-xl blur-lg opacity-60"></div>
              <div className="relative bg-gradient-to-br from-blue-500 to-indigo-500 p-3 rounded-xl shadow-lg">
                <TrendingUp className="h-7 w-7 text-white" strokeWidth={2.5} />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight mb-1 drop-shadow-sm">
                Annual Revenue Performance
              </h2>
              <p className="text-sm text-blue-100 font-semibold uppercase tracking-wider">
                Fiscal Year Analysis
              </p>
            </div>
          </div>
          <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/30">
            <p className="text-xs text-blue-100 font-bold uppercase tracking-wider">Status</p>
            <p className="text-sm text-white font-bold">Active</p>
          </div>
        </div>
      </div>

      <div className="relative p-8">
        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-5 mb-8 animate-slide-down">
          <div className="relative group overflow-hidden rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300"></div>
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12"></div>
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="bg-white/20 backdrop-blur-sm p-2 rounded-lg">
                  <DollarSign className="h-5 w-5 text-white" />
                </div>
                <p className="text-xs font-bold text-blue-100 uppercase tracking-wider">
                  Total Revenue
                </p>
              </div>
              <p className="text-3xl font-bold text-white mb-2">
                ₨{totalSales.toLocaleString()}
              </p>
              <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div className="w-full h-full bg-white rounded-full shadow-lg"></div>
              </div>
            </div>
          </div>

          <div className="relative group overflow-hidden rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300"></div>
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12"></div>
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="bg-white/20 backdrop-blur-sm p-2 rounded-lg">
                  <Activity className="h-5 w-5 text-white" />
                </div>
                <p className="text-xs font-bold text-purple-100 uppercase tracking-wider">
                  Average
                </p>
              </div>
              <p className="text-3xl font-bold text-white mb-2">
                ₨{Math.round(avgSales).toLocaleString()}
              </p>
              <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div className="w-3/4 h-full bg-white rounded-full shadow-lg"></div>
              </div>
            </div>
          </div>

          <div className="relative group overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300"></div>
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12"></div>
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="bg-white/20 backdrop-blur-sm p-2 rounded-lg">
                  <Award className="h-5 w-5 text-white" />
                </div>
                <p className="text-xs font-bold text-emerald-100 uppercase tracking-wider">
                  Peak Period
                </p>
              </div>
              <p className="text-3xl font-bold text-white mb-2">
                {peakMonth.month}
              </p>
              <p className="text-sm text-emerald-100 font-semibold">
                ₨{peakMonth.sales.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Chart Container */}
        <div className="relative rounded-xl bg-white/60 backdrop-blur-sm border border-indigo-200/60 p-6 shadow-lg animate-fade-in">
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 rounded-lg shadow-md">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span className="text-xs font-bold text-white uppercase tracking-wider">Performance Trend</span>
          </div>
          
          <div className="h-[400px] pt-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={yearlySalesData}
                margin={{ top: 20, right: 30, left: 10, bottom: 10 }}
              >
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.5} />
                    <stop offset="50%" stopColor="#8B5CF6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#EC4899" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="strokeGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="50%" stopColor="#8B5CF6" />
                    <stop offset="100%" stopColor="#EC4899" />
                  </linearGradient>
                  <filter id="shadow">
                    <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#3B82F6" floodOpacity="0.4"/>
                  </filter>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>

                <CartesianGrid 
                  strokeDasharray="5 5" 
                  stroke="#A5B4FC" 
                  strokeOpacity={0.4}
                  vertical={false}
                />
                <XAxis 
                  dataKey="month" 
                  tick={{ fill: "#4F46E5", fontWeight: 700, fontSize: 12 }}
                  axisLine={{ stroke: "#A5B4FC", strokeWidth: 2 }}
                  tickLine={false}
                  dy={8}
                />
                <YAxis
                  tick={{ fill: "#4F46E5", fontWeight: 700, fontSize: 12 }}
                  tickFormatter={(value) => `₨${value/1000}k`}
                  axisLine={{ stroke: "#A5B4FC", strokeWidth: 2 }}
                  tickLine={false}
                  dx={-5}
                />

                <Tooltip 
                  contentStyle={{
                    background: "rgba(255, 255, 255, 0.95)",
                    borderRadius: "12px",
                    border: "1px solid #A5B4FC",
                    boxShadow: "0 10px 40px rgba(59, 130, 246, 0.3)",
                    padding: "12px 16px",
                    backdropFilter: "blur(12px)",
                  }}
                  labelStyle={{ 
                    color: "#4F46E5", 
                    fontWeight: "bold",
                    fontSize: "13px",
                    marginBottom: "4px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em"
                  }}
                  formatter={(value: number) => [`₨${value.toLocaleString()}`, "Revenue"]}
                />

                <ReferenceLine 
                  y={avgSales} 
                  label={{ 
                    value: `Average: ₨${Math.round(avgSales).toLocaleString()}`, 
                    position: "right",
                    fill: "#F59E0B",
                    fontWeight: "bold",
                    fontSize: 11
                  }} 
                  stroke="#F59E0B" 
                  strokeWidth={2}
                  strokeDasharray="8 4"
                  opacity={0.8}
                />

                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="url(#strokeGradient)"
                  strokeWidth={4}
                  fill="url(#salesGradient)"
                  filter="url(#shadow)"
                  dot={{ 
                    r: 6, 
                    fill: "#FFFFFF",
                    stroke: "#3B82F6", 
                    strokeWidth: 3,
                    filter: "url(#glow)"
                  }}
                  activeDot={{ 
                    r: 9,
                    fill: "#3B82F6",
                    stroke: "#FFFFFF",
                    strokeWidth: 3,
                    filter: "url(#glow)"
                  }}
                  animationDuration={1800}
                  animationEasing="ease-out"
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

  return (
    <div className="relative overflow-hidden rounded-xl border border-emerald-200 bg-white/95 backdrop-blur-xl shadow-2xl">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 via-teal-50/30 to-white/50"></div>
      <div className="relative bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 border-b border-emerald-500/30">
        <p className="font-bold text-white text-xs uppercase tracking-wider">{label}</p>
      </div>
      <div className="relative px-5 py-3">
        <p className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">{formatted}</p>
      </div>
    </div>
  )
}

// ----------------- Trend Area Chart -----------------
export function TrendAreaChart({ data, className }: { data: TrendPoint[]; className?: string }) {
  const chartData: ChartDatum[] = useMemo(
    () => data.map((point) => ({ label: point.label, value: point.value })),
    [data]
  )

  const totalValue = chartData.reduce((sum, item) => sum + item.value, 0)
  const peakDay = chartData.reduce((max, item) => item.value > max.value ? item : max, chartData[0])

  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-2xl border border-slate-700/30 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 shadow-2xl">
        {/* Subtle light orbs */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full blur-3xl"></div>

        {/* Header */}
        <div className="relative bg-gradient-to-r from-slate-700 via-slate-800 to-slate-700 px-8 py-6 border-b border-slate-600/50">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500 rounded-xl blur-lg opacity-50"></div>
              <div className="relative bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-xl shadow-lg">
                <Activity className="h-7 w-7 text-white" strokeWidth={2.5} />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight mb-1">
                Daily Performance Trend
              </h2>
              <p className="text-sm text-slate-300 font-semibold uppercase tracking-wider">
                Week-over-Week Analysis
              </p>
            </div>
          </div>
        </div>

        <div className="relative p-8">
          {/* Mini Stats */}
          <div className="grid grid-cols-2 gap-5 mb-6 animate-slide-right">
            <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 p-6 border border-blue-500/30 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
              <div className="relative">
                <p className="text-xs font-bold text-blue-100 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Total Value
                </p>
                <p className="text-3xl font-bold text-white mb-2">
                  ₨{totalValue.toLocaleString()}
                </p>
                <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div className="w-full h-full bg-white rounded-full shadow-lg"></div>
                </div>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-600 to-pink-700 p-6 border border-purple-500/30 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
              <div className="relative">
                <p className="text-xs font-bold text-purple-100 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  Peak Day
                </p>
                <p className="text-3xl font-bold text-white mb-2">
                  {peakDay.label}
                </p>
                <p className="text-sm text-purple-100 font-semibold">
                  ₨{peakDay.value.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="relative rounded-xl bg-slate-800/50 backdrop-blur-sm border border-slate-600/50 p-6 shadow-inner">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                  <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.6} />
                      <stop offset="50%" stopColor="#EC4899" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="areaStroke" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#8B5CF6" />
                      <stop offset="50%" stopColor="#EC4899" />
                      <stop offset="100%" stopColor="#F59E0B" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke="#64748B" 
                    strokeOpacity={0.3}
                    vertical={false} 
                  />
                  <XAxis 
                    dataKey="label" 
                    tickLine={false} 
                    axisLine={{ stroke: "#94A3B8", strokeWidth: 2 }} 
                    tickMargin={12} 
                    tick={{ fill: "#CBD5E1", fontWeight: 600, fontSize: 11 }}
                  />
                  <YAxis
                    tickFormatter={(value) => `₨${value/1000}k`}
                    width={75}
                    axisLine={{ stroke: "#94A3B8", strokeWidth: 2 }}
                    tickLine={false}
                    tickMargin={12}
                    tick={{ fill: "#CBD5E1", fontWeight: 600, fontSize: 11 }}
                  />
                  <Tooltip content={<ChartTooltip prefix="currency" />} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="url(#areaStroke)"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#areaGradient)"
                    animationDuration={1800}
                    animationEasing="ease-out"
                    dot={{ 
                      r: 5, 
                      fill: "#FFFFFF",
                      stroke: "#8B5CF6", 
                      strokeWidth: 3,
                    }}
                    activeDot={{ 
                      r: 8,
                      fill: "#8B5CF6",
                      stroke: "#FFFFFF",
                      strokeWidth: 3,
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
  const chartData: ChartDatum[] = useMemo(
    () => data.map((point) => ({ label: point.label, value: point.value })),
    [data]
  )

  return (
    <div className={className}>
      <div className="overflow-hidden rounded-2xl border border-rose-200/60 bg-white shadow-2xl">
        {title && (
          <div className="bg-gradient-to-r from-rose-600 to-pink-600 px-6 py-5 border-b border-rose-500/30">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-rose-400 rounded-lg blur-lg opacity-60"></div>
                <div className="relative bg-white/20 backdrop-blur-sm p-2 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-white" />
                </div>
              </div>
              <p className="text-xl font-bold text-white uppercase tracking-wide">
                {title}
              </p>
            </div>
          </div>
        )}
        <div className="h-72 bg-gradient-to-br from-rose-50/50 to-white p-6">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 12, right: 16, left: -8, bottom: 8 }}>
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F43F5E" />
                  <stop offset="100%" stopColor="#FB7185" />
                </linearGradient>
                <filter id="barShadow">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#F43F5E" floodOpacity="0.3"/>
                </filter>
              </defs>
              <CartesianGrid 
                strokeDasharray="5 5" 
                stroke="#FBCFE8" 
                strokeOpacity={0.5}
                vertical={false} 
              />
              <XAxis 
                dataKey="label" 
                tickLine={false} 
                axisLine={{ stroke: "#FDA4AF", strokeWidth: 2 }} 
                tickMargin={10} 
                tick={{ fill: "#BE123C", fontWeight: 700, fontSize: 12 }}
              />
              <YAxis 
                allowDecimals={false} 
                axisLine={{ stroke: "#FDA4AF", strokeWidth: 2 }} 
                tickLine={false} 
                tick={{ fill: "#BE123C", fontWeight: 700, fontSize: 12 }}
              />
              <Tooltip 
                content={<ChartTooltip prefix="count" />} 
                cursor={{ fill: "rgba(251, 207, 232, 0.2)" }} 
              />
              <Bar
                dataKey="value"
                radius={[10, 10, 0, 0]}
                fill="url(#barGradient)"
                filter="url(#barShadow)"
                animationDuration={1400}
                animationEasing="ease-out"
                label={{ 
                  position: "top", 
                  fill: "#BE123C", 
                  fontSize: 12, 
                  fontWeight: "bold",
                  offset: 8
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
// ----------------- Sales Bar Chart -----------------
export default function SalesBarChart({ data }: Props) {
  const totalRevenue = data.reduce((sum, item) => sum + item.value, 0)
  const avgRevenue = Math.round(totalRevenue / data.length)
  const peakMonth = data.reduce((max, item) => item.value > max.value ? item : max, data[0])

  return (
    <div className="relative overflow-hidden rounded-xl border-2 border-slate-300 bg-white shadow-2xl">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 px-8 py-6 border-b-4 border-slate-700">
        <div className="flex items-center justify-center gap-4">
          <div className="bg-slate-700 p-3 rounded-lg shadow-lg">
            <BarChart3 className="h-7 w-7 text-slate-100" strokeWidth={2.5} />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Monthly Revenue Performance
          </h2>
        </div>
        <p className="text-center text-sm text-slate-300 font-semibold mt-3 uppercase tracking-wider">
          Comprehensive Financial Overview
        </p>
      </div>

      <div className="p-8">
        {/* Chart */}
        <div className="relative h-[420px] mb-6 rounded-xl bg-slate-50 border-2 border-slate-200 p-6">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={data} 
              barSize={45}
              margin={{ top: 30, right: 20, left: 20, bottom: 20 }}
            >
              <defs>
                {barColors.map((color, index) => (
                  <linearGradient key={index} id={`barGradient${index}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color.start} />
                    <stop offset="100%" stopColor={color.end} />
                  </linearGradient>
                ))}
              </defs>

              <CartesianGrid 
                strokeDasharray="5 5" 
                stroke="#CBD5E1" 
                strokeOpacity={0.5}
                vertical={false}
              />
              
              <XAxis 
                dataKey="month" 
                tick={{ fill: "#475569", fontWeight: 700, fontSize: 12 }}
                axisLine={{ stroke: "#94A3B8", strokeWidth: 2 }}
                tickLine={false}
                dy={10}
              />
              
              <YAxis
                tick={{ fill: "#475569", fontWeight: 700, fontSize: 12 }}
                axisLine={{ stroke: "#94A3B8", strokeWidth: 2 }}
                tickLine={false}
                tickFormatter={(value) => `₨${value/1000}k`}
              />

              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(203, 213, 225, 0.15)" }} />

              <Bar
                dataKey="value"
                radius={[8, 8, 0, 0]}
                animationDuration={1200}
                animationEasing="ease-out"
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={`url(#barGradient${index % barColors.length})`}
                  />
                ))}
                <LabelList 
                  dataKey="value" 
                  position="top" 
                  formatter={(value: number) => `₨${(value/1000).toFixed(1)}k`}
                  style={{ 
                    fill: "#1E293B", 
                    fontWeight: "bold", 
                    fontSize: 12,
                  }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Summary Statistics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl bg-slate-50 border-2 border-slate-200 p-5 text-center hover:shadow-lg transition-all duration-300">
            <div className="flex justify-center mb-2">
              <div className="bg-slate-800 p-2 rounded-lg">
                <DollarSign className="h-5 w-5 text-white" />
              </div>
            </div>
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Total Revenue</p>
            <p className="text-2xl font-bold text-slate-900">
              ₨{totalRevenue.toLocaleString()}
            </p>
          </div>
          
          <div className="rounded-xl bg-slate-50 border-2 border-slate-200 p-5 text-center hover:shadow-lg transition-all duration-300">
            <div className="flex justify-center mb-2">
              <div className="bg-slate-800 p-2 rounded-lg">
                <Activity className="h-5 w-5 text-white" />
              </div>
            </div>
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Average</p>
            <p className="text-2xl font-bold text-slate-900">
              ₨{avgRevenue.toLocaleString()}
            </p>
          </div>
          
          <div className="rounded-xl bg-slate-50 border-2 border-slate-200 p-5 text-center hover:shadow-lg transition-all duration-300">
            <div className="flex justify-center mb-2">
              <div className="bg-slate-800 p-2 rounded-lg">
                <PieChart className="h-5 w-5 text-white" />
              </div>
            </div>
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Peak Month</p>
            <p className="text-2xl font-bold text-slate-900">
              {peakMonth.month}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}