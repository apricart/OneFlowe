"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import useSWR from "swr"
import { useAppContext } from "@/components/context/app-context"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
    RefreshCw, Search, Download, FileText, FileSpreadsheet, FileIcon as FilePdf, Package, TrendingUp, Loader2, AlertOctagon, RotateCcw, Calculator, 
    ChevronDown, BarChart3, ListOrdered, Calendar, Hash, Store, Layers, ArrowUpRight, ArrowDownRight, LayoutDashboard, Database, Filter
} from "lucide-react"
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
    DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    ResponsiveContainer,
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    Legend,
    Cell,
    PieChart,
    Pie,
} from "recharts"

import { ColumnSelector, useColumnSelector, type ColumnDef } from "@/components/reports/column-selector"
import { GlobalDateFilter, type FilterPreset } from "@/components/dashboard/global-date-filter"
import type { DateRange } from "@/lib/hooks/use-sales-performance"
import { BranchFilter } from "@/components/reports/branch-filter"
import { MultiSelectFilter } from "@/components/reports/multi-select-filter"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const ALL_COLUMNS: ColumnDef[] = [
    { key: "orderDate", label: "Date", defaultVisible: true },
    { key: "userName", label: "User name", defaultVisible: true },
    { key: "tid", label: "Transaction ID", defaultVisible: true },
    { key: "organizationName", label: "Org", defaultVisible: true },
    { key: "group", label: "Group", defaultVisible: true },
    { key: "branchName", label: "Branch", defaultVisible: true },
    { key: "status", label: "Status", defaultVisible: true },
    { key: "subtotalValue", label: "Subtotal", defaultVisible: true },
    { key: "refundValue", label: "Refund", defaultVisible: true },
    { key: "netTotalValue", label: "Net Total", defaultVisible: true },
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
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const {
        organizationId: contextOrgId,
        branchId: contextBranchId,
        branchIds: contextBranchIds,
        setBranchIds: setContextBranchIds
    } = useAppContext()

    const { data: session } = useSession()
    const role = (session?.user as any)?.role as Role
    const userOrgId = (session?.user as any)?.organizationId
    const organizationId = userOrgId || contextOrgId

    const [hasMounted, setHasMounted] = useState(false)
    const [activeTab, setActiveTab] = useState("analytics")
    const [reportSearch, setReportSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
    const [generatedDate, setGeneratedDate] = useState("")

    // ━━━ 1. GLOBAL STATE (Sticky Header) ━━━
    const [dateRange, setDateRange] = useState<DateRange | null>(null)
    const [activePreset, setActivePreset] = useState<FilterPreset>("all")
    const [compare, setCompare] = useState(false)
    const [compareRange, setCompareRange] = useState<DateRange | null>(null)
    
    // Global Multi-Selects
    const [selectedMonths, setSelectedMonths] = useState<number[]>([])
    const [selectedYears, setSelectedYears] = useState<number[]>([])
    const [compareMonths, setCompareMonths] = useState<number[]>([])
    const [compareYears, setCompareYears] = useState<number[]>([])

    // ━━━ 2. ANALYTICS LOCAL STATE ━━━
    const [chartMonths, setChartMonths] = useState<number[]>([])
    const [chartYears, setChartYears] = useState<number[]>([])
    const [chartBranchIds, setChartBranchIds] = useState<string[]>([])

    // ━━━ 3. REPORTS LOCAL STATE ━━━
    const [reportMonths, setReportMonths] = useState<number[]>([])
    const [reportYears, setReportYears] = useState<number[]>([])
    const [reportBranchIds, setReportBranchIds] = useState<string[]>([])

    const { visibleKeys, isVisible, setVisibleKeys } = useColumnSelector(ALL_COLUMNS, "order-report-v2")

    // ━━━ DATA FETCHING (3-TIER) ━━━
    
    // Tier 1: Global Summary
    const globalParams = new URLSearchParams()
    if (organizationId) globalParams.set("organizationId", organizationId.toString())
    if (dateRange?.startDate) globalParams.set("startDate", dateRange.startDate.toISOString())
    if (dateRange?.endDate) globalParams.set("endDate", dateRange.endDate.toISOString())
    if (selectedMonths.length) globalParams.set("months", selectedMonths.join(","))
    if (selectedYears.length) globalParams.set("years", selectedYears.join(","))
    if (compare) {
        globalParams.set("compare", "true")
        if (compareRange?.startDate) globalParams.set("compareStartDate", compareRange.startDate.toISOString())
        if (compareRange?.endDate) globalParams.set("compareEndDate", compareRange.endDate.toISOString())
        if (compareMonths.length) globalParams.set("compareMonths", compareMonths.join(","))
        if (compareYears.length) globalParams.set("compareYears", compareYears.join(","))
    }
    const { data: globalData, isLoading: isGlobalLoading, mutate: mutateGlobal } = useSWR(
        `/api/v1/analytics/summary?${globalParams.toString()}&summaryOnly=true`, fetcher
    )

    // Tier 2: Chart/Trend Data
    const chartParams = new URLSearchParams()
    if (organizationId) chartParams.set("organizationId", organizationId.toString())
    if (chartBranchIds.length) chartParams.set("branchIds", chartBranchIds.join(","))
    if (chartMonths.length) chartParams.set("months", chartMonths.join(","))
    if (chartYears.length) chartParams.set("years", chartYears.join(","))
    if (compare) chartParams.set("compare", "true")
    const { data: chartData, isLoading: isChartLoading, mutate: mutateChart } = useSWR(
        `/api/v1/analytics/summary?${chartParams.toString()}&trendOnly=true`, fetcher
    )

    // Tier 3: Report Table Data
    const reportParams = new URLSearchParams()
    if (organizationId) reportParams.set("organizationId", organizationId.toString())
    if (reportBranchIds.length) reportParams.set("branchIds", reportBranchIds.join(","))
    if (reportMonths.length) reportParams.set("months", reportMonths.join(","))
    if (reportYears.length) reportParams.set("years", reportYears.join(","))
    const { data: reportData, isLoading: isReportLoading, mutate: mutateReport } = useSWR(
        `/api/v1/analytics/summary?${reportParams.toString()}`, fetcher
    )

    // All-time Data (for year ranges)
    const { data: allTimeData } = useSWR(organizationId ? `/api/v1/analytics/summary?organizationId=${organizationId}&allTime=true` : null, fetcher)

    useEffect(() => {
        setHasMounted(true)
        setGeneratedDate(new Date().toLocaleString())
    }, [])

    const handleDateChange = useCallback((range: DateRange | null, preset: FilterPreset, c?: boolean, cr?: DateRange | null, m?: number[], y?: number[], cm?: number[], cy?: number[]) => {
        setDateRange(range)
        setActivePreset(preset)
        if (c !== undefined) setCompare(c)
        if (cr !== undefined) setCompareRange(cr)
        if (m !== undefined) setSelectedMonths(m)
        if (y !== undefined) setSelectedYears(y)
        if (cm !== undefined) setCompareMonths(cm)
        if (cy !== undefined) setCompareYears(cy)
    }, [])

    const handleBranchChange = useCallback((ids: string[]) => {
        setContextBranchIds(ids)
    }, [setContextBranchIds])

    // ━━━ DATA PROCESSING ━━━
    const summary = globalData?.summary || { totalSales: 0, totalRefunds: 0, totalTax: 0, totalSubtotal: 0, orderCount: 0 }
    const comparison = globalData?.comparison
    const chartOrders = chartData?.orders || []
    const reportOrders = reportData?.orders || []

    const filteredOrders = useMemo(() => {
        return reportOrders.filter((order: any) => {
            const matchesSearch = !reportSearch ||
                (order.tid && order.tid.toLowerCase().includes(reportSearch.toLowerCase())) ||
                (order.userName && order.userName.toLowerCase().includes(reportSearch.toLowerCase()))
            const matchesStatus = statusFilter === 'all' || order.status?.toLowerCase() === statusFilter.toLowerCase();
            return matchesSearch && matchesStatus;
        })
    }, [reportOrders, reportSearch, statusFilter])

    const getTrend = (current: number, prev: number) => {
        if (!prev || prev === 0) return null
        const diff = ((current - prev) / prev) * 100
        return { value: Math.abs(diff).toFixed(1), isUp: diff > 0, isDown: diff < 0 }
    }

    const revenueTrend = getTrend(summary.totalSales, comparison?.totalSales || 0)
    const refundsTrend = getTrend(summary.totalRefunds, comparison?.totalRefunds || 0)
    const ordersTrend = getTrend(summary.orderCount, comparison?.totalOrders || 0)

    // ━━━ CHART TREND DATA: Normalized X-Axis ━━━
    const chartTrendData = useMemo(() => {
        const trend = chartOrders || []
        const currentYear = new Date().getFullYear()
        
        // Case A: Multiple years -> Show Years on X-Axis
        if (chartYears.length > 1) {
            return chartYears.sort((a,b) => a-b).map(year => {
                const yearOrders = trend.filter((o: any) => new Date(o.createdAt || o.orderDate).getFullYear() === year)
                const compOrders = chartData?.comparisonOrders?.filter((o: any) => new Date(o.createdAt || o.orderDate).getFullYear() === year) || []
                
                return {
                    label: String(year),
                    revenue: Math.round(yearOrders.reduce((sum: number, o: any) => sum + (o.totalCents - (o.refundAmountCents || 0))/100, 0)),
                    orders: yearOrders.length,
                    prevRevenue: Math.round(compOrders.reduce((sum: number, o: any) => sum + (o.totalCents - (o.refundAmountCents || 0))/100, 0)),
                    prevOrders: compOrders.length
                }
            })
        }

        // Case B: Single year (or default) -> Show Months on X-Axis
        const activeYear = chartYears.length === 1 ? chartYears[0] : currentYear
        const monthsToShow = chartMonths.length > 0 && chartMonths.length < 12 
            ? [...chartMonths].sort((a,b) => a-b) 
            : [1,2,3,4,5,6,7,8,9,10,11,12]

        return monthsToShow.map(m => {
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
            const monthOrders = trend.filter((o: any) => {
                const d = new Date(o.createdAt || o.orderDate)
                return d.getFullYear() === activeYear && (d.getMonth() + 1) === m
            })
            const compOrders = chartData?.comparisonOrders?.filter((o: any) => {
                const d = new Date(o.createdAt || o.orderDate)
                return d.getFullYear() === activeYear && (d.getMonth() + 1) === m
            }) || []

            return {
                label: monthNames[m-1],
                revenue: Math.round(monthOrders.reduce((sum: number, o: any) => sum + (o.totalCents - (o.refundAmountCents || 0))/100, 0)),
                orders: monthOrders.length,
                prevRevenue: Math.round(compOrders.reduce((sum: number, o: any) => sum + (o.totalCents - (o.refundAmountCents || 0))/100, 0)),
                prevOrders: compOrders.length
            }
        })
    }, [chartOrders, chartData, chartMonths, chartYears])

    // Status breakdown for Donut
    const statusChartData = useMemo(() => {
        if (!chartOrders.length) return []
        const counts: Record<string, number> = {}
        chartOrders.forEach((o: any) => {
            const s = (o.status || "UNKNOWN").toUpperCase()
            counts[s] = (counts[s] || 0) + 1
        })
        return Object.entries(counts).map(([name, value]) => ({ name, value, fill: STATUS_COLORS[name] || "#94a3b8" }))
    }, [chartOrders])

    const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
        const headers = ALL_COLUMNS.filter(c => isVisible(c.key)).map(c => c.label)
        const rows = filteredOrders.map((order: any) => {
            const row: any[] = []
            if (isVisible("orderDate")) row.push(new Date(order.createdAt).toLocaleDateString())
            if (isVisible("userName")) row.push(order.userName || "-")
            if (isVisible("tid")) row.push(order.tid)
            if (isVisible("organizationName")) row.push(order.organizationName || "N/A")
            if (isVisible("group")) row.push(order.group || "-")
            if (isVisible("branchName")) row.push(order.branchName || "-")
            if (isVisible("status")) row.push(order.status)
            if (isVisible("subtotalValue")) row.push(((order.subtotalCents || 0) / 100).toFixed(2))
            if (isVisible("refundValue")) row.push(((order.refundAmountCents || 0) / 100).toFixed(2))
            if (isVisible("netTotalValue")) row.push((( (order.totalCents || 0) - (order.refundAmountCents || 0)) / 100).toFixed(2))
            return row
        })

        if (format === 'pdf') {
            const doc = new jsPDF('landscape')
            doc.setFontSize(20); doc.text("Order Consumption Report", 14, 20)
            doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28)
            autoTable(doc, { startY: 40, head: [headers], body: rows, theme: 'grid', styles: { fontSize: 8 } })
            doc.save(`order-report-${Date.now()}.pdf`); return
        }

        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Orders")
        XLSX.writeFile(wb, `order-report-${Date.now()}.${format === 'excel' ? 'xlsx' : 'csv'}`)
    }

    if (!hasMounted) return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-400" /></div>

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0b0f1a] pb-16 text-slate-900 dark:text-slate-100">
            {/* â” â”  STICKY BANKING-GRADE HEADER â” â”  */}
            <div className="sticky top-0 z-40 bg-white/80 dark:bg-[#0b0f1a]/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-6 h-14 flex items-center shadow-sm">
                <div className="flex items-center gap-3">
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
                        <div className="flex items-center gap-2 h-6 pl-3 border-l border-slate-200 dark:border-slate-800">
                            <BranchFilter selectedIds={contextBranchIds} onChange={handleBranchChange} organizationId={organizationId || undefined} />
                        </div>
                    )}
                </div>
                <div className="flex-1" />
                <div className="flex items-center gap-3">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => { mutateGlobal(); mutateChart(); mutateReport(); }}
                        className="h-9 px-4 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold text-[11px] gap-2 hover:bg-slate-50 transition-all"
                    >
                        <RefreshCw className={cn("h-3.5 w-3.5", (isGlobalLoading || isChartLoading || isReportLoading) && "animate-spin")} />
                        SYNC
                    </Button>
                </div>
            </div>

            <div className="px-4 md:px-6 pt-6 space-y-6">
                {/* â” â” â”  LUXURY INTELLIGENCE HEADER â” â” â”  */}
                <div className="relative overflow-hidden bg-slate-900 rounded-[2.5rem] border border-slate-800 shadow-2xl">
                    <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-indigo-600/20 blur-[120px] rounded-full animate-pulse" />
                    <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-72 h-72 bg-blue-600/10 blur-[100px] rounded-full" />
                    
                    <div className="px-8 py-10 relative">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-2xl bg-indigo-600/20 text-indigo-400 ring-1 ring-indigo-500/30">
                                        <TrendingUp className="h-5 w-5" />
                                    </div>
                                    <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-[10px] font-black uppercase tracking-widest px-3 py-1">
                                        Intelligence Engine
                                    </Badge>
                                </div>
                                <h1 className="text-4xl font-black text-white tracking-tight sm:text-5xl uppercase">
                                    Order <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-blue-400 to-emerald-400">Intelligence</span>
                                </h1>
                                <p className="text-slate-400 font-medium text-sm flex items-center gap-2 max-w-md">
                                    <Calculator className="h-4 w-4 opacity-50" />
                                    Detailed audit of <strong className="text-white">{summary.orderCount}</strong> transactions across selected domains.
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button className="h-12 bg-indigo-600 hover:bg-indigo-500 text-white border-none rounded-2xl px-6 gap-2 shadow-lg shadow-indigo-600/20 transition-all duration-300 font-black text-xs uppercase tracking-widest">
                                            <Download className="h-4 w-4" /> Export Report
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-52 bg-slate-900 border-slate-800 text-slate-300 rounded-2xl p-2">
                                        <DropdownMenuItem onClick={() => handleExport('csv')} className="gap-3 py-3 rounded-xl hover:bg-slate-800 cursor-pointer">
                                            <FileSpreadsheet className="h-4 w-4 text-emerald-500" /> <span className="text-[10px] font-black uppercase">Archive CSV</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleExport('excel')} className="gap-3 py-3 rounded-xl hover:bg-slate-800 cursor-pointer">
                                            <FileText className="h-4 w-4 text-blue-500" /> <span className="text-[10px] font-black uppercase">Excel Ledger</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleExport('pdf')} className="gap-3 py-3 rounded-xl hover:bg-slate-800 cursor-pointer">
                                            <FilePdf className="h-4 w-4 text-rose-500" /> <span className="text-[10px] font-black uppercase">PDF Document</span>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    </div>
                </div>

                {/* â” â” â”  KPI BENTO GRID â” â” â”  */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                    <KPICard label="Net Revenue" value={formatPKR((summary.totalSales - summary.totalRefunds) / 100)} icon={<TrendingUp className="h-6 w-6" />} iconBg="bg-indigo-500/10 text-indigo-500" trend={revenueTrend} trendColor="indigo" subtitle="Gross fulfilled minus refunds." compare={compare} compareValue={formatPKR(((comparison?.totalSales || 0) - (comparison?.totalRefunds || 0)) / 100)} />
                    <KPICard label="Refund Impact" value={formatPKR(summary.totalRefunds / 100)} icon={<RotateCcw className="h-6 w-6" />} iconBg="bg-rose-500/10 text-rose-500" trend={refundsTrend} trendColor="rose" subtitle="Total value returned to users." compare={compare} compareValue={formatPKR((comparison?.totalRefunds || 0) / 100)} />
                    <KPICard label="Total Orders" value={summary.orderCount} icon={<Package className="h-6 w-6" />} iconBg="bg-blue-500/10 text-blue-500" trend={ordersTrend} trendColor="blue" subtitle="Gross transaction count." compare={compare} compareValue={comparison?.totalOrders} />
                    <KPICard label="Avg Value" value={formatPKR(summary.orderCount > 0 ? (summary.totalSales / summary.orderCount) / 100 : 0)} icon={<Calculator className="h-6 w-6" />} iconBg="bg-amber-500/10 text-amber-500" subtitle="Gross revenue per order." />
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 pt-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <TabsList className="bg-slate-200/50 dark:bg-slate-900/50 p-1 rounded-2xl h-12 w-fit backdrop-blur-md border border-slate-200 dark:border-slate-800">
                            <TabsTrigger value="analytics" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-lg rounded-xl px-6 py-2 text-xs font-black uppercase tracking-widest gap-2 transition-all duration-300">
                                <BarChart3 className="h-4 w-4 text-indigo-500" /> Analytics
                            </TabsTrigger>
                            <TabsTrigger value="reports" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-lg rounded-xl px-6 py-2 text-xs font-black uppercase tracking-widest gap-2 transition-all duration-300">
                                <ListOrdered className="h-4 w-4 text-blue-500" /> Ledger
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="analytics" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Main Trend Chart */}
                            <Card className="lg:col-span-2 rounded-[2rem] border-slate-200 dark:border-slate-800 shadow-xl bg-white/50 dark:bg-slate-900/40 backdrop-blur-xl overflow-hidden">
                                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
                                            <TrendingUp className="h-4 w-4" />
                                        </div>
                                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Order Velocity</h3>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <MonthFilter selected={chartMonths} onChange={setChartMonths} />
                                        <YearFilter selected={chartYears} onChange={setChartYears} allTimeData={allTimeData} />
                                        {(role === "SUPER_ADMIN" || role === "HEAD_OFFICE") && (
                                            <BranchFilter selectedIds={chartBranchIds} onChange={setChartBranchIds} organizationId={organizationId || undefined} />
                                        )}
                                    </div>
                                </div>
                                <div className="p-6 h-[400px]">
                                    {isChartLoading ? (
                                        <div className="h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-500/20" /></div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={chartTrendData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                                <defs>
                                                    <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                                                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} dy={10} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} tickFormatter={(v) => `₨${v/1000}k`} />
                                                <RechartsTooltip content={<BarTooltip compare={compare} />} cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} />
                                                <Bar dataKey="revenue" fill="url(#revGradient)" radius={[6, 6, 0, 0]} barSize={32} name="Current Revenue" />
                                                {compare && <Bar dataKey="prevRevenue" fill="#94a3b8" opacity={0.3} radius={[6, 6, 0, 0]} barSize={32} name="Prior Revenue" />}
                                                <Line type="monotone" dataKey="orders" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} name="Orders" />
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </Card>

                            {/* Status Distribution */}
                            <Card className="rounded-[2rem] border-slate-200 dark:border-slate-800 shadow-xl bg-white/50 dark:bg-slate-900/40 backdrop-blur-xl overflow-hidden">
                                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                                        <Layers className="h-4 w-4" />
                                    </div>
                                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Status Mix</h3>
                                </div>
                                <div className="p-6 h-[400px] flex flex-col justify-center">
                                    <ResponsiveContainer width="100%" height={250}>
                                        <PieChart>
                                            <Pie
                                                data={statusChartData}
                                                innerRadius={60}
                                                outerRadius={90}
                                                paddingAngle={8}
                                                dataKey="value"
                                                stroke="none"
                                            >
                                                {statusChartData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip 
                                                content={({ active, payload }) => {
                                                    if (active && payload && payload.length) {
                                                        const d = payload[0].payload;
                                                        return (
                                                            <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800">
                                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{d.name}</p>
                                                                <p className="text-lg font-black text-slate-900 dark:text-white">{d.value} <span className="text-xs font-medium text-slate-400">orders</span></p>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="grid grid-cols-2 gap-3 mt-6">
                                        {statusChartData.map((s) => (
                                            <div key={s.name} className="flex items-center gap-2">
                                                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: s.fill }} />
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{s.name}</span>
                                                <span className="text-[10px] font-black ml-auto">{s.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="reports" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {/* Report Controls */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/50 dark:bg-slate-900/40 p-4 rounded-[2rem] border border-slate-200 dark:border-slate-800 backdrop-blur-xl">
                            <div className="flex flex-wrap items-center gap-2">
                                <button onClick={() => setStatusFilter("all")} className={cn("px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", statusFilter === "all" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200")}>All</button>
                                <button onClick={() => setStatusFilter("fulfilled")} className={cn("px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", statusFilter === "fulfilled" ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200")}>Fulfilled</button>
                                <button onClick={() => setStatusFilter("refunded")} className={cn("px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", statusFilter === "refunded" ? "bg-rose-600 text-white shadow-lg shadow-rose-600/20" : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200")}>Refunds</button>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="relative group">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                    <Input
                                        placeholder="Scan Ledger (TID, User)..."
                                        className="pl-11 h-11 w-64 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl text-xs font-bold placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-indigo-500/20"
                                        value={reportSearch}
                                        onChange={(e) => setReportSearch(e.target.value)}
                                    />
                                </div>
                                <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-1" />
                                <MonthFilter selected={reportMonths} onChange={setReportMonths} />
                                <YearFilter selected={reportYears} onChange={setReportYears} allTimeData={allTimeData} />
                                <ColumnSelector columns={ALL_COLUMNS} storageKey="order-report-v2" visibleKeys={visibleKeys} onChange={setVisibleKeys} />
                            </div>
                        </div>

                        {/* Report Table */}
                        <Card className="rounded-[2.5rem] border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900/40 overflow-hidden">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 hover:bg-transparent">
                                            {isVisible("orderDate") && <TableHead className="h-14 px-6 text-[10px] font-black uppercase tracking-widest text-slate-500"><div className="flex items-center gap-2"><Calendar className="h-3 w-3" /> Date</div></TableHead>}
                                            {isVisible("userName") && <TableHead className="h-14 px-6 text-[10px] font-black uppercase tracking-widest text-slate-500">User</TableHead>}
                                            {isVisible("tid") && <TableHead className="h-14 px-6 text-[10px] font-black uppercase tracking-widest text-slate-500"><div className="flex items-center gap-2"><Hash className="h-3 w-3" /> TID</div></TableHead>}
                                            {isVisible("organizationName") && <TableHead className="h-14 px-1 px-6 text-[10px] font-black uppercase tracking-widest text-slate-500">Org</TableHead>}
                                            {isVisible("group") && <TableHead className="h-14 px-6 text-[10px] font-black uppercase tracking-widest text-slate-500">Group</TableHead>}
                                            {isVisible("branchName") && <TableHead className="h-14 px-6 text-[10px] font-black uppercase tracking-widest text-slate-500"><div className="flex items-center gap-2"><Store className="h-3 w-3" /> Branch</div></TableHead>}
                                            {isVisible("status") && <TableHead className="h-14 px-6 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Status</TableHead>}
                                            {isVisible("subtotalValue") && <TableHead className="h-14 px-6 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Subtotal</TableHead>}
                                            {isVisible("refundValue") && <TableHead className="h-14 px-6 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right text-rose-500">Refund</TableHead>}
                                            {isVisible("netTotalValue") && <TableHead className="h-14 px-6 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Net Total</TableHead>}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isReportLoading ? (
                                            <TableRow><TableCell colSpan={ALL_COLUMNS.length} className="h-64 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-500/20" /></TableCell></TableRow>
                                        ) : filteredOrders.length === 0 ? (
                                            <TableRow><TableCell colSpan={ALL_COLUMNS.length} className="h-64 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">No records found</TableCell></TableRow>
                                        ) : (
                                            filteredOrders.map((order: any) => (
                                                <TableRow key={order.id} className="group border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-indigo-500/5 transition-colors duration-200">
                                                    {isVisible("orderDate") && <TableCell className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-tighter" suppressHydrationWarning>{new Date(order.createdAt).toLocaleDateString()}</TableCell>}
                                                    {isVisible("userName") && <TableCell className="px-6 py-4"><span className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-tighter">{order.userName || "Guest System"}</span></TableCell>}
                                                    {isVisible("tid") && <TableCell className="px-6 py-4"><span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-600 dark:text-slate-400 font-mono italic">{order.tid}</span></TableCell>}
                                                    {isVisible("organizationName") && <TableCell className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{order.organizationName || "N/A"}</TableCell>}
                                                    {isVisible("group") && <TableCell className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{order.group || "-"}</TableCell>}
                                                    {isVisible("branchName") && <TableCell className="px-6 py-4 text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-tighter">{order.branchName}</TableCell>}
                                                    {isVisible("status") && (
                                                        <TableCell className="px-6 py-4 text-center">
                                                            <Badge variant="outline" style={{ backgroundColor: `${STATUS_COLORS[order.status?.toUpperCase()] || '#94a3b8'}15`, color: STATUS_COLORS[order.status?.toUpperCase()] || '#94a3b8', borderColor: `${STATUS_COLORS[order.status?.toUpperCase()] || '#94a3b8'}30` }} className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border">
                                                                {order.status}
                                                            </Badge>
                                                        </TableCell>
                                                    )}
                                                    {isVisible("subtotalValue") && <TableCell className="px-6 py-4 text-right text-[11px] font-bold font-mono">{formatPKR(order.subtotalCents / 100)}</TableCell>}
                                                    {isVisible("refundValue") && <TableCell className="px-6 py-4 text-right text-[11px] font-black font-mono text-rose-500">{order.refundAmountCents > 0 ? `-${formatPKR(order.refundAmountCents / 100)}` : "—"}</TableCell>}
                                                    {isVisible("netTotalValue") && <TableCell className="px-6 py-4 text-right text-xs font-black font-mono text-slate-900 dark:text-white leading-none">{formatPKR((order.totalCents - (order.refundAmountCents || 0)) / 100)}</TableCell>}
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="px-8 py-6 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-center gap-6">
                                    <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Volume</p><p className="text-xl font-black text-slate-900 dark:text-white leading-none">{filteredOrders.length}</p></div>
                                    <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
                                    <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Net Revenue Pool</p><p className="text-xl font-black text-indigo-500 leading-none">{formatPKR(filteredOrders.reduce((sum: number, o: any) => sum + (o.totalCents - (o.refundAmountCents || 0)), 0) / 100)}</p></div>
                                </div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic" suppressHydrationWarning>Generated locally on {generatedDate}</p>
                            </div>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
}

// â” â” â”  HELPER COMPONENTS â” â” â” 

function KPICard({ label, value, icon, iconBg, trend, trendColor, subtitle, compare, compareValue }: any) {
    return (
        <Card className="relative overflow-hidden group rounded-[2.5rem] bg-white/50 dark:bg-slate-900/40 backdrop-blur-xl border-slate-200 dark:border-slate-800 shadow-xl transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1">
            <div className="p-7">
                <div className="flex items-center justify-between mb-4">
                    <div className={cn("p-4 rounded-[1.25rem] transition-transform duration-500 group-hover:scale-110", iconBg)}>{icon}</div>
                    {trend && (
                        <Badge variant="outline" className={cn("text-[10px] font-black uppercase tracking-widest px-3 py-1 border-none", 
                            trendColor === "indigo" ? "bg-indigo-500/10 text-indigo-500" : 
                            trendColor === "rose" ? "bg-rose-500/10 text-rose-500" : 
                            "bg-blue-500/10 text-blue-500")}>
                            {trend.isUp ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                            {trend.value}%
                        </Badge>
                    )}
                </div>
                <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{label}</p>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none">{value}</h2>
                    {subtitle && <p className="text-[10px] font-bold text-slate-400 italic pt-1">{subtitle}</p>}
                </div>
                {compare && compareValue !== undefined && (
                    <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/50 flex items-center justify-between">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Prior Period</span>
                        <span className="text-xs font-black text-slate-500">{compareValue}</span>
                    </div>
                )}
            </div>
        </Card>
    )
}

function MonthFilter({ selected, onChange }: { selected: number[], onChange: (val: number[]) => void }) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    const items = months.map((m, i) => ({ id: i + 1, label: m }))
    return (
        <MultiSelectFilter
            title="Months"
            items={items}
            selectedIds={selected}
            onChange={(ids) => onChange(ids.sort((a,b) => a - b))}
            icon={<Filter className="h-3.5 w-3.5 text-indigo-500" />}
            placeholder="Months"
            showSearch={false}
        />
    )
}

function YearFilter({ selected, onChange, allTimeData }: { selected: number[], onChange: (val: number[]) => void, allTimeData: any }) {
    const availableYears = useMemo(() => {
        if (!allTimeData?.orders?.length) return [new Date().getFullYear()]
        const yearsSet = new Set<number>()
        allTimeData.orders.forEach((o: any) => yearsSet.add(new Date(o.createdAt).getFullYear()))
        return Array.from(yearsSet).sort((a, b) => b - a)
    }, [allTimeData])

    const items = availableYears.map(y => ({ id: y, label: String(y) }))

    return (
        <MultiSelectFilter
            title="Years"
            items={items}
            selectedIds={selected}
            onChange={(ids) => onChange(ids.sort((a,b) => b - a))}
            icon={<Calendar className="h-3.5 w-3.5 text-blue-500" />}
            placeholder="Years"
            showSearch={false}
        />
    )
}

function BarTooltip({ active, payload, label, compare }: any) {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 min-w-[200px] backdrop-blur-xl bg-white/90 dark:bg-slate-900/90">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">{label}</p>
                </div>
                <div className="space-y-2">
                    {payload.map((p: any) => (
                        <div key={p.name} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{p.name}</span>
                            </div>
                            <span className="text-xs font-black text-slate-900 dark:text-white tabular-nums">
                                {typeof p.value === 'number' && p.name.toLowerCase().includes('revenue') ? formatPKR(p.value) : p.value}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        )
    }
    return null
}
