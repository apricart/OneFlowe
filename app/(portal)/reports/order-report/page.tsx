"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import useSWR from "swr"
import { useAppContext } from "@/components/context/app-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { RefreshCw, Search, Download, FileText, FileSpreadsheet, FileIcon as FilePdf, Package, TrendingUp, Loader2, AlertOctagon, RotateCcw, Calculator, ChevronDown, BarChart3, ListOrdered } from "lucide-react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    Cell,
    PieChart,
    Pie,
} from "recharts"

import { ColumnSelector, useColumnSelector, type ColumnDef } from "@/components/reports/column-selector"
import { GlobalDateFilter, type FilterPreset } from "@/components/dashboard/global-date-filter"
import { BranchFilter } from "@/components/reports/branch-filter"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const ALL_COLUMNS: ColumnDef[] = [
    { key: "tid", label: "TID", defaultVisible: true },
    { key: "orderDate", label: "Order Date", defaultVisible: true },
    { key: "userName", label: "User", defaultVisible: true },
    { key: "branch", label: "Branch", defaultVisible: true },
    { key: "qtyOrdered", label: "Qty Ordered", defaultVisible: true },
    { key: "fulfQty", label: "Fulf Qty", defaultVisible: true },
    { key: "fulfValue", label: "Fulf Value", defaultVisible: true },
    { key: "refQty", label: "Ref Qty", defaultVisible: true },
    { key: "refValue", label: "Ref Value", defaultVisible: true },
    { key: "totalCents", label: "Net Revenue", defaultVisible: true },
    { key: "status", label: "Status", defaultVisible: true },
] as const;
type StatusFilter = "all" | "approved" | "fulfilled" | "refunded" | "rejected"

