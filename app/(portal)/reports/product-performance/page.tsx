"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import useSWR from "swr"
import { useAppContext } from "@/components/context/app-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    Loader2, RefreshCw, Search, FileText, FileSpreadsheet, FileIcon as FilePdf, Download, LineChart, Package, Tags, AlertOctagon, TrendingUp, History, Layers, Calculator, ChevronDown, Check
} from "lucide-react"
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Line, ComposedChart
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
    const [selectedChartProducts, setSelectedChartProducts] = useState<number[]>([])
    const [chartProductDropdownOpen, setChartProductDropdownOpen] = useState(false)

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

    const currentYear = dateRange?.startDate.getFullYear() || new Date().getFullYear()
    const currentMonthIdx = dateRange?.startDate.getMonth() || new Date().getMonth()

    const products = useMemo(() => {
        const p = perfData?.data || []
        // Sort by revenue descending by default
        return [...p].sort((a: any, b: any) => (b.revenueGeneratedCents || 0) - (a.revenueGeneratedCents || 0))
    }, [perfData])

    const transactionItems = useMemo(() => {
        const items = summaryData?.items || []
        // Sort by date descending
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
    const totalVolume = products.reduce((sum: number, p: any) => sum + (p.qtyFulfilled || 0), 0)
    const totalRefunds = products.reduce((sum: number, p: any) => sum + (p.qtyRefunded || 0), 0)
    const totalRefundLoss = products.reduce((sum: number, p: any) => sum + (p.refundLossCents || 0), 0)

    const refundRate = (totalVolume + totalRefunds) > 0 ? (totalRefunds / (totalVolume + totalRefunds)) * 100 : 0

    // Chart data: build per-product comparison data
    const chartProducts = selectedChartProducts.length > 0
        ? products.filter((p: any) => selectedChartProducts.includes(p.productId))
        : products.slice(0, 5) // Default: top 5 products by revenue

    const chartData = chartProducts.map((p: any) => ({
        name: p.productName?.length > 18 ? p.productName.substring(0, 18) + '…' : p.productName,
        fullName: p.productName,
        ordered: p.qtyOrdered || 0,
        fulfilled: p.qtyFulfilled || 0,
        refunded: p.qtyRefunded || 0,
        revenue: Math.round((p.revenueGeneratedCents || 0) / 100),
        compFulfilled: p.compareQty || 0,
        compRevenue: Math.round((p.compareRevenue || 0) / 100)
    }))

    // Comparison Trends
    const comparison = perfData?.comparison
    const getTrend = (current: number, prev: number) => {
        if (!prev || prev === 0) return null
        const diff = ((current - prev) / prev) * 100
        return {
            value: Math.abs(diff).toFixed(1),
            isUp: diff > 0,
            isDown: diff < 0
        }
    }

    const revenueTrend = getTrend(totalRevenue, comparison?.totalRevenue || 0)
    const volumeTrend = getTrend(totalVolume, comparison?.totalVolume || 0)
    const refundTrend = getTrend(totalRefunds, comparison?.totalRefunds || 0)

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

                {/* ━━━ "INTELLIGENCE" HEADER ━━━ */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#eab308] via-[#ca8a04] to-[#c2410c] px-6 py-6 text-white shadow-xl ring-1 ring-amber-500/30">
                <div className="flex flex-wrap flex-col gap-2 relative z-10">
                    <p className="text-xs tracking-[0.2em] text-white/80 font-bold uppercase">Centralized Reporting</p>
                    <div className="flex items-center justify-between">
                        <h1 className="text-3xl font-semibold tracking-tight">Product Intelligence</h1>
                        <div className="flex bg-white/10 backdrop-blur-md p-1 rounded-2xl border border-white/20">
                            <button
                                onClick={() => setActiveTab("analytics")}
                                className={cn(
                                    "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                                    activeTab === "analytics" 
                                        ? "bg-white text-amber-600 shadow-lg" 
                                        : "text-white/70 hover:text-white hover:bg-white/5"
                                )}
                            >
                                <LineChart className="w-4 h-4 mr-2 inline-block" />
                                Product analytics
                            </button>
                            <button
                                onClick={() => setActiveTab("reports")}
                                className={cn(
                                    "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                                    activeTab === "reports" 
                                        ? "bg-white text-amber-600 shadow-lg" 
                                        : "text-white/70 hover:text-white hover:bg-white/5"
                                )}
                            >
                                <History className="w-4 h-4 mr-2 inline-block" />
                                Product Reports
                            </button>
                        </div>
                    </div>
                    <p className="text-sm text-white/90 font-medium max-w-2xl">
                        Unified view of product performance and transactional history. Analyze top-line yield alongside ground-level order logs.
                    </p>
                </div>
                    <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
                </div>

                {/* ━━━ KPI BENTO GRID ━━━ */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Card className="p-5 rounded-2xl border border-amber-200 dark:border-amber-800/50 shadow-sm bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                                <TrendingUp className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <Badge variant="outline" className="border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 text-[10px] uppercase font-bold tracking-wider">Product Revenue</Badge>
                                {revenueTrend && revenueTrend.value !== "0.0" && (
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
                            <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{formatPKR(totalRevenue / 100)}</p>
                            {compare && comparison && (
                                <span className="text-[10px] font-bold text-slate-400 line-through opacity-50">
                                    {formatPKR(comparison.totalRevenue / 100)}
                                </span>
                            )}
                        </div>
                        <p className="text-xs font-semibold text-slate-400 mt-2">Yield from fulfilled products.</p>
                    </Card>

                    <Card className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                                <Package className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider opacity-60">Qty Fulfilled</Badge>
                                {volumeTrend && volumeTrend.value !== "0.0" && (
                                    <div className={cn(
                                        "text-[10px] font-black tracking-tighter",
                                        volumeTrend.isUp ? "text-emerald-500" : volumeTrend.isDown ? "text-rose-500" : "text-slate-400"
                                    )}>
                                        {volumeTrend.isUp ? "↑" : volumeTrend.isDown ? "↓" : "•"} {volumeTrend.value}%
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{totalVolume.toLocaleString()}</p>
                            {compare && comparison && (
                                <span className="text-[10px] font-bold text-slate-400 line-through opacity-50">
                                    {comparison.totalVolume.toLocaleString()}
                                </span>
                            )}
                        </div>
                        <p className="text-xs font-semibold text-slate-400 mt-2">Total successful units delivered.</p>
                    </Card>

                    <Card className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400">
                                <AlertOctagon className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider opacity-60">Refund Rate</Badge>
                                {refundTrend && refundTrend.value !== "0.0" && (
                                    <div className={cn(
                                        "text-[10px] font-black tracking-tighter",
                                        refundTrend.isUp ? "text-rose-500" : refundTrend.isDown ? "text-emerald-500" : "text-slate-400"
                                    )}>
                                        {refundTrend.isUp ? "↑" : refundTrend.isDown ? "↓" : "•"} {refundTrend.value}%
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <p className="text-3xl font-bold text-rose-600 dark:text-rose-400 mb-1">{refundRate.toFixed(2)}%</p>
                            {compare && comparison && (
                                <span className="text-[10px] font-bold text-slate-400 line-through opacity-50">
                                    {comparison.totalRefunds.toLocaleString()} items
                                </span>
                            )}
                        </div>
                        <p className="text-xs font-semibold text-slate-400 mt-2">{totalRefunds.toLocaleString()} items refunded.</p>
                    </Card>
                </div>

                {/* ━━━ TAB CONTENT ━━━ */}
                {activeTab === "analytics" ? (
                    <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800/50 flex flex-wrap justify-between items-center gap-3 bg-white/50 dark:bg-slate-900/20">
                            <h3 className="font-semibold text-sm uppercase tracking-tight text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                <LineChart className="h-4 w-4 text-amber-600" />
                                Product analytics
                            </h3>

                            <div className="flex flex-wrap items-center gap-2">
                                <DropdownMenu open={chartProductDropdownOpen} onOpenChange={setChartProductDropdownOpen}>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-8 text-[11px] font-bold border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 gap-1.5 px-3 rounded-md">
                                            <Layers className="h-3 w-3" />
                                            {selectedChartProducts.length === 0 ? "Top 5 Products" : `${selectedChartProducts.length} Selected`}
                                            <ChevronDown className="h-3 w-3 opacity-50" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-64 max-h-[400px] overflow-y-auto rounded-xl p-1 shadow-2xl">
                                        <div className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] border-b border-slate-50 mb-1">Visualize Comparison</div>
                                        <div className="grid grid-cols-1 gap-1">
                                            {products.slice(0, 30).map((p: any) => (
                                                <DropdownMenuItem 
                                                    key={p.productId} 
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        setSelectedChartProducts(prev => 
                                                            prev.includes(p.productId) 
                                                                ? prev.filter(id => id !== p.productId) 
                                                                : [...prev, p.productId]
                                                        )
                                                    }}
                                                    className={cn(
                                                        "text-[11px] py-2.5 px-3 cursor-pointer flex items-center justify-between rounded-lg transition-all",
                                                        selectedChartProducts.includes(p.productId) ? "bg-amber-50 text-amber-700 dark:bg-amber-900/20" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                                    )}
                                                >
                                                    <div className="flex flex-col truncate pr-2">
                                                        <span className="font-bold truncate">{p.productName}</span>
                                                        <span className="text-[9px] opacity-50 font-mono tracking-tighter">{p.productCode}</span>
                                                    </div>
                                                    {selectedChartProducts.includes(p.productId) && (
                                                        <div className="shrink-0 h-5 w-5 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30">
                                                            <Check className="h-3 w-3" strokeWidth={4} />
                                                        </div>
                                                    )}
                                                </DropdownMenuItem>
                                            ))}
                                        </div>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                    <Input
                                        placeholder="Filter List..."
                                        className="pl-8 h-8 w-40 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 focus:ring-1 focus:ring-amber-500/50 transition-all rounded-md"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button size="sm" className="h-8 text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white gap-1.5 px-3 rounded-md shadow-lg shadow-amber-600/20" disabled={isPerfLoading}>
                                            <Download className="h-3.5 w-3.5" /> EXPORT
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-40 rounded-xl">
                                        <DropdownMenuItem onClick={() => handleExport('csv')} className="text-xs py-2 cursor-pointer font-medium font-bold"><FileText className="mr-2 h-4 w-4 text-slate-400" /> CSV</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleExport('excel')} className="text-xs py-2 cursor-pointer font-medium font-bold"><FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-500" /> Excel</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleExport('pdf')} className="text-xs py-2 cursor-pointer font-medium font-bold"><FilePdf className="mr-2 h-4 w-4 text-rose-500" /> PDF</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>

                        {/* Chart Section */}
                        <div className="p-6 bg-slate-50/30 dark:bg-slate-900/10 border-b border-slate-100 dark:border-slate-800/50">
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                                        <XAxis 
                                            dataKey="name" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                                            interval={0}
                                        />
                                        <YAxis 
                                            yAxisId="left"
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: '#64748b', fontSize: 10 }}
                                            label={{ value: 'Quantity', angle: -90, position: 'insideLeft', style: { fill: '#64748b', fontSize: 10, fontWeight: 700 } }}
                                        />
                                        <YAxis 
                                            yAxisId="right"
                                            orientation="right"
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: '#059669', fontSize: 10 }}
                                            label={{ value: 'Revenue (PKR)', angle: 90, position: 'insideRight', style: { fill: '#059669', fontSize: 10, fontWeight: 700 } }}
                                        />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                            itemStyle={{ fontSize: '11px', fontWeight: 600 }}
                                            labelStyle={{ fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}
                                            formatter={(value: any, name: string) => [name === 'revenue' ? formatPKR(value) : value, name.charAt(0).toUpperCase() + name.slice(1)]}
                                        />
                                        <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', paddingTop: '10px' }} />
                                        <Bar yAxisId="left" dataKey="ordered" name="ordered" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={compare ? 10 : 20} />
                                        <Bar yAxisId="left" dataKey="fulfilled" name="fulfilled" fill="#10b981" radius={[4, 4, 0, 0]} barSize={compare ? 10 : 20} />
                                        <Bar yAxisId="left" dataKey="refunded" name="refunded" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={compare ? 10 : 20} />
                                        {compare && <Bar yAxisId="left" dataKey="compFulfilled" name="prev fulfilled" fill="#fcd34d" radius={[4, 4, 0, 0]} barSize={10} />}
                                        
                                        <Line yAxisId="right" type="monotone" dataKey="revenue" name="revenue" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: '#f59e0b', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                                        {compare && <Line yAxisId="right" type="monotone" dataKey="compRevenue" name="prev revenue" stroke="#fcd34d" strokeWidth={3} strokeDasharray="4 4" dot={{ r: 4, fill: '#fcd34d', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />}
                                    </ComposedChart>
                                </ResponsiveContainer>
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
                                                        variant={p.qtyRefunded > 0 ? "destructive" : (p.status === 'active' ? 'default' : 'secondary')} 
                                                        className="text-[9px] uppercase px-1.5 py-0"
                                                    >
                                                        {p.qtyRefunded > 0 ? 'REFUNDED' : (p.status || 'ACTIVE')}
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
                ) : (
                    <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl">
                        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/20">
                            <div className="flex items-center gap-3">
                                <History className="h-4 w-4 text-indigo-500" />
                                <h3 className="font-semibold text-sm uppercase tracking-tight text-slate-800 dark:text-slate-200">
                                    Product Reports
                                </h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                    <Input
                                        placeholder="Search by Trans ID, product..."
                                        className="pl-8 h-8 w-56 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 focus:ring-1 focus:ring-indigo-500/50 transition-all rounded-md"
                                        value={reportSearchTerm}
                                        onChange={(e) => setReportSearchTerm(e.target.value)}
                                    />
                                </div>
                                <Badge variant="secondary" className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 border-none text-[10px] font-bold uppercase">Transaction Audit</Badge>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50/20 dark:bg-slate-800/10">
                                        <TableHead className="w-8 h-10"></TableHead>
                                        <TableHead className="pl-2 h-10 text-[9px] font-black uppercase tracking-widest text-slate-400">Date</TableHead>
                                        <TableHead className="h-10 text-[9px] font-black uppercase tracking-widest text-slate-400">Item / SKU</TableHead>
                                        <TableHead className="h-10 text-[9px] font-black uppercase tracking-widest text-slate-400">Branch Context</TableHead>
                                        <TableHead className="h-10 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Qty</TableHead>
                                        <TableHead className="h-10 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Unit Price</TableHead>
                                        <TableHead className="h-10 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Net Total</TableHead>
                                        <TableHead className="h-10 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Trans ID</TableHead>
                                        <TableHead className="h-10 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right pr-6">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isSummaryLoading ? (
                                        <TableRow><TableCell colSpan={8} className="h-32 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-300" /></TableCell></TableRow>
                                    ) : filteredTransactions.length === 0 ? (
                                        <TableRow><TableCell colSpan={8} className="h-32 text-center text-slate-500 text-xs text-black">No transactions recorded.</TableCell></TableRow>
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
                                        }, {} as any)).map((order: any) => {
                                            const isExpanded = expandedRow === `order-${order.id}`
                                            const totalQty = order.items.reduce((s: number, i: any) => s + i.quantity, 0)
                                            const totalRevenue = order.items.reduce((s: number, i: any) => s + (i.quantity * i.priceCents) / 100, 0)
                                            const avgUnitPrice = order.items.length === 1 ? order.items[0].priceCents / 100 : totalRevenue / totalQty

                                            return (
                                                <React.Fragment key={order.id}>
                                                    <TableRow className={cn("hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors", order.items.length === 1 ? "cursor-pointer" : "")} onClick={() => { if (order.items.length === 1) handleRowClick(order.items[0]) }}>
                                                        <TableCell onClick={(e) => { e.stopPropagation(); setExpandedRow(isExpanded ? null : `order-${order.id}`); }} className="w-8">
                                                            {order.items.length > 1 ? (
                                                                <button className="flex items-center justify-center w-5 h-5 rounded-md bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
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
                                                                <span className="text-[10px] text-slate-400 font-mono italic">{order.items.length === 1 ? order.items[0].productCode : 'MULTIPLE'}</span>
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
                                                            <Badge variant="outline" className={cn(
                                                                "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border-none",
                                                                order.status === "REFUNDED" ? "bg-rose-100 text-rose-600" : 
                                                                order.status === "REJECTED" ? "bg-amber-100 text-amber-600" : 
                                                                "bg-emerald-100 text-emerald-600"
                                                            )}>
                                                                {order.status}
                                                            </Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                    {isExpanded && order.items.map((prod: any, pIdx: number) => {
                                                        const pTotal = (prod.quantity * prod.priceCents) / 100
                                                        return (
                                                        <TableRow key={`${order.id}-${pIdx}`} className="bg-slate-50 dark:bg-slate-800/80 border-l-4 border-indigo-600 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-inner" onClick={() => handleRowClick(prod)}>
                                                            <TableCell className="w-8 pl-3">
                                                                <div className="w-2 h-2 rounded-full bg-indigo-400" />
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
                                                                <Badge variant="outline" className={cn(
                                                                    "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border-none",
                                                                    prod.orderStatus === "REFUNDED" ? "bg-rose-100 text-rose-600" :
                                                                    prod.orderStatus === "REJECTED" ? "bg-amber-100 text-amber-600" :
                                                                    "bg-emerald-100 text-emerald-600"
                                                                )}>
                                                                    {prod.orderStatus}
                                                                </Badge>
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
