"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import useSWR from "swr"
import { useAppContext } from "@/components/context/app-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { RefreshCw, Search, Download, FileText, FileSpreadsheet, FileIcon as FilePdf, Package, TrendingUp, Filter, Loader2, ArrowUpRight, ArrowDownRight, AlertOctagon, RotateCcw, Calculator, ChevronDown } from "lucide-react"
import { formatPKR, cn } from "@/lib/utils"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"
import { Badge } from "@/components/ui/badge"
import { Role } from "@/lib/rbac"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { ColumnSelector, useColumnSelector, type ColumnDef } from "@/components/reports/column-selector"
import { GlobalDateFilter, type FilterPreset } from "@/components/dashboard/global-date-filter"
import { BranchFilter } from "@/components/reports/branch-filter"


const fetcher = (url: string) => fetch(url).then((r) => r.json())

const ALL_COLUMNS: ColumnDef[] = [
    { key: "empNumber", label: "Emp #", defaultVisible: true },
    { key: "userName", label: "User Details", defaultVisible: true },
    { key: "userEmail", label: "Email Address", defaultVisible: true },
    { key: "group", label: "Group", defaultVisible: true },
    { key: "tid", label: "TID", defaultVisible: true },
    { key: "orderDate", label: "Order Date", defaultVisible: true },
    { key: "branch", label: "Branch", defaultVisible: true },
    { key: "itemCode", label: "Item Code", defaultVisible: true },
    { key: "itemCategory", label: "Item Category", defaultVisible: true },
    { key: "unitRate", label: "Unit Rate", defaultVisible: true },
    { key: "qtyOrdered", label: "QTY Ordered", defaultVisible: true },
    { key: "qtyDelivered", label: "QTY Delivered", defaultVisible: true },
    { key: "valueDelivered", label: "Value of Qty Delivered", defaultVisible: true },
    { key: "status", label: "Status", defaultVisible: true },
]

