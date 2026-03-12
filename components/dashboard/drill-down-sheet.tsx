"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import useSWR from "swr"
import { formatPKR, cn } from "@/lib/utils"
import { format } from "date-fns"
import { fetcher } from "@/lib/fetcher"

const formatDuration = (mins: number) => {
    if (mins <= 0) return "0m"
    if (mins < 60) return `${mins}m`
    const h = Math.floor(mins / 60)
    const m = mins % 60
    if (h < 24) return m > 0 ? `${h}h ${m}m` : `${h}h`
    const d = Math.floor(h / 24)
    const hRemaining = h % 24
    return hRemaining > 0 ? `${d}d ${hRemaining}h` : `${d}d`
}
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Loader2, Calendar, AlertCircle, CheckCircle2, Package, TrendingUp,
    ArrowUpRight, ArrowDownRight, Activity, Zap, Clock, Award, Hash, Search, Info, Box, ChevronRight, ArrowDownAZ, ArrowDown01
} from "lucide-react"
import { Badge } from "@/components/ui/badge"

import { GlobalDateFilter, type FilterPreset } from "@/components/dashboard/global-date-filter"
import type { DateRange } from "@/lib/hooks/use-sales-performance"

export type DrillDownType = "REVENUE" | "REJECTED" | "FULFILLED" | "ORDERS" | "REFUNDED"

interface DrillDownSheetProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    type: DrillDownType | null
    organizationId?: string | null
    branchId?: string | null
    branchIds?: string[]
    defaultDateRange?: DateRange | null
    title?: string
    compare?: boolean
}

const TYPE_CONFIG = {
    REVENUE: {
        title: "Revenue Insights",
        icon: TrendingUp,
        color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20",
        columns: [
            { key: "tid", label: "Transaction ID" },
            { key: "customerName", label: "Customer" },
            { key: "taxAmount", label: "Tax", isCurrency: true },
            { key: "netValue", label: "Net Profit", isCurrency: true },
        ]
    },
    REJECTED: {
        title: "Rejected Orders Analysis",
        icon: AlertCircle,
        color: "text-red-600 bg-red-50 dark:bg-red-900/20",
        columns: [
            { key: "tid", label: "Order ID" },
            { key: "rejectionReason", label: "Reason" },
            { key: "rejectedBy", label: "Rejected By" },
            { key: "timeElapsed", label: "Time Elapsed" },
        ]
    },
    FULFILLED: {
        title: "Fulfillment Performance",
        icon: CheckCircle2,
        color: "text-teal-600 bg-teal-50 dark:bg-teal-900/20",
        columns: [
            { key: "tid", label: "Order ID" },
            { key: "preparationTime", label: "Prep Time" },
            { key: "fulfilledBy", label: "Fulfilled By" },
            { key: "grossValue", label: "Total Value", isCurrency: true },
        ]
    },
    ORDERS: {
        title: "Order Volume Breakdown",
        icon: Package,
        color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20",
        columns: [
            { key: "tid", label: "Order ID" },
            { key: "customerName", label: "Customer" },
            { key: "grossValue", label: "Total", isCurrency: true },
            { key: "status", label: "Status", isBadge: true },
        ]
    },
    REFUNDED: {
        title: "Refunded Orders Analysis",
        icon: AlertCircle,
        color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20",
        columns: [
            { key: "tid", label: "Order ID" },
            { key: "refundAmount", label: "Refund Amount", isCurrency: true },
            { key: "grossValue", label: "Original Value", isCurrency: true },
        ]
    }
}

const BIInsightCard = ({ title, value, subvalue, icon: Icon, trend, colorClass }: any) => (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col gap-1", colorClass)}
    >
        <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{title}</span>
            <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800">
                <Icon className="w-3.5 h-3.5 opacity-80" />
            </div>
        </div>
        <div className="flex items-end justify-between mt-1">
            <span className="text-lg font-bold tracking-tight">{value}</span>
            {trend && (
                <span className={cn("text-[10px] font-black flex items-center px-1.5 py-0.5 rounded-full",
                    trend.includes('Healthy') || trend.includes('Efficient') || trend.includes('Optimal')
                        ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30"
                        : "text-rose-600 bg-rose-50 dark:bg-rose-950/30")}>
                    {trend}
                </span>
            )}
        </div>
        {subvalue && <span className="text-[10px] font-medium opacity-50 mt-1">{subvalue}</span>}
    </motion.div>
)

