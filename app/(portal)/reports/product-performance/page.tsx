"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import useSWR from "swr"
import { useAppContext } from "@/components/context/app-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    Loader2, RefreshCw, Search, FileText, FileSpreadsheet, FileIcon as FilePdf, Download, LineChart, Package, Tags, AlertOctagon, TrendingUp, History, Layers, Calculator
} from "lucide-react"
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
import { ScheduleReportModal } from "@/components/reports/schedule-report-modal"
import { ExpandableRowDrawer, type DetailField } from "@/components/reports/expandable-row-drawer"
import { ColumnSelector, useColumnSelector, type ColumnDef } from "@/components/reports/column-selector"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const LEDGER_COLUMNS: ColumnDef[] = [
    { key: "date", label: "Date", defaultVisible: true },
    { key: "item", label: "Item / SKU", defaultVisible: true },
    { key: "branch", label: "Branch", defaultVisible: true },
    { key: "qty", label: "Qty", defaultVisible: true },
    { key: "price", label: "Unit Price", defaultVisible: true },
    { key: "total", label: "Net Total", defaultVisible: true },
    { key: "tid", label: "Trans ID", defaultVisible: false },
    { key: "status", label: "Status", defaultVisible: false },
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
    const [groupId, setGroupId] = useState("")
    const [generatedDate, setGeneratedDate] = useState("")
    const [selectedRow, setSelectedRow] = useState<any>(null)
    const [drawerOpen, setDrawerOpen] = useState(false)

    const { data: session } = useSession()
    const role = (session?.user as any)?.role as Role
    const [hasMounted, setHasMounted] = useState(false)

    // URL States for filtering
    const presetFromUrl = (searchParams.get("preset") as FilterPreset) || "thisMonth"
    const startFromUrl = searchParams.get("startDate") || ""
    const endFromUrl = searchParams.get("endDate") || ""
    const compareFromUrl = searchParams.get("compare") === "true"

    const [compare, setCompare] = useState(compareFromUrl)
    const [compareRange, setCompareRange] = useState<{ startDate: Date; endDate: Date } | null>(null)

    const activePreset = presetFromUrl
    const dateRange = useMemo(() => {
        if (startFromUrl && endFromUrl) {
            return { startDate: new Date(startFromUrl), endDate: new Date(endFromUrl) }
        }
        return null
    }, [startFromUrl, endFromUrl])

    const handleDateChange = useCallback((range: { startDate: Date; endDate: Date } | null, preset: FilterPreset, compareMode?: boolean, compRange?: { startDate: Date; endDate: Date } | null) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("preset", preset)
        if (compareMode !== undefined) {
            params.set("compare", String(compareMode))
            setCompare(compareMode)
        }
        if (compRange !== undefined) {
            setCompareRange(compRange)
        }
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
    if (groupId) queryParams.set("groupId", groupId)

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

    // Performance Data (Aggregated)
    const { data: perfData, isLoading: isPerfLoading, mutate: mutatePerf } = useSWR(`/api/v1/analytics/products/performance?${queryParams.toString()}`, fetcher)

    // Transactional Summary Data (Line Items)
    const summaryParams = new URLSearchParams(queryParams.toString())
    summaryParams.set("limit", "100")
    const { data: summaryData, isLoading: isSummaryLoading, mutate: mutateSummary } = useSWR(`/api/v1/analytics/products/summary?${summaryParams.toString()}`, fetcher)

    useEffect(() => {
        setHasMounted(true)
        setGeneratedDate(new Date().toLocaleString())
    }, [])

    const products = perfData?.data || []
    const transactionItems = summaryData?.items || []

    const filteredProducts = products.filter((p: any) =>
        (p.productName || p.productCode || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.category || "").toLowerCase().includes(searchTerm.toLowerCase())
    )

    const totalRevenue = products.reduce((sum: number, p: any) => sum + (p.revenueGeneratedCents || 0), 0)
    const totalVolume = products.reduce((sum: number, p: any) => sum + (p.qtyFulfilled || 0), 0)
    const totalRefunds = products.reduce((sum: number, p: any) => sum + (p.qtyRefunded || 0), 0)
    const totalRefundLoss = products.reduce((sum: number, p: any) => sum + (p.refundLossCents || 0), 0)

    const refundRate = (totalVolume + totalRefunds) > 0 ? (totalRefunds / (totalVolume + totalRefunds)) * 100 : 0

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
        { key: "productName", label: "Product Name", value: item.productName },
        { key: "productCode", label: "Product Code", value: item.productCode || "-", type: "mono" },
        { key: "orderDate", label: "Order Date", value: new Date(item.orderDate).toLocaleString(), type: "date" },
        { key: "branch", label: "Branch", value: item.branchName },
        { key: "qty", label: "Quantity", value: item.quantity },
        { key: "price", label: "Unit Price", value: formatPKR(item.priceCents / 100), type: "currency" },
        { key: "total", label: "Total", value: formatPKR(item.totalAmount / 100), type: "currency" },
        { key: "status", label: "Status", value: item.orderStatus, type: "badge" },
    ]

    const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
        const headers = ["Product Code", "Product Name", "Category", "Orders", "Qty Fulfilled", "Qty Refunded", "Revenue Generated"]
        const rows = filteredProducts.map((p: any) => [
            p.productCode, p.productName, p.category, p.totalOrders, p.qtyFulfilled, p.qtyRefunded,
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
                />
                {(role === "SUPER_ADMIN" || role === "HEAD_OFFICE") && (
                    <>
                        <BranchFilter
                            selectedIds={contextBranchIds}
                            onChange={handleBranchChange}
                            organizationId={organizationId || undefined}
                        />
                        <GroupFilter
                            value={groupId}
                            onChange={setGroupId}
                            organizationId={organizationId || undefined}
                        />
                    </>
                )}
                <div className="flex-1" />
                <ScheduleReportModal reportName="Product Intelligence" />
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
                        <h1 className="text-3xl font-semibold tracking-tight">Product Intelligence</h1>
                        <p className="text-sm text-white/90 font-medium max-w-2xl">
                            Unified view of product performance and transactional history. Analyze top-line yield alongside ground-level order logs.
                        </p>
                    </div>
                    <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
                </div>

                {/* ━━━ KPI BENTO GRID ━━━ */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="p-5 rounded-2xl border border-amber-200 dark:border-amber-800/50 shadow-sm bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                                <TrendingUp className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <Badge variant="outline" className="border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 text-[10px] uppercase font-bold tracking-wider">Product Revenue</Badge>
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
                                {volumeTrend && (
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
                                {refundTrend && (
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

                    <Card className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400">
                                <Calculator className="h-4 w-4" />
                            </div>
                            <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider opacity-60">Unique SKUs</Badge>
                        </div>
                        <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{products.length}</p>
                        <p className="text-xs font-semibold text-slate-400 mt-2">Total active product codes.</p>
                    </Card>
                </div>

                {/* ━━━ AGGREGATED PERFORMANCE TABLE ━━━ */}
                <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800/50 flex flex-wrap justify-between items-center gap-3 bg-white/50 dark:bg-slate-900/20">
                        <h3 className="font-semibold text-sm uppercase tracking-tight text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <LineChart className="h-4 w-4 text-amber-600" />
                            Yield Breakdown (Aggregated)
                        </h3>
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                <Input
                                    placeholder="Search Products..."
                                    className="pl-8 h-8 w-48 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 focus:ring-1 focus:ring-amber-500/50 transition-all rounded-md"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button size="sm" className="h-8 text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white gap-1.5 px-3 rounded-md" disabled={isPerfLoading}>
                                        <Download className="h-3.5 w-3.5" /> EXPORT
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40 rounded-xl">
                                    <DropdownMenuItem onClick={() => handleExport('csv')} className="text-xs py-2 cursor-pointer font-medium"><FileText className="mr-2 h-4 w-4 text-slate-400" /> CSV</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleExport('excel')} className="text-xs py-2 cursor-pointer font-medium"><FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-500" /> Excel</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleExport('pdf')} className="text-xs py-2 cursor-pointer font-medium"><FilePdf className="mr-2 h-4 w-4 text-rose-500" /> PDF</DropdownMenuItem>
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
                                    <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center">Orders</TableHead>
                                    <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center text-emerald-600">Fulfilled</TableHead>
                                    {compare && <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center">Δ Volume</TableHead>}
                                    <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center text-rose-500">Refunded</TableHead>
                                    <TableHead className="text-right pr-6 h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">Revenue</TableHead>
                                    {compare && <TableHead className="text-right pr-6 h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">Δ Rev</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isPerfLoading ? (
                                    <TableRow><TableCell colSpan={7} className="h-32 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-amber-500" /></TableCell></TableRow>
                                ) : filteredProducts.length === 0 ? (
                                    <TableRow><TableCell colSpan={7} className="h-32 text-center text-slate-500 text-sm">No products found.</TableCell></TableRow>
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
                                            <TableCell className="text-center font-mono text-xs">{p.totalOrders}</TableCell>
                                            <TableCell className="text-center font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">{p.qtyFulfilled}</TableCell>
                                            {compare && (
                                                <TableCell className="text-center">
                                                    <div className="flex flex-col items-center">
                                                        <span className={`text-[10px] font-bold ${p.qtyFulfilled >= p.compareQty ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                            {p.qtyFulfilled >= p.compareQty ? '↑' : '↓'} {Math.abs(p.qtyFulfilled - p.compareQty)}
                                                        </span>
                                                        <span className="text-[8px] text-slate-400 font-mono">from {p.compareQty}</span>
                                                    </div>
                                                </TableCell>
                                            )}
                                            <TableCell className="text-center font-mono font-bold text-xs text-rose-500">{p.qtyRefunded}</TableCell>
                                            <TableCell className="text-right font-mono font-bold text-xs text-slate-900 dark:text-white">{formatPKR(p.revenueGeneratedCents / 100)}</TableCell>
                                            {compare && (
                                                <TableCell className="text-right pr-6">
                                                    <div className="flex flex-col items-end">
                                                        <span className={`text-[10px] font-bold ${p.revenueGeneratedCents >= p.compareRevenue ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                            {p.revenueGeneratedCents >= p.compareRevenue ? '↑' : '↓'} 
                                                            {((Math.abs(p.revenueGeneratedCents - p.compareRevenue) / (p.compareRevenue || 1)) * 100).toFixed(0)}%
                                                        </span>
                                                        <span className="text-[8px] text-slate-400 font-mono italic">
                                                            {p.revenueGeneratedCents >= p.compareRevenue ? '+' : '-'} {formatPKR(Math.abs(p.revenueGeneratedCents - p.compareRevenue) / 100)}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </Card>

                {/* ━━━ TRANSACTIONAL AUDIT LOG (Consolidated Feature) ━━━ */}
                <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl">
                    <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/20">
                        <div className="flex items-center gap-3">
                            <History className="h-4 w-4 text-indigo-500" />
                            <h3 className="font-semibold text-sm uppercase tracking-tight text-slate-800 dark:text-slate-200">
                                Recent Transaction Ledger
                            </h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <ColumnSelector columns={LEDGER_COLUMNS} storageKey="product-intelligence-ledger" visibleKeys={visibleKeys} onChange={setVisibleKeys} />
                            <Badge variant="secondary" className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 border-none text-[10px] font-bold uppercase">Line Item Audit</Badge>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50/20 dark:bg-slate-800/10">
                                    {isVisible("date") && <TableHead className="pl-6 h-10 text-[9px] font-black uppercase tracking-widest">Date</TableHead>}
                                    {isVisible("item") && <TableHead className="h-10 text-[9px] font-black uppercase tracking-widest">Item / SKU</TableHead>}
                                    {isVisible("branch") && <TableHead className="h-10 text-[9px] font-black uppercase tracking-widest">Branch Context</TableHead>}
                                    {isVisible("qty") && <TableHead className="h-10 text-[9px] font-black uppercase tracking-widest text-right">Qty</TableHead>}
                                    {isVisible("price") && <TableHead className="h-10 text-[9px] font-black uppercase tracking-widest text-right">Unit Price</TableHead>}
                                    {isVisible("total") && <TableHead className="h-10 text-[9px] font-black uppercase tracking-widest text-right pr-6">Net Total</TableHead>}
                                    {isVisible("tid") && <TableHead className="h-10 text-[9px] font-black uppercase tracking-widest px-4">Trans ID</TableHead>}
                                    {isVisible("status") && <TableHead className="h-10 text-[9px] font-black uppercase tracking-widest text-center">Status</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isSummaryLoading ? (
                                    <TableRow><TableCell colSpan={8} className="h-32 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-300" /></TableCell></TableRow>
                                ) : transactionItems.length === 0 ? (
                                    <TableRow><TableCell colSpan={8} className="h-32 text-center text-slate-500 text-xs">No recent transactions recorded.</TableCell></TableRow>
                                ) : (
                                    transactionItems.map((item: any, idx: number) => (
                                        <TableRow key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors" onClick={() => handleRowClick(item)}>
                                            {isVisible("date") && <TableCell className="pl-6 py-3 text-[11px] font-mono text-slate-500">{new Date(item.orderDate).toLocaleDateString()}</TableCell>}
                                            {isVisible("item") && (
                                                <TableCell className="py-3">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-[11px] text-slate-900 dark:text-white uppercase truncate max-w-[180px]">{item.productName}</span>
                                                        <span className="text-[10px] text-slate-400 font-mono italic">{item.productCode}</span>
                                                    </div>
                                                </TableCell>
                                            )}
                                            {isVisible("branch") && (
                                                <TableCell className="py-3">
                                                    <Badge variant="outline" className="text-[10px] font-medium opacity-70">{item.branchName}</Badge>
                                                </TableCell>
                                            )}
                                            {isVisible("qty") && <TableCell className="text-right font-mono text-[11px] font-bold">{item.quantity}</TableCell>}
                                            {isVisible("price") && <TableCell className="text-right font-mono text-[11px] text-slate-500">{formatPKR(item.priceCents / 100)}</TableCell>}
                                            {isVisible("total") && <TableCell className="text-right pr-6 font-mono font-bold text-[11px] text-indigo-600 dark:text-indigo-400">{formatPKR(item.totalAmount / 100)}</TableCell>}
                                            {isVisible("tid") && <TableCell className="px-4 font-mono text-[10px] text-slate-400 uppercase tracking-tighter italic whitespace-nowrap overflow-hidden text-ellipsis max-w-[100px]">{item.tid}</TableCell>}
                                            {isVisible("status") && (
                                                <TableCell className="text-center">
                                                    <Badge variant="outline" className={cn(
                                                        "text-[9px] uppercase font-bold px-1.5 py-0",
                                                        item.orderStatus === "FULFILLED" ? "text-emerald-600 border-emerald-200" :
                                                            item.orderStatus === "REFUNDED" ? "text-rose-500 border-rose-200" :
                                                                "text-amber-600 border-amber-200"
                                                    )}>
                                                        {item.orderStatus}
                                                    </Badge>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
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
