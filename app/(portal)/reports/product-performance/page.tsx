"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import useSWR from "swr"
import { useAppContext } from "@/components/context/app-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    Loader2, RefreshCw, Search, FileText, FileSpreadsheet, FileIcon as FilePdf, Download, LineChart, Package, Tags, AlertOctagon, TrendingUp, History, Layers, Calculator, ChevronDown, Check, ArrowUpRight, ArrowDownRight, ChartBar as ChartBarIcon, ShieldCheck, ShieldX, Eye
} from "lucide-react"
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell
} from "recharts"
import * as XLSX from "xlsx"
import { formatPKR, cn } from "@/lib/utils"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { Badge } from "@/components/ui/badge"
import { Role } from "@/lib/rbac"
import { useSession } from "next-auth/react"
import { Input } from "@/components/ui/input"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { GlobalDateFilter, type FilterPreset } from "@/components/dashboard/global-date-filter"
import { BranchFilter } from "@/components/reports/branch-filter"
import { GroupFilter } from "@/components/reports/group-filter"

import { ExpandableRowDrawer, type DetailField } from "@/components/reports/expandable-row-drawer"
import { ColumnSelector, useColumnSelector, type ColumnDef } from "@/components/reports/column-selector"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#818cf8', '#7c3aed', '#4f46e5', '#4338ca', '#6d28d9', '#5b21b6']

const LEDGER_COLUMNS: ColumnDef[] = [
    { key: "date", label: "Date", defaultVisible: true },
    { key: "item", label: "Item / SKU", defaultVisible: true },
    { key: "branch", label: "Branch Context", defaultVisible: true },
    { key: "qty", label: "Qty", defaultVisible: true },
    { key: "unit_price", label: "Unit Price", defaultVisible: true },
    { key: "total", label: "Net Total", defaultVisible: true },
    { key: "tid", label: "Trans ID", defaultVisible: true },
    { key: "status", label: "Status", defaultVisible: true },
]