export function DrillDownSheet({
    isOpen,
    onOpenChange,
    type,
    organizationId,
    branchId,
    branchIds,
    defaultDateRange,
    title,
    compare
}: DrillDownSheetProps): React.ReactElement | null {
    // Internal localized date range state for the drill down
    const [localDateRange, setLocalDateRange] = useState<DateRange | null>(null)
    const [activePreset, setActivePreset] = useState<FilterPreset>("today")
    const [expandedRow, setExpandedRow] = useState<string | null>(null)
    const [refundType, setRefundType] = useState<"all" | "full" | "partial">("all")
    const [sortBy, setSortBy] = useState<"date" | "value">("date")

    useEffect(() => {
        if (isOpen) {
            setLocalDateRange(defaultDateRange || null)
            setActivePreset(defaultDateRange ? "custom" : "today")
            setExpandedRow(null)
            setSortBy("date")
        }
    }, [isOpen, defaultDateRange])

    const url = useMemo(() => {
        if (!isOpen || !type) return null

        const params = new URLSearchParams()
        params.set("type", type)
        // Hardcoded localized date filter logic just for the demo sheet
        if (localDateRange) {
            params.set("startDate", localDateRange.startDate.toISOString())
            params.set("endDate", localDateRange.endDate.toISOString())
        }
        params.set("sortBy", sortBy)
        if (compare) params.set("compare", "true")
        if (type === "REFUNDED") {
            params.set("refundType", refundType)
        }
        if (sortBy === "value") {
            params.set("sortBy", "value")
        }

        if (organizationId && organizationId !== "null") params.set("organizationId", organizationId)
        if (branchIds && branchIds.length > 0) {
            params.set("branchIds", branchIds.join(","))
        } else if (branchId && branchId !== "null") {
            params.set("branchId", branchId)
        }

        return `/api/v1/analytics/drill-down?${params.toString()}`
    }, [isOpen, type, organizationId, branchId, branchIds, localDateRange, refundType, sortBy])

    const { data, isLoading } = useSWR<{ items: any[], summary: any, comparison: any, total: number }>(url, fetcher, {
        revalidateOnFocus: false
    })

    const items = data?.items || []
    const summary = data?.summary || {}
    const comparison = data?.comparison || null
    const config = type ? TYPE_CONFIG[type] : null

    const getTrend = useCallback((current: number, prev: number) => {
        if (!prev || prev === 0) return null
        const diff = current - prev
        const percentage = (diff / prev) * 100
        const isUp = diff >= 0
        return `${isUp ? '+' : ''}${percentage.toFixed(1)}%`
    }, [])

    const handleDateChange = useCallback((range: DateRange | null, preset: FilterPreset) => {
        setLocalDateRange(range)
        setActivePreset(preset)
    }, [])

    if (!config) return null

    const Icon = config.icon

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-[95vw] sm:max-w-3xl p-0 flex flex-col gap-0 border-l border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">

                {/* ━━━ PREMIUM BI HEADER ━━━ */}
                <div className="sticky top-0 z-30 px-6 pt-6 pb-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <div className={cn("p-3 rounded-2xl shadow-inner", config.color)}>
                                <Icon className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white uppercase italic">
                                    {title || config.title}
                                </h2>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className="text-[10px] font-bold border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20">
                                        <Activity className="w-3 h-3 mr-1" />
                                        {items.length} REAL-TIME AUDITS
                                    </Badge>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                                <button
                                    onClick={() => setSortBy("date")}
                                    className={cn(
                                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all",
                                        sortBy === "date"
                                            ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                                            : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                    )}
                                >
                                    <ArrowDownAZ className="w-3 h-3" /> Date
                                </button>
                                <button
                                    onClick={() => setSortBy("value")}
                                    className={cn(
                                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all",
                                        sortBy === "value"
                                            ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                                            : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                    )}
                                >
                                    <ArrowDown01 className="w-3 h-3" /> Value
                                </button>
                            </div>
                            <GlobalDateFilter
                                value={localDateRange}
                                onChange={handleDateChange}
                                activePreset={activePreset}
                                className="scale-90"
                            />
                        </div>
                    </div>

                    {type === "REFUNDED" && (
                        <div className="flex gap-1 mb-4 p-1.5 bg-slate-100 dark:bg-slate-800/50 rounded-2xl w-fit">
                            {[
                                { id: "all", label: "All Refunds" },
                                { id: "full", label: "Fully Refunded" },
                                { id: "partial", label: "Partially Refunded" },
                            ].map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() => setRefundType(t.id as any)}
                                    className={cn(
                                        "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                        refundType === t.id
                                            ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                                            : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                    )}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Sort Toggle */}
                    <div className="flex items-center gap-3 mb-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sort by:</span>
                        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl">
                            {[
                                { id: "date", label: "Latest" },
                                { id: "value", label: "Highest Value" },
                            ].map((s) => (
                                <button
                                    key={s.id}
                                    onClick={() => setSortBy(s.id as any)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all",
                                        sortBy === s.id
                                            ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                                            : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                    )}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ━━━ BI SNAPSHOT CARDS ━━━ */}
                    {!isLoading && items.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2 animate-in fade-in slide-in-from-top-4 duration-500">
                            {type === "REVENUE" && (
                                <>
                                    <BIInsightCard 
                                        title="Net Revenue" 
                                        value={formatPKR(summary.netRevenue)} 
                                        subvalue={`Gross: ${formatPKR(summary.grossRevenue)}`} 
                                        icon={TrendingUp} 
                                        trend={comparison ? getTrend(summary.netRevenue, comparison.netRevenue) : undefined}
                                        colorClass="border-emerald-100 dark:border-emerald-900/30" 
                                    />
                                    <BIInsightCard 
                                        title="Refund Rate" 
                                        value={`${summary.refundRate.toFixed(1)}%`} 
                                        trend={summary.refundRate > 5 ? "+ Leakage" : "- Healthy"} 
                                        icon={AlertCircle} 
                                        colorClass={summary.refundRate > 5 ? "border-rose-100 dark:border-rose-900/30" : ""} 
                                    />
                                    <BIInsightCard 
                                        title="Leakage (Lost)" 
                                        value={formatPKR(summary.leakage)} 
                                        subvalue={`Inc. ${formatPKR(summary.discountImpact)} discounts`} 
                                        trend={comparison ? getTrend(summary.leakage, comparison.leakage) : undefined}
                                        icon={Zap} 
                                        colorClass="border-rose-100 dark:border-rose-900/30" 
                                    />
                                    <BIInsightCard title="Peak Hours" value={summary.peakPeriod} subvalue="Highest yield window" icon={Clock} />
                                </>
                            )}
                            {type === "ORDERS" && (
                                <>
                                    <BIInsightCard title="Top Branch" value={summary.topBranch} subvalue="By Growth Volume" icon={Award} colorClass="border-indigo-100 dark:border-indigo-900/30" />
                                    <BIInsightCard 
                                        title="Total Items" 
                                        value={summary.totalItems} 
                                        subvalue="Across all orders" 
                                        trend={comparison ? getTrend(summary.totalItems, comparison.totalItems) : undefined}
                                        icon={Box} 
                                        colorClass="border-indigo-100 dark:border-indigo-900/30" 
                                    />
                                    <BIInsightCard title="Problematic" value={summary.problematicBranch} subvalue="High Refund Risk" icon={AlertCircle} colorClass="border-rose-100 dark:border-rose-900/30" />
                                    <BIInsightCard 
                                        title="Total Orders" 
                                        value={items.length} 
                                        subvalue="Processed volume" 
                                        trend={comparison ? getTrend(items.length, comparison.totalOrders) : undefined}
                                        icon={Package} 
                                    />
                                </>
                            )}
                            {(type === "FULFILLED" || type === "REJECTED" || type === "REFUNDED") && (
                                <>
                                    <BIInsightCard title="Top Performing Branch" value={summary.topBranch} subvalue="Highest Activity" icon={Award} colorClass="border-indigo-100 dark:border-indigo-900/30" />
                                    <BIInsightCard 
                                        title="Total Value" 
                                        value={formatPKR(summary.grossRevenue || 0)} 
                                        subvalue="Gross Amount" 
                                        trend={comparison ? getTrend(summary.grossRevenue, comparison.grossRevenue) : undefined}
                                        icon={TrendingUp} 
                                    />
                                    <BIInsightCard 
                                        title="Total Items" 
                                        value={summary.totalItems} 
                                        subvalue="Product SKU Count" 
                                        trend={comparison ? getTrend(summary.totalItems, comparison.totalItems) : undefined}
                                        icon={Box} 
                                    />
                                    <BIInsightCard 
                                        title="Order Count" 
                                        value={items.length} 
                                        subvalue="Total Transactions" 
                                        trend={comparison ? getTrend(items.length, comparison.totalOrders) : undefined}
                                        icon={Hash} 
                                    />
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* ━━━ SCROLLABLE CONTENT ━━━ */}
                <ScrollArea className="flex-1">
                    <div className="p-6 pt-2">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-32 text-slate-400">
                                <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-6" />
                                <p className="text-sm font-bold tracking-widest uppercase opacity-50">Auditing Intelligence Stream...</p>
                            </div>
                        ) : items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center grayscale opacity-50">
                                <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center mb-6">
                                    <Search className="w-10 h-10 text-slate-400" />
                                </div>
                                <h3 className="text-lg font-black uppercase tracking-tighter">Zero Data Intercepted</h3>
                                <p className="text-sm text-slate-500 mt-2 max-w-xs">No transactions match the current BI audit parameters.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between px-2 mb-2">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Live Transaction Audit</span>
                                    <Info className="w-3 h-3 text-slate-300" />
                                </div>
                                {items.map((item: any, idx: number) => (
                                    <div key={item.id} className="group">
                                        <motion.div
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.03 }}
                                            onClick={() => setExpandedRow(expandedRow === item.id ? null : item.id)}
                                            className={cn(
                                                "p-4 rounded-2xl border transition-all duration-300 cursor-pointer relative overflow-hidden",
                                                expandedRow === item.id
                                                    ? "bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-800 shadow-lg ring-1 ring-indigo-500/10"
                                                    : "bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-white dark:hover:bg-slate-900"
                                            )}
                                        >
                                            <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
                                                <div className="flex items-center gap-4">
                                                    <div className={cn(
                                                        "w-10 h-10 rounded-xl flex items-center justify-center font-black transition-transform group-hover:scale-110",
                                                        item.status === 'FULFILLED' ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40" :
                                                            item.status === 'REJECTED' ? "bg-rose-50 text-rose-600 dark:bg-rose-950/40" :
                                                                "bg-amber-50 text-amber-600 dark:bg-amber-950/40"
                                                    )}>
                                                        {idx + 1}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-black text-slate-900 dark:text-white tracking-tight uppercase">{item.tid}</span>
                                                            {item.customerLevel === 'VIP' && (
                                                                <Badge className="bg-amber-400 text-amber-950 border-none font-black text-[9px] px-1.5 py-0">VIP</Badge>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-3 mt-0.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {format(new Date(item.date), "HH:mm")}</span>
                                                            <span className="flex items-center gap-1"><Box className="w-3 h-3" /> {item.branchName}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-8">
                                                    <div className="text-right">
                                                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Value</p>
                                                        <p className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                                                            {formatPKR(item.netValue)}
                                                        </p>
                                                    </div>
                                                    <div className={cn("transition-transform duration-300", expandedRow === item.id ? "rotate-90" : "rotate-0")}>
                                                        <ChevronRight className="w-4 h-4 text-slate-300" />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* ━━━ OPERATIONS VIEW (Expanded) ━━━ */}
                                            <AnimatePresence>
                                                {expandedRow === item.id && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: "auto" }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4"
                                                    >
                                                        <div className="space-y-3">
                                                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500">Order Composition</h4>
                                                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <span className="text-xs font-bold text-slate-600">Total Items</span>
                                                                    <Badge variant="secondary" className="font-bold">{item.skuCount} {item.skuCount === 1 ? 'item' : 'items'}</Badge>
                                                                </div>
                                                                <div className="flex items-center justify-between text-[11px] text-slate-500">
                                                                    <span>Gross Value</span>
                                                                    <span className={cn("font-mono", item.refundAmount > 0 && "line-through opacity-50")}>
                                                                        {formatPKR(item.grossValue)}
                                                                    </span>
                                                                </div>
                                                                {item.refundAmount > 0 && (
                                                                    <>
                                                                        <div className="flex items-center justify-between text-[11px] text-rose-500 font-bold mt-1">
                                                                            <span>Refunded Assets</span>
                                                                            <span className="font-mono">-{formatPKR(item.refundAmount)}</span>
                                                                        </div>
                                                                        <div className="flex items-center justify-between text-[11px] text-emerald-600 font-black mt-1 pt-1 border-t border-slate-200/50 dark:border-slate-800/50">
                                                                            <span>Net Revenue</span>
                                                                            <span className="font-mono">{formatPKR(item.netValue)}</span>
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="space-y-3">
                                                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500">Efficiency Audit</h4>
                                                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                                                                <div className="flex items-center justify-between gap-4">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                                                        <span className="text-[10px] font-bold text-slate-500 uppercase">Processing</span>
                                                                    </div>
                                                                    <span className="text-xs font-black italic">{item.preparationTime}</span>
                                                                </div>
                                                                <div className="flex items-center justify-between gap-4">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                                        <span className="text-[10px] font-bold text-slate-500 uppercase">Status</span>
                                                                    </div>
                                                                    <Badge className={cn(
                                                                        "font-black text-[9px] px-2 py-0",
                                                                        item.status === 'FULFILLED' ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
                                                                    )}>
                                                                        {item.status}
                                                                    </Badge>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </motion.div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </ScrollArea>
                <div className="p-4 bg-white/50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">BI Intercept Pulse: Active</p>
                    <div className="flex gap-1">
                        <div className="w-1 h-1 rounded-full bg-indigo-500 animate-ping" />
                        <div className="w-1 h-1 rounded-full bg-indigo-500" />
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}