const STATUS_COLORS: Record<string, string> = {
    FULFILLED: "#10b981",
    APPROVED: "#3b82f6",
    REFUNDED: "#f59e0b",
    REJECTED: "#ef4444",
    PENDING: "#8b5cf6",
    CANCELLED: "#ef4444",
}

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
    const [activeTab, setActiveTab] = useState<"analytics" | "reports">("analytics")

    const { data: session } = useSession()
    const role = (session?.user as any)?.role as Role
    const [hasMounted, setHasMounted] = useState(false)

    const { visibleKeys, isVisible, setVisibleKeys } = useColumnSelector(ALL_COLUMNS, "order-report-v2")

    const [startDate, setStartDate] = useState<string>("")
    const [endDate, setEndDate] = useState<string>("")
    const [activePreset, setActivePreset] = useState<FilterPreset>("all")
    const [compare, setCompare] = useState(false)
    const [compareRange, setCompareRange] = useState<{ startDate: Date; endDate: Date } | null>(null)

    // Advanced Arrays
    const [selectedMonths, setSelectedMonths] = useState<number[]>([])
    const [selectedYears, setSelectedYears] = useState<number[]>([])
    const [compareMonths, setCompareMonths] = useState<number[]>([])
    const [compareYears, setCompareYears] = useState<number[]>([])

    const handleDateChange = useCallback((
        range: { startDate: Date; endDate: Date } | null, 
        preset: FilterPreset, 
        compareMode?: boolean, 
        compRange?: { startDate: Date; endDate: Date } | null,
        newMonths?: number[],
        newYears?: number[],
        newCompMonths?: number[],
        newCompYears?: number[]
    ) => {
        setActivePreset(preset)
        if (compareMode !== undefined) setCompare(compareMode)
        if (compRange !== undefined) setCompareRange(compRange)
        
        if (newMonths !== undefined) setSelectedMonths(newMonths)
        if (newYears !== undefined) setSelectedYears(newYears)
        if (newCompMonths !== undefined) setCompareMonths(newCompMonths)
        if (newCompYears !== undefined) setCompareYears(newCompYears)

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

    const queryParams = new URLSearchParams()
    if (organizationId) queryParams.set("organizationId", organizationId.toString())
    
    // Arrays Support mapping
    if (selectedMonths.length > 0) queryParams.set("months", selectedMonths.map(m => m + 1).join(","))
    if (selectedYears.length > 0) queryParams.set("years", selectedYears.join(","))
    if (compareMonths.length > 0) queryParams.set("compareMonths", compareMonths.map(m => m + 1).join(","))
    if (compareYears.length > 0) queryParams.set("compareYears", compareYears.join(","))

    // Fallback bounds
    if (startDate && selectedMonths.length === 0 && selectedYears.length === 0) queryParams.set("startDate", startDate)
    if (endDate && selectedMonths.length === 0 && selectedYears.length === 0) queryParams.set("endDate", endDate)
    
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
    queryParams.set("limit", "10000")

    const { data, isLoading, mutate } = useSWR(`/api/v1/analytics/summary?${queryParams.toString()}`, fetcher)

    useEffect(() => {
        setHasMounted(true)
        setGeneratedDate(new Date().toLocaleString())

        // If no explicit dates AND no multi-select arrays, force "All Time" filter
        if (!startDate && !endDate && selectedMonths.length === 0 && selectedYears.length === 0) {
            handleDateChange(null, "all")
        }
    }, [startDate, endDate, handleDateChange, selectedMonths.length, selectedYears.length])

    const orders = data?.orders || []

    const filteredOrders = orders.filter((order: any) => {
        const matchesSearch = !searchTerm ||
            (order.tid && order.tid.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (order.userName && order.userName.toLowerCase().includes(searchTerm.toLowerCase()))

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

    // KPI Calculations
    // Note: User feedback specified Net Revenue is (Fulfilled + Partial + Approved) and refund has no calculation in Net Revenue.
    const currentRevenue = filteredOrders.reduce((sum: number, o: any) => {
        const status = (o.status || "").toUpperCase()
        if (["FULFILLED", "APPROVED", "PARTIAL", "PARTIALLY_FULFILLED"].includes(status)) {
            return sum + (o.totalCents || 0) - (o.refundAmountCents || 0)
        }
        return sum
    }, 0)

    const currentRefunded = filteredOrders.reduce((sum: number, o: any) => sum + (o.refundAmountCents || 0), 0)
    
    const currentRejected = filteredOrders.reduce((sum: number, o: any) => {
        const status = (o.status || "").toUpperCase()
        if (["REJECTED", "CANCELLED"].includes(status)) {
            return sum + (o.totalCents || 0)
        }
        return sum
    }, 0)
    
    const netRevenue = currentRevenue // User requested Net Revenue = Fulfilled + Partial + Approved ONLY.
    const currentOrdersCount = filteredOrders.length

    const revenueTrend = getTrend(currentRevenue, comparison?.totalSales || 0)
    const refundedTrend = getTrend(currentRefunded, comparison?.totalRefunds || 0)
    const rejectedTrend: any = null // We don't have comparison for rejected sales value out of the box, ignoring for now
    const ordersTrend = getTrend(currentOrdersCount, comparison?.totalOrders || 0)

    // Status breakdown for bar chart
    const statusChartData = useMemo(() => {
        if (!orders.length) return []
        
        const buckets: Record<string, { current: number; previous: number }> = {}
        const statuses = ["FULFILLED", "PARTIAL", "REFUNDED", "REJECTED", "PENDING"]
        statuses.forEach(s => buckets[s] = { current: 0, previous: 0 })

        orders.forEach((o: any) => {
            const s = (o.status || "UNKNOWN").toUpperCase()
            if (buckets[s]) buckets[s].current += 1
            else buckets[s] = { current: 1, previous: 0 }
        })

        if (comparison?.orders) {
            comparison.orders.forEach((o: any) => {
                const s = (o.status || "UNKNOWN").toUpperCase()
                if (buckets[s]) buckets[s].previous += 1
                else buckets[s] = { current: 0, previous: 1 }
            })
        }

        return Object.entries(buckets).map(([name, data]) => ({
            name,
            current: data.current,
            previous: data.previous,
            fill: STATUS_COLORS[name] || "#94a3b8"
        }))
    }, [orders, comparison])

    // Monthly trend data for analytics
    const monthlyTrendData = useMemo(() => {
        if (!orders.length) return []
        const monthly: Record<string, { revenue: number; orders: number; prevRevenue: number; prevOrders: number }> = {}
        
        orders.forEach((o: any) => {
            const d = new Date(o.createdAt || o.orderDate)
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            if (!monthly[key]) monthly[key] = { revenue: 0, orders: 0, prevRevenue: 0, prevOrders: 0 }
            monthly[key].revenue += (o.totalCents || o.netTotalCents || 0) / 100
            monthly[key].orders += 1
        })

        if (comparison?.orders) {
            comparison.orders.forEach((o: any) => {
                const d = new Date(o.createdAt || o.orderDate)
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                if (!monthly[key]) monthly[key] = { revenue: 0, orders: 0, prevRevenue: 0, prevOrders: 0 }
                monthly[key].prevRevenue += (o.totalCents || o.netTotalCents || 0) / 100
                monthly[key].prevOrders += 1
            })
        }

        return Object.entries(monthly)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([key, d]) => {
                const [year, month] = key.split('-')
                const date = new Date(Number(year), Number(month) - 1)
                return {
                    label: date.toLocaleString('default', { month: 'short', year: '2-digit' }),
                    revenue: Math.round(d.revenue),
                    orders: d.orders,
                    prevRevenue: Math.round(d.prevRevenue),
                    prevOrders: d.prevOrders
                }
            })
    }, [orders, comparison])

    const statusTabs: { key: StatusFilter; label: string }[] = [
        { key: "all", label: "All Items" },
        { key: "fulfilled", label: "Fulfilled" },
        { key: "approved", label: "Approved" },
        { key: "refunded", label: "Refunded" },
        { key: "rejected", label: "Rejected" },
    ]

    const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
        const headers = ALL_COLUMNS.filter(c => isVisible(c.key)).map(c => c.label)

        const rows = filteredOrders.map((order: any) => {
            const row: any[] = []
            if (isVisible("tid")) row.push(order.tid)
            if (isVisible("orderDate")) row.push(new Date(order.createdAt).toLocaleDateString())
            if (isVisible("userName")) row.push(order.userName || "-")
            if (isVisible("branch")) row.push(order.branchName || "-")
            if (isVisible("qtyOrdered")) row.push(order.qtyOrdered)
            if (isVisible("fulfQty")) row.push(order.qtyDelivered)
            if (isVisible("fulfValue")) row.push(((order.valueDeliveredCents || 0) / 100).toFixed(2))
            if (isVisible("refQty")) row.push(Math.max(0, order.qtyOrdered - order.qtyDelivered))
            if (isVisible("refValue")) row.push(((order.refundAmountCents || 0) / 100).toFixed(2))
            if (isVisible("totalCents")) row.push((((order.totalCents || 0) - (order.refundAmountCents || 0)) / 100).toFixed(2))
            if (isVisible("status")) row.push(order.status)
            return row
        })

        if (format === 'pdf') {
            const doc = new jsPDF('landscape')
            doc.setFontSize(20); doc.text("Order Report", 14, 20)
            doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28)
            autoTable(doc, { startY: 40, head: [headers], body: rows, theme: 'grid', styles: { fontSize: 7 } })
            doc.save(`order-report-${new Date().getTime()}.pdf`)
            return
        }

        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Order Items")
        XLSX.writeFile(workbook, `order-report-${new Date().getTime()}.${format === 'excel' ? 'xlsx' : 'csv'}`)
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
                    months={selectedMonths}
                    years={selectedYears}
                    compareMonths={compareMonths}
                    compareYears={compareYears}
                />

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
                {/* ━━━ HEADER ━━━ */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#1e3a8a] via-[#3730a3] to-[#4c1d95] px-6 py-6 text-white shadow-xl ring-1 ring-indigo-500/30">
                    <div className="flex flex-col gap-2 relative z-10">
                        <p className="text-xs tracking-[0.2em] text-white/70 font-bold uppercase">Transaction Inventory</p>
                        <h1 className="text-3xl font-semibold tracking-tight">Order Report</h1>
                        <p className="text-sm text-white/80 font-medium max-w-2xl">
                            Consolidated audit of orders with fulfillment, refund, and net revenue breakdown.
                        </p>
                    </div>
                    <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />
                </div>

                {/* ━━━ KPI BENTO GRID ━━━ */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    {/* Revenue */}
                    <Card className="p-5 rounded-2xl border border-emerald-200 dark:border-emerald-800/50 shadow-sm bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                                <TrendingUp className="h-4 w-4" />
                            </div>
                            <Badge variant="outline" className="border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 text-[10px] uppercase font-bold tracking-wider">Fulfilled</Badge>
                        </div>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatPKR(currentRevenue / 100)}</p>
                        {revenueTrend && (
                            <p className={cn("text-[10px] font-bold mt-1", revenueTrend.isUp ? "text-emerald-500" : "text-rose-500")}>
                                {revenueTrend.isUp ? "↑" : "↓"} {revenueTrend.value}%
                            </p>
                        )}
                    </Card>

                    {/* Refunded */}
                    <Card className="p-5 rounded-2xl border border-amber-200 dark:border-amber-800/50 shadow-sm bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
                                <RotateCcw className="h-4 w-4" />
                            </div>
                            <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider opacity-60">Refunded</Badge>
                        </div>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatPKR(currentRefunded / 100)}</p>
                        {refundedTrend && (
                            <p className={cn("text-[10px] font-bold mt-1", refundedTrend.isUp ? "text-rose-500" : "text-emerald-500")}>
                                {refundedTrend.isUp ? "↑" : "↓"} {refundedTrend.value}%
                            </p>
                        )}
                    </Card>

                    {/* Rejected */}
                    <Card className="p-5 rounded-2xl border border-rose-200 dark:border-rose-800/50 shadow-sm bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400">
                                <AlertOctagon className="h-4 w-4" />
                            </div>
                            <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider opacity-60">Rejected</Badge>
                        </div>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatPKR(currentRejected / 100)}</p>
                        {rejectedTrend && (
                            <p className={cn("text-[10px] font-bold mt-1", rejectedTrend.isUp ? "text-rose-500" : "text-emerald-500")}>
                                {rejectedTrend.isUp ? "↑" : "↓"} {rejectedTrend.value}%
                            </p>
                        )}
                    </Card>

                    {/* Net Revenue */}
                    <Card className="p-5 rounded-2xl border border-indigo-200 dark:border-indigo-800/50 shadow-sm bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/30 dark:to-slate-900/50 backdrop-blur-xl">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
                                <Calculator className="h-4 w-4" />
                            </div>
                            <Badge variant="outline" className="border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 text-[10px] uppercase font-bold tracking-wider">Net Revenue</Badge>
                        </div>
                        <p className="text-2xl font-black text-indigo-700 dark:text-indigo-300">{formatPKR(netRevenue / 100)}</p>
                        <p className="text-[10px] font-medium text-slate-400 mt-1">Fulfilled − Refunded</p>
                    </Card>

                    {/* Total Orders */}
                    <Card className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-2 rounded-xl bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400">
                                <Package className="h-4 w-4" />
                            </div>
                            <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider opacity-60">Orders</Badge>
                        </div>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{currentOrdersCount}</p>
                        {ordersTrend && (
                            <p className={cn("text-[10px] font-bold mt-1", ordersTrend.isUp ? "text-emerald-500" : "text-rose-500")}>
                                {ordersTrend.isUp ? "↑" : "↓"} {ordersTrend.value}%
                            </p>
                        )}
                    </Card>
                </div>

                {/* ━━━ TABS: Analytics + Table ━━━ */}
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-5">
                    <TabsList className="bg-slate-100 dark:bg-slate-800 rounded-xl p-1 h-auto w-fit">
                        <TabsTrigger value="analytics" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider gap-2">
                            <BarChart3 className="h-4 w-4" /> Order Analytics
                        </TabsTrigger>
                        <TabsTrigger value="reports" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider gap-2">
                            <ListOrdered className="h-4 w-4" /> Table View
                        </TabsTrigger>
                    </TabsList>

                    {/* ━━━ ANALYTICS TAB ━━━ */}
                    <TabsContent value="analytics" className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            {/* Status Breakdown Bar Chart */}
                            <Card className="rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900/50">
                                <CardHeader className="px-6 py-5 border-b border-slate-100 dark:border-slate-800">
                                    <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                        <BarChart3 className="h-4 w-4 text-indigo-500" /> Status Breakdown
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6">
                                    {statusChartData.length === 0 ? (
                                        <div className="h-[250px] flex items-center justify-center text-slate-400 text-sm">No data available</div>
                                    ) : (
                                        <div className="h-[300px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={statusChartData} margin={{ top: 10, right: 10, bottom: 10, left: -10 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                                    <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} tickLine={false} axisLine={false} />
                                                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                                                    <Tooltip
                                                        content={({ payload, label }: any) => {
                                                            if (!payload?.length) return null
                                                            const d = payload[0].payload
                                                            return (
                                                                <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 min-w-[160px]">
                                                                    <p className="font-black text-xs text-slate-700 dark:text-slate-300 mb-2">{d.name}</p>
                                                                    <p className="text-xs text-slate-500">Current: <span className="font-bold text-slate-900 dark:text-white">{d.current}</span></p>
                                                                    {compare && <p className="text-xs text-slate-500">Previous: <span className="font-bold text-slate-900 dark:text-white">{d.previous}</span></p>}
                                                                </div>
                                                            )
                                                        }}
                                                    />
                                                    <Bar dataKey="current" radius={[6, 6, 0, 0]} barSize={40} name="Current Period">
                                                        {statusChartData.map((entry: any, idx: number) => (
                                                            <Cell key={idx} fill={entry.fill} />
                                                        ))}
                                                    </Bar>
                                                    {compare && <Bar dataKey="previous" fill="#94a3b8" radius={[6, 6, 0, 0]} barSize={40} name="Previous Period" />}
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Revenue by Status Donut */}
                            <Card className="rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900/50">
                                <CardHeader className="px-6 py-5 border-b border-slate-100 dark:border-slate-800">
                                    <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                        <Package className="h-4 w-4 text-emerald-500" /> Revenue Distribution
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6">
                                    {statusChartData.length === 0 ? (
                                        <div className="h-[250px] flex items-center justify-center text-slate-400 text-sm">No data available</div>
                                    ) : (
                                        <div className="h-[300px] flex items-center justify-center">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={statusChartData.filter(d => d.current > 0)}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={60}
                                                        outerRadius={100}
                                                        paddingAngle={3}
                                                        dataKey="current"
                                                        nameKey="name"
                                                        stroke="none"
                                                    >
                                                        {statusChartData.filter(d => d.current > 0).map((entry: any, idx: number) => (
                                                            <Cell key={idx} fill={entry.fill} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip
                                                        content={({ payload }: any) => {
                                                            if (!payload?.length) return null
                                                            const d = payload[0].payload
                                                            return (
                                                                <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700">
                                                                    <p className="font-black text-xs mb-1">{d.name}</p>
                                                                    <p className="text-sm font-bold">Qty: {d.current}</p>
                                                                </div>
                                                            )
                                                        }}
                                                    />
                                                    <Legend
                                                        verticalAlign="bottom"
                                                        iconType="circle"
                                                        iconSize={8}
                                                        formatter={(value: string) => <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{value}</span>}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Monthly Trend */}
                        {monthlyTrendData.length > 1 && (
                            <Card className="rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900/50">
                                <CardHeader className="px-6 py-5 border-b border-slate-100 dark:border-slate-800">
                                    <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                        <TrendingUp className="h-4 w-4 text-blue-500" /> Monthly Revenue vs Refunds
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <div className="h-[300px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={monthlyTrendData} margin={{ top: 10, right: 10, bottom: 10, left: -10 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                                <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 700 }} tickLine={false} axisLine={false} />
                                                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `₨${v / 1000}k`} />
                                                <Tooltip
                                                    content={({ payload, label }: any) => {
                                                        if (!payload?.length) return null
                                                        return (
                                                            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 min-w-[180px]">
                                                                <p className="font-black text-xs text-slate-700 dark:text-slate-300 mb-2 border-b pb-1">{label}</p>
                                                                {payload.map((p: any) => (
                                                                    <p key={p.dataKey} className="text-xs text-slate-500 flex justify-between gap-4">
                                                                        <span>{p.dataKey === 'revenue' ? 'Revenue' : 'Refunds'}</span>
                                                                        <span className="font-bold text-slate-900 dark:text-white">{formatPKR(p.value)}</span>
                                                                    </p>
                                                                ))}
                                                            </div>
                                                        )
                                                    }}
                                                />
                                                <Legend iconType="circle" iconSize={8} formatter={(v: string) => <span className="text-[10px] font-bold uppercase">{v}</span>} />
                                                <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} name="Revenue" />
                                                <Bar dataKey="refunds" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={20} name="Refunds" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    {/* ━━━ TABLE VIEW TAB ━━━ */}
                    <TabsContent value="reports" className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                                        placeholder="Search TID, Items, Users..."
                                        className="pl-8 h-9 w-64 text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 rounded-md"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
                                <ColumnSelector columns={ALL_COLUMNS} storageKey="order-report-v2" visibleKeys={visibleKeys} onChange={setVisibleKeys} />
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button size="sm" className="h-9 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm gap-1.5 px-3 rounded-md" disabled={isLoading}>
                                            <Download className="h-3.5 w-3.5" />
                                            EXPORT
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="min-w-[140px] rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl">
                                        <DropdownMenuItem onClick={() => handleExport('csv')} className="text-xs font-medium cursor-pointer py-2">
                                            <FileText className="mr-2.5 h-3.5 w-3.5 text-slate-400" /> CSV
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleExport('excel')} className="text-xs font-medium cursor-pointer py-2">
                                            <FileSpreadsheet className="mr-2.5 h-3.5 w-3.5 text-emerald-500" /> Excel
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleExport('pdf')} className="text-xs font-medium cursor-pointer py-2">
                                            <FilePdf className="mr-2.5 h-3.5 w-3.5 text-rose-500" /> PDF
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>

                        {/* ━━━ REPORT TABLE ━━━ */}
                        <Card className="overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl">
                            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white/50 dark:bg-slate-900/20">
                                <h3 className="font-semibold text-sm uppercase tracking-tight text-slate-800 dark:text-slate-200">
                                    Order Line Items
                                </h3>
                                <p className="text-[10px] font-semibold text-slate-400">{filteredOrders.length} items</p>
                            </div>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50/50">
                                            {isVisible("orderDate") && <TableHead className="py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap hidden lg:table-cell">Date</TableHead>}
                                            {isVisible("tid") && <TableHead className="py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">TID</TableHead>}
                                            {isVisible("userName") && <TableHead className="py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">User</TableHead>}
                                            {isVisible("branch") && <TableHead className="py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Branch</TableHead>}
                                            {isVisible("qtyOrdered") && <TableHead className="py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-right">Qty Ord</TableHead>}
                                            {isVisible("fulfQty") && <TableHead className="py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-right">{compare ? "Fulf Qty (A/B)" : "Fulf Qty"}</TableHead>}
                                            {isVisible("fulfValue") && <TableHead className="py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-right">{compare ? "Fulf Val (A/B)" : "Fulf Val"}</TableHead>}
                                            {isVisible("refQty") && <TableHead className="py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-right">{compare ? "Ref Qty (A/B)" : "Ref Qty"}</TableHead>}
                                            {isVisible("refValue") && <TableHead className="py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-right">{compare ? "Ref Val (A/B)" : "Ref Val"}</TableHead>}
                                            {isVisible("totalCents") && <TableHead className="py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-right">{compare ? "Net Rev (A/B)" : "Net Revenue"}</TableHead>}
                                            {isVisible("status") && <TableHead className="py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center">Status</TableHead>}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoading ? (
                                            <TableRow><TableCell colSpan={visibleKeys.length} className="h-32 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-500" /></TableCell></TableRow>
                                        ) : filteredOrders.length === 0 ? (
                                            <TableRow><TableCell colSpan={visibleKeys.length} className="h-32 text-center text-slate-400 text-sm">No items match your filters.</TableCell></TableRow>
                                        ) : (
                                            filteredOrders.map((order: any) => {
                                                const refQty = Math.max(0, order.qtyOrdered - order.qtyDelivered)
                                                return (
                                                    <TableRow key={order.id} className="hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10 cursor-default transition-colors border-b border-slate-100 dark:border-slate-800/50">
                                                        {isVisible("tid") && <TableCell className="pl-5 whitespace-nowrap font-mono text-[11px] text-slate-700 dark:text-slate-300 font-semibold">{order.tid}</TableCell>}
                                                        {isVisible("orderDate") && <TableCell className="whitespace-nowrap text-xs text-slate-500 font-medium" suppressHydrationWarning>{new Date(order.orderCreatedAt).toLocaleDateString()}</TableCell>}
                                                        {isVisible("userName") && <TableCell className="whitespace-nowrap text-xs font-medium text-slate-800 dark:text-slate-200">{order.userName}</TableCell>}
                                                        {isVisible("branch") && (
                                                            <TableCell className="max-w-[140px]">
                                                                <div className="text-[11px] font-bold text-slate-900 dark:text-slate-200 truncate" title={order.branchName}>
                                                                    {order.branchName}
                                                                </div>
                                                            </TableCell>
                                                        )}
                                                        {isVisible("qtyOrdered") && <TableCell className="whitespace-nowrap text-right font-mono text-xs text-slate-700 dark:text-slate-300">{order.qtyOrdered}</TableCell>}
                                                        {isVisible("fulfQty") && (
                                                            <TableCell className="whitespace-nowrap text-right font-mono text-xs">
                                                                <div className="flex flex-col items-end">
                                                                    <span className="font-bold text-emerald-600">{order.qtyDelivered}</span>
                                                                    {compare && <span className="text-[10px] text-slate-400 border-t border-slate-100 mt-0.5">{order.compareFulfilledQty || 0}</span>}
                                                                </div>
                                                            </TableCell>
                                                        )}
                                                        {isVisible("fulfValue") && (
                                                            <TableCell className="whitespace-nowrap text-right font-mono text-xs">
                                                                <div className="flex flex-col items-end">
                                                                    <span className="font-bold text-emerald-600">{formatPKR((order.valueDeliveredCents || 0) / 100)}</span>
                                                                    {compare && <span className="text-[10px] text-slate-400 border-t border-slate-100 mt-0.5">{formatPKR((order.compareFulfilledValueCents || 0) / 100)}</span>}
                                                                </div>
                                                            </TableCell>
                                                        )}
                                                        {isVisible("refQty") && (
                                                            <TableCell className="whitespace-nowrap text-right font-mono text-xs">
                                                                <div className="flex flex-col items-end">
                                                                    <span className="font-bold text-rose-500">{refQty}</span>
                                                                    {compare && <span className="text-[10px] text-slate-400 border-t border-slate-100 mt-0.5">{order.compareRefundQty || 0}</span>}
                                                                </div>
                                                            </TableCell>
                                                        )}
                                                        {isVisible("refValue") && (
                                                            <TableCell className="whitespace-nowrap text-right font-mono text-xs">
                                                                <div className="flex flex-col items-end">
                                                                    <span className="font-bold text-rose-500">{formatPKR((order.valueRefundedCents || 0) / 100)}</span>
                                                                    {compare && <span className="text-[10px] text-slate-400 border-t border-slate-100 mt-0.5">{formatPKR((order.compareRefundValueCents || 0) / 100)}</span>}
                                                                </div>
                                                            </TableCell>
                                                        )}
                                                        {isVisible("totalCents") && (
                                                            <TableCell className="whitespace-nowrap text-right font-mono pr-5">
                                                                <div className="flex flex-col items-end">
                                                                    <span className="font-black text-slate-900 dark:text-white">
                                                                        {formatPKR(((order.totalCents || 0) - (order.refundAmountCents || 0)) / 100)}
                                                                    </span>
                                                                    {compare && <span className="text-[10px] text-slate-400 border-t border-slate-100 mt-0.5 font-normal">{formatPKR((order.compareNetRevenueCents || 0) / 100)}</span>}
                                                                </div>
                                                            </TableCell>
                                                        )}
                                                        {isVisible("status") && (
                                                            <TableCell className="whitespace-nowrap">
                                                                <Badge variant="outline" className={cn(
                                                                    "text-[9px] uppercase font-bold tracking-widest border-none px-2 py-0.5",
                                                                    order.status === 'FULFILLED' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' :
                                                                    order.status === 'APPROVED' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400' :
                                                                    order.status === 'REFUNDED' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400' :
                                                                    'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400'
                                                                )}>
                                                                    {order.status}
                                                                </Badge>
                                                            </TableCell>
                                                        )}
                                                    </TableRow>
                                                )
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="px-5 py-3 bg-slate-50/70 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                                    {filteredOrders.length} line item{filteredOrders.length !== 1 ? "s" : ""} shown
                                </p>
                                <p className="text-[10px] text-slate-300 dark:text-slate-600" suppressHydrationWarning>
                                    Generated {generatedDate}
                                </p>
                            </div>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
}
