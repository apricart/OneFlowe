"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import useSWR from "swr"
import { formatPKR, cn } from "@/lib/utils"
import { format } from "date-fns"
import { fetcher } from "@/lib/fetcher"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Calendar, AlertCircle, CheckCircle2, Package, TrendingUp } from "lucide-react"

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
}

const TYPE_CONFIG = {
    REVENUE: {
        title: "Revenue Insights",
        icon: TrendingUp,
        color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20",
        columns: [
            { key: "tid", label: "Transaction ID" },
            { key: "customerName", label: "Customer" },
            { key: "paymentMethod", label: "Payment" },
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
            { key: "rejectedBy", label: "Manager" },
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
            { key: "assignedStaff", label: "Staff" },
            { key: "terminalId", label: "Terminal" },
            { key: "skuCount", label: "SKUs" },
        ]
    },
    ORDERS: {
        title: "Order Volume Breakdown",
        icon: Package,
        color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20",
        columns: [
            { key: "tid", label: "Order ID" },
            { key: "source", label: "Source" },
            { key: "channel", label: "Channel" },
            { key: "loyaltyStatus", label: "Loyalty" },
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
            { key: "refundReason", label: "Reason" },
            { key: "processedBy", label: "Processed By" },
            { key: "netValue", label: "Original Value", isCurrency: true },
        ]
    }
}

export function DrillDownSheet({
    isOpen,
    onOpenChange,
    type,
    organizationId,
    branchId,
    branchIds,
    defaultDateRange
}: DrillDownSheetProps): React.ReactElement | null {
    // Internal localized date range state for the drill down
    const [localDateRange, setLocalDateRange] = useState<DateRange | null>(null)
    const [activePreset, setActivePreset] = useState<FilterPreset>("today")

    useEffect(() => {
        if (isOpen) {
            setLocalDateRange(defaultDateRange || null)
            setActivePreset(defaultDateRange ? "custom" : "today")
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

        if (organizationId && organizationId !== "null") params.set("organizationId", organizationId)
        if (branchIds && branchIds.length > 0) {
            params.set("branchIds", branchIds.join(","))
        } else if (branchId && branchId !== "null") {
            params.set("branchId", branchId)
        }

        return `/api/v1/analytics/drill-down?${params.toString()}`
    }, [isOpen, type, organizationId, branchId, branchIds, localDateRange])

    const { data, isLoading } = useSWR<{ items: any[], total: number }>(url, fetcher, {
        revalidateOnFocus: false
    })

    const items = data?.items || []
    const config = type ? TYPE_CONFIG[type] : null

    const handleDateChange = useCallback((range: DateRange | null, preset: FilterPreset) => {
        setLocalDateRange(range)
        setActivePreset(preset)
    }, [])

    if (!config) return null

    const Icon = config.icon

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-[90vw] sm:max-w-2xl p-0 flex flex-col gap-0 border-l border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">

                {/* ━━━ STICKY HEADER ━━━ */}
                <div className="sticky top-0 z-20 px-6 py-5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className={cn("p-2 rounded-xl", config.color)}>
                                <Icon className="w-5 h-5" />
                            </div>
                            <div>
                                <SheetTitle className="text-xl font-semibold tracking-tight">
                                    {config.title}
                                </SheetTitle>
                                <SheetDescription className="mt-0.5 flex items-center gap-2">
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                                        {items.length} records found
                                    </span>
                                    {type === "REJECTED" && items.length > 20 && (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 uppercase tracking-widest">
                                            High Rate Alert
                                        </span>
                                    )}
                                </SheetDescription>
                            </div>
                        </div>
                    </div>

                    {/* Internal Date Picker for Drill-Down */}
                    <div className="mt-5">
                        <GlobalDateFilter
                            value={localDateRange}
                            onChange={handleDateChange}
                            activePreset={activePreset}
                            className="scale-90 origin-left"
                        />
                    </div>
                </div>

                {/* ━━━ SCROLLABLE CONTENT ━━━ */}
                <ScrollArea className="flex-1 px-6 py-6" data-slot="scroll-area">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <Loader2 className="w-8 h-8 animate-spin text-slate-300 dark:text-slate-600 mb-4" />
                            <p className="text-sm">Crunching data...</p>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center mb-4">
                                <Package className="w-8 h-8 text-slate-300 dark:text-slate-700" />
                            </div>
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">No records found</h3>
                            <p className="text-sm text-slate-500 mt-1 max-w-xs">There are no {type?.toLowerCase()} transactions in this selected period.</p>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 bg-slate-50/50 dark:bg-slate-800/50 uppercase font-semibold">
                                    <tr>
                                        {config.columns.map((col: any) => (
                                            <th key={col.key} className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                                                {col.label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    <AnimatePresence>
                                        {items.map((item: any, idx: number) => (
                                            <motion.tr
                                                key={item.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.3, delay: idx * 0.05 }}
                                                className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 group"
                                            >
                                                {config.columns.map((col: any) => (
                                                    <td key={col.key} className="px-4 py-3 align-middle text-slate-600 dark:text-slate-300 font-medium">
                                                        {col.key === "tid" ? (
                                                            <div className="flex flex-col">
                                                                <span className="text-slate-900 dark:text-slate-100 font-semibold">{item[col.key]}</span>
                                                                <span className="text-[10px] text-slate-400">{format(new Date(item.date), "MMM d, HH:mm")}</span>
                                                            </div>
                                                        ) : col.isCurrency ? (
                                                            <span className="tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                                                                {formatPKR(item[col.key])}
                                                            </span>
                                                        ) : col.isBadge ? (
                                                            <span className={cn(
                                                                "px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider",
                                                                item[col.key] === "FULFILLED" ? "bg-teal-50 text-teal-700" :
                                                                    item[col.key] === "REJECTED" ? "bg-red-50 text-red-700" :
                                                                        "bg-slate-100 text-slate-700"
                                                            )}>
                                                                {item[col.key]}
                                                            </span>
                                                        ) : (
                                                            item[col.key] || "—"
                                                        )}
                                                    </td>
                                                ))}
                                            </motion.tr>
                                        ))}
                                    </AnimatePresence>
                                </tbody>
                            </table>
                        </div>
                    )}
                </ScrollArea>
            </SheetContent>
        </Sheet>
    )
}
