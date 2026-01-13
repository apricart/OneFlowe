"use client"
import { ArrowUpRight, ArrowDownRight } from "lucide-react"

type BankingKPICardProps = {
    icon: any
    title: string
    value: string | number
    trend?: "up" | "down"
    trendValue?: string
    gradient: string
    iconBg: string
}

export const BankingKPICard = ({
    icon: Icon,
    title,
    value,
    trend,
    trendValue,
    gradient,
    iconBg
}: BankingKPICardProps) => {
    const isPositive = trend === "up"

    return (
        <div className={`group relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-xl transition-all duration-500 bg-white dark:bg-slate-900`}>
            {/* Background Gradient Glow */}
            <div className={`absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${gradient} opacity-5 blur-3xl group-hover:opacity-15 transition-opacity duration-700`}></div>

            <div className="relative flex items-start justify-between mb-4">
                {/* Icon Container - Mesmerizing & Non-Boxy */}
                <div className={`relative flex items-center justify-center`}>
                    <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-10 blur-xl group-hover:opacity-30 transition-opacity duration-500 rounded-full`}></div>
                    <div className={`relative w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-500`}>
                        <Icon className={`w-7 h-7 ${iconBg.split(' ')[0]} transition-colors duration-300`} strokeWidth={2.5} />
                    </div>
                </div>

                {trend && (
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${isPositive ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' : 'bg-red-50/50 border-red-200 dark:bg-red-900/20 dark:border-red-800'}`}>
                        {isPositive ? (
                            <ArrowUpRight className={`w-3.5 h-3.5 ${isPositive ? 'text-emerald-600' : 'text-red-600'}`} />
                        ) : (
                            <ArrowDownRight className={`w-3.5 h-3.5 ${isPositive ? 'text-emerald-600' : 'text-red-600'}`} />
                        )}
                        <span className={`text-xs font-bold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                            {trendValue}
                        </span>
                    </div>
                )}
            </div>

            <div className="relative space-y-1">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.1em]">
                    {title}
                </p>
                <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                    {value}
                </p>
            </div>

            {/* Modern Accent Bar */}
            <div className={`mt-4 h-1 w-0 group-hover:w-full bg-gradient-to-r ${gradient} rounded-full transition-all duration-700 ease-out`}></div>
        </div>
    )
}
