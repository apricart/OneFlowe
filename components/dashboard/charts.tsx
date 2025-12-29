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
import { cn } from "@/lib/utils"
import { TrendingUp, Sparkles, Award, BarChart3 } from "lucide-react"

type Props = {
  data: {
    month: string
    value: number
  }[]
}

const barColors = [
  { start: "#FF6B9D", end: "#C44569", glow: "rgba(255, 107, 157, 0.4)" },
  { start: "#FFA07A", end: "#FF6347", glow: "rgba(255, 160, 122, 0.4)" },
  { start: "#FFD700", end: "#FFA500", glow: "rgba(255, 215, 0, 0.4)" },
  { start: "#98D8C8", end: "#6BCF7F", glow: "rgba(152, 216, 200, 0.4)" },
  { start: "#4ECDC4", end: "#1AA3A3", glow: "rgba(78, 205, 196, 0.4)" },
  { start: "#A8E6CF", end: "#56C596", glow: "rgba(168, 230, 207, 0.4)" },
  { start: "#95E1D3", end: "#38ADA9", glow: "rgba(149, 225, 211, 0.4)" },
  { start: "#F38181", end: "#E74C3C", glow: "rgba(243, 129, 129, 0.4)" },
  { start: "#AA96DA", end: "#8B5FBF", glow: "rgba(170, 150, 218, 0.4)" },
  { start: "#FCBAD3", end: "#F78FB3", glow: "rgba(252, 186, 211, 0.4)" },
  { start: "#FFFFD2", end: "#FFEB99", glow: "rgba(255, 255, 210, 0.4)" },
  { start: "#A8D8EA", end: "#5FA8D3", glow: "rgba(168, 216, 234, 0.4)" },
]

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  
  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-purple-400/50 bg-white/95 backdrop-blur-xl px-6 py-5 shadow-2xl animate-in fade-in zoom-in duration-200">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-50/80 via-pink-50/60 to-white/40"></div>
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-2 w-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 animate-pulse"></div>
          <p className="font-bold text-purple-900 text-base">{payload[0].payload.month}</p>
        </div>
        <p className="text-3xl font-extrabold bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 bg-clip-text text-transparent">
          ₨{payload[0].value.toLocaleString()}
        </p>
        <p className="text-xs text-purple-600 mt-2 font-semibold uppercase tracking-wider">Monthly Revenue</p>
      </div>
    </div>
  )
}

type TrendPoint = { label: string; value: number }
type ChartDatum = { label: string; value: number }

// ----------------- Currency Formatter -----------------
const currencyFormatter = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  maximumFractionDigits: 0,
})

// ----------------- MESMERIZING Yearly Spline Chart -----------------
export type SalesData = { month: string; sales: number }
export type YearlySalesSplineChartProps = {
  yearlySalesData: SalesData[]
  avgSales: number
}

