"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import useSWR from "swr"
import { useAppContext } from "@/components/context/app-context"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
    RefreshCw, Search, Download, FileText, FileSpreadsheet, Package, TrendingUp, Loader2, AlertOctagon, RotateCcw, Calculator, 
    ChevronDown, BarChart3, ListOrdered, Calendar, Hash, Store, Layers, ArrowUpRight, ArrowDownRight, LayoutDashboard, Database, Filter, LayoutGrid
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
import { GroupFilter } from "@/components/reports/group-filter"
import { OrganizationFilter } from "@/components/reports/organization-filter"
import { MultiBranchFilter } from "@/components/dashboard/multi-branch-filter"
import { MultiSelectFilter } from "@/components/reports/multi-select-filter"
import { KPICard } from "@/components/reports/kpi-card"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const ALL_COLUMNS: ColumnDef[] = [
    { key: "orderDate", label: "Date", defaultVisible: true },
    { key: "userName", label: "User name", defaultVisible: true },
    { key: "employeeId", label: "Employee #", defaultVisible: true },
    { key: "tid", label: "Transaction ID", defaultVisible: true },
    { key: "organizationName", label: "Org", defaultVisible: true },
    { key: "group", label: "Group", defaultVisible: true },
    { key: "branchName", label: "Branch", defaultVisible: true },
    { key: "status", label: "Status", defaultVisible: true },
    { key: "quantityOrdered", label: "Qty Ordered", defaultVisible: true },
    { key: "quantityDelivered", label: "Qty Delivered", defaultVisible: true },
    { key: "quantityRefunded", label: "Qty Refunded", defaultVisible: true },
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
    const isBuyer = role === "HEAD_OFFICE" || role === "BRANCH_ADMIN"

    // Role-based terminology
    const kpiRevenueLabel = isBuyer ? "Net Amount" : "Net Revenue"
    const kpiAvgLabel = isBuyer ? "Avg Purchased Value" : "Avg Value"
    const chartRevenueLabel = isBuyer ? "Purchased" : "Revenue"
    const chartOrdersLabel = isBuyer ? "Orders" : "Orders"
    const exportTitleLabel = isBuyer ? "Order Purchase Report" : "Order Consumption Report"

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
    const [chartOrgIds, setChartOrgIds] = useState<string[]>([])
    const [chartGroupIds, setChartGroupIds] = useState<string[]>([])
    const [chartBranchIds, setChartBranchIds] = useState<string[]>([])

    // ━━━ 3. REPORTS LOCAL STATE ━━━
    const [reportMonths, setReportMonths] = useState<number[]>([])
    const [reportYears, setReportYears] = useState<number[]>([])
    const [reportOrgIds, setReportOrgIds] = useState<string[]>([])
    const [reportGroupIds, setReportGroupIds] = useState<string[]>([])
    const [reportBranchIds, setReportBranchIds] = useState<string[]>([])

    const lastSyncedBranchIds = useRef<string[]>([])

    // ━━━ SMART SYNC (Global to Local) ━━━
    useEffect(() => {
        const hasGlobalChanged = JSON.stringify(contextBranchIds) !== JSON.stringify(lastSyncedBranchIds.current)
        if (hasGlobalChanged && contextBranchIds.length > 0) {
            setChartBranchIds([...contextBranchIds])
            setReportBranchIds([...contextBranchIds])
            lastSyncedBranchIds.current = [...contextBranchIds]
        }
    }, [contextBranchIds])

    const { visibleKeys, isVisible, setVisibleKeys } = useColumnSelector(ALL_COLUMNS, "order-report-v2")

    // ━━━ DATA FETCHING (3-TIER) ━━━
    
    // Tier 1: Global Summary
    const globalParams = new URLSearchParams()
    
    // Security Isolation: Force branch/org if BRANCH_ADMIN
    if (role === "BRANCH_ADMIN") {
        const adminBranchId = contextBranchId || (session?.user as any)?.branchId
        if (userOrgId) globalParams.set("organizationId", String(userOrgId))
        if (adminBranchId) globalParams.set("branchIds", String(adminBranchId))
    } else {
        if (organizationId) globalParams.set("organizationId", organizationId.toString())
    }

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
    
    // Security Isolation: Force branch/org if BRANCH_ADMIN
    if (role === "BRANCH_ADMIN") {
        const adminBranchId = contextBranchId || (session?.user as any)?.branchId
        if (userOrgId) chartParams.set("organizationId", String(userOrgId))
        if (adminBranchId) chartParams.set("branchIds", String(adminBranchId))
    } else {
        if (chartOrgIds.length > 0) chartParams.set("organizationIds", chartOrgIds.join(","))
        else if (organizationId) chartParams.set("organizationId", organizationId.toString())
        if (chartBranchIds.length > 0) chartParams.set("branchIds", chartBranchIds.join(","))
    }

    if (chartGroupIds.length > 0) chartParams.set("groupIds", chartGroupIds.join(","))
    if (chartMonths.length > 0) chartParams.set("months", chartMonths.join(","))
    if (chartYears.length > 0) chartParams.set("years", chartYears.join(","))
    if (compare) chartParams.set("compare", "true")
    const { data: chartData, isLoading: isChartLoading, mutate: mutateChart } = useSWR(
        `/api/v1/analytics/summary?${chartParams.toString()}&trendOnly=true`, fetcher
    )

    // Tier 3: Report Table Data
    const reportParams = new URLSearchParams()
    
    // Security Isolation: Force branch/org if BRANCH_ADMIN
    if (role === "BRANCH_ADMIN") {
        const adminBranchId = contextBranchId || (session?.user as any)?.branchId
        if (userOrgId) reportParams.set("organizationId", String(userOrgId))
        if (adminBranchId) reportParams.set("branchIds", String(adminBranchId))
    } else {
        if (reportOrgIds.length > 0) reportParams.set("organizationIds", reportOrgIds.join(","))
        else if (organizationId) reportParams.set("organizationId", organizationId.toString())
        if (reportBranchIds.length > 0) reportParams.set("branchIds", reportBranchIds.join(","))
    }

    if (reportGroupIds.length > 0) reportParams.set("groupIds", reportGroupIds.join(","))
    if (reportMonths.length > 0) reportParams.set("months", reportMonths.join(","))
    if (reportYears.length > 0) reportParams.set("years", reportYears.join(","))
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
    const summary = globalData?.summary || { totalSales: 0, totalRefunds: 0, totalTax: 0, totalSubtotal: 0, orderCount: 0, totalOrderCount: 0 }
    const comparison = globalData?.comparison
    const chartOrders = chartData?.orders || []
    const reportOrders = reportData?.orders || []

    const filteredOrders = useMemo(() => {
        return reportOrders.filter((order: any) => {
            const matchesSearch = !reportSearch ||
                (order.tid && order.tid.toLowerCase().includes(reportSearch.toLowerCase())) ||
                (order.userName && order.userName.toLowerCase().includes(reportSearch.toLowerCase())) ||
                (order.employeeId && String(order.employeeId).toLowerCase().includes(reportSearch.toLowerCase())) ||
                (order.userId && order.userId.toLowerCase().includes(reportSearch.toLowerCase()))
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
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        
        // Use backend aggregated trend if available (covers ALL orders in period)
        if (chartData?.trend?.length > 0) {
            const activeYear = chartYears.length === 1 ? chartYears[0] : new Date().getFullYear()
            const monthsToShow = chartMonths.length > 0 && chartMonths.length < 12 
                ? [...chartMonths].sort((a,b) => a-b) 
                : [1,2,3,4,5,6,7,8,9,10,11,12]

            return monthsToShow.map(m => {
                const dataPoint = chartData.trend.find((t: any) => Number(t.month) === m && (chartYears.length > 1 || Number(t.year) === activeYear))
                return {
                    label: monthNames[m-1],
                    revenue: dataPoint ? Math.round(dataPoint.revenue / 100) : 0,
                    orders: dataPoint ? Number(dataPoint.orders) : 0,
                    prevRevenue: 0, // Comparison support could be added here later
                    prevOrders: 0
                }
            })
        }

        // --- FALLBACK: Client-side calculation (limited to current page/chartOrders) ---
        const trend = (chartOrders || []).filter((o: any) => 
            ['FULFILLED', 'APPROVED', 'PARTIAL', 'PARTIALLY_FULFILLED'].includes((o.status || "").toUpperCase())
        )
        const currentYear = new Date().getFullYear()
        
        // Case A: Multiple years -> Show Years on X-Axis
        if (chartYears.length > 1) {
            return chartYears.sort((a,b) => a-b).map(year => {
                const yearOrders = trend.filter((o: any) => new Date(o.createdAt || o.orderDate).getFullYear() === year)
                const compOrders = (chartData?.comparisonOrders || []).filter((o: any) => 
                    ['FULFILLED', 'APPROVED', 'PARTIAL', 'PARTIALLY_FULFILLED'].includes((o.status || "").toUpperCase()) &&
                    new Date(o.createdAt || o.orderDate).getFullYear() === year
                )
                
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
        const activeYearForFallback = chartYears.length === 1 ? chartYears[0] : currentYear
        const monthsToShowForFallback = chartMonths.length > 0 && chartMonths.length < 12 
            ? [...chartMonths].sort((a,b) => a-b) 
            : [1,2,3,4,5,6,7,8,9,10,11,12]

        return monthsToShowForFallback.map(m => {
            const monthOrders = trend.filter((o: any) => {
                const d = new Date(o.createdAt || o.orderDate)
                return d.getFullYear() === activeYearForFallback && (d.getMonth() + 1) === m
            })
            const compOrders = (chartData?.comparisonOrders || []).filter((o: any) => {
                const d = new Date(o.createdAt || o.orderDate)
                return ['FULFILLED', 'APPROVED', 'PARTIAL', 'PARTIALLY_FULFILLED'].includes((o.status || "").toUpperCase()) &&
                       d.getFullYear() === activeYearForFallback && (d.getMonth() + 1) === m
            })

            return {
                label: monthNames[m-1],
                revenue: Math.round(monthOrders.reduce((sum: number, o: any) => sum + (o.totalCents - (o.refundAmountCents || 0))/100, 0)),
                orders: monthOrders.length,
                prevRevenue: Math.round(compOrders.reduce((sum: number, o: any) => sum + (o.totalCents - (o.refundAmountCents || 0))/100, 0)),
                prevOrders: compOrders.length
            }
        })
    }, [chartOrders, chartData, chartMonths, chartYears])

    interface StatusChartItem {
        name: string
        value: number
        fill: string
    }

    // Status breakdown for Donut
    const statusChartData = useMemo<StatusChartItem[]>(() => {
        const dist = chartData?.statusDistribution || []
        if (dist.length > 0) {
            return dist.map((d: any) => ({
                name: d.name,
                value: Number(d.value),
                fill: STATUS_COLORS[d.name] || "#94a3b8"
            }))
        }
        
        // Fallback for legacy or edge cases
        if (!chartOrders.length) return []
        const counts: Record<string, number> = {}
        chartOrders.forEach((o: any) => {
            const s = (o.status || "UNKNOWN").toUpperCase()
            counts[s] = (counts[s] || 0) + 1
        })
        return Object.entries(counts).map(([name, value]) => ({ name, value, fill: STATUS_COLORS[name] || "#94a3b8" }))
    }, [chartData, chartOrders])

    const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
        const headers = ALL_COLUMNS.filter(c => {
            if (role === "BRANCH_ADMIN" && (c.key === "group" || c.key === "branchName")) return false;
            if (role !== "SUPER_ADMIN" && c.key === "organizationName") return false;
            return isVisible(c.key);
        }).map(c => {
            if (c.key === "netTotalValue" && isBuyer) return "Net Purchased"
            return c.label
        })
        const rows = filteredOrders.map((order: any) => {
            const row: any[] = []
            if (isVisible("orderDate")) row.push(new Date(order.createdAt).toLocaleDateString())
            if (isVisible("userName")) row.push(order.userName || "-")
            if (isVisible("tid")) row.push(order.tid)
            if (isVisible("organizationName") && role === "SUPER_ADMIN") row.push(order.organizationName || "N/A")
            if (isVisible("group") && role !== "BRANCH_ADMIN") row.push(order.groupName || "-")
            if (isVisible("branchName") && role !== "BRANCH_ADMIN") row.push(order.branchName || "-")
            if (isVisible("status")) row.push(order.status)
            if (isVisible("quantityOrdered")) row.push(order.quantityOrdered || 0)
            if (isVisible("quantityDelivered")) row.push((order.quantityOrdered || 0) - (order.quantityRefunded || 0))
            if (isVisible("quantityRefunded")) row.push(order.quantityRefunded || 0)
            if (isVisible("subtotalValue")) row.push(((order.subtotalCents || 0) / 100).toFixed(2))
            if (isVisible("refundValue")) row.push(((order.refundAmountCents || 0) / 100).toFixed(2))
            if (isVisible("netTotalValue")) row.push((( (order.totalCents || 0) - (order.refundAmountCents || 0)) / 100).toFixed(2))
            return row
        })

        if (format === 'pdf') {
            const doc = new jsPDF('landscape')
            doc.setFontSize(20); doc.text(exportTitleLabel, 14, 20)
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
        <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] transition-colors duration-500 pb-20">
            {/* ━━━ STICKY PREMIUM HEADER ━━━ */}
            <div className="sticky top-0 z-30 w-full backdrop-blur-xl bg-white/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300">
                <div className="max-w-[1600px] mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 flex items-center justify-center shadow-lg shadow-indigo-500/20 rotate-3 group hover:rotate-0 transition-all duration-500">
                            <TrendingUp className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Order Intelligence</h1>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
                                <LayoutGrid className="h-3 w-3" />
                                Detailed audit of corporate transactions
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="hidden lg:flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner">
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
                        </div>
                        {role !== "BRANCH_ADMIN" && organizationId && (
                            <>
                                <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
                                <MultiBranchFilter organizationId={organizationId} selectedBranchIds={contextBranchIds} onChange={setContextBranchIds} />
                            </>
                        )}
                        <Button variant="ghost" size="icon" className="rounded-xl text-slate-400 hover:text-indigo-500 transition-colors" onClick={() => { mutateGlobal(); mutateChart(); mutateReport(); }}>
                            <RefreshCw className={cn("h-4 w-4", (isGlobalLoading || isChartLoading || isReportLoading) && "animate-spin")} />
                        </Button>
                    </div>
                </div>
            </div>

            <div className="max-w-[1600px] mx-auto px-6 pt-10 space-y-10">
                {/* ━━━ KPI BENTO GRID ━━━ */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <KPICard title={kpiRevenueLabel} value={formatPKR(summary.totalSales / 100)} icon={TrendingUp} colorScheme="indigo" />
                    <KPICard title="Refund Impact" value={formatPKR(summary.totalRefunds / 100)} icon={RotateCcw} colorScheme="rose" />
                    <KPICard title="Total Orders" value={summary.totalOrderCount} icon={Package} colorScheme="blue" />
                    <KPICard title={kpiAvgLabel} value={formatPKR(summary.orderCount > 0 ? (summary.totalSales / summary.orderCount) / 100 : 0)} icon={Calculator} colorScheme="amber" />
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
                    
                    <div className="flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-1">
                        <TabsList className="bg-transparent h-auto p-0 gap-8">
                            <TabsTrigger value="analytics" className="bg-transparent border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent rounded-none px-0 pb-4 text-sm font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white transition-all">
                                <LayoutDashboard className="h-4 w-4 mr-2" />
                                Analytics
                            </TabsTrigger>
                            <TabsTrigger value="reports" className="bg-transparent border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent rounded-none px-0 pb-4 text-sm font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white transition-all">
                                <Database className="h-4 w-4 mr-2" />
                                Reports
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="analytics" className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Main Trend Chart */}
                            <Card className="lg:col-span-2 rounded-[2rem] border-slate-200 dark:border-slate-800 shadow-xl bg-white/50 dark:bg-slate-900/40 backdrop-blur-xl overflow-hidden">
                                <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
                                            <TrendingUp className="h-4 w-4" />
                                        </div>
                                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Order Velocity</h3>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <MonthFilter selected={chartMonths} onChange={setChartMonths} />
                                        <YearFilter selected={chartYears} onChange={setChartYears} allTimeData={allTimeData} />
                                        {role === "SUPER_ADMIN" && (
                                            <OrganizationFilter selectedIds={chartOrgIds} onChange={setChartOrgIds} />
                                        )}
                                        {((role === "SUPER_ADMIN" && (chartOrgIds.length > 0 || organizationId)) || (role !== "SUPER_ADMIN" && role !== "BRANCH_ADMIN" && organizationId)) && (
                                            <>
                                                <GroupFilter 
                                                    selectedIds={chartGroupIds} 
                                                    onChange={setChartGroupIds} 
                                                    organizationIds={chartOrgIds.length > 0 ? chartOrgIds : (organizationId ? [String(organizationId)] : [])}
                                                    disabled={chartBranchIds.length > 0}
                                                />
                                                <BranchFilter 
                                                    selectedIds={chartBranchIds} 
                                                    onChange={setChartBranchIds} 
                                                    organizationIds={chartOrgIds.length > 0 ? chartOrgIds : (organizationId ? [organizationId] : [])} 
                                                    groupIds={chartGroupIds}
                                                />
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="p-8 h-[400px]">
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
                                                <RechartsTooltip content={<BarTooltip compare={compare} revenueLabel={chartRevenueLabel} />} cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} />
                                                <Bar dataKey="revenue" fill="url(#revGradient)" radius={[6, 6, 0, 0]} barSize={32} name={`Current ${chartRevenueLabel}`} />
                                                {compare && <Bar dataKey="prevRevenue" fill="#94a3b8" opacity={0.3} radius={[6, 6, 0, 0]} barSize={32} name={`Prior ${chartRevenueLabel}`} />}
                                                <Line type="monotone" dataKey="orders" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} name={chartOrdersLabel} />
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </Card>

                            {/* Status Distribution */}
                            <Card className="rounded-[2rem] border-slate-200 dark:border-slate-800 shadow-xl bg-white/50 dark:bg-slate-900/40 backdrop-blur-xl overflow-hidden">
                                <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                                        <Layers className="h-4 w-4" />
                                    </div>
                                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Status Mix</h3>
                                </div>
                                <div className="p-8 h-[400px] flex flex-col justify-center relative">
                                    <ResponsiveContainer width="100%" height={250}>
                                        <PieChart>
                                            <Pie
                                                data={statusChartData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
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
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -mt-10 text-center pointer-events-none">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total</p>
                                        <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">{statusChartData.reduce((sum, s) => sum + s.value, 0).toLocaleString()}</p>
                                    </div>
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

                    <TabsContent value="reports" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
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
                                        placeholder="Search TID, Employee #, or User..."
                                        className="pl-11 h-11 w-64 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl text-xs font-bold placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-indigo-500/20"
                                        value={reportSearch}
                                        onChange={(e) => setReportSearch(e.target.value)}
                                    />
                                </div>
                                <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-1" />
                                <MonthFilter selected={reportMonths} onChange={setReportMonths} />
                                <YearFilter selected={reportYears} onChange={setReportYears} allTimeData={allTimeData} />
                                {role === "SUPER_ADMIN" && (
                                    <>
                                        <OrganizationFilter selectedIds={reportOrgIds} onChange={setReportOrgIds} />
                                        {(reportOrgIds.length > 0 || organizationId) && (
                                            <>
                                                <GroupFilter 
                                                    selectedIds={reportGroupIds} 
                                                    onChange={setReportGroupIds} 
                                                    organizationIds={reportOrgIds.length > 0 ? reportOrgIds : (organizationId ? [String(organizationId)] : [])}
                                                    disabled={reportBranchIds.length > 0}
                                                />
                                                <BranchFilter 
                                                    selectedIds={reportBranchIds} 
                                                    onChange={setReportBranchIds} 
                                                    organizationIds={reportOrgIds.length > 0 ? reportOrgIds : (organizationId ? [organizationId] : [])} 
                                                    groupIds={reportGroupIds}
                                                />
                                            </>
                                        )}
                                    </>
                                )}
                                {role !== "SUPER_ADMIN" && role !== "BRANCH_ADMIN" && organizationId && (
                                    <>
                                        <GroupFilter 
                                            selectedIds={reportGroupIds} 
                                            onChange={setReportGroupIds} 
                                            organizationIds={[String(organizationId)]}
                                            disabled={reportBranchIds.length > 0}
                                        />
                                        <BranchFilter 
                                            selectedIds={reportBranchIds} 
                                            onChange={setReportBranchIds} 
                                            organizationIds={[organizationId]} 
                                            groupIds={reportGroupIds}
                                        />
                                    </>
                                )}
                                <ColumnSelector columns={ALL_COLUMNS} storageKey="order-report-v2" visibleKeys={visibleKeys} onChange={setVisibleKeys} />
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-11 text-[11px] font-black underline decoration-slate-200 gap-2 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm px-5">
                                            <Download className="h-3.5 w-3.5" />
                                            EXPORT
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-52 rounded-2xl border-slate-200 dark:border-slate-800 p-2 shadow-2xl bg-white dark:bg-slate-900">
                                        <DropdownMenuItem onClick={() => handleExport('csv')} className="text-xs font-bold py-3 cursor-pointer rounded-xl"><FileText className="mr-3 h-4 w-4 text-slate-400" /> CSV ARCHIVE</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleExport('excel')} className="text-xs font-bold py-3 cursor-pointer rounded-xl"><FileSpreadsheet className="mr-3 h-4 w-4 text-emerald-500" /> EXCEL WORKBOOK</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleExport('pdf')} className="text-xs font-bold py-3 cursor-pointer rounded-xl"><FileText className="mr-3 h-4 w-4 text-rose-500" /> PDF DOCUMENT</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>

                        {/* Report Table */}
                        <Card className="rounded-[2.5rem] border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900/40 overflow-hidden min-h-[600px] flex flex-col">
                            <div className="overflow-x-auto flex-1">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 hover:bg-transparent">
                                            {isVisible("orderDate") && <TableHead className="h-14 px-8 text-[10px] font-black uppercase tracking-widest text-slate-500"><div className="flex items-center gap-2"><Calendar className="h-3 w-3" /> Date</div></TableHead>}
                                            {isVisible("userName") && <TableHead className="h-14 px-8 text-[10px] font-black uppercase tracking-widest text-slate-500">User</TableHead>}
                                            {isVisible("employeeId") && <TableHead className="h-14 px-8 text-[10px] font-black uppercase tracking-widest text-slate-500">Employee #</TableHead>}
                                            {isVisible("tid") && <TableHead className="h-14 px-8 text-[10px] font-black uppercase tracking-widest text-slate-500"><div className="flex items-center gap-2"><Hash className="h-3 w-3" /> TID</div></TableHead>}
                                            {isVisible("organizationName") && role === "SUPER_ADMIN" && <TableHead className="h-14 px-8 text-[10px] font-black uppercase tracking-widest text-slate-500">Org</TableHead>}
                                            {isVisible("group") && role !== "BRANCH_ADMIN" && <TableHead className="h-14 px-8 text-[10px] font-black uppercase tracking-widest text-slate-500">Group</TableHead>}
                                            {isVisible("branchName") && role !== "BRANCH_ADMIN" && <TableHead className="h-14 px-8 text-[10px] font-black uppercase tracking-widest text-slate-500"><div className="flex items-center gap-2"><Store className="h-3 w-3" /> Branch</div></TableHead>}
                                            {isVisible("status") && <TableHead className="h-14 px-8 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Status</TableHead>}
                                            {isVisible("quantityOrdered") && <TableHead className="h-14 px-8 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Qty Ordered</TableHead>}
                                            {isVisible("quantityDelivered") && <TableHead className="h-14 px-8 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center text-emerald-600">Qty Delivered</TableHead>}
                                            {isVisible("quantityRefunded") && <TableHead className="h-14 px-8 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center text-rose-500">Qty Refunded</TableHead>}
                                            {isVisible("subtotalValue") && <TableHead className="h-14 px-8 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Subtotal</TableHead>}
                                            {isVisible("refundValue") && <TableHead className="h-14 px-8 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right text-rose-500">Refund</TableHead>}
                                            {isVisible("netTotalValue") && <TableHead className="h-14 px-8 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">{isBuyer ? "Net Purchased" : "Net Total"}</TableHead>}
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
                                                    {isVisible("orderDate") && <TableCell className="px-8 py-5 text-[11px] font-bold text-slate-500 uppercase tracking-tighter" suppressHydrationWarning>{new Date(order.createdAt).toLocaleDateString()}</TableCell>}
                                                    {isVisible("userName") && <TableCell className="px-8 py-5"><span className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-tighter">{order.userName || "Guest System"}</span></TableCell>}
                                                    {isVisible("employeeId") && (
                                                        <TableCell className="px-8 py-5">
                                                            <span className="px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-500/10 text-[10px] font-black text-indigo-600 dark:text-indigo-400 font-mono">
                                                                #{order.employeeId || (order.userId ? order.userId.split('-')[0] : 'N/A')}
                                                            </span>
                                                        </TableCell>
                                                    )}
                                                    {isVisible("tid") && <TableCell className="px-8 py-5"><span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-600 dark:text-slate-400 font-mono italic">{order.tid}</span></TableCell>}
                                                    {isVisible("organizationName") && role === "SUPER_ADMIN" && <TableCell className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{order.organizationName || "N/A"}</TableCell>}
                                                    {isVisible("group") && role !== "BRANCH_ADMIN" && <TableCell className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{order.groupName || "-"}</TableCell>}
                                                    {isVisible("branchName") && role !== "BRANCH_ADMIN" && <TableCell className="px-8 py-5 text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-tighter">{order.branchName}</TableCell>}
                                                    {isVisible("status") && (
                                                        <TableCell className="px-8 py-5 text-center">
                                                            <Badge variant="outline" style={{ backgroundColor: `${STATUS_COLORS[order.status?.toUpperCase()] || '#94a3b8'}15`, color: STATUS_COLORS[order.status?.toUpperCase()] || '#94a3b8', borderColor: `${STATUS_COLORS[order.status?.toUpperCase()] || '#94a3b8'}30` }} className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border">
                                                                {order.status}
                                                            </Badge>
                                                        </TableCell>
                                                    )}
                                                    {isVisible("quantityOrdered") && <TableCell className="px-8 py-5 text-center text-[11px] font-bold font-mono text-slate-600 dark:text-slate-400">{order.quantityOrdered || 0}</TableCell>}
                                                    {isVisible("quantityDelivered") && <TableCell className="px-8 py-5 text-center text-[11px] font-bold font-mono text-emerald-600 dark:text-emerald-400">{(order.quantityOrdered || 0) - (order.quantityRefunded || 0)}</TableCell>}
                                                    {isVisible("quantityRefunded") && <TableCell className="px-8 py-5 text-center text-[11px] font-bold font-mono text-rose-500 dark:text-rose-400">{order.quantityRefunded || 0}</TableCell>}
                                                    {isVisible("subtotalValue") && <TableCell className="px-8 py-5 text-right text-[11px] font-bold font-mono">{formatPKR(order.subtotalCents / 100)}</TableCell>}
                                                    {isVisible("refundValue") && <TableCell className="px-8 py-5 text-right text-[11px] font-black font-mono text-rose-500">{order.refundAmountCents > 0 ? `-${formatPKR(order.refundAmountCents / 100)}` : "—"}</TableCell>}
                                                    {isVisible("netTotalValue") && <TableCell className="px-8 py-5 text-right text-xs font-black font-mono text-slate-900 dark:text-white leading-none">{formatPKR((order.totalCents - (order.refundAmountCents || 0)) / 100)}</TableCell>}
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="px-8 py-5 border-t border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">System Generated Audit • {generatedDate}</p>
                            </div>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
}

// ━━━ HELPER COMPONENTS ━━━

function MonthFilter({ selected, onChange }: { selected: number[], onChange: (val: number[]) => void }) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    const items = months.map((m, i) => ({ id: i + 1, label: m }))
    return (
        <MultiSelectFilter
            title="Months"
            items={items}
            selectedIds={selected}
            onChange={(ids: number[]) => onChange([...ids].sort((a, b) => a - b))}
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
            onChange={(ids: number[]) => onChange([...ids].sort((a, b) => b - a))}
            icon={<Calendar className="h-3.5 w-3.5 text-blue-500" />}
            placeholder="Years"
            showSearch={false}
        />
    )
}

function BarTooltip({ active, payload, label, compare, revenueLabel }: any) {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 min-w-[200px] backdrop-blur-xl bg-white/90 dark:bg-slate-900/90">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">{label}</p>
                </div>
                <div className="space-y-2">
                    {payload.map((p: any) => {
                        let displayName = p.name;
                        if (displayName.toLowerCase().includes('revenue')) {
                            displayName = displayName.replace(/revenue/i, revenueLabel);
                        }
                        return (
                            <div key={p.name} className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{displayName}</span>
                                </div>
                                <span className="text-xs font-black text-slate-900 dark:text-white tabular-nums">
                                    {typeof p.value === 'number' && (p.name.toLowerCase().includes('revenue') || p.name.toLowerCase().includes(revenueLabel.toLowerCase())) ? formatPKR(p.value) : p.value}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        )
    }
    return null
}
