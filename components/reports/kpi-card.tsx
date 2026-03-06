"use client"

import { Card, CardContent } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { cn } from "@/lib/utils"
import { LineChart, Line, ResponsiveContainer } from "recharts"
interface KPICardProps {
    title: string
    value: string | number
    trend?: number // percentage change vs previous period
    trendData?: number[] // array of values for sparkline
    icon: React.ElementType
    colorScheme?: "indigo" | "emerald" | "rose" | "amber" | "blue" | "violet"
    comparisonValue?: string | number
    comparisonLabel?: string
    subtitle?: string
}

const colorMap = {
    indigo: {
        bg: "bg-indigo-50 dark:bg-indigo-950/30",
        iconBg: "bg-indigo-100 dark:bg-indigo-900/40",
        iconColor: "text-indigo-600 dark:text-indigo-400",
        sparkline: "#6366f1",
        border: "border-indigo-100 dark:border-indigo-900/30",
        accent: "from-indigo-500 to-indigo-600",
    },
    emerald: {
        bg: "bg-emerald-50 dark:bg-emerald-950/30",
        iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
        iconColor: "text-emerald-600 dark:text-emerald-400",
        sparkline: "#10b981",
        border: "border-emerald-100 dark:border-emerald-900/30",
        accent: "from-emerald-500 to-emerald-600",
    },
    rose: {
        bg: "bg-rose-50 dark:bg-rose-950/30",
        iconBg: "bg-rose-100 dark:bg-rose-900/40",
        iconColor: "text-rose-600 dark:text-rose-400",
        sparkline: "#f43f5e",
        border: "border-rose-100 dark:border-rose-900/30",
        accent: "from-rose-500 to-rose-600",
    },
    amber: {
        bg: "bg-amber-50 dark:bg-amber-950/30",
        iconBg: "bg-amber-100 dark:bg-amber-900/40",
        iconColor: "text-amber-600 dark:text-amber-400",
        sparkline: "#f59e0b",
        border: "border-amber-100 dark:border-amber-900/30",
        accent: "from-amber-500 to-amber-600",
    },
    blue: {
        bg: "bg-blue-50 dark:bg-blue-950/30",
        iconBg: "bg-blue-100 dark:bg-blue-900/40",
        iconColor: "text-blue-600 dark:text-blue-400",
        sparkline: "#3b82f6",
        border: "border-blue-100 dark:border-blue-900/30",
        accent: "from-blue-500 to-blue-600",
    },
    violet: {
        bg: "bg-violet-50 dark:bg-violet-950/30",
        iconBg: "bg-violet-100 dark:bg-violet-900/40",
        iconColor: "text-violet-600 dark:text-violet-400",
        sparkline: "#8b5cf6",
        border: "border-violet-100 dark:border-violet-900/30",
        accent: "from-violet-500 to-violet-600",
    },
}

export function KPICard({
    title,
    value,
    trend,
    trendData,
    icon: Icon,
    colorScheme = "indigo",
    comparisonValue,
    comparisonLabel,
    subtitle,
}: KPICardProps) {
    const colors = colorMap[colorScheme]
    const chartData = trendData?.map((v, i) => ({ value: v, index: i })) || []

    const TrendIcon = trend !== undefined
        ? trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus
        : null

    return (
        <Card className={cn(
            "relative overflow-hidden border shadow-sm hover:shadow-md transition-all duration-300 group",
            colors.border,
            "bg-white dark:bg-slate-900"
        )}>
            {/* Accent gradient bar at top */}
            <div className={cn("absolute top-0 left-0 right-0 h-1 bg-gradient-to-r", colors.accent)} />

            <CardContent className="p-5 pt-6">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", colors.iconBg)}>
                                <Icon className={cn("h-4 w-4", colors.iconColor)} />
                            </div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                {title}
                            </p>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{value}</h3>

                        {/* Trend indicator */}
                        {trend !== undefined && (
                            <div className="flex items-center gap-1.5 mt-1.5">
                                <div className={cn(
                                    "flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold",
                                    trend > 0 ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" :
                                        trend < 0 ? "bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400" :
                                            "bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                                )}>
                                    {TrendIcon && <TrendIcon className="h-3 w-3" />}
                                    {Math.abs(trend).toFixed(1)}%
                                </div>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500">vs prev period</span>
                            </div>
                        )}

                        {/* Comparison value */}
                        {comparisonValue && (
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                                {comparisonLabel}: <span className="font-semibold text-slate-500 dark:text-slate-400">{comparisonValue}</span>
                            </p>
                        )}
                        {subtitle && (
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 italic">
                                {subtitle}
                            </p>
                        )}
                    </div>

                    {/* Sparkline */}
                    {chartData.length > 1 && (
                        <div className="w-24 h-12 opacity-70 group-hover:opacity-100 transition-opacity">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData}>
                                    <Line
                                        type="monotone"
                                        dataKey="value"
                                        stroke={colors.sparkline}
                                        strokeWidth={2}
                                        dot={false}
                                        isAnimationActive={true}
                                        animationDuration={1000}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
