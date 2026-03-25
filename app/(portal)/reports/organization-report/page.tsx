"use client"

import { useState, useMemo } from "react"
import useSWR from "swr"
import { fetcher } from "@/lib/fetcher"
import { formatPKR, cn } from "@/lib/utils"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { GlobalDateFilter, FilterPreset } from "@/components/dashboard/global-date-filter"
import { BranchFilter } from "@/components/reports/branch-filter"
import { DateRange } from "@/lib/hooks/use-sales-performance"
import { startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { 
    ResponsiveContainer, 
    ComposedChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    Legend, 
    Cell,
    Line
} from "recharts"
import { 
    Building2, 
    Users, 
    TrendingUp, 
    RefreshCw, 
    CheckCircle2, 
    RotateCcw, 
    BarChart3, 
    ListOrdered,
    LayoutDashboard,
    Database,
    Search,
    FileSpreadsheet,
    FilePdf,
    FileText,
    Upload,
    Download,
    Calculator,
    Package,
    ShoppingBag,
    Calendar,
    Hash,
    Store,
    Layers,
    ChevronRight,
    ArrowUpRight,
    ArrowDownRight,
    MoreHorizontal,
    Table as TableIcon,
    LineChart as LineChartIcon,
    PieChart as PieChartIcon
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MultiSelectFilter } from "@/components/reports/multi-select-filter"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef } from "react"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"



const getDefaultDateRange = (): DateRange => ({
    startDate: startOfMonth(new Date()),
    endDate: endOfMonth(new Date()),
})

