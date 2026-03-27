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
        gradient: "bg-gradient-to-br from-indigo-50/80 to-blue-50/80 border-indigo-100/50 text-indigo-700 dark:from-indigo-900/20 dark:to-blue-900/20 dark:border-indigo-800/30 dark:text-indigo-400",
        iconBadge: "bg-white/80 text-indigo-600 shadow-sm border border-indigo-100 dark:bg-slate-800 dark:border-indigo-800",
        sparkline: "#6366f1",
    },
    emerald: {
        gradient: "bg-gradient-to-br from-teal-50/80 to-emerald-50/80 border-teal-100/50 text-teal-700 dark:from-teal-900/20 dark:to-emerald-900/20 dark:border-teal-800/30 dark:text-teal-400",
        iconBadge: "bg-white/80 text-teal-600 shadow-sm border border-teal-100 dark:bg-slate-800 dark:border-teal-800",
        sparkline: "#10b981",
    },
    rose: {
        gradient: "bg-gradient-to-br from-rose-50/80 to-red-50/80 border-rose-100/50 text-rose-700 dark:from-rose-900/20 dark:to-red-900/20 dark:border-rose-800/30 dark:text-rose-400",
        iconBadge: "bg-white/80 text-rose-600 shadow-sm border border-rose-100 dark:bg-slate-800 dark:border-rose-800",
        sparkline: "#f43f5e",
    },
    amber: {
        gradient: "bg-gradient-to-br from-amber-50/80 to-orange-50/80 border-amber-100/50 text-amber-700 dark:from-amber-900/20 dark:to-orange-900/20 dark:border-amber-800/30 dark:text-amber-400",
        iconBadge: "bg-white/80 text-amber-600 shadow-sm border border-amber-100 dark:bg-slate-800 dark:border-amber-800",
        sparkline: "#f59e0b",
    },
    blue: {
        gradient: "bg-gradient-to-br from-blue-50/80 to-cyan-50/80 border-blue-100/50 text-blue-700 dark:from-blue-900/20 dark:to-cyan-900/20 dark:border-blue-800/30 dark:text-blue-400",
        iconBadge: "bg-white/80 text-blue-600 shadow-sm border border-blue-100 dark:bg-slate-800 dark:border-blue-800",
        sparkline: "#3b82f6",
    },
    violet: {
        gradient: "bg-gradient-to-br from-fuchsia-50/80 to-purple-50/80 border-fuchsia-100/50 text-fuchsia-700 dark:from-fuchsia-900/20 dark:to-purple-900/20 dark:border-fuchsia-800/30 dark:text-fuchsia-400",
        iconBadge: "bg-white/80 text-fuchsia-600 shadow-sm border border-fuchsia-100 dark:bg-slate-800 dark:border-fuchsia-800",
        sparkline: "#8b5cf6",
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
            "border rounded-2xl shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5",
            colors.gradient
        )}>
            <CardContent className="p-5 flex items-center justify-between relative overflow-hidden h-full">
                <div className="space-y-1.5 flex-1 max-w-[calc(100%-3rem)] z-10 flex flex-col justify-between h-full">
                    <div>
                        <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest truncate">
                            {title}
                        </p>
                        <h3 className="text-2xl font-black tracking-tight mt-1">
                            {value}
                        </h3>
                    </div>

                    {/* Additional Sub info */}
                    {(trend !== undefined || comparisonValue || subtitle) && (
                        <div className="pt-3 space-y-1 mt-auto">
                            {trend !== undefined && Math.abs(trend).toFixed(1) !== "0.0" && (
                                <div className="flex items-center gap-1.5 mt-1.5">
                                    <div className={cn(
                                        "flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold shadow-sm",
                                        trend > 0 ? "bg-emerald-50/90 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400" :
                                            trend < 0 ? "bg-rose-50/90 text-rose-700 dark:bg-rose-900/50 dark:text-rose-400" :
                                                "bg-slate-50/90 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400"
                                    )}>
                                        {TrendIcon && <TrendIcon className="h-3 w-3" />}
                                        {Math.abs(trend).toFixed(1)}%
                                    </div>
                                    <span className="text-[10px] opacity-70 italic font-medium">vs prior</span>
                                </div>
                            )}

                            {comparisonValue && (
                                <p className="text-[10px] opacity-80 truncate font-medium">
                                    {comparisonLabel}: <span className="font-bold">{comparisonValue}</span>
                                </p>
                            )}
                            {subtitle && (
                                <p className="text-[10px] opacity-70 italic truncate">
                                    {subtitle}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <div className={cn("flex shrink-0 h-12 w-12 items-center justify-center rounded-xl z-10 self-start", colors.iconBadge)}>
                    <Icon className="h-5 w-5" />
                </div>

                {/* Sparkline background */}
                {chartData.length > 1 && (
                    <div className="absolute right-0 bottom-0 w-32 h-16 opacity-30 pointer-events-none">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <Line
                                    type="monotone"
                                    dataKey="value"
                                    stroke={colors.sparkline}
                                    strokeWidth={3}
                                    dot={false}
                                    isAnimationActive={true}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