export function YearlySalesSplineChart({ yearlySalesData, avgSales }: YearlySalesSplineChartProps) {
  const totalSales = yearlySalesData.reduce((sum, item) => sum + item.sales, 0)
  const peakMonth = yearlySalesData.reduce((max, item) => item.sales > max.sales ? item : max, yearlySalesData[0])
  
  return (
    <div className="relative overflow-hidden rounded-3xl border border-purple-200/50 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-8 shadow-2xl hover:shadow-purple-400/30 transition-all duration-700 group">
      {/* Animated Background Orbs */}
      <div className="absolute -top-20 -right-20 w-60 h-60 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-gradient-to-br from-blue-400/20 to-indigo-400/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-purple-300/10 to-pink-300/10 rounded-full blur-3xl animate-spin" style={{ animationDuration: '20s' }}></div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-purple-400 rounded-full animate-ping"></div>
        <div className="absolute top-3/4 right-1/4 w-1.5 h-1.5 bg-pink-400 rounded-full animate-ping delay-500"></div>
        <div className="absolute bottom-1/4 left-1/2 w-2 h-2 bg-blue-400 rounded-full animate-ping delay-1000"></div>
      </div>

      {/* Header */}
      <div className="relative flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl blur-xl opacity-50 animate-pulse"></div>
            <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-br from-purple-500 via-purple-600 to-blue-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-500">
              <TrendingUp className="h-7 w-7 text-white animate-pulse" />
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-extrabold bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent mb-1">
              Yearly Sales Performance
            </h2>
            <p className="text-sm text-purple-600 font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Comprehensive annual revenue analysis
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="relative grid grid-cols-3 gap-4 mb-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500/10 to-purple-600/10 backdrop-blur-sm p-4 border border-purple-300/30 hover:scale-105 transition-transform duration-300 group/card">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity"></div>
          <div className="relative">
            <p className="text-xs font-bold text-purple-700 uppercase tracking-wider mb-2 flex items-center gap-1">
              <BarChart3 className="h-3 w-3" />
              Total Revenue
            </p>
            <p className="text-2xl font-extrabold bg-gradient-to-r from-purple-700 to-purple-900 bg-clip-text text-transparent">
              ₨{totalSales.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-600/10 backdrop-blur-sm p-4 border border-blue-300/30 hover:scale-105 transition-transform duration-300 group/card">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity"></div>
          <div className="relative">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-2 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Average
            </p>
            <p className="text-2xl font-extrabold bg-gradient-to-r from-blue-700 to-blue-900 bg-clip-text text-transparent">
              ₨{Math.round(avgSales).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-600/10 backdrop-blur-sm p-4 border border-amber-300/30 hover:scale-105 transition-transform duration-300 group/card">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity"></div>
          <div className="relative">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Award className="h-3 w-3" />
              Peak Month
            </p>
            <p className="text-2xl font-extrabold bg-gradient-to-r from-amber-700 to-amber-900 bg-clip-text text-transparent">
              {peakMonth.month}
            </p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="relative h-[380px] rounded-2xl bg-white/50 backdrop-blur-sm p-4 border border-white/60 shadow-inner">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-100/10 via-blue-100/10 to-indigo-100/10 rounded-2xl"></div>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={yearlySalesData}
            margin={{ top: 20, right: 30, left: 10, bottom: 10 }}
          >
            <defs>
              <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.9} />
                <stop offset="30%" stopColor="#3B82F6" stopOpacity={0.6} />
                <stop offset="60%" stopColor="#06B6D4" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#F0ABFC" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="glowGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#8B5CF6" />
                <stop offset="30%" stopColor="#3B82F6" />
                <stop offset="70%" stopColor="#06B6D4" />
                <stop offset="100%" stopColor="#F0ABFC" />
              </linearGradient>
              <filter id="shadow">
                <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#8B5CF6" floodOpacity="0.3"/>
              </filter>
              <filter id="glow">
                <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            <CartesianGrid 
              strokeDasharray="8 8" 
              stroke="#C7D2FE" 
              strokeOpacity={0.3}
              vertical={false}
            />
            <XAxis 
              dataKey="month" 
              tick={{ fill: "#7C3AED", fontWeight: 700, fontSize: 13 }}
              axisLine={{ stroke: "#DDD6FE", strokeWidth: 2 }}
              tickLine={false}
              dy={5}
            />
            <YAxis
              tick={{ fill: "#7C3AED", fontWeight: 700, fontSize: 13 }}
              tickFormatter={(value) => `₨${value/1000}k`}
              axisLine={{ stroke: "#DDD6FE", strokeWidth: 2 }}
              tickLine={false}
              dx={-5}
            />

            <Tooltip 
              contentStyle={{
                background: "rgba(255, 255, 255, 0.98)",
                borderRadius: "20px",
                border: "2px solid #8B5CF6",
                boxShadow: "0 20px 60px rgba(139, 92, 246, 0.4)",
                padding: "16px 20px",
                backdropFilter: "blur(12px)",
              }}
              labelStyle={{ 
                color: "#6366F1", 
                fontWeight: "bold",
                fontSize: "14px",
                marginBottom: "6px"
              }}
              formatter={(value: number) => [`₨${value.toLocaleString()}`, "Sales"]}
            />

            <ReferenceLine 
              y={avgSales} 
              label={{ 
                value: `Avg: ₨${Math.round(avgSales).toLocaleString()}`, 
                position: "right",
                fill: "#F59E0B",
                fontWeight: "bold",
                fontSize: 12
              }} 
              stroke="#F59E0B" 
              strokeWidth={3}
              strokeDasharray="10 5"
              opacity={0.7}
              filter="url(#glow)"
            />

            <Area
              type="monotone"
              dataKey="sales"
              stroke="url(#glowGradient)"
              strokeWidth={5}
              fill="url(#salesGradient)"
              filter="url(#shadow)"
              dot={{ 
                r: 7, 
                fill: "#FFFFFF",
                stroke: "#8B5CF6", 
                strokeWidth: 4,
                filter: "url(#glow)"
              }}
              activeDot={{ 
                r: 10,
                fill: "#8B5CF6",
                stroke: "#FFFFFF",
                strokeWidth: 4,
                filter: "url(#glow)"
              }}
              animationDuration={2500}
              animationEasing="ease-in-out"
              animationBegin={200}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ----------------- MESMERIZING Tooltip Component -----------------
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
    <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-400/50 bg-white/95 backdrop-blur-xl px-5 py-4 shadow-2xl animate-in fade-in zoom-in duration-200">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/80 via-teal-50/60 to-white/40"></div>
      <div className="relative">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-2 w-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 animate-pulse"></div>
          <p className="font-bold text-emerald-900 text-sm">{label}</p>
        </div>
        <p className="text-2xl font-extrabold bg-gradient-to-r from-emerald-600 to-teal-700 bg-clip-text text-transparent">{formatted}</p>
      </div>
    </div>
  )
}

// ----------------- MESMERIZING Trend Area Chart -----------------
export function TrendAreaChart({ data, className }: { data: TrendPoint[]; className?: string }) {
  const chartData: ChartDatum[] = useMemo(
    () => data.map((point) => ({ label: point.label, value: point.value })),
    [data]
  )

  const totalValue = chartData.reduce((sum, item) => sum + item.value, 0)
  const peakDay = chartData.reduce((max, item) => item.value > max.value ? item : max, chartData[0])

  return (
    <div className={cn("w-full relative", className)}>
      <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8 shadow-2xl hover:shadow-purple-500/50 transition-all duration-700 group">
        {/* Animated Background Orbs */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-gradient-to-br from-purple-500/30 to-pink-500/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-20 -right-32 w-80 h-80 bg-gradient-to-br from-cyan-500/30 to-blue-500/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>

        {/* Mini Stats */}
        <div className="relative grid grid-cols-2 gap-4 mb-6">
          <div className="group/stat rounded-2xl bg-white/10 backdrop-blur-xl p-5 border border-white/20 hover:bg-white/15 hover:border-white/30 transition-all duration-500 hover:scale-105 hover:-translate-y-1 shadow-lg hover:shadow-purple-500/30">
            <p className="text-xs font-bold text-purple-200 uppercase tracking-widest mb-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></span>
              Total Value
            </p>
            <p className="text-3xl font-black bg-gradient-to-r from-purple-300 via-pink-300 to-purple-300 bg-clip-text text-transparent animate-pulse">
              ₨{totalValue.toLocaleString()}
            </p>
            <div className="mt-2 h-1 w-0 group-hover/stat:w-full bg-gradient-to-r from-purple-400 to-pink-400 rounded-full transition-all duration-700"></div>
          </div>
          <div className="group/stat rounded-2xl bg-white/10 backdrop-blur-xl p-5 border border-white/20 hover:bg-white/15 hover:border-white/30 transition-all duration-500 hover:scale-105 hover:-translate-y-1 shadow-lg hover:shadow-cyan-500/30">
            <p className="text-xs font-bold text-cyan-200 uppercase tracking-widest mb-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></span>
              Peak Day
            </p>
            <p className="text-3xl font-black bg-gradient-to-r from-cyan-300 via-blue-300 to-cyan-300 bg-clip-text text-transparent">
              {peakDay.label}
            </p>
            <div className="mt-2 h-1 w-0 group-hover/stat:w-full bg-gradient-to-r from-cyan-400 to-blue-400 rounded-full transition-all duration-700"></div>
          </div>
        </div>

        {/* Chart */}
        <div className="relative h-80 rounded-2xl bg-white/5 backdrop-blur-2xl p-6 border border-white/20 shadow-2xl overflow-hidden group-hover:bg-white/10 transition-all duration-700">
          {/* Chart glow effect */}
          <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/10 via-transparent to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
          
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#A78BFA" stopOpacity={0.9} />
                  <stop offset="25%" stopColor="#C084FC" stopOpacity={0.7} />
                  <stop offset="50%" stopColor="#E879F9" stopOpacity={0.5} />
                  <stop offset="75%" stopColor="#22D3EE" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#06B6D4" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="strokeGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#A78BFA" />
                  <stop offset="25%" stopColor="#C084FC" />
                  <stop offset="50%" stopColor="#E879F9" />
                  <stop offset="75%" stopColor="#F472B6" />
                  <stop offset="100%" stopColor="#22D3EE" />
                </linearGradient>
                <filter id="areaGlow">
                  <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                <filter id="areaShadow">
                  <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#A78BFA" floodOpacity="0.6"/>
                </filter>
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="#FFFFFF" 
                strokeOpacity={0.1}
                vertical={false} 
              />
              <XAxis 
                dataKey="label" 
                tickLine={false} 
                axisLine={{ stroke: "#A78BFA", strokeWidth: 2, strokeOpacity: 0.3 }} 
                tickMargin={12} 
                tick={{ fill: "#E9D5FF", fontWeight: 600, fontSize: 11 }}
              />
              <YAxis
                tickFormatter={(value) => `₨${value/1000}k`}
                width={75}
                axisLine={{ stroke: "#A78BFA", strokeWidth: 2, strokeOpacity: 0.3 }}
                tickLine={false}
                tickMargin={12}
                tick={{ fill: "#E9D5FF", fontWeight: 600, fontSize: 11 }}
              />
              <Tooltip content={<ChartTooltip prefix="currency" />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="url(#strokeGradient)"
                strokeWidth={4}
                fillOpacity={1}
                fill="url(#areaGradient)"
                animationDuration={2500}
                animationEasing="ease-in-out"
                filter="url(#areaShadow)"
                dot={{ 
                  r: 7, 
                  fill: "#FFFFFF",
                  stroke: "#A78BFA", 
                  strokeWidth: 3,
                  filter: "url(#areaGlow)"
                }}
                activeDot={{ 
                  r: 11,
                  fill: "#C084FC",
                  stroke: "#FFFFFF",
                  strokeWidth: 3,
                  filter: "url(#areaGlow)"
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
// ----------------- MESMERIZING Comparison Bar Chart -----------------
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
    <div className={cn("h-72 w-full", className)}>
      {title && (
        <div className="mb-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-lg">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <p className="text-xl font-extrabold bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
            {title}
          </p>
        </div>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 12, right: 16, left: -8, bottom: 8 }}>
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#EC4899" />
              <stop offset="50%" stopColor="#F43F5E" />
              <stop offset="100%" stopColor="#FB7185" />
            </linearGradient>
            <filter id="barShadow">
              <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#EC4899" floodOpacity="0.4"/>
            </filter>
          </defs>
          <CartesianGrid 
            strokeDasharray="6 6" 
            stroke="#FBCFE8" 
            strokeOpacity={0.5}
            vertical={false} 
          />
          <XAxis 
            dataKey="label" 
            tickLine={false} 
            axisLine={{ stroke: "#FBCFE8", strokeWidth: 2 }} 
            tickMargin={10} 
            tick={{ fill: "#BE123C", fontWeight: 700, fontSize: 12 }}
          />
          <YAxis 
            allowDecimals={false} 
            axisLine={{ stroke: "#FBCFE8", strokeWidth: 2 }} 
            tickLine={false} 
            tick={{ fill: "#BE123C", fontWeight: 700, fontSize: 12 }}
          />
          <Tooltip 
            content={<ChartTooltip prefix="count" />} 
            cursor={{ fill: "rgba(251, 207, 232, 0.2)" }} 
          />
          <Bar
            dataKey="value"
            radius={[14, 14, 0, 0]}
            fill="url(#barGradient)"
            filter="url(#barShadow)"
            animationDuration={1800}
            animationEasing="ease-out"
            label={{ 
              position: "top", 
              fill: "#BE123C", 
              fontSize: 13, 
              fontWeight: "bold",
              offset: 10
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ----------------- EXTRAORDINARY Sales Bar Chart -----------------
export default function SalesBarChart({ data }: Props) {
  const totalRevenue = data.reduce((sum, item) => sum + item.value, 0)
  const avgRevenue = Math.round(totalRevenue / data.length)
  const peakMonth = data.reduce((max, item) => item.value > max.value ? item : max, data[0])
  const peakValue = peakMonth.value

  return (
    <div className="relative overflow-hidden rounded-3xl border border-purple-200/50 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-8 shadow-2xl hover:shadow-purple-400/40 transition-all duration-700 group">
      {/* Animated Cosmic Background */}
      <div className="absolute top-0 left-0 w-80 h-80 bg-gradient-to-br from-purple-400/20 via-pink-400/20 to-rose-400/20 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-br from-pink-400/20 via-rose-400/20 to-orange-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-purple-300/10 via-pink-300/10 to-rose-300/10 rounded-full blur-3xl animate-spin" style={{ animationDuration: '25s' }}></div>

      {/* Floating Sparkles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1.5 h-1.5 bg-white rounded-full animate-ping"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animationDelay: `${i * 0.3}s`,
              animationDuration: '3s'
            }}
          />
        ))}
      </div>
      {/* Header */}
     <div className="relative flex items-center justify-center mb-8 gap-4">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 rounded-full blur-xl opacity-60 animate-pulse"></div>
          <Sparkles className="relative h-8 w-8 text-purple-600 animate-bounce" />
        </div>
        <h2 className="text-3xl font-extrabold bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 bg-clip-text text-transparent animate-in slide-in-from-top duration-700">
          Monthly Sales Performance
        </h2>
        <div className="h-3 w-3 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 animate-bounce delay-300"></div>
      </div>

      {/* Subtitle */}
      <p className="relative text-center text-sm text-purple-600 font-semibold mb-6 animate-in fade-in duration-1000">
        Track your revenue growth month by month
      </p>

      {/* Chart */}
      <div className="relative h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={data} 
            barSize={50}
            margin={{ top: 30, right: 20, left: 20, bottom: 20 }}
          >
            <defs>
              {barColors.map((color, index) => (
                <linearGradient key={index} id={`barGradient${index}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color.start} stopOpacity={0.95} />
                  <stop offset="100%" stopColor={color.end} stopOpacity={0.85} />
                </linearGradient>
              ))}
              <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
                <feOffset dx="0" dy="4" result="offsetblur"/>
                <feComponentTransfer>
                  <feFuncA type="linear" slope="0.3"/>
                </feComponentTransfer>
                <feMerge>
                  <feMergeNode/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="#E9D5FF" 
              strokeOpacity={0.4}
              vertical={false}
            />
            
            <XAxis 
              dataKey="month" 
              tick={{ fill: "#7C3AED", fontWeight: 700, fontSize: 13 }}
              axisLine={{ stroke: "#C4B5FD", strokeWidth: 2 }}
              tickLine={false}
              dy={10}
            />
            
            <YAxis
              tick={{ fill: "#7C3AED", fontWeight: 700, fontSize: 13 }}
              axisLine={{ stroke: "#C4B5FD", strokeWidth: 2 }}
              tickLine={false}
              tickFormatter={(value) => `₨${value/1000}k`}
            />

            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(167, 139, 250, 0.1)" }} />

            <Bar
              dataKey="value"
              radius={[12, 12, 0, 0]}
              filter="url(#shadow)"
              animationDuration={1500}
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
                  fill: "#6B21A8", 
                  fontWeight: "bold", 
                  fontSize: 13,
                  textShadow: "0 2px 4px rgba(0,0,0,0.1)"
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Stats */}
      <div className="relative mt-6 grid grid-cols-3 gap-4">
        <div className="rounded-2xl bg-gradient-to-br from-purple-100 to-purple-200 p-4 text-center transform hover:scale-105 transition-transform duration-300">
          <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Total Revenue</p>
          <p className="text-xl font-bold text-purple-900 mt-1">
            ₨{data.reduce((sum, item) => sum + item.value, 0).toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-pink-100 to-pink-200 p-4 text-center transform hover:scale-105 transition-transform duration-300">
          <p className="text-xs font-semibold text-pink-700 uppercase tracking-wide">Average</p>
          <p className="text-xl font-bold text-pink-900 mt-1">
            ₨{Math.round(data.reduce((sum, item) => sum + item.value, 0) / data.length).toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-rose-100 to-rose-200 p-4 text-center transform hover:scale-105 transition-transform duration-300">
          <p className="text-xs font-semibold text-rose-700 uppercase tracking-wide">Peak Month</p>
          <p className="text-xl font-bold text-rose-900 mt-1">
            {data.reduce((max, item) => item.value > max.value ? item : max, data[0]).month}
          </p>
        </div>
      </div>
    </div>
  )
}