type StatusFilter = "all" | "approved" | "fulfilled" | "refunded" | "rejected"

    export default function OrderReportPage() {
        const {
            organizationId,
            branchId: contextBranchId,
            branchIds: contextBranchIds,
            setBranchIds: setContextBranchIds
        } = useAppContext()

        const [searchTerm, setSearchTerm] = useState("")
        const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
        const [generatedDate, setGeneratedDate] = useState("")

        const { data: session } = useSession()
        const role = (session?.user as any)?.role as Role
        const [hasMounted, setHasMounted] = useState(false)

        // Column Selector
        const { visibleKeys, isVisible, setVisibleKeys } = useColumnSelector(ALL_COLUMNS, "order-report")

        // URL States
        const [startDate, setStartDate] = useState(() => {
            const today = new Date();
            return new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
        })
        const [endDate, setEndDate] = useState(() => {
            const today = new Date();
            return new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
        })
        const [activePreset, setActivePreset] = useState<FilterPreset>("thisMonth")
        const [compare, setCompare] = useState(false)
        const [compareRange, setCompareRange] = useState<{ startDate: Date; endDate: Date } | null>(null)

        const handleDateChange = useCallback((range: { startDate: Date; endDate: Date } | null, preset: FilterPreset, compareMode?: boolean, compRange?: { startDate: Date; endDate: Date } | null) => {
            setActivePreset(preset)
            if (compareMode !== undefined) setCompare(compareMode)
            if (compRange !== undefined) setCompareRange(compRange)
            if (range) {
                setStartDate(range.startDate.toISOString())
                setEndDate(range.endDate.toISOString())
            } else {
                setStartDate("")
                setEndDate("")
            }
        }, [])

        const handleBranchChange = useCallback((ids: string[]) => {
            setContextBranchIds(ids)
        }, [setContextBranchIds])

        // Fetch Query
        const queryParams = new URLSearchParams()
        if (organizationId) queryParams.set("organizationId", organizationId.toString())
        if (startDate) queryParams.set("startDate", startDate)
        if (endDate) queryParams.set("endDate", endDate)
        if (contextBranchIds.length > 0) {
            queryParams.set("branchIds", contextBranchIds.join(","))
        } else if (contextBranchId) {
            queryParams.set("branchId", contextBranchId)
        }
        if (compare) {
            queryParams.set("compare", "true")
            if (compareRange) {
                queryParams.set("compareStartDate", compareRange.startDate.toISOString())
                queryParams.set("compareEndDate", compareRange.endDate.toISOString())
            }
        }

        const { data, isLoading, mutate } = useSWR(`/api/v1/analytics/orders/itemized?${queryParams.toString()}`, fetcher)

        useEffect(() => {
            setHasMounted(true)
            setGeneratedDate(new Date().toLocaleString())
        }, [])

        const MONTHS = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ]
        const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

        const handleMonthYearChange = (monthIdx: number, year: number) => {
            const startDate = new Date(year, monthIdx, 1)
            const endDate = new Date(year, monthIdx + 1, 0)
            handleDateChange({ startDate, endDate }, "custom")
        }

        const currentYear = new Date(startDate || new Date()).getFullYear()
        const currentMonthIdx = new Date(startDate || new Date()).getMonth()

        const orders = data?.data || []

        const filteredOrders = orders.filter((order: any) => {
            const matchesSearch =
                order.tid?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (order.itemDetails && order.itemDetails.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (order.userName && order.userName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (order.itemCode && order.itemCode.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesStatus = statusFilter === 'all' || order.status?.toLowerCase() === statusFilter.toLowerCase();

            return matchesSearch && matchesStatus;
        })

        // Comparison Trends
        const comparison = data?.comparison
        const getTrend = (current: number, prev: number) => {
            if (!prev || prev === 0) return null
            const diff = ((current - prev) / prev) * 100
            return {
                value: Math.abs(diff).toFixed(1),
                isUp: diff > 0,
                isDown: diff < 0
            }
        }

        const currentRevenue = filteredOrders.reduce((sum: number, o: any) => sum + (o.valueDeliveredCents || 0), 0)
        const currentRejected = filteredOrders.reduce((sum: number, o: any) => sum + (o.valueRejectedCents || 0), 0)
        const currentRefunded = filteredOrders.reduce((sum: number, o: any) => sum + (o.valueRefundedCents || 0), 0)
        const currentOrdersCount = [...new Set(filteredOrders.map((o: any) => o.tid))].length

        const revenueTrend = getTrend(currentRevenue, comparison?.totalRevenue || 0)
        const rejectedTrend = getTrend(currentRejected, comparison?.totalRejected || 0)
        const refundedTrend = getTrend(currentRefunded, comparison?.totalRefunded || 0)
        const ordersTrend = getTrend(currentOrdersCount, comparison?.totalOrders || 0)


        const statusTabs: { key: StatusFilter; label: string }[] = [
            { key: "all", label: "All Items" },
            { key: "fulfilled", label: "Fulfilled" },
            { key: "approved", label: "Approved" },
            { key: "refunded", label: "Refunded" },
            { key: "rejected", label: "Rejected" },
        ]

        const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
            const headers = ALL_COLUMNS.filter(c => visibleKeys.includes(c.key)).map(c => c.label)

            const rows = filteredOrders.map((order: any) => {
                const row: any[] = []
                if (isVisible("empNumber")) row.push(order.empNumber)
                if (isVisible("userName")) row.push(order.userName)
                if (isVisible("userEmail")) row.push(order.userEmail)
                if (isVisible("group")) row.push(order.group)
                if (isVisible("tid")) row.push(order.tid)
                if (isVisible("orderDate")) row.push(new Date(order.orderCreatedAt).toLocaleDateString())
                if (isVisible("branch")) row.push(order.branchName)
                if (isVisible("itemCode")) row.push(order.itemCode)
                if (isVisible("itemCategory")) row.push(order.itemCategory)
                if (isVisible("unitRate")) row.push((order.unitRateCents / 100).toFixed(2))
                if (isVisible("qtyOrdered")) row.push(order.qtyOrdered)
                if (isVisible("qtyDelivered")) row.push(order.qtyDelivered)
                if (isVisible("valueDelivered")) row.push((order.valueDeliveredCents / 100).toFixed(2))
                if (isVisible("status")) row.push(order.status)
                return row
            })

            if (format === 'pdf') {
                const doc = new jsPDF('landscape')
                doc.setFontSize(20); doc.text("Itemized Order Report", 14, 20)
                doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28)
                autoTable(doc, { startY: 40, head: [headers], body: rows, theme: 'grid', styles: { fontSize: 7 } })
                doc.save(`item-order-report-${new Date().getTime()}.pdf`)
                return
            }

            const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
            const workbook = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(workbook, worksheet, "Order Items")
            XLSX.writeFile(workbook, `item-order-report-${new Date().getTime()}.${format === 'excel' ? 'xlsx' : 'csv'}`)
        }

        if (!hasMounted) {
            return (
                <div className="flex h-[50vh] items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                </div>
            )
        }

        return (
            <div className="space-y-5 pb-12 bg-slate-50 dark:bg-slate-950 min-h-screen">
                <div className="sticky top-0 z-30 flex flex-wrap items-center gap-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 p-4 shadow-sm">
                    <GlobalDateFilter
                        value={startDate && endDate ? { startDate: new Date(startDate), endDate: new Date(endDate) } : null}
                        onChange={handleDateChange}
                        activePreset={activePreset}
                        hidePresets={false}
                        compare={compare}
                        compareRange={compareRange}
                    />

                    <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1 hidden md:block" />

                    <div className="flex items-center gap-2">
                        {/* Time Span Presets */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-9 text-[11px] font-bold border-indigo-100 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400 gap-1.5 px-3 rounded-full bg-indigo-50/20">
                                    <Calculator className="h-4 w-4" />
                                    {activePreset === "thisMonth" ? "This Month" : activePreset === "yearly" ? "This Year" : activePreset === "all" ? "All Time" : activePreset === "custom" ? "Custom Range" : "Presets"}
                                    <ChevronDown className="h-3 w-3 opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-xl">
                                <div className="p-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 mb-1">Quick Select</div>
                                <DropdownMenuItem onClick={() => handleDateChange(null, "thisMonth")} className="text-xs py-2 cursor-pointer font-medium">This Month</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                    const end = new Date();
                                    const start = new Date();
                                    start.setMonth(start.getMonth() - 1);
                                    start.setDate(1);
                                    end.setDate(0);
                                    handleDateChange({ startDate: start, endDate: end }, "custom");
                                }} className="text-xs py-2 cursor-pointer font-medium text-emerald-600">Last Month</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                    const start = new Date();
                                    start.setMonth(start.getMonth() - 6);
                                    handleDateChange({ startDate: start, endDate: new Date() }, "custom");
                                }} className="text-xs py-2 cursor-pointer font-medium font-bold text-indigo-600">Last 6 Months</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDateChange(null, "yearly")} className="text-xs py-2 cursor-pointer font-medium">This Year</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDateChange(null, "all")} className="text-xs py-2 cursor-pointer font-medium text-slate-400 border-t border-slate-100 mt-1">All Time</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Month/Year Selector */}
                        <div className="flex items-center gap-1 bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-full border border-slate-200 dark:border-slate-800 px-2">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold px-2 hover:bg-white dark:hover:bg-slate-700 rounded-full uppercase text-slate-600 dark:text-slate-400">
                                        {MONTHS[currentMonthIdx]}
                                        <ChevronDown className="h-2.5 w-2.5 ml-1 opacity-50" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="max-h-[300px] overflow-y-auto w-32 rounded-xl shadow-2xl">
                                    {MONTHS.map((m, i) => (
                                        <DropdownMenuItem key={m} onClick={() => handleMonthYearChange(i, currentYear)} className={cn("text-[11px] uppercase tracking-tighter", currentMonthIdx === i && "bg-indigo-50 text-indigo-600 font-bold")}>
                                            {m}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <div className="w-[1px] h-3 bg-slate-300 dark:bg-slate-700" />
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold px-2 hover:bg-white dark:hover:bg-slate-700 rounded-full text-slate-600 dark:text-slate-400">
                                        {currentYear}
                                        <ChevronDown className="h-2.5 w-2.5 ml-1 opacity-50" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="rounded-xl shadow-2xl w-24">
                                    {YEARS.map(y => (
                                        <DropdownMenuItem key={y} onClick={() => handleMonthYearChange(currentMonthIdx, y)} className={cn("text-[11px] font-mono", currentYear === y && "bg-indigo-50 text-indigo-600 font-bold")}>
                                            {y}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>

                    {(role === "SUPER_ADMIN" || role === "HEAD_OFFICE") && (
                        <BranchFilter
                            selectedIds={contextBranchIds}
                            onChange={handleBranchChange}
                            organizationId={organizationId || undefined}
                        />
                    )}
                    <div className="flex-1" />
                    
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => mutate()}
                        disabled={isLoading}
                        className="h-9 text-[12px] font-bold bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-full px-4"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                        REFRESH
                    </Button>
                </div>

                <div className="px-4 md:px-6 space-y-5">
                    {/* ━━━ "INTELLIGENCE" HEADER ━━━ */}
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#1e3a8a] via-[#3730a3] to-[#4c1d95] px-6 py-6 text-white shadow-xl ring-1 ring-indigo-500/30">
                        <div className="flex flex-wrap flex-col gap-2 relative z-10">
                            <p className="text-xs tracking-[0.2em] text-white/70 font-bold uppercase">Transaction Inventory</p>
                            <h1 className="text-3xl font-semibold tracking-tight">Order Report</h1>
                            <p className="text-sm text-white/80 font-medium max-w-2xl">
                                Consolidated audit of branch-level orders and line items. Use the specialized status filters to isolate fulfillment vs. loss.
                            </p>
                        </div>
                    </div>

                    {/* ━━━ KPI BENTO GRID ━━━ */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="p-5 rounded-2xl border border-indigo-200 dark:border-indigo-800/50 shadow-sm bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl">
                            <div className="flex items-center justify-between mb-2">
                                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                                    <TrendingUp className="h-4 w-4" />
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <Badge variant="outline" className="border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 text-[10px] uppercase font-bold tracking-wider">Revenue</Badge>
                                    {revenueTrend && (
                                        <div className={cn(
                                            "text-[10px] font-black tracking-tighter",
                                            revenueTrend.isUp ? "text-emerald-500" : revenueTrend.isDown ? "text-rose-500" : "text-slate-400"
                                        )}>
                                            {revenueTrend.isUp ? "↑" : revenueTrend.isDown ? "↓" : "•"} {revenueTrend.value}%
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
                                    {formatPKR(currentRevenue / 100)}
                                </p>
                                {compare && comparison && (
                                    <span className="text-[10px] font-bold text-slate-400 line-through opacity-50">
                                        {formatPKR(comparison.totalRevenue / 100)}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs font-medium text-slate-500 mt-2">Total value of quantities delivered.</p>
                        </Card>

                        <Card className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl">
                            <div className="flex items-center justify-between mb-2">
                                <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400">
                                    <AlertOctagon className="h-4 w-4" />
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider opacity-60">Rejected Value</Badge>
                                    {rejectedTrend && (
                                        <div className={cn(
                                            "text-[10px] font-black tracking-tighter",
                                            rejectedTrend.isUp ? "text-emerald-500" : rejectedTrend.isDown ? "text-rose-500" : "text-slate-400"
                                        )}>
                                            {rejectedTrend.isUp ? "↑" : rejectedTrend.isDown ? "↓" : "•"} {rejectedTrend.value}%
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
                                    {formatPKR(currentRejected / 100)}
                                </p>
                                {compare && comparison && (
                                    <span className="text-[10px] font-bold text-slate-400 line-through opacity-50">
                                        {formatPKR(comparison.totalRejected / 100)}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs font-medium text-slate-500 mt-2">Loss from rejected/cancelled orders.</p>
                        </Card>

                        <Card className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl">
                            <div className="flex items-center justify-between mb-2">
                                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
                                    <RotateCcw className="h-4 w-4" />
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider opacity-60">Refunded Value</Badge>
                                    {refundedTrend && (
                                        <div className={cn(
                                            "text-[10px] font-black tracking-tighter",
                                            refundedTrend.isUp ? "text-emerald-500" : refundedTrend.isDown ? "text-rose-500" : "text-slate-400"
                                        )}>
                                            {refundedTrend.isUp ? "↑" : refundedTrend.isDown ? "↓" : "•"} {refundedTrend.value}%
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
                                    {formatPKR(currentRefunded / 100)}
                                </p>
                                {compare && comparison && (
                                    <span className="text-[10px] font-bold text-slate-400 line-through opacity-50">
                                        {formatPKR(comparison.totalRefunded / 100)}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs font-medium text-slate-500 mt-2">Value of returned quantities.</p>
                        </Card>

                        <Card className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl">
                            <div className="flex items-center justify-between mb-2">
                                <div className="p-2 rounded-xl bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400">
                                    <Package className="h-4 w-4" />
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider opacity-60">Total Orders</Badge>
                                    {ordersTrend && (
                                        <div className={cn(
                                            "text-[10px] font-black tracking-tighter",
                                            ordersTrend.isUp ? "text-emerald-500" : ordersTrend.isDown ? "text-rose-500" : "text-slate-400"
                                        )}>
                                            {ordersTrend.isUp ? "↑" : ordersTrend.isDown ? "↓" : "•"} {ordersTrend.value}%
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{currentOrdersCount}</p>
                                {compare && comparison && (
                                    <span className="text-[10px] font-bold text-slate-400 line-through opacity-50">
                                        {comparison.totalOrders}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs font-medium text-slate-500 mt-2">Total unique orders in view.</p>
                        </Card>
                    </div>

                    {/* Status Tabs & Controls */}
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 w-fit">
                            {statusTabs.map((tab) => (
                                <button
                                    key={tab.key}
                                    onClick={() => setStatusFilter(tab.key)}
                                    className={cn(
                                        "px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200",
                                        statusFilter === tab.key
                                            ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-600"
                                            : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                                    )}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-2 bg-white dark:bg-slate-900/50 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                <Input
                                    placeholder="Search Items, Users, TID..."
                                    className="pl-8 h-9 w-64 text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 focus:ring-1 focus:ring-indigo-500/50 transition-all rounded-md"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button size="sm" className="h-9 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm gap-1.5 px-3 rounded-md" disabled={isLoading}>
                                        <Download className="h-3.5 w-3.5" />
                                        EXPORT
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="min-w-[140px] rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl">
                                    <DropdownMenuItem onClick={() => handleExport('csv')} className="text-xs font-medium cursor-pointer py-2">
                                        <FileText className="mr-2.5 h-3.5 w-3.5 text-slate-400" /> CSV Export
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleExport('excel')} className="text-xs font-medium cursor-pointer py-2">
                                        <FileSpreadsheet className="mr-2.5 h-3.5 w-3.5 text-emerald-500" /> Excel Workbook
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleExport('pdf')} className="text-xs font-medium cursor-pointer py-2">
                                        <FilePdf className="mr-2.5 h-3.5 w-3.5 text-rose-500" /> PDF Document
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>

                    {/* ━━━ REPORT TABLE ━━━ */}
                    <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl">
                        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white/50 dark:bg-slate-900/20">
                            <h3 className="font-semibold text-sm uppercase tracking-tight text-slate-800 dark:text-slate-200">
                                Item Level Ledgers
                            </h3>
                            <ColumnSelector columns={ALL_COLUMNS} storageKey="order-report" visibleKeys={visibleKeys} onChange={setVisibleKeys} />
                        </div>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-800">
                                        {isVisible("empNumber") && <TableHead className="pl-6 h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap text-left">Emp #</TableHead>}
                                        {isVisible("userName") && <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">User Details</TableHead>}
                                        {isVisible("userEmail") && <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">Email Address</TableHead>}
                                        {isVisible("group") && <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">Group</TableHead>}
                                        {isVisible("tid") && <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">TID</TableHead>}
                                        {isVisible("orderDate") && <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">Order Date</TableHead>}
                                        {isVisible("branch") && <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">Branch</TableHead>}
                                        {isVisible("itemCode") && <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">Item Code</TableHead>}
                                        {isVisible("itemCategory") && <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">Item Category</TableHead>}
                                        {isVisible("unitRate") && <TableHead className="text-right h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">Unit Rate</TableHead>}
                                        {isVisible("qtyOrdered") && <TableHead className="text-right h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">QTY Ordered</TableHead>}
                                        {isVisible("qtyDelivered") && <TableHead className="text-right h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">QTY Delivered</TableHead>}
                                        {isVisible("valueDelivered") && <TableHead className="text-right pr-6 h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">Value</TableHead>}
                                        {isVisible("status") && <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">Status</TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow><TableCell colSpan={13} className="h-32 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-500" /></TableCell></TableRow>
                                    ) : filteredOrders.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={13} className="h-32 text-center text-slate-500 text-sm">No items match your filters.</TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredOrders.map((order: any) => (
                                            <TableRow key={order.id} className="hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10 cursor-default transition-colors border-b border-slate-100 dark:border-slate-800/50">
                                                {isVisible("empNumber") && <TableCell className="pl-6 whitespace-nowrap font-mono text-[11px] text-slate-500">{order.empNumber}</TableCell>}
                                                {isVisible("userName") && <TableCell className="whitespace-nowrap text-xs font-medium text-slate-800 dark:text-slate-200">{order.userName}</TableCell>}
                                                {isVisible("userEmail") && <TableCell className="whitespace-nowrap text-[11px] text-slate-400 font-mono italic">{order.userEmail}</TableCell>}
                                                {isVisible("group") && (
                                                    <TableCell className="max-w-[120px]">
                                                        <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-tight bg-slate-100 text-slate-600 truncate block text-center">
                                                            {order.group || "No Group"}
                                                        </Badge>
                                                    </TableCell>
                                                )}
                                                {isVisible("tid") && <TableCell className="whitespace-nowrap font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-700 dark:text-slate-300">{order.tid}</TableCell>}
                                                {isVisible("orderDate") && <TableCell className="whitespace-nowrap text-xs text-slate-500 font-medium">{new Date(order.orderCreatedAt).toLocaleDateString()}</TableCell>}
                                                {isVisible("branch") && (
                                                    <TableCell className="max-w-[140px]">
                                                        <div className="text-[11px] font-bold text-slate-900 dark:text-slate-200 truncate" title={order.branchName}>
                                                            {order.branchName}
                                                        </div>
                                                    </TableCell>
                                                )}
                                                {isVisible("itemCode") && <TableCell className="whitespace-nowrap font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">{order.itemCode}</TableCell>}
                                                {isVisible("itemCategory") && <TableCell className="whitespace-nowrap text-xs text-slate-600 dark:text-slate-400">{order.itemCategory}</TableCell>}
                                                {isVisible("unitRate") && <TableCell className="whitespace-nowrap text-right font-mono text-xs text-slate-500">{formatPKR(order.unitRateCents / 100)}</TableCell>}
                                                {isVisible("qtyOrdered") && <TableCell className="whitespace-nowrap text-right font-mono font-medium text-xs dark:text-slate-200">{order.qtyOrdered}</TableCell>}
                                                {isVisible("qtyDelivered") && <TableCell className="whitespace-nowrap text-right font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">{order.qtyDelivered}</TableCell>}
                                                {isVisible("valueDelivered") && <TableCell className="whitespace-nowrap text-right font-mono font-bold text-xs pr-6 text-slate-900 dark:text-white">{formatPKR((order.valueDeliveredCents || 0) / 100)}</TableCell>}
                                                {isVisible("status") && <TableCell className="whitespace-nowrap"><Badge variant="outline" className="text-[9px] uppercase font-bold">{order.status}</Badge></TableCell>}
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                </div>
            </div>
        )
    }
