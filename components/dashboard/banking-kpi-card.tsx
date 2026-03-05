"use client"
import { ArrowUpRight, ArrowDownRight } from "lucide-react"
import { getValueFontSize } from "@/components/dashboard/charts"

type BankingKPICardProps = {
    icon: any
    title: string
    value: string | number
    subtitle?: string
    trend?: "up" | "down"
    trendValue?: string
    gradient: string
    iconBg: string
    delay?: number
}

/* Decorative sparkline wave SVG */
const SparklineWave = ({ gradient }: { gradient: string }) => {
    const gradientId = `wave-${gradient.replace(/[\s/]/g, '-')}`
    return (
        <svg
            viewBox="0 0 200 40"
            preserveAspectRatio="none"
            className="absolute bottom-0 left-0 w-full h-12 opacity-[0.07] group-hover:opacity-[0.15] transition-opacity duration-700"
        >
            <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0.1" />
                </linearGradient>
            </defs>
            <path
                d="M0 30 Q25 10 50 25 T100 20 T150 28 T200 15 V40 H0 Z"
                fill={`url(#${gradientId})`}
                className="text-current"
            />
            <path
                d="M0 35 Q30 20 60 30 T120 22 T180 32 T200 25 V40 H0 Z"
                fill={`url(#${gradientId})`}
                className="text-current"
                opacity="0.5"
            />
        </svg>
    )
}

export const BankingKPICard = ({
    icon: Icon,
    title,
    value,
    subtitle,
    trend,
    trendValue,
    gradient,
    iconBg,
    delay = 0,
}: BankingKPICardProps) => {
    const isPositive = trend === "up"

    return (
        <div
            className={`group relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800/60 p-5 shadow-sm hover:shadow-2xl hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50 transition-all duration-500 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl`}
            style={{
                animationDelay: `${delay}ms`,
                animation: `kpiEntrance 0.6s ease-out ${delay}ms both`,
            }}
        >
            {/* Animated mesh gradient background */}
            <div className={`absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br ${gradient} opacity-[0.06] blur-3xl group-hover:opacity-[0.18] group-hover:scale-110 transition-all duration-700`} />
            <div className={`absolute -left-8 -bottom-8 h-24 w-24 rounded-full bg-gradient-to-tr ${gradient} opacity-[0.04] blur-2xl group-hover:opacity-[0.10] transition-all duration-700`} />

            {/* Sparkline decoration */}
            <SparklineWave gradient={gradient} />

            <div className="relative flex items-start justify-between mb-4">
                {/* Premium Icon Container */}
                <div className="relative flex items-center justify-center">
                    <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-[0.08] blur-xl group-hover:opacity-[0.25] transition-opacity duration-500 rounded-full scale-150`} />
                    <div className={`relative w-14 h-14 rounded-2xl bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 border border-slate-200/80 dark:border-slate-700/50 shadow-sm group-hover:shadow-lg flex items-center justify-center group-hover:scale-110 group-hover:-rotate-3 transition-all duration-500`}>
                        <Icon className={`w-7 h-7 ${iconBg.split(' ')[0]} transition-colors duration-300`} strokeWidth={2} />
                    </div>
                </div>

                {trend && (
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border backdrop-blur-sm ${isPositive
                        ? 'bg-emerald-50/80 border-emerald-200/60 dark:bg-emerald-900/20 dark:border-emerald-800/60'
                        : 'bg-red-50/80 border-red-200/60 dark:bg-red-900/20 dark:border-red-800/60'
                        }`}>
                        {isPositive ? (
                            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                            <ArrowDownRight className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                        )}
                        <span className={`text-xs font-semibold ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                            {trendValue}
                        </span>
                    </div>
                )}
            </div>

            <div className="relative space-y-1.5">
                <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em]">
                    {title}
                </p>
                <p className={`${getValueFontSize(value)} font-semibold text-slate-900 dark:text-slate-50 tracking-tight break-words leading-tight`}>
                    {value}
                </p>
                {subtitle && (
                    <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-1.5">
                        {subtitle}
                    </p>
                )}
            </div>

            {/* Premium animated accent bar */}
            <div className="mt-4 h-[3px] rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                <div className={`h-full w-0 group-hover:w-full bg-gradient-to-r ${gradient} rounded-full transition-all duration-1000 ease-out`} />
            </div>
        </div>
    )
}