export default function OrganizationReportPage() {
    const { data: session } = useSession()
    const role = (session?.user as any)?.role
    const userOrgId = (session?.user as any)?.organizationId
    const router = useRouter()
    const searchParams = useSearchParams()

    // ━━━ PERSISTENT STATE ━━━
    const [hasMounted, setHasMounted] = useState(false)
    const [generatedDate, setGeneratedDate] = useState("")
    const [activeTab, setActiveTab] = useState("analytics")

    // ━━━ GLOBAL CONTEXT FILTERS ━━━
    const startFromUrl = searchParams.get("startDate")
    const endFromUrl = searchParams.get("endDate")
    const [dateRange, setDateRange] = useState<DateRange | null>(
        startFromUrl && endFromUrl 
            ? { startDate: new Date(startFromUrl), endDate: new Date(endFromUrl) }
            : getDefaultDateRange()
    )
    const [activePreset, setActivePreset] = useState<FilterPreset>((searchParams.get("preset") as FilterPreset) || "thisMonth")
    const [compare, setCompare] = useState(searchParams.get("compare") === "true")
    const [compareRange, setCompareRange] = useState<DateRange | null>(null)
    
    // Global Multi-Selects
    const [selectedMonths, setSelectedMonths] = useState<number[]>([])
    const [selectedYears, setSelectedYears] = useState<number[]>([])
    const [compareMonths, setCompareMonths] = useState<number[]>([])
    const [compareYears, setCompareYears] = useState<number[]>([])
    
    // Branch/Organization Scope
    const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>([])
    const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([])
    const [statusFilter, setStatusFilter] = useState<string>("all")

    // ━━━ TIER 1: GLOBAL SUMMARY DATA ━━━
    const globalQueryParams = new URLSearchParams()
    if (dateRange) {
        globalQueryParams.set("startDate", dateRange.startDate.toISOString())
        globalQueryParams.set("endDate", dateRange.endDate.toISOString())
    }
    if (selectedOrgIds.length > 0) globalQueryParams.set("organizationIds", selectedOrgIds.join(","))
    if (selectedBranchIds.length > 0) globalQueryParams.set("branchIds", selectedBranchIds.join(","))
    if (selectedMonths.length > 0) globalQueryParams.set("months", selectedMonths.join(","))
    if (selectedYears.length > 0) globalQueryParams.set("years", selectedYears.join(","))
    if (compare) globalQueryParams.set("compare", "true")

    const { data: globalData, isLoading: isGlobalLoading, mutate: mutateGlobal } = useSWR<any>(`/api/v1/analytics/organization-stats?${globalQueryParams.toString()}`, fetcher)

    // ━━━ TIER 2: CHART (ANALYTICS) LOCAL STATE ━━━
    const [chartMonths, setChartMonths] = useState<number[]>([])
    const [chartYears, setChartYears] = useState<number[]>([])
    const [chartBranchIds, setChartBranchIds] = useState<string[]>([])
    const [chartOrgIds, setChartOrgIds] = useState<string[]>([])

    const chartQueryParams = new URLSearchParams(globalQueryParams.toString())
    if (chartMonths.length > 0) chartQueryParams.set("months", chartMonths.join(","))
    if (chartYears.length > 0) chartQueryParams.set("years", chartYears.join(","))
    if (chartBranchIds.length > 0) chartQueryParams.set("branchIds", chartBranchIds.join(","))
    if (chartOrgIds.length > 0) chartQueryParams.set("organizationIds", chartOrgIds.join(","))

    const { data: chartData, isLoading: isChartLoading, mutate: mutateChart } = useSWR<any>(`/api/v1/analytics/organization-stats?${chartQueryParams.toString()}`, fetcher)

    // ━━━ TIER 3: REPORT (TABLE) LOCAL STATE ━━━
    const [reportMonths, setReportMonths] = useState<number[]>([])
    const [reportYears, setReportYears] = useState<number[]>([])
    const [reportBranchIds, setReportBranchIds] = useState<string[]>([])
    const [reportOrgIds, setReportOrgIds] = useState<string[]>([])
    const [reportSearch, setReportSearch] = useState("")

    const reportQueryParams = new URLSearchParams(globalQueryParams.toString())
    if (reportMonths.length > 0) reportQueryParams.set("months", reportMonths.join(","))
    if (reportYears.length > 0) reportQueryParams.set("years", reportYears.join(","))
    if (reportBranchIds.length > 0) reportQueryParams.set("branchIds", reportBranchIds.join(","))
    if (reportOrgIds.length > 0) reportQueryParams.set("organizationIds", reportOrgIds.join(","))

    const { data: reportData, isLoading: isReportLoading, mutate: mutateReport } = useSWR<any>(`/api/v1/analytics/organization-stats?${reportQueryParams.toString()}`, fetcher)

    // ━━━ TIER 4: ALL-TIME (FOR YEAR SELECTION) ━━━
    const { data: allTimeData } = useSWR<any>(`/api/v1/analytics/organization-stats?allTime=true`, fetcher)

    useEffect(() => {
        setHasMounted(true)
        setGeneratedDate(new Date().toLocaleString())
    }, [])

    const organizationId = userOrgId || (selectedOrgIds.length === 1 ? selectedOrgIds[0] : null)

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

    const handleBranchChange = (ids: string[]) => setSelectedBranchIds(ids)

    // ━━━ YEAR RANGE CALCULATION ━━━
    const allYears = useMemo(() => {
        const trend = allTimeData?.trend || []
        const years = new Set<number>()
        trend.forEach((t: any) => {
            const y = parseInt(t.period.split('-')[0])
            if (!isNaN(y)) years.add(y)
        })
        if (years.size === 0) years.add(new Date().getFullYear())
        return Array.from(years).sort((a, b) => b - a)
    }, [allTimeData])

    const chartYearsAvailable = allYears
    const reportYearsAvailable = allYears

    const stats = reportData?.items || []
    const normalizedTrend = useMemo(() => {
        const trend = chartData?.trend || []
        const currentYear = new Date().getFullYear()

        // Case A: Multiple years -> Show Years on X-Axis
        if (chartYears.length > 1) {
            return chartYears.sort((a,b) => a-b).map(year => {
                const yearData = trend.filter((t: any) => t.period.startsWith(String(year)))
                const compData = chartData?.comparisonTrend?.filter((t: any) => t.period.startsWith(String(year))) || []
                
                return {
                    period: String(year),
                    revenue: yearData.reduce((sum: number, t: any) => sum + (t.revenue || 0), 0),
                    orders: yearData.reduce((sum: number, t: any) => sum + (t.orders || 0), 0),
                    prevRevenue: compData.reduce((sum: number, t: any) => sum + (t.revenue || 0), 0)
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
            const periodKey = `${activeYear}-${String(m).padStart(2, '0')}`
            const monthData = trend.find((t: any) => t.period === periodKey)
            const compData = chartData?.comparisonTrend?.find((t: any) => t.period === periodKey)

            return {
                period: monthNames[m-1],
                revenue: monthData?.revenue || 0,
                orders: monthData?.orders || 0,
                prevRevenue: compData?.revenue || 0
            }
        })
    }, [chartData, chartMonths, chartYears])

    const statsData = stats // renaming to avoid conflict if any

    const summary = globalData?.items?.reduce((acc: any, curr: any) => ({
        revenue: acc.revenue + curr.revenue,
        orders: acc.orders + curr.orderCount,
        users: acc.users + curr.totalUserCount,
        orgs: acc.orgs + 1
    }), { revenue: 0, orders: 0, users: 0, orgs: 0 }) || { revenue: 0, orders: 0, users: 0, orgs: 0 }

    // Comparison Trends
    const comparisonSummary = globalData?.items?.reduce((acc: any, curr: any) => ({
        revenue: acc.revenue + (curr.comparison?.revenue || 0),
        orders: acc.orders + (curr.comparison?.orderCount || 0)
    }), { revenue: 0, orders: 0 }) || { revenue: 0, orders: 0 }

    const revenueTrend = useMemo(() => {
        if (!compare || comparisonSummary.revenue === 0) return null
        const pct = ((summary.revenue - comparisonSummary.revenue) / comparisonSummary.revenue) * 100
        return { value: Math.abs(pct).toFixed(1), isUp: pct > 0, isDown: pct < 0 }
    }, [summary.revenue, comparisonSummary.revenue, compare])

    const orderTrend = useMemo(() => {
        if (!compare || comparisonSummary.orders === 0) return null
        const pct = ((summary.orders - comparisonSummary.orders) / comparisonSummary.orders) * 100
        return { value: Math.abs(pct).toFixed(1), isUp: pct > 0, isDown: pct < 0 }
    }, [summary.orders, comparisonSummary.orders, compare])

    const filteredStats = useMemo(() => {
        return stats.filter((s: any) => 
            s.organizationName.toLowerCase().includes(reportSearch.toLowerCase()) ||
            s.organizationId.toString().includes(reportSearch)
        )
    }, [stats, reportSearch])

    return (
        <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] transition-colors duration-500 pb-20">
            {/* ━━━ STICKY PREMIUM HEADER ━━━ */}
            <div className="sticky top-0 z-50 w-full backdrop-blur-xl bg-white/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300">
                <div className="max-w-[1600px] mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 flex items-center justify-center shadow-lg shadow-indigo-500/20 rotate-3 group hover:rotate-0 transition-all duration-500">
                            <Building2 className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Organization Intelligence</h1>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
                                <Store className="h-3 w-3" />
                                Corporate Performance Hub
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="hidden lg:flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner">
                            <GlobalDateFilter 
                                value={dateRange} 
                                activePreset={activePreset} 
                                compare={compare}
                                compareRange={compareRange}
                                months={selectedMonths}
                                years={selectedYears}
                                compareMonths={compareMonths}
                                compareYears={compareYears}
                                onChange={handleDateChange} 
                            />
                        </div>
                        <div className="h-10 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" />
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-500 transition-colors"
                            onClick={() => mutateGlobal()}
                        >
                            <RefreshCw className={cn("h-4 w-4", isGlobalLoading && "animate-spin")} />
                        </Button>
                    </div>
                </div>
            </div>

            <div className="max-w-[1600px] mx-auto px-6 pt-10 space-y-10">
                {/* ━━━ BENTO KPI GRID ━━━ */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <KPICard 
                        label="Total Corporate Revenue"
                        value={formatPKR(summary.revenue)}
                        icon={<TrendingUp className="h-4 w-4" />}
                        iconBg="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400"
                        trend={revenueTrend}
                        trendColor="emerald"
                        subtitle="Consolidated net sales"
                        compare={compare}
                        compareValue={formatPKR(comparisonSummary.revenue)}
                    />
                    <KPICard 
                        label="Fulfilled Orders"
                        value={summary.orders.toLocaleString()}
                        icon={<ShoppingBag className="h-4 w-4" />}
                        iconBg="bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
                        trend={orderTrend}
                        trendColor="blue"
                        subtitle="Completed transactions"
                        compare={compare}
                        compareValue={comparisonSummary.orders.toLocaleString()}
                    />
                    <KPICard 
                        label="Active Managed Users"
                        value={summary.users.toLocaleString()}
                        icon={<Users className="h-4 w-4" />}
                        iconBg="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                        trend={null}
                        trendColor="slate"
                        subtitle="Across all branches"
                    />
                    <KPICard 
                        label="Registered Companies"
                        value={summary.orgs.toLocaleString()}
                        icon={<Building2 className="h-4 w-4" />}
                        iconBg="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                        trend={null}
                        trendColor="emerald"
                        subtitle="Active organizations"
                    />
                </div>

                {/* ━━━ TABBED INTERFACE ━━━ */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
                    <div className="flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-1">
                        <TabsList className="bg-transparent h-auto p-0 gap-8">
                            <TabsTrigger 
                                value="analytics" 
                                className="bg-transparent border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent rounded-none px-0 pb-4 text-sm font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white transition-all"
                            >
                                <LayoutDashboard className="h-4 w-4 mr-2" />
                                Analytics
                            </TabsTrigger>
                            <TabsTrigger 
                                value="reports" 
                                className="bg-transparent border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent rounded-none px-0 pb-4 text-sm font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white transition-all"
                            >
                                <TableIcon className="h-4 w-4 mr-2" />
                                Reports
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="analytics" className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900/50 backdrop-blur-3xl rounded-[2rem] relative group transition-all duration-700 hover:shadow-indigo-500/10">
                            {/* Analytics Header */}
                            <div className="px-8 py-7 border-b border-slate-100 dark:border-slate-800 space-y-5">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
                                                <LineChartIcon className="h-4 w-4" />
                                            </div>
                                            <h3 className="font-black text-sm uppercase tracking-tight text-slate-800 dark:text-slate-200">
                                                Growth & Comparison Trend
                                            </h3>
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-11">Consolidated revenue stream</p>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => mutateChart()} className="h-8 w-8 p-0 rounded-lg border-slate-200 dark:border-slate-800">
                                        <RefreshCw className={cn("h-3.5 w-3.5 text-slate-400", isChartLoading && "animate-spin")} />
                                    </Button>
                                </div>

                                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                                    <MonthFilter selected={chartMonths} onChange={setChartMonths} />
                                    <YearFilter selected={chartYears} onChange={setChartYears} availableYears={chartYearsAvailable} />
                                    <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />
                                    {(role === "SUPER_ADMIN" || role === "HEAD_OFFICE") && (
                                        <div className="flex items-center gap-2.5">
                                            <OrgFilter selectedIds={chartOrgIds} onChange={setChartOrgIds} />
                                            {chartOrgIds.length > 0 && (
                                                <BranchFilter 
                                                    selectedIds={chartBranchIds} 
                                                    onChange={setChartBranchIds} 
                                                    organizationIds={chartOrgIds}
                                                    placeholder="Branches" 
                                                />
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <CardContent className="p-8">
                                {(isChartLoading || !normalizedTrend.length) ? (
                                    <div className="h-[450px] flex flex-col items-center justify-center gap-4">
                                        <div className="h-10 w-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                                        <p className="text-[10px] font-black uppercase text-slate-400 animate-pulse">Synchronizing Analytics...</p>
                                    </div>
                                ) : (
                                    <div className="h-[450px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={normalizedTrend} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                                <defs>
                                                    <linearGradient id="orgRevenue" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.1} />
                                                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.3} />
                                                <XAxis 
                                                    dataKey="period" 
                                                    axisLine={false} 
                                                    tickLine={false} 
                                                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                                                    dy={10}
                                                />
                                                <YAxis 
                                                    axisLine={false} 
                                                    tickLine={false} 
                                                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                                                    tickFormatter={(v) => `₨${v >= 1000 ? (v/1000).toFixed(0)+'K' : v}`}
                                                />
                                                <Tooltip 
                                                    content={({ active, payload, label }: any) => {
                                                        if (active && payload && payload.length) {
                                                            const d = payload[0].payload;
                                                            return (
                                                                <div className="bg-white dark:bg-slate-900/95 p-4 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl backdrop-blur-xl">
                                                                    <p className="text-[10px] font-black uppercase text-slate-400 mb-3 tracking-[0.2em]">{label}</p>
                                                                    <div className="space-y-3">
                                                                        <div className="flex items-center justify-between gap-10">
                                                                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-2">
                                                                                <div className="h-2 w-2 rounded-full bg-indigo-500" /> Net Revenue
                                                                            </span>
                                                                            <span className="text-xs font-black text-slate-900 dark:text-white">{formatPKR(payload[0].value as number)}</span>
                                                                        </div>
                                                                        {compare && (
                                                                            <div className="flex items-center justify-between gap-10">
                                                                                <span className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-2">
                                                                                    <div className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" /> Prior Revenue
                                                                                </span>
                                                                                <span className="text-xs font-black text-slate-500">{formatPKR(d.prevRevenue)}</span>
                                                                            </div>
                                                                        )}
                                                                        <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                                                            <span className="text-[10px] font-black text-slate-400 uppercase">Orders</span>
                                                                            <span className="text-xs font-black text-indigo-600">{d.orders}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )
                                                        }
                                                        return null;
                                                    }}
                                                />
                                                <Legend 
                                                    verticalAlign="top" 
                                                    align="right" 
                                                    iconType="circle" 
                                                    wrapperStyle={{ paddingBottom: 30, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}
                                                />
                                                <Bar dataKey="revenue" name="Net Revenue" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={32} />
                                                {compare && (
                                                    <Bar dataKey="prevRevenue" name="Prior Period" fill="#cbd5e1" radius={[6, 6, 0, 0]} barSize={32} />
                                                )}
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="reports" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        {/* ━━━ LOCAL REPORT FILTERS ━━━ */}
                        <div className="flex flex-wrap items-center gap-2.5 p-4 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
                            <div className="relative flex-1 min-w-[240px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                <Input 
                                    placeholder="Search companies..."
                                    value={reportSearch}
                                    onChange={(e) => setReportSearch(e.target.value)}
                                    className="pl-9 h-10 bg-slate-100/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold font-mono placeholder:font-sans focus:ring-2 focus:ring-indigo-500/20"
                                />
                            </div>
                            <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1 lg:block hidden" />
                            <MonthFilter selected={reportMonths} onChange={setReportMonths} />
                            <YearFilter selected={reportYears} onChange={setReportYears} availableYears={reportYearsAvailable} />
                            {(role === "SUPER_ADMIN" || role === "HEAD_OFFICE") && (
                                <div className="flex items-center gap-2.5">
                                    <OrgFilter selectedIds={reportOrgIds} onChange={setReportOrgIds} />
                                    {reportOrgIds.length > 0 && (
                                        <BranchFilter 
                                            selectedIds={reportBranchIds} 
                                            onChange={setReportBranchIds} 
                                            organizationIds={reportOrgIds}
                                            placeholder="Branches"
                                        />
                                    )}
                                </div>
                            )}
                            <Button variant="outline" size="sm" onClick={() => mutateReport()} className="h-10 w-10 p-0 rounded-xl border-slate-200 dark:border-slate-800">
                                <RefreshCw className={cn("h-3.5 w-3.5 text-slate-400", isReportLoading && "animate-spin")} />
                            </Button>
                        </div>

                        <Card className="rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl overflow-hidden min-h-[600px] flex flex-col">
                            <CardHeader className="px-8 pt-8 pb-4 border-b border-slate-100 dark:border-slate-800">
                                <div className="flex items-center justify-between flex-wrap gap-4">
                                    <CardTitle className="text-slate-900 dark:text-white font-black tracking-tight flex items-center gap-3">
                                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                                            <ListOrdered className="w-5 h-5 text-indigo-600" />
                                        </div>
                                        Corporate Performance Ledger
                                    </CardTitle>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="h-8 rounded-lg px-3 bg-slate-50 dark:bg-slate-900 text-[10px] font-black border-slate-200 dark:border-slate-800 uppercase tracking-widest text-slate-500">
                                            {filteredStats.length} ENTRIES
                                        </Badge>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0 flex-1 overflow-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                                            <TableHead className="pl-8 h-14 font-black text-[10px] uppercase tracking-[0.2em] text-slate-400">Organization</TableHead>
                                            <TableHead className="h-14 font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 text-center">Branches (Act/Ina)</TableHead>
                                            <TableHead className="h-14 font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 text-center">Managed Users</TableHead>
                                            <TableHead className="h-14 font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 text-right">Revenue (PKR)</TableHead>
                                            <TableHead className="h-14 font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 text-right">Orders</TableHead>
                                            <TableHead className="px-8 h-14 font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 text-center">Fulfillment</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isReportLoading ? (
                                            Array(6).fill(0).map((_, i) => (
                                                <TableRow key={i} className="h-20 animate-pulse border-b border-slate-50 dark:border-slate-900">
                                                    <TableCell colSpan={6}><div className="h-10 bg-slate-50 dark:bg-slate-900/50 rounded-xl mx-4" /></TableCell>
                                                </TableRow>
                                            ))
                                        ) : filteredStats.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="h-60 text-center">
                                                    <div className="flex flex-col items-center gap-4 opacity-30">
                                                        <Database className="h-12 w-12" />
                                                        <p className="text-xs font-black uppercase tracking-widest">No records found</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredStats.map((org: any) => (
                                                <TableRow key={org.organizationId} className="group hover:bg-slate-50/80 dark:hover:bg-slate-900/40 border-b border-slate-50 dark:border-slate-900 transition-all duration-200 h-20">
                                                    <TableCell className="pl-8">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight group-hover:text-indigo-600 transition-colors uppercase">{org.organizationName}</span>
                                                            <span className="text-[10px] font-bold text-slate-400 font-mono tracking-tight uppercase tracking-widest">ID: {org.organizationId}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center font-black">
                                                        <div className="flex items-center justify-center gap-6">
                                                            <div className="flex flex-col items-center">
                                                                <span className="text-sm text-emerald-600">{org.activeBranchCount}</span>
                                                                <span className="text-[8px] text-slate-400 uppercase tracking-widest font-black">Active</span>
                                                            </div>
                                                            <div className="h-6 w-[1px] bg-slate-100 dark:bg-slate-800" />
                                                            <div className="flex flex-col items-center">
                                                                <span className="text-sm text-slate-400 font-black">{org.inactiveBranchCount}</span>
                                                                <span className="text-[8px] text-slate-400 uppercase tracking-widest font-black">Inactive</span>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50/50 dark:bg-indigo-500/10 rounded-xl border border-indigo-100 dark:border-indigo-500/10">
                                                            <Users className="h-3 w-3 text-indigo-500" />
                                                            <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{org.totalUserCount}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-sm font-black text-slate-900 dark:text-white tracking-tight">{formatPKR(org.revenue)}</span>
                                                            {compare && (
                                                                <div className={cn("text-[8px] font-black uppercase tracking-widest flex items-center gap-1", 
                                                                    (org.comparison?.revenue > 0 && org.revenue > org.comparison?.revenue) ? "text-emerald-500" : "text-rose-500")}>
                                                                    {org.revenue > org.comparison?.revenue ? <ArrowUpRight className="h-2 w-2" /> : <ArrowDownRight className="h-2 w-2" />}
                                                                    SR {formatPKR(org.comparison?.revenue || 0)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right font-black text-sm text-slate-900 dark:text-white tracking-tight">
                                                        {org.orderCount.toLocaleString()}
                                                    </TableCell>
                                                    <TableCell className="px-8 text-center">
                                                        <div className="flex items-center justify-center gap-8">
                                                            <div className="flex flex-col items-center">
                                                                <div className="flex items-center gap-1.5 text-emerald-600">
                                                                    <CheckCircle2 className="h-3 w-3" />
                                                                    <span className="text-sm font-black">{org.fulfilledCount}</span>
                                                                </div>
                                                                <span className="text-[8px] text-slate-400 uppercase tracking-widest font-black">Fulfilled</span>
                                                            </div>
                                                            <div className="flex flex-col items-center">
                                                                <div className="flex items-center gap-1.5 text-rose-500">
                                                                    <RotateCcw className="h-3 w-3" />
                                                                    <span className="text-sm font-black">{org.refundedCount}</span>
                                                                </div>
                                                                <span className="text-[8px] text-slate-400 uppercase tracking-widest font-black">Refunded</span>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                            <div className="px-8 py-5 border-t border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    {filteredStats.length} organization{filteredStats.length !== 1 ? 's' : ''} listed
                                </p>
                                <p className="text-[10px] font-bold text-slate-300 dark:text-slate-700 font-mono italic" suppressHydrationWarning>
                                    GEN_TS: {generatedDate}
                                </p>
                            </div>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
}

// ━━━ STANDARDIZED COMPONENTS ━━━

function KPICard({ label, value, icon, iconBg, trend, trendColor, subtitle, compare, compareValue }: any) {
    return (
        <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none bg-white/80 dark:bg-slate-900/50 backdrop-blur-3xl rounded-[2rem] relative group transition-all duration-500 hover:shadow-indigo-500/10 hover:translate-y-[-4px]">
            <div className="p-7">
                <div className="flex items-center justify-between mb-6">
                    <div className={cn("p-2.5 rounded-2xl shadow-lg transition-transform group-hover:scale-110 duration-500", iconBg)}>
                        {icon}
                    </div>
                    {trend && (
                        <div className={cn("px-3 py-1 rounded-full text-[10px] font-black tracking-widest flex items-center gap-1 shadow-sm", 
                            trendColor === "emerald" ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                            trendColor === "blue" ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400" :
                            "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400")}>
                            {trend.isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {trend.value}%
                        </div>
                    )}
                </div>
                <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</p>
                    <div className="flex items-baseline gap-2">
                        <h4 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{value}</h4>
                    </div>
                    {compare && (
                        <p className="text-[10px] font-bold text-slate-400 italic">
                            Prior: <span className="font-mono">{compareValue}</span>
                        </p>
                    )}
                    <p className="text-[10px] font-bold text-slate-400 italic opacity-0 group-hover:opacity-100 transition-opacity duration-500">{subtitle}</p>
                </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </Card>
    )
}



function OrgFilter({ selectedIds, onChange }: any) {
    const { data: orgs } = useSWR<any>(`/api/v1/organizations`, fetcher)
    const items = ((orgs as any)?.items || []).map((o: any) => ({ id: String(o.id), label: o.name }))

    return (
        <MultiSelectFilter
            title="Organizations"
            items={items}
            selectedIds={selectedIds}
            onChange={onChange}
            icon={<Building2 className="h-3.5 w-3.5 mr-2 text-indigo-500" />}
            placeholder="Organizations"
        />
    )
}


function MonthFilter({ selected, onChange }: { selected: number[], onChange: (v: number[]) => void }) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    const items = months.map((m, i) => ({ id: i + 1, label: m }))
    
    return (
        <MultiSelectFilter
            title="Months"
            items={items}
            selectedIds={selected}
            onChange={(ids) => onChange(ids.sort((a, b) => a - b))}
            icon={<Calendar className="h-3.5 w-3.5 mr-2 text-indigo-500" />}
            placeholder="Months"
            showSearch={false}
        />
    )
}

function YearFilter({ selected, onChange, availableYears }: { selected: number[], onChange: (v: number[]) => void, availableYears: number[] }) {
    const items = availableYears.map(y => ({ id: y, label: String(y) }))

    return (
        <MultiSelectFilter
            title="Years"
            items={items}
            selectedIds={selected}
            onChange={(ids) => onChange(ids.sort((a, b) => b - a))}
            icon={<Layers className="h-3.5 w-3.5 mr-2 text-indigo-500" />}
            placeholder="Years"
            showSearch={false}
        />
    )
}