export default function ProductPerformancePage() {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const { visibleKeys, isVisible, setVisibleKeys } = useColumnSelector(LEDGER_COLUMNS, "product-intelligence-ledger")

    const {
        organizationId,
        branchId: contextBranchId,
        branchIds: contextBranchIds,
        setBranchIds: setContextBranchIds
    } = useAppContext()

    const [searchTerm, setSearchTerm] = useState("")
    const [reportSearchTerm, setReportSearchTerm] = useState("")
    const [generatedDate, setGeneratedDate] = useState("")
    const [selectedRow, setSelectedRow] = useState<any>(null)
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<"analytics" | "reports">("analytics")
    const [expandedRow, setExpandedRow] = useState<string | null>(null)

    const { data: session } = useSession()
    const role = (session?.user as any)?.role as Role
    const [hasMounted, setHasMounted] = useState(false)

    // URL States for filtering
    const presetFromUrl = (searchParams.get("preset") as FilterPreset) || "all"
    const startFromUrl = searchParams.get("startDate") || ""
    const endFromUrl = searchParams.get("endDate") || ""
    const compareFromUrl = searchParams.get("compare") === "true"

    const [compare, setCompare] = useState(compareFromUrl)
    const [compareRange, setCompareRange] = useState<{ startDate: Date; endDate: Date } | null>(null)
    
    // Multi-select month/year states
    const [selectedMonths, setSelectedMonths] = useState<number[]>(
        searchParams.get("months")?.split(",").map(Number).filter(n => !isNaN(n)) || []
    )
    const [selectedYears, setSelectedYears] = useState<number[]>(
        searchParams.get("years")?.split(",").map(Number).filter(n => !isNaN(n)) || []
    )
    const [compareMonths, setCompareMonths] = useState<number[]>(
        searchParams.get("compareMonths")?.split(",").map(Number).filter(n => !isNaN(n)) || []
    )
    const [compareYears, setCompareYears] = useState<number[]>(
        searchParams.get("compareYears")?.split(",").map(Number).filter(n => !isNaN(n)) || []
    )

    const activePreset = presetFromUrl
    const dateRange = useMemo(() => {
        if (startFromUrl && endFromUrl) {
            return { startDate: new Date(startFromUrl), endDate: new Date(endFromUrl) }
        }
        return null
    }, [startFromUrl, endFromUrl])

    const handleDateChange = useCallback((
        range: { startDate: Date; endDate: Date } | null, 
        preset: FilterPreset, 
        compareMode?: boolean, 
        compRange?: { startDate: Date; endDate: Date } | null,
        months: number[] = [],
        years: number[] = [],
        cMonths: number[] = [],
        cYears: number[] = []
    ) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("preset", preset)
        if (compareMode !== undefined) {
            params.set("compare", String(compareMode))
            setCompare(compareMode)
        }
        if (compRange !== undefined) {
            setCompareRange(compRange)
        }
        
        setSelectedMonths(months)
        setSelectedYears(years)
        setCompareMonths(cMonths)
        setCompareYears(cYears)

        if (months.length > 0) params.set("months", months.join(","))
        else params.delete("months")
        
        if (years.length > 0) params.set("years", years.join(","))
        else params.delete("years")
        
        if (cMonths.length > 0) params.set("compareMonths", cMonths.join(","))
        else params.delete("compareMonths")
        
        if (cYears.length > 0) params.set("compareYears", cYears.join(","))
        else params.delete("compareYears")

        if (range) {
            params.set("startDate", range.startDate.toISOString())
            params.set("endDate", range.endDate.toISOString())
        } else {
            params.delete("startDate")
            params.delete("endDate")
        }
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }, [searchParams, pathname, router])

    const handleBranchChange = useCallback((ids: string[]) => {
        setContextBranchIds(ids)
    }, [setContextBranchIds])

    // Build query strings
    const queryParams = new URLSearchParams()
    if (organizationId) queryParams.set("organizationId", organizationId.toString())
    if (startFromUrl) queryParams.set("startDate", startFromUrl)
    if (endFromUrl) queryParams.set("endDate", endFromUrl)

    if (contextBranchIds.length > 0) {
        queryParams.set("branchIds", contextBranchIds.join(","))
    } else if (contextBranchId) {
        queryParams.set("branchId", contextBranchId)
    }

    if (selectedMonths.length > 0) queryParams.set("months", selectedMonths.join(","))
    if (selectedYears.length > 0) queryParams.set("years", selectedYears.join(","))
    if (compareMonths.length > 0) queryParams.set("compareMonths", compareMonths.join(","))
    if (compareYears.length > 0) queryParams.set("compareYears", compareYears.join(","))

    if (compare) {
        queryParams.set("compare", "true")
        if (compareRange) {
            queryParams.set("compareStartDate", compareRange.startDate.toISOString())
            queryParams.set("compareEndDate", compareRange.endDate.toISOString())
        }
    }

    // Performance Data (Aggregated)
    const { data: perfData, isLoading: isPerfLoading, mutate: mutatePerf } = useSWR(`/api/v1/analytics/products/performance?${queryParams.toString()}`, fetcher)

    // Transactional Summary Data (Line Items)
    const summaryParams = new URLSearchParams(queryParams.toString())
    summaryParams.set("limit", "100")
    const { data: summaryData, isLoading: isSummaryLoading, mutate: mutateSummary } = useSWR(`/api/v1/analytics/products/summary?${summaryParams.toString()}`, fetcher)

    useEffect(() => {
        setHasMounted(true)
        setGeneratedDate(new Date().toLocaleString())

        if (!startFromUrl && !endFromUrl && selectedMonths.length === 0 && selectedYears.length === 0) {
            handleDateChange(null, "all")
        }
    }, [])

    const products = useMemo(() => {
        const p = perfData?.data || []
        return [...p].sort((a: any, b: any) => (b.revenueGeneratedCents || 0) - (a.revenueGeneratedCents || 0))
    }, [perfData])

    const transactionItems = useMemo(() => {
        const items = summaryData?.items || []
        return [...items].sort((a: any, b: any) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())
    }, [summaryData])

    const filteredTransactions = useMemo(() => {
        if (!reportSearchTerm) return transactionItems
        const term = reportSearchTerm.toLowerCase()
        return transactionItems.filter((i: any) => 
            (i.tid || "").toLowerCase().includes(term) ||
            (i.productName || "").toLowerCase().includes(term) ||
            (i.productCode || "").toLowerCase().includes(term)
        )
    }, [transactionItems, reportSearchTerm])

    const filteredProducts = products.filter((p: any) =>
        (p.productName || p.productCode || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.category || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.subCategory || "").toLowerCase().includes(searchTerm.toLowerCase())
    )

    const totalRevenue = products.reduce((sum: number, p: any) => sum + (p.revenueGeneratedCents || 0), 0)
    const totalOrdered = products.reduce((sum: number, p: any) => sum + (p.qtyOrdered || 0), 0)
    const totalVolume = products.reduce((sum: number, p: any) => sum + (p.qtyFulfilled || 0), 0)
    const totalRefunds = products.reduce((sum: number, p: any) => sum + (p.qtyRefunded || 0), 0)
    const totalRefundLoss = products.reduce((sum: number, p: any) => sum + (p.refundLossCents || 0), 0)
    const fulfillmentRate = totalOrdered > 0 ? (totalVolume / totalOrdered) * 100 : 0
    const refundRate = totalOrdered > 0 ? (totalRefunds / totalOrdered) * 100 : 0
    const activeProductCount = products.filter((p: any) => p.status === 'active').length
    const inactiveProductCount = products.filter((p: any) => p.status !== 'active').length

    // Comparison Trends
    const comparison = perfData?.comparison
    const getTrend = (current: number, prev: number) => {
        if (!prev || prev === 0) return null
        const diff = ((current - prev) / prev) * 100
        return { value: Math.abs(diff).toFixed(1), isUp: diff > 0, isDown: diff < 0 }
    }
    const revenueTrend = getTrend(totalRevenue, comparison?.totalRevenue || 0)
    const volumeTrend = getTrend(totalVolume, comparison?.totalVolume || 0)
    const refundTrend = getTrend(totalRefunds, comparison?.totalRefunds || 0)

    // Chart data: top 10 products by revenue
    const chartData = useMemo(() => {
        return filteredProducts.slice(0, 10).map((p: any) => ({
            name: p.productName?.length > 22 ? p.productName.substring(0, 22) + '…' : p.productName,
            fullName: p.productName,
            revenue: Math.round((p.revenueGeneratedCents || 0) / 100),
            ordered: p.qtyOrdered || 0,
            fulfilled: p.qtyFulfilled || 0,
            refunded: p.qtyRefunded || 0,
            fulfillRate: p.qtyOrdered > 0 ? Math.round((p.qtyFulfilled / p.qtyOrdered) * 100) : 0,
        }))
    }, [filteredProducts])

    const handleRowClick = (item: any) => {
        setSelectedRow(item)
        setDrawerOpen(true)
    }

    const getDrawerFields = (item: any): DetailField[] => [
        { key: "s1", label: "Order Information", value: "", type: "section" },
        { key: "tid", label: "Transaction ID", value: item.tid || "-", type: "mono" },
        { key: "orderDate", label: "Date & Time", value: new Date(item.orderDate).toLocaleString(), type: "date" },
        { key: "status", label: "Order Status", value: item.orderStatus, type: "badge" },
        { key: "branch", label: "Branch", value: item.branchName || "-" },
        { key: "org", label: "Organization", value: item.organizationName || "-" },
        { key: "s2", label: "Product Details", value: "", type: "section" },
        { key: "productCode", label: "Product Code", value: item.productCode || "-", type: "mono" },
        { key: "productName", label: "Product Name", value: item.productName || "-" },
        { key: "category", label: "Category", value: item.categoryName || "-" },
        { key: "price", label: "Unit Price", value: formatPKR(item.priceCents / 100), type: "currency" },
        { key: "s3", label: "Quantities & Revenue", value: "", type: "section" },
        { key: "qtyOrdered", label: "Qty Ordered", value: String(item.quantity || 0) },
        { key: "qtyFulfilled", label: "Qty Fulfilled", value: String(item.qtyFulfilled ?? item.quantity ?? 0) },
        { key: "qtyRefunded", label: "Qty Refunded", value: String(item.qtyRefunded ?? 0) },
        { key: "revenue", label: "Revenue Generated", value: formatPKR(((item.qtyFulfilled ?? item.quantity ?? 0) * item.priceCents) / 100), type: "currency" },
        { key: "refundLoss", label: "Refund Loss", value: formatPKR(((item.qtyRefunded ?? 0) * item.priceCents) / 100), type: "currency" },
        { key: "total", label: "Net Total", value: formatPKR((item.quantity * item.priceCents) / 100), type: "currency" },
    ]

    const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
        const headers = ["Product Code", "Product Name", "Category", "Sub-category", "Status", "Qty Ordered", "Qty Fulfilled", "Qty Refunded", "Revenue Generated"]
        const rows = filteredProducts.map((p: any) => [
            p.productCode, p.productName, p.category, p.subCategory, p.status || 'active', p.qtyOrdered, p.qtyFulfilled, p.qtyRefunded,
            (p.revenueGeneratedCents / 100).toFixed(2)
        ])

        if (format === 'pdf') {
            const doc = new jsPDF('landscape')
            doc.setFontSize(20); doc.text("Product Intelligence Report", 14, 20)
            doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28)
            autoTable(doc, { startY: 40, head: [headers], body: rows, theme: 'grid' })
            doc.save(`product-intelligence-${new Date().getTime()}.pdf`)
            return
        }

        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Performance")
        XLSX.writeFile(workbook, `product-intelligence-${new Date().getTime()}.${format === 'excel' ? 'xlsx' : 'csv'}`)
    }

    // Custom tooltip for horizontal bar chart
    const CustomBarTooltip = ({ active, payload }: any) => {
        if (!active || !payload?.length) return null
        const d = payload[0]?.payload
        return (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl p-4 min-w-[220px]">
                <p className="font-bold text-sm text-slate-900 dark:text-white mb-2">{d.fullName}</p>
                <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Revenue</span>
                        <span className="font-bold text-indigo-600">{formatPKR(d.revenue)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Ordered</span>
                        <span className="font-semibold">{d.ordered}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Fulfilled</span>
                        <span className="font-semibold text-emerald-600">{d.fulfilled}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Refunded</span>
                        <span className="font-semibold text-rose-500">{d.refunded}</span>
                    </div>
                    <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex justify-between text-xs">
                        <span className="text-slate-500">Fulfillment</span>
                        <span className="font-bold text-emerald-600">{d.fulfillRate}%</span>
                    </div>
                </div>
            </div>
        )
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

            {/* ━━━ GLOBAL STICKY HEADER ━━━ */}
            <div className="sticky top-0 z-30 flex flex-wrap items-center gap-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 p-4 shadow-sm">
                <GlobalDateFilter
                    value={dateRange}
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
                    onClick={() => { mutatePerf(); mutateSummary(); }}
                    disabled={isPerfLoading || isSummaryLoading}
                    className="h-9 text-[12px] font-bold bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-full px-4"
                >
                    <RefreshCw className={`h-3.5 w-3.5 mr-2 ${isPerfLoading || isSummaryLoading ? "animate-spin" : ""}`} />
                    REFRESH
                </Button>
            </div>

            <div className="px-4 md:px-6 space-y-5">

                {/* ━━━ HEADER WITH TAB SWITCHER ━━━ */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-900 px-6 py-6 text-white shadow-2xl">
                    <div className="flex flex-wrap flex-col gap-2 relative z-10">
                        <p className="text-xs tracking-[0.2em] text-white/60 font-bold uppercase">Centralized Reporting</p>
                        <div className="flex items-center justify-between">
                            <h1 className="text-3xl font-semibold tracking-tight">Product Intelligence</h1>
                            <div className="flex bg-white/10 backdrop-blur-md p-1 rounded-2xl border border-white/20">
                                <button
                                    onClick={() => setActiveTab("analytics")}
                                    className={cn(
                                        "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                                        activeTab === "analytics" 
                                            ? "bg-white text-indigo-700 shadow-lg" 
                                            : "text-white/70 hover:text-white hover:bg-white/5"
                                    )}
                                >
                                    <ChartBarIcon className="w-4 h-4 mr-2 inline-block" />
                                    Analytics
                                </button>
                                <button
                                    onClick={() => setActiveTab("reports")}
                                    className={cn(
                                        "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                                        activeTab === "reports" 
                                            ? "bg-white text-indigo-700 shadow-lg" 
                                            : "text-white/70 hover:text-white hover:bg-white/5"
                                    )}
                                >
                                    <History className="w-4 h-4 mr-2 inline-block" />
                                    Reports
                                </button>
                            </div>
                        </div>
                        <p className="text-sm text-white/70 font-medium max-w-2xl">
                            Unified view of product performance metrics and transactional history across all branches.
                        </p>
                    </div>
                    <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute bottom-0 left-0 translate-y-12 -translate-x-1/4 w-64 h-64 bg-violet-500/20 rounded-full blur-3xl pointer-events-none" />
                </div>

                {/* ━━━ KPI CARDS ━━━ */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Revenue */}
                    <KPICard
                        label="Total Revenue"
                        value={formatPKR(totalRevenue / 100)}
                        icon={<TrendingUp className="h-4 w-4" />}
                        iconBg="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400"
                        trend={revenueTrend}
                        trendColor="emerald"
                        subtitle="From fulfilled products"
                        compare={compare}
                        compareValue={comparison ? formatPKR(comparison.totalRevenue / 100) : undefined}
                    />
                    {/* Fulfilled */}
                    <KPICard
                        label="Qty Fulfilled"
                        value={totalVolume.toLocaleString()}
                        icon={<Package className="h-4 w-4" />}
                        iconBg="bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
                        trend={volumeTrend}
                        trendColor="emerald"
                        subtitle={`${fulfillmentRate.toFixed(1)}% fulfillment rate`}
                        compare={compare}
                        compareValue={comparison ? comparison.totalVolume.toLocaleString() : undefined}
                    />
                    {/* Refunded */}
                    <KPICard
                        label="Refund Loss"
                        value={formatPKR(totalRefundLoss / 100)}
                        icon={<AlertOctagon className="h-4 w-4" />}
                        iconBg="bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400"
                        trend={refundTrend}
                        trendColor="rose"
                        subtitle={`${totalRefunds.toLocaleString()} items (${refundRate.toFixed(1)}%)`}
                        compare={compare}
                        compareValue={comparison ? `${comparison.totalRefunds.toLocaleString()} items` : undefined}
                    />
                    {/* Product Status */}
                    <Card className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400">
                                <Layers className="h-4 w-4" />
                            </div>
                            <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-wider opacity-60">Catalog</Badge>
                        </div>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{products.length}</p>
                        <div className="flex items-center gap-3 mt-2">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                                <ShieldCheck className="h-3 w-3" /> {activeProductCount} active
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400">
                                <ShieldX className="h-3 w-3" /> {inactiveProductCount} inactive
                            </span>
                        </div>
                    </Card>
                </div>

                {/* ━━━ TAB CONTENT ━━━ */}
                {activeTab === "analytics" ? (
                    <>
                        {/* Revenue Chart */}
                        <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
                            <CardHeader className="pb-2 flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                        <ChartBarIcon className="h-4 w-4 text-indigo-500" />
                                        Top Products by Revenue
                                    </CardTitle>
                                    <p className="text-xs text-slate-400 mt-1">Revenue from fulfilled orders only</p>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-0 pb-4">
                                {isPerfLoading ? (
                                    <div className="h-[320px] flex items-center justify-center">
                                        <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
                                    </div>
                                ) : chartData.length === 0 ? (
                                    <div className="h-[320px] flex items-center justify-center text-sm text-slate-400">
                                        No product data available
                                    </div>
                                ) : (
                                    <div className="h-[320px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" opacity={0.3} />
                                                <XAxis 
                                                    type="number" 
                                                    axisLine={false} 
                                                    tickLine={false} 
                                                    tick={{ fill: '#94a3b8', fontSize: 10 }} 
                                                    tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v.toString()}
                                                />
                                                <YAxis 
                                                    type="category" 
                                                    dataKey="name" 
                                                    axisLine={false} 
                                                    tickLine={false} 
                                                    tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }} 
                                                    width={180}
                                                />
                                                <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} />
                                                <Bar dataKey="revenue" name="Revenue (PKR)" radius={[0, 8, 8, 0]} barSize={24}>
                                                    {chartData.map((_: any, idx: number) => (
                                                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Product Table */}
                        <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
                            <div className="p-4 border-b border-slate-100 dark:border-slate-800/50 flex flex-wrap justify-between items-center gap-3">
                                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                    <Package className="h-4 w-4 text-indigo-500" />
                                    All Products
                                    <Badge variant="secondary" className="text-[10px] ml-1 font-mono">{filteredProducts.length}</Badge>
                                </h3>

                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="relative">
                                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                        <Input
                                            placeholder="Search products..."
                                            className="pl-8 h-8 w-44 text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 rounded-lg"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button size="sm" className="h-8 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 px-3 rounded-lg shadow-lg shadow-indigo-600/20" disabled={isPerfLoading}>
                                                <Download className="h-3.5 w-3.5" /> EXPORT
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-40 rounded-xl">
                                            <DropdownMenuItem onClick={() => handleExport('csv')} className="text-xs py-2 cursor-pointer font-bold"><FileText className="mr-2 h-4 w-4 text-slate-400" /> CSV</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleExport('excel')} className="text-xs py-2 cursor-pointer font-bold"><FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-500" /> Excel</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleExport('pdf')} className="text-xs py-2 cursor-pointer font-bold"><FilePdf className="mr-2 h-4 w-4 text-rose-500" /> PDF</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-800">
                                            <TableHead className="pl-6 h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500">Code</TableHead>
                                            <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500">Product Name</TableHead>
                                            <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500">Category</TableHead>
                                            <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500">Sub-category</TableHead>
                                            <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center">Status</TableHead>
                                            <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center">{compare ? "Qty Ord (A/B)" : "Qty Ordered"}</TableHead>
                                            <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center text-emerald-600">{compare ? "Fulfilled (A/B)" : "Fulfilled"}</TableHead>
                                            <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center text-rose-500">{compare ? "Refunded (A/B)" : "Refunded"}</TableHead>
                                            <TableHead className="text-right pr-6 h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">{compare ? "Revenue (A/B)" : "Revenue"}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isPerfLoading ? (
                                            <TableRow><TableCell colSpan={8} className="h-32 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-amber-500" /></TableCell></TableRow>
                                        ) : filteredProducts.length === 0 ? (
                                            <TableRow><TableCell colSpan={8} className="h-32 text-center text-slate-500 text-sm">No products found.</TableCell></TableRow>
                                        ) : (
                                            filteredProducts.map((p: any) => (
                                                <TableRow key={p.productId} className="hover:bg-amber-50/40 dark:hover:bg-amber-900/10 border-b border-slate-100 dark:border-slate-800/50">
                                                    <TableCell className="font-mono text-[11px] pl-6 text-slate-500 font-semibold">{p.productCode}</TableCell>
                                                    <TableCell className="font-medium text-xs text-slate-900 dark:text-slate-200">
                                                        <div className="flex flex-col">
                                                            <span>{p.productName}</span>
                                                            <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded w-fit mt-1">{p.unit}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-xs text-slate-600 dark:text-slate-400">{p.category}</TableCell>
                                                    <TableCell className="text-xs text-slate-600 dark:text-slate-400">{p.subCategory}</TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge 
                                                            className={cn(
                                                                "text-[9px] uppercase px-2 py-0.5 rounded-full border-none font-bold tracking-wider",
                                                                (p.status === 'active' || !p.status) 
                                                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" 
                                                                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                                            )}
                                                        >
                                                            {p.status || 'ACTIVE'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-center font-mono text-xs">
                                                        <div className="flex flex-col items-center">
                                                            <span>{p.qtyOrdered}</span>
                                                            {compare && <span className="text-[10px] text-slate-400 border-t border-slate-100 mt-0.5">{p.compareQtyOrdered || 0}</span>}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                                                        <div className="flex flex-col items-center">
                                                            <span>{p.qtyFulfilled}</span>
                                                            {compare && <span className="text-[10px] text-slate-400 border-t border-slate-100 mt-0.5 font-normal">{p.compareQty || 0}</span>}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center font-mono font-bold text-xs text-rose-500">
                                                        <div className="flex flex-col items-center">
                                                            <span>{p.qtyRefunded}</span>
                                                            {compare && <span className="text-[10px] text-slate-400 border-t border-slate-100 mt-0.5 font-normal">{p.compareQtyRefunded || 0}</span>}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono font-bold text-xs text-slate-900 dark:text-white">
                                                        <div className="flex flex-col items-end">
                                                            <span>{formatPKR(p.revenueGeneratedCents / 100)}</span>
                                                            {compare && <span className="text-[10px] text-slate-400 border-t border-slate-100 mt-0.5 font-normal">{formatPKR((p.compareRevenue || 0) / 100)}</span>}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </Card>
                    </>
                ) : (
                    /* ━━━ REPORTS TAB ━━━ */
                    <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
                        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <History className="h-4 w-4 text-indigo-500" />
                                <h3 className="font-bold text-sm uppercase tracking-tight text-slate-800 dark:text-slate-200">
                                    Transaction Ledger
                                </h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                    <Input
                                        placeholder="Search by Trans ID, product..."
                                        className="pl-8 h-8 w-56 text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 rounded-lg"
                                        value={reportSearchTerm}
                                        onChange={(e) => setReportSearchTerm(e.target.value)}
                                    />
                                </div>
                                <Badge variant="secondary" className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 border-none text-[10px] font-bold uppercase">Audit Trail</Badge>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50/20 dark:bg-slate-800/10">
                                        <TableHead className="w-8 h-10"></TableHead>
                                        <TableHead className="pl-2 h-10 text-[9px] font-black uppercase tracking-widest text-slate-400">Date</TableHead>
                                        <TableHead className="h-10 text-[9px] font-black uppercase tracking-widest text-slate-400">Item / SKU</TableHead>
                                        <TableHead className="h-10 text-[9px] font-black uppercase tracking-widest text-slate-400">Branch</TableHead>
                                        <TableHead className="h-10 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Qty</TableHead>
                                        <TableHead className="h-10 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Unit Price</TableHead>
                                        <TableHead className="h-10 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Net Total</TableHead>
                                        <TableHead className="h-10 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Trans ID</TableHead>
                                        <TableHead className="h-10 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right pr-6">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isSummaryLoading ? (
                                        <TableRow><TableCell colSpan={9} className="h-32 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-300" /></TableCell></TableRow>
                                    ) : filteredTransactions.length === 0 ? (
                                        <TableRow><TableCell colSpan={9} className="h-32 text-center text-slate-400 text-xs">No transactions recorded.</TableCell></TableRow>
                                    ) : (
                                        Object.values(filteredTransactions.reduce((acc: any, curr: any) => {
                                            if (!acc[curr.orderId]) {
                                                acc[curr.orderId] = {
                                                    id: curr.orderId,
                                                    tid: curr.tid,
                                                    date: curr.orderDate,
                                                    branch: curr.branchName,
                                                    status: curr.orderStatus,
                                                    items: []
                                                }
                                            }
                                            acc[curr.orderId].items.push(curr)
                                            return acc
                                        }, {} as any))
                                        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                        .map((order: any) => {
                                            const isExpanded = expandedRow === `order-${order.id}`
                                            const totalQty = order.items.reduce((s: number, i: any) => s + i.quantity, 0)
                                            const totalRevenue = order.items.reduce((s: number, i: any) => s + (i.quantity * i.priceCents) / 100, 0)
                                            const avgUnitPrice = order.items.length === 1 ? order.items[0].priceCents / 100 : totalRevenue / totalQty

                                            return (
                                                <React.Fragment key={order.id}>
                                                    <TableRow className={cn("hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors", order.items.length === 1 ? "cursor-pointer" : "")} onClick={() => { if (order.items.length === 1) handleRowClick(order.items[0]) }}>
                                                        <TableCell onClick={(e) => { e.stopPropagation(); setExpandedRow(isExpanded ? null : `order-${order.id}`); }} className="w-8">
                                                            {order.items.length > 1 ? (
                                                                <button className="flex items-center justify-center w-5 h-5 rounded-md bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold">
                                                                    {isExpanded ? "−" : "+"}
                                                                </button>
                                                            ) : null}
                                                        </TableCell>
                                                        <TableCell className="pl-2 py-3 text-[11px] font-mono text-slate-500">{new Date(order.date).toLocaleDateString()}</TableCell>
                                                        <TableCell className="py-3">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-[11px] text-slate-900 dark:text-white uppercase truncate max-w-[180px]">
                                                                    {order.items.length === 1 ? order.items[0].productName : `${order.items.length} Products`}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 font-mono">{order.items.length === 1 ? order.items[0].productCode : 'MULTIPLE'}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-3">
                                                            <Badge variant="outline" className="text-[10px] font-medium opacity-70 px-2 rounded-full">{order.branch}</Badge>
                                                        </TableCell>
                                                        <TableCell className="text-center font-mono text-[11px] font-bold">{totalQty}</TableCell>
                                                        <TableCell className="text-center font-mono text-[11px] font-medium text-slate-400">{order.items.length === 1 ? formatPKR(avgUnitPrice) : 'Mixed'}</TableCell>
                                                        <TableCell className="text-center font-mono text-[11px] font-bold text-indigo-500">{formatPKR(totalRevenue)}</TableCell>
                                                        <TableCell className="text-center font-mono text-[10px] text-slate-400">{order.tid}</TableCell>
                                                        <TableCell className="text-right pr-6">
                                                            {(() => {
                                                                const s = (order.status || "").toUpperCase()
                                                                let colors = "bg-slate-100 text-slate-600 dark:bg-slate-900/20 dark:text-slate-400" // Default
                                                                if (s === 'FULFILLED') colors = "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
                                                                else if (s === 'REJECTED') colors = "bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400"
                                                                else if (s === 'REFUNDED') colors = "bg-rose-100 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400"
                                                                else if (s === 'APPROVED') colors = "bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                                                                else if (s === 'PARTIAL' || s === 'PARTIALLY_FULFILLED') colors = "bg-sky-100 text-sky-600 dark:bg-sky-900/20 dark:text-sky-400"
                                                                else if (s === 'CANCELLED') colors = "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                                                
                                                                return (
                                                                    <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border-none", colors)}>
                                                                        {order.status}
                                                                    </Badge>
                                                                )
                                                            })()}
                                                        </TableCell>
                                                    </TableRow>
                                                    {isExpanded && order.items.map((prod: any, pIdx: number) => {
                                                        const pTotal = (prod.quantity * prod.priceCents) / 100
                                                        return (
                                                        <TableRow key={`${order.id}-${pIdx}`} className="bg-slate-50/80 dark:bg-slate-800/80 border-l-4 border-indigo-500 cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-colors" onClick={() => handleRowClick(prod)}>
                                                            <TableCell className="w-8 pl-3">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                                            </TableCell>
                                                            <TableCell className="pl-2 py-3 text-[11px] font-mono text-slate-500">{new Date(prod.orderDate).toLocaleDateString()}</TableCell>
                                                            <TableCell className="py-3 pl-4">
                                                                <div className="flex flex-col">
                                                                    <span className="font-bold text-[11px] text-indigo-700 dark:text-indigo-300 uppercase">{prod.productName}</span>
                                                                    <span className="text-[10px] text-slate-500 font-mono">{prod.productCode}</span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="py-3 text-[11px] text-slate-500 font-medium">{order.branch}</TableCell>
                                                            <TableCell className="text-center font-mono text-[11px] text-slate-700 dark:text-slate-300 font-bold">{prod.quantity}</TableCell>
                                                            <TableCell className="text-center font-mono text-[11px] text-slate-600 dark:text-slate-400 font-medium">{formatPKR(prod.priceCents / 100)}</TableCell>
                                                            <TableCell className="text-center font-mono text-[11px] text-indigo-600 dark:text-indigo-400 font-bold">{formatPKR(pTotal)}</TableCell>
                                                            <TableCell className="text-center font-mono text-[10px] text-slate-500">{prod.tid}</TableCell>
                                                            <TableCell className="text-right pr-6">
                                                                {(() => {
                                                                    const s = (prod.orderStatus || "").toUpperCase()
                                                                    let colors = "bg-slate-100 text-slate-600 dark:bg-slate-900/10 dark:text-slate-400" // Default
                                                                    if (s === 'FULFILLED') colors = "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
                                                                    else if (s === 'REJECTED') colors = "bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400"
                                                                    else if (s === 'REFUNDED') colors = "bg-rose-100 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400"
                                                                    else if (s === 'APPROVED') colors = "bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                                                                    else if (s === 'PARTIAL' || s === 'PARTIALLY_FULFILLED') colors = "bg-sky-100 text-sky-600 dark:bg-sky-900/20 dark:text-sky-400"
                                                                    else if (s === 'CANCELLED') colors = "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                                                    return (
                                                                        <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border-none", colors)}>
                                                                            {prod.orderStatus}
                                                                        </Badge>
                                                                    )
                                                                })()}
                                                            </TableCell>
                                                        </TableRow>
                                                    )})}
                                                </React.Fragment>
                                            )
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                )}
            </div>

            <ExpandableRowDrawer
                open={drawerOpen} onClose={() => setDrawerOpen(false)}
                title={selectedRow?.productName || "Product Transaction"}
                subtitle={`${selectedRow?.branchName} • ${selectedRow?.productCode}`}
                fields={selectedRow ? getDrawerFields(selectedRow) : []}
            />
        </div>
    )
}

/* ━━━ KPI Card Component ━━━ */
function KPICard({ label, value, icon, iconBg, trend, trendColor, subtitle, compare, compareValue }: {
    label: string
    value: string | number
    icon: React.ReactNode
    iconBg: string
    trend: { value: string; isUp: boolean; isDown: boolean } | null
    trendColor: 'emerald' | 'rose'
    subtitle: string
    compare?: boolean
    compareValue?: string
}) {
    return (
        <Card className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between mb-2">
                <div className={cn("p-2 rounded-xl", iconBg)}>{icon}</div>
                <div className="flex flex-col items-end gap-1">
                    <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-wider opacity-60">{label}</Badge>
                    {trend && trend.value !== "0.0" && (
                        <div className={cn(
                            "flex items-center gap-0.5 text-[10px] font-bold",
                            trendColor === 'rose'
                                ? (trend.isUp ? "text-rose-500" : "text-emerald-500")
                                : (trend.isUp ? "text-emerald-500" : "text-rose-500")
                        )}>
                            {trend.isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {trend.value}%
                        </div>
                    )}
                </div>
            </div>
            <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
                {compare && compareValue && (
                    <span className="text-[10px] font-bold text-slate-400 line-through opacity-50">{compareValue}</span>
                )}
            </div>
            <p className="text-[10px] font-semibold text-slate-400 mt-1.5">{subtitle}</p>
        </Card>
    )
}
