"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import useSWR from "swr"
import { useAppContext } from "@/components/context/app-context"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    Loader2, RefreshCw, Search, FileText, FileSpreadsheet, FileIcon as FilePdf, Download, Users, Package, CheckCircle, TrendingUp, Filter, UserCircle, Calculator, ChevronDown, UserPlus,
    Calendar, Hash, ArrowUpRight, ArrowDownRight, LayoutDashboard, Database, BarChart3, Layers
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
    DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"
import {
    ResponsiveContainer,
    ComposedChart,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip as RechartsTooltip,
    Legend,
    Bar,
    Line,
} from "recharts"
import { GlobalDateFilter, type FilterPreset } from "@/components/dashboard/global-date-filter"
import type { DateRange } from "@/lib/hooks/use-sales-performance"
import { OrganizationFilter } from "@/components/reports/organization-filter"
import { BranchFilter } from "@/components/reports/branch-filter"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MultiSelectFilter } from "@/components/reports/multi-select-filter"
import { GroupFilter } from "@/components/reports/group-filter"
import { UserFilter } from "@/components/reports/user-filter"
import { AlertCircle } from "lucide-react"


const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function UserReportPage() {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const {
        organizationId: contextOrgId,
        branchId: contextBranchId,
        branchIds: contextBranchIds,
    } = useAppContext()

    const { data: session } = useSession()
    const role = (session?.user as any)?.role as Role
    const userOrgId = (session?.user as any)?.organizationId

    const [hasMounted, setHasMounted] = useState(false)
    const [activeTab, setActiveTab] = useState("analytics")
    const [reportSearch, setReportSearch] = useState("")
    const [generatedDate, setGeneratedDate] = useState("")

    // ━━━ 1. GLOBAL STATE (Sticky Header) ━━━
    const [dateRange, setDateRange] = useState<DateRange | null>(null)
    const [activePreset, setActivePreset] = useState<FilterPreset>("all")
    const [compare, setCompare] = useState(false)
    const [compareRange, setCompareRange] = useState<DateRange | null>(null)
    
    // Global Multi-Selects
    const [selectedMonths, setSelectedMonths] = useState<number[]>([])
    const [selectedYears, setSelectedYears] = useState<number[]>([])
    const [globalOrganizationIds, setGlobalOrganizationIds] = useState<string[]>([])
    const [globalGroupIds, setGlobalGroupIds] = useState<string[]>([])
    const [globalBranchIds, setGlobalBranchIds] = useState<string[]>([])
    const [globalUserIds, setGlobalUserIds] = useState<string[]>([])
    const [compareMonths, setCompareMonths] = useState<number[]>([])
    const [compareYears, setCompareYears] = useState<number[]>([])

    // ━━━ 2. ANALYTICS LOCAL STATE ━━━
    const [chartYears, setChartYears] = useState<number[]>([])
    const [chartMonths, setChartMonths] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    const [chartBranchIds, setChartBranchIds] = useState<string[]>([])
    const [chartGroupIds, setChartGroupIds] = useState<string[]>([])
    const [chartOrganizationIds, setChartOrganizationIds] = useState<string[]>([])
    const [chartUserIds, setChartUserIds] = useState<string[]>([])

    // ━━━ 3. REPORTS LOCAL STATE ━━━
    const [reportMonths, setReportMonths] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    const [reportYears, setReportYears] = useState<number[]>([])
    const [reportBranchIds, setReportBranchIds] = useState<string[]>([])
    const [reportGroupIds, setReportGroupIds] = useState<string[]>([])
    const [reportOrganizationIds, setReportOrganizationIds] = useState<string[]>([])
    const [reportUserIds, setReportUserIds] = useState<string[]>([])

    // ━━━ DATA FETCHING (3-TIER) ━━━
    const organizationId = userOrgId || contextOrgId

    // Tier 1: Global Summary
    const globalParams = new URLSearchParams()
    if (globalOrganizationIds.length) globalParams.set("organizationIds", globalOrganizationIds.join(","))
    else if (organizationId) globalParams.set("organizationIds", organizationId.toString())
    if (globalGroupIds.length) globalParams.set("groupIds", globalGroupIds.join(","))
    if (globalBranchIds.length) globalParams.set("branchIds", globalBranchIds.join(","))
    if (globalUserIds.length) globalParams.set("userIds", globalUserIds.join(","))
    
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
        `/api/v1/analytics/users/performance?${globalParams.toString()}&summaryOnly=true`, fetcher
    )

    // Tier 2: Chart/Trend Data
    const isChartUserView = chartUserIds.length > 1
    const chartParams = new URLSearchParams()
    if (chartOrganizationIds.length) chartParams.set("organizationIds", chartOrganizationIds.join(","))
    else if (organizationId) chartParams.set("organizationIds", organizationId.toString())
    
    if (chartGroupIds.length) chartParams.set("groupIds", chartGroupIds.join(","))
    if (chartBranchIds.length) chartParams.set("branchIds", chartBranchIds.join(","))
    if (chartUserIds.length) chartParams.set("userIds", chartUserIds.join(","))
    if (chartMonths.length) chartParams.set("months", chartMonths.join(","))
    if (chartYears.length) chartParams.set("years", chartYears.join(","))
    if (compare) chartParams.set("compare", "true")
    const { data: chartData, isLoading: isChartLoading, mutate: mutateChart } = useSWR(
        `/api/v1/analytics/users/performance?${chartParams.toString()}${isChartUserView ? "" : "&trendOnly=true"}`, fetcher
    )

    // Tier 3: Report Table Data
    const reportParams = new URLSearchParams()
    if (reportOrganizationIds.length) reportParams.set("organizationIds", reportOrganizationIds.join(","))
    else if (organizationId) reportParams.set("organizationIds", organizationId.toString())
    
    if (reportGroupIds.length) reportParams.set("groupIds", reportGroupIds.join(","))
    if (reportBranchIds.length) reportParams.set("branchIds", reportBranchIds.join(","))
    if (reportUserIds.length) reportParams.set("userIds", reportUserIds.join(","))
    if (reportMonths.length) reportParams.set("months", reportMonths.join(","))
    if (reportYears.length) reportParams.set("years", reportYears.join(","))
    const { data: reportData, isLoading: isReportLoading, mutate: mutateReport } = useSWR(
        `/api/v1/analytics/users/performance?${reportParams.toString()}`, fetcher
    )

    // Tier 4: User Products Data
    const { data: userProductsData, isLoading: isUserProductsLoading, mutate: mutateUserProducts } = useSWR(
        `/api/v1/analytics/users/products?${reportParams.toString()}`, fetcher
    )

    // All-time Data (for year ranges)
    const { data: allTimeData } = useSWR(organizationId ? `/api/v1/analytics/users/performance?organizationId=${organizationId}&allTime=true` : null, fetcher)

    const isInitialLoad = useRef(true)

    useEffect(() => {
        setHasMounted(true)
        setGeneratedDate(new Date().toLocaleString())
    }, [])

    // ━━━ INITIALIZATION (ALL TIME) ━━━
    const allYears = useMemo(() => {
        const years = new Set<number>()
        const trendData = allTimeData?.trend || []
        trendData.forEach((t: any) => {
            const y = parseInt(t.date.split('-')[0])
            if (!isNaN(y)) years.add(y)
        })
        if (years.size === 0) years.add(new Date().getFullYear())
        return Array.from(years).sort((a, b) => b - a)
    }, [allTimeData])

    useEffect(() => {
        if (hasMounted && isInitialLoad.current && allYears.length > 0) {
            setSelectedYears(allYears)
            setChartYears(allYears)
            setReportYears(allYears)
            isInitialLoad.current = false
        }
    }, [hasMounted, allYears])

    // ━━━ CASCADING SELECTION CLEARING ━━━
    useEffect(() => {
        setGlobalGroupIds([])
        setGlobalBranchIds([])
        setGlobalUserIds([])
    }, [globalOrganizationIds])

    useEffect(() => {
        setGlobalBranchIds([])
        setGlobalUserIds([])
    }, [globalGroupIds])

    useEffect(() => {
        setGlobalUserIds([])
    }, [globalBranchIds])

    useEffect(() => {
        setChartGroupIds([])
        setChartBranchIds([])
        setChartUserIds([])
    }, [chartOrganizationIds])

    useEffect(() => {
        setChartBranchIds([])
        setChartUserIds([])
    }, [chartGroupIds])

    useEffect(() => {
        setChartUserIds([])
    }, [chartBranchIds])

    useEffect(() => {
        setReportGroupIds([])
        setReportBranchIds([])
        setReportUserIds([])
    }, [reportOrganizationIds])

    useEffect(() => {
        setReportBranchIds([])
        setReportUserIds([])
    }, [reportGroupIds])

    useEffect(() => {
        setReportUserIds([])
    }, [reportBranchIds])

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

    // ━━━ DATA PROCESSING ━━━
    const summary = globalData?.data || {}
    const trend = chartData?.trend || []
    const compareTrend = chartData?.compareTrend || []
    const reportItems = reportData?.data || []
    const CHART_MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    const filteredUsers = reportItems.filter((u: any) =>
        (u.userName || "").toLowerCase().includes(reportSearch.toLowerCase()) ||
        (u.userEmail || "").toLowerCase().includes(reportSearch.toLowerCase()) ||
        (u.branchName || "").toLowerCase().includes(reportSearch.toLowerCase()) ||
        (u.employeeId || "").toLowerCase().includes(reportSearch.toLowerCase()) ||
        (u.organizationName || "").toLowerCase().includes(reportSearch.toLowerCase())
    )

    // KPI Metrics
    const totalUsers = summary.totalUsers || 0
    const totalOrders = summary.totalOrders || 0
    const totalFulfilled = summary.fulfilledOrders || 0
    const totalSpent = summary.totalSpentCents || 0

    const comparison = globalData?.comparison
    const getTrend = (current: number, prev: number) => {
        if (!prev || prev === 0) return null
        const diff = ((current - prev) / prev) * 100
        return { value: Math.abs(diff).toFixed(1), isUp: diff > 0, isDown: diff < 0 }
    }

    const usersTrend = getTrend(totalUsers, comparison?.totalUsers || 0)
    const ordersTrend = getTrend(totalOrders, comparison?.totalOrders || 0)
    const spentTrend = getTrend(totalSpent, comparison?.totalSpentCents || 0)
    const currentSuccess = totalOrders > 0 ? (totalFulfilled / totalOrders) * 100 : 0
    const prevSuccess = (comparison?.totalOrders || 0) > 0 ? (comparison.totalFulfilled / comparison.totalOrders) * 100 : 0
    const successTrend = getTrend(currentSuccess, prevSuccess)

    // Processed Chart Data (Monthly performance or User performance)
    const processedChartData = useMemo(() => {
        if (isChartUserView) {
            const usersData = chartData?.data || []
            return usersData.map((u: any) => ({
                name: u.userName || "N/A",
                orders: u.totalOrders || 0,
                fulfilled: u.fulfilledOrders || 0,
                refunded: u.refundedOrders || 0,
                spent: Math.round((u.totalSpentCents || 0) / 100),
                compOrders: u.comparison?.totalOrders || 0,
                compSpent: Math.round((u.comparison?.totalSpentCents || 0) / 100),
                fullName: u.userName
            }))
        }

        // If multiple years selected, show years on X-axis (optional, but keep monthly for now as requested)
        // One year selected (or default to current year) -> show months
        const activeYear = chartYears.length === 1 ? chartYears[0] : new Date().getFullYear();
        
        const monthsToShow = chartMonths.length > 0 && chartMonths.length < 12 
            ? [...chartMonths].sort((a, b) => a - b) 
            : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

        return monthsToShow.map(m => {
            const dateStr = `${activeYear}-${String(m).padStart(2, '0')}`;
            const dataPoint = trend.find((d: any) => d.date === dateStr);
            const compPoint = compareTrend.find((d: any) => d.date === dateStr);
            
            return {
                name: CHART_MONTH_NAMES[m - 1],
                orders: dataPoint?.qtyOrdered || 0,
                fulfilled: dataPoint?.qtyFulfilled || 0,
                refunded: 0, // monthly trend doesn't return refunds currently
                spent: Math.round((dataPoint?.revenue || 0) / 100),
                compOrders: compPoint?.qtyOrdered || 0,
                compSpent: Math.round((compPoint?.revenue || 0) / 100),
                fullName: `${CHART_MONTH_NAMES[m - 1]} ${activeYear}`
            }
        });
    }, [trend, compareTrend, chartYears, chartMonths, chartData, isChartUserView])

    const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
        const headers = ["Employee ID", "Name", "Email", "Status", "Organization", "Branch", "Orders", "Fulfilled", "Refunded", "Spent"]
        const rows = filteredUsers.map((u: any) => [
            u.employeeId || "-", u.userName, u.userEmail, u.status || "active", u.organizationName || 'N/A', u.branchName || 'N/A', 
            u.totalOrders, u.fulfilledOrders, u.refundedOrders,
            (u.totalSpentCents / 100).toFixed(2)
        ])

        if (format === 'pdf') {
            const doc = new jsPDF()
            doc.setFontSize(20)
            doc.text("User Consumption Report", 14, 20)
            doc.setFontSize(10)
            doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28)
            autoTable(doc, { startY: 40, head: [headers], body: rows, theme: 'grid' })
            doc.save(`user-report-${new Date().getTime()}.pdf`)
            return
        }

        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Users")
        XLSX.writeFile(workbook, `user-report-${new Date().getTime()}.${format === 'excel' ? 'xlsx' : 'csv'}`)
    }

    return (
        <div className="space-y-5 pb-10 bg-slate-50 dark:bg-slate-950 min-h-screen">
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
                    <OrganizationFilter
                        selectedIds={globalOrganizationIds}
                        onChange={setGlobalOrganizationIds}
                    />
                )}
                {(role === "SUPER_ADMIN" || role === "HEAD_OFFICE") && (
                    <GroupFilter
                        selectedIds={globalGroupIds}
                        onChange={setGlobalGroupIds}
                        organizationIds={globalOrganizationIds.length > 0 ? globalOrganizationIds : (organizationId ? [organizationId.toString()] : undefined)}
                    />
                )}
                {(role === "SUPER_ADMIN" || role === "HEAD_OFFICE" || role === "BRANCH_ADMIN") && (
                    <BranchFilter
                        selectedIds={globalBranchIds}
                        onChange={setGlobalBranchIds}
                        organizationIds={globalOrganizationIds.length > 0 ? globalOrganizationIds : (organizationId ? [organizationId.toString()] : undefined)}
                        groupIds={globalGroupIds}
                    />
                )}
                <UserFilter
                    selectedIds={globalUserIds}
                    onChange={setGlobalUserIds}
                    organizationIds={globalOrganizationIds.length > 0 ? globalOrganizationIds : (organizationId ? [organizationId.toString()] : undefined)}
                    groupIds={globalGroupIds}
                    branchIds={globalBranchIds}
                />
                <div className="flex-1" />
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { mutateGlobal(); mutateChart(); mutateReport(); mutateUserProducts(); }}
                    disabled={isGlobalLoading || isChartLoading || isReportLoading || isUserProductsLoading}
                    className="h-9 text-[12px] font-bold bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-full px-4"
                >
                    <RefreshCw className={`h-3.5 w-3.5 mr-2 ${(isGlobalLoading || isChartLoading || isReportLoading) ? "animate-spin" : ""}`} />
                    REFRESH
                </Button>
            </div>

            <div className="px-4 md:px-6 space-y-6">
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#384e72] px-8 py-10 text-white shadow-2xl ring-1 ring-slate-700/50">
                    <div className="flex flex-col gap-2 relative z-10">
                        <p className="text-xs tracking-[0.4em] text-slate-400 font-black uppercase">Consumptive Intelligence</p>
                        <h1 className="text-5xl font-black tracking-tight drop-shadow-sm">User Performance</h1>
                        <p className="text-sm text-slate-400 font-bold max-w-xl italic mt-1 leading-relaxed">
                            Holistic consumption overview for <strong className="text-white underline decoration-indigo-500/50">{totalUsers}</strong> active users across filtered branches.
                        </p>
                    </div>
                    <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    <KPICard label="Active Transactors" value={totalUsers} icon={<Users className="h-6 w-6" />} iconBg="bg-indigo-500/10 text-indigo-500" trend={usersTrend} trendColor="emerald" subtitle="Distinct user profiles found." compare={compare} compareValue={comparison?.totalUsers} />
                    <KPICard label="Order Volume" value={totalOrders} icon={<Package className="h-6 w-6" />} iconBg="bg-blue-500/10 text-blue-500" trend={ordersTrend} trendColor="blue" subtitle="Total orders initiated." compare={compare} compareValue={comparison?.totalOrders} />
                    <KPICard label="Success Rate" value={`${currentSuccess.toFixed(1)}%`} icon={<CheckCircle className="h-6 w-6" />} iconBg="bg-emerald-500/10 text-emerald-500" trend={successTrend} trendColor="emerald" subtitle={`${totalFulfilled} fulfilled orders.`} compare={compare} compareValue={`${prevSuccess.toFixed(1)}%`} />
                    <KPICard label="Total Yield" value={formatPKR(totalSpent / 100)} icon={<TrendingUp className="h-6 w-6" />} iconBg="bg-indigo-600 text-white" trend={spentTrend} trendColor="indigo" subtitle="Total net value generated." compare={compare} compareValue={formatPKR(comparison?.totalSpentCents / 100)} />
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <div className="flex justify-center">
                        <TabsList className="bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-1 rounded-2xl h-12 shadow-sm backdrop-blur-sm">
                            <TabsTrigger value="analytics" className="rounded-xl px-8 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-md font-bold text-xs uppercase tracking-widest transition-all">Analytics</TabsTrigger>
                            <TabsTrigger value="reports" className="rounded-xl px-8 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-md font-bold text-xs uppercase tracking-widest transition-all">Report</TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="analytics" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xl bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem]">
                            <div className="p-8 border-b border-slate-100/50 dark:border-slate-800/50 flex flex-wrap justify-between items-center gap-6 bg-slate-50/30 dark:bg-slate-900/10">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-500">
                                        <BarChart3 className="h-6 w-6" />
                                    </div>
                                    <div className="flex flex-col">
                                        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-900 dark:text-white">User Consumption Trends</h3>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Volume & Yield Comparison</p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <MonthFilter selected={chartMonths} onChange={setChartMonths} />
                                    <YearFilter selected={chartYears} onChange={setChartYears} availableYears={allTimeData?.years || []} />
                                    {(role === "SUPER_ADMIN" || role === "HEAD_OFFICE") && (
                                        <OrganizationFilter selectedIds={chartOrganizationIds} onChange={setChartOrganizationIds} />
                                    )}
                                    <GroupFilter 
                                        selectedIds={chartGroupIds} 
                                        onChange={setChartGroupIds} 
                                        organizationIds={chartOrganizationIds.length > 0 ? chartOrganizationIds : (organizationId ? [organizationId.toString()] : undefined)}
                                    />
                                    <BranchFilter 
                                        selectedIds={chartBranchIds} 
                                        onChange={setChartBranchIds} 
                                        organizationIds={chartOrganizationIds.length > 0 ? chartOrganizationIds : (organizationId ? [organizationId.toString()] : undefined)}
                                        groupIds={chartGroupIds}
                                    />
                                    <UserFilter
                                        selectedIds={chartUserIds}
                                        onChange={setChartUserIds}
                                        organizationIds={chartOrganizationIds.length > 0 ? chartOrganizationIds : (organizationId ? [organizationId.toString()] : undefined)}
                                        groupIds={chartGroupIds}
                                        branchIds={chartBranchIds}
                                    />
                                    <Button variant="ghost" size="icon" onClick={() => { 
                                        setChartMonths([1,2,3,4,5,6,7,8,9,10,11,12]); 
                                        setChartYears([]); 
                                        setChartBranchIds([]); 
                                        setChartOrganizationIds([]); 
                                        setChartGroupIds([]);
                                        setChartUserIds([]);
                                    }} className="h-10 w-10 text-slate-400 hover:text-indigo-500 rounded-xl hover:bg-indigo-50/50 transition-all">
                                        <RefreshCw className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            <CardContent className="p-8 pt-4">
                                <div className="h-[450px] w-full relative">
                                    {isChartLoading && (
                                        <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-[2px] z-10 flex items-center justify-center rounded-3xl">
                                            <div className="flex flex-col items-center gap-3">
                                                <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Updating Trends...</p>
                                            </div>
                                        </div>
                                    )}
                                    {processedChartData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={processedChartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                                <defs>
                                                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9} />
                                                        <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.7} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.4} />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }} dy={10} />
                                                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }} tickFormatter={(val) => val.toLocaleString()} />
                                                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }} tickFormatter={(val) => `Rs ${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`} />
                                                <RechartsTooltip 
                                                    content={({ active, payload, label }: any) => {
                                                        if (active && payload && payload.length) {
                                                            const u = processedChartData.find((d: any) => d.name === label);
                                                            return (
                                                                <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-2xl min-w-[220px]">
                                                                    <p className="text-[12px] font-black uppercase tracking-[0.1em] text-slate-900 dark:text-white mb-3 border-b border-slate-100 dark:border-slate-800/50 pb-2">{u?.fullName || label}</p>
                                                                    <div className="space-y-2">
                                                                        <div className="flex justify-between items-center bg-blue-500/5 p-2 rounded-xl">
                                                                            <span className="text-[10px] font-bold text-blue-600 uppercase">Orders {compare ? '(A/B)' : ''}</span>
                                                                            <span className="text-[11px] font-black text-blue-700">
                                                                                {(payload[0]?.value || 0).toLocaleString()} {compare ? `/ ${(payload[1]?.value || 0).toLocaleString()}` : ''}
                                                                            </span>
                                                                        </div>
                                                                        {isChartUserView && (
                                                                            <>
                                                                                <div className="flex justify-between items-center bg-emerald-500/5 p-2 rounded-xl">
                                                                                    <span className="text-[10px] font-bold text-emerald-600 uppercase">Fulfilled</span>
                                                                                    <span className="text-[11px] font-black text-emerald-700">
                                                                                        {u?.fulfilled?.toLocaleString()}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="flex justify-between items-center bg-rose-500/5 p-2 rounded-xl">
                                                                                    <span className="text-[10px] font-bold text-rose-600 uppercase">Refunded</span>
                                                                                    <span className="text-[11px] font-black text-rose-700">
                                                                                        {u?.refunded?.toLocaleString()}
                                                                                    </span>
                                                                                </div>
                                                                            </>
                                                                        )}
                                                                        <div className="flex justify-between items-center bg-indigo-500/5 p-2 rounded-xl">
                                                                            <span className="text-[10px] font-bold text-indigo-600 uppercase">Yield {compare ? '(A/B)' : ''}</span>
                                                                            <span className="text-[11px] font-black text-indigo-700">
                                                                                {formatPKR(Number(payload[compare ? 2 : 1]?.value || 0))} {compare ? `/ ${formatPKR(Number(payload[3]?.value || 0))}` : ''}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    }}
                                                />
                                                <Legend verticalAlign="top" align="right" height={40} iconType="circle" wrapperStyle={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                                                <Bar yAxisId="left" dataKey="orders" name={compare ? "Orders (A)" : "Total Orders"} fill="url(#barGradient)" radius={[6, 6, 0, 0]} barSize={compare ? 20 : 40} />
                                                {compare && <Bar yAxisId="left" dataKey="compOrders" name="Orders (B)" fill="#94a3b8" radius={[6, 6, 0, 0]} barSize={20} opacity={0.5} />}
                                                <Line yAxisId="right" type="monotone" dataKey="spent" name={compare ? "Spent (A)" : "Yield"} stroke="#6366f1" strokeWidth={4} dot={{ r: 5, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8, strokeWidth: 2, stroke: '#fff' }} />
                                                {compare && <Line yAxisId="right" type="monotone" dataKey="compSpent" name="Spent (B)" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4 }} />}
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                                            <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800">
                                                <Users className="h-10 w-10 opacity-20" />
                                            </div>
                                            <p className="text-sm font-bold uppercase tracking-widest italic animate-pulse">Insufficient transactional history</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* ━━━ USER-WISE TOP PRODUCTS ━━━ */}
                        <div className="space-y-4 pt-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
                                    <Package className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="font-black text-sm uppercase tracking-[0.1em] text-slate-900 dark:text-white">Product Analytics by User</h3>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Top performing items per employee</p>
                                </div>
                            </div>

                            {isUserProductsLoading ? (
                                <div className="h-40 flex items-center justify-center">
                                    <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
                                </div>
                            ) : (userProductsData?.data || []).length === 0 ? (
                                <div className="p-12 flex flex-col items-center justify-center text-slate-400 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-3xl">
                                    <Package className="h-12 w-12 mb-4 opacity-20" />
                                    <p className="text-xs font-black uppercase tracking-widest">No product data found</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {(userProductsData?.data || [])
                                        .filter((u: any) => 
                                            !reportSearch || 
                                            u.userName?.toLowerCase().includes(reportSearch.toLowerCase()) || 
                                            u.userId.toString().includes(reportSearch)
                                        )
                                        .slice(0, 6)
                                        .map((user: any, idx: number) => (
                                        <Card key={user.userId} className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900/40 backdrop-blur-3xl rounded-[2rem] transition-all hover:-translate-y-1 hover:shadow-indigo-500/10">
                                            <div className="p-5 border-b border-slate-100 dark:border-slate-800/50 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "h-10 w-10 flex items-center justify-center rounded-2xl font-black shadow-sm",
                                                        idx === 0 ? "bg-amber-100 text-amber-600 dark:bg-amber-500/20" : 
                                                        idx === 1 ? "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300" :
                                                        idx === 2 ? "bg-orange-100 text-orange-600 dark:bg-orange-500/20" :
                                                        "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 text-indigo-400"
                                                    )}>
                                                        #{idx + 1}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-tight truncate max-w-[120px]">{user.userName}</h4>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest"><span className="text-slate-900 dark:text-white font-black">{formatPKR(user.fulfilledProductRevenueCents / 100)}</span> Total</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <Badge variant="outline" className="text-[10px] font-black uppercase bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-500/30">
                                                        {user.totalProductsSold} Items
                                                    </Badge>
                                                </div>
                                            </div>
                                            <CardContent className="p-0">
                                                <div className="divide-y divide-slate-100 dark:divide-slate-800 mt-2">
                                                    {user.products.slice(0, 3).map((product: any, pIdx: number) => (
                                                        <div key={product.productId} className="flex justify-between items-center px-6 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                                                            <div className="flex items-start gap-3 w-1/2">
                                                                <span className="text-[10px] font-black text-slate-300 dark:text-slate-600 mt-0.5 w-3 text-right">{pIdx + 1}.</span>
                                                                <div className="min-w-0">
                                                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-tight truncate break-words" title={product.productName}>
                                                                        {product.productName}
                                                                    </p>
                                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">{product.categoryName}</p>
                                                                </div>
                                                            </div>
                                                            <div className="text-right flex flex-col items-end gap-1">
                                                                <div className="flex items-center gap-2">
                                                                    <p className="text-[11px] font-black text-slate-700 dark:text-slate-300 tracking-tight">{formatPKR(product.fulfilledRevenueCents / 100)}</p>
                                                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded cursor-help" title={`Total Qty: ${product.quantity}`}>Qty: {product.fulfilledQuantity}</p>
                                                                </div>
                                                                {product.refundedQuantity > 0 && (
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="text-[9px] font-black text-rose-500 tracking-tight">-{formatPKR(product.refundedRevenueCents / 100)}</p>
                                                                        <p className="text-[8px] font-bold text-rose-500 uppercase tracking-widest whitespace-nowrap bg-rose-50 dark:bg-rose-500/10 px-1.5 py-0.5 rounded" title={`Refunded Money: ${formatPKR(product.refundedRevenueCents / 100)}`}>Ref: {product.refundedQuantity}</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {user.products.length > 3 && (
                                                        <div className="px-6 py-3 text-center bg-slate-50/30 dark:bg-slate-900/30">
                                                            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors">+{user.products.length - 3} more items...</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="reports" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl rounded-3xl">
                            <div className="p-6 border-b border-slate-100/50 dark:border-slate-800 flex flex-wrap justify-between items-center gap-4 bg-slate-50/20 dark:bg-slate-900/10">
                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                        <Database className="h-5 w-5" />
                                    </div>
                                    <h3 className="font-black text-slate-900 dark:text-white text-xs uppercase tracking-[0.2em]">Transaction Ledger</h3>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="relative group">
                                        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-indigo-500" />
                                        <Input
                                            placeholder="Audit user by name or email..."
                                            className="pl-10 h-10 w-72 text-[11px] font-bold bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:ring-1 focus:ring-indigo-500/50 rounded-xl shadow-sm transition-all"
                                            value={reportSearch}
                                            onChange={(e) => setReportSearch(e.target.value)}
                                        />
                                    </div>
                                    <MonthFilter selected={reportMonths} onChange={setReportMonths} />
                                    <YearFilter selected={reportYears} onChange={setReportYears} availableYears={allTimeData?.years || []} />
                                    {(role === "SUPER_ADMIN" || role === "HEAD_OFFICE") && (
                                        <OrganizationFilter selectedIds={reportOrganizationIds} onChange={setReportOrganizationIds} />
                                    )}
                                    <GroupFilter 
                                        selectedIds={reportGroupIds} 
                                        onChange={setReportGroupIds} 
                                        organizationIds={reportOrganizationIds.length > 0 ? reportOrganizationIds : (organizationId ? [organizationId.toString()] : undefined)}
                                    />
                                    <BranchFilter 
                                        selectedIds={reportBranchIds} 
                                        onChange={setReportBranchIds} 
                                        organizationIds={reportOrganizationIds.length > 0 ? reportOrganizationIds : (organizationId ? [organizationId.toString()] : undefined)}
                                        groupIds={reportGroupIds}
                                    />
                                    <UserFilter
                                        selectedIds={reportUserIds}
                                        onChange={setReportUserIds}
                                        organizationIds={reportOrganizationIds.length > 0 ? reportOrganizationIds : (organizationId ? [organizationId.toString()] : undefined)}
                                        groupIds={reportGroupIds}
                                        branchIds={reportBranchIds}
                                    />
                                    <Button variant="ghost" size="icon" onClick={() => { 
                                        setReportMonths([1,2,3,4,5,6,7,8,9,10,11,12]); 
                                        setReportYears([]); 
                                        setReportBranchIds([]); 
                                        setReportOrganizationIds([]); 
                                        setReportGroupIds([]);
                                        setReportUserIds([]);
                                    }} className="h-10 w-10 text-slate-400 hover:text-indigo-500 rounded-xl hover:bg-indigo-50/50 transition-all">
                                        <RefreshCw className="h-4 w-4" />
                                    </Button>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="sm" className="h-10 text-[11px] font-black underline decoration-slate-200 gap-2 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm px-5">
                                                <Download className="h-3.5 w-3.5" />
                                                STASH REPORT
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-52 rounded-2xl border-slate-200 dark:border-slate-800 p-2 shadow-2xl bg-white dark:bg-slate-900">
                                            <DropdownMenuItem onClick={() => handleExport('csv')} className="text-xs font-bold py-3 cursor-pointer rounded-xl"><FileText className="mr-3 h-4 w-4 text-slate-400" /> CSV ARCHIVE</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleExport('excel')} className="text-xs font-bold py-3 cursor-pointer rounded-xl"><FileSpreadsheet className="mr-3 h-4 w-4 text-emerald-500" /> EXCEL WORKBOOK</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleExport('pdf')} className="text-xs font-bold py-3 cursor-pointer rounded-xl"><FilePdf className="mr-3 h-4 w-4 text-rose-500" /> PDF DOCUMENT</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>

                            <div className="overflow-x-auto relative min-h-[400px]">
                                {isReportLoading && (
                                    <div className="absolute inset-0 bg-white/30 dark:bg-slate-900/30 backdrop-blur-[1px] z-10 flex items-center justify-center">
                                        <Loader2 className="h-10 w-10 animate-spin text-slate-300" />
                                    </div>
                                )}
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100/50 dark:border-slate-800/50">
                                            <TableHead className="pl-8 h-14 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Employee Profile</TableHead>
                                            <TableHead className="h-14 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">Status</TableHead>
                                            <TableHead className="h-14 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">ID Reference</TableHead>
                                            <TableHead className="h-14 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Domain / Branch</TableHead>
                                            <TableHead className="h-14 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">Orders {compare && "(A/B)"}</TableHead>
                                            <TableHead className="h-14 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">Fulfilled</TableHead>
                                            <TableHead className="h-14 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">Refunded</TableHead>
                                            <TableHead className="text-right pr-8 h-14 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Yield {compare && "(A/B)"}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredUsers.length === 0 ? (
                                            <TableRow><TableCell colSpan={8} className="h-60 text-center text-slate-400 font-bold uppercase tracking-widest italic opacity-50">No audits found for this criteria</TableCell></TableRow>
                                        ) : (
                                            filteredUsers.map((u: any) => (
                                                <TableRow key={`${u.userId}-${u.userEmail}`} className="group hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-all duration-300">
                                                    <TableCell className="pl-8 py-5">
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="font-black text-xs text-slate-900 dark:text-white capitalize tracking-tight group-hover:text-indigo-600 transition-colors uppercase">{u.userName || "Anonymous"}</span>
                                                            <span className="text-[10px] text-slate-400 font-bold lowercase tracking-tighter opacity-80">{u.userEmail}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center py-5">
                                                        <Badge variant="outline" className={cn("text-[10px] font-black uppercase tracking-widest", u.status === "active" ? "bg-emerald-50 text-emerald-600 border-emerald-200" : u.status === "deleted" ? "bg-rose-50 text-rose-600 border-rose-200" : "bg-amber-50 text-amber-600 border-amber-200")}>
                                                            {u.status || "Unknown"}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="py-5">
                                                        <Badge variant="outline" className="text-[10px] font-black font-mono px-2.5 py-1 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 group-hover:border-indigo-500/30 transition-all">
                                                            {u.employeeId || "NO-ID"}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="py-5">
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tighter truncate max-w-[150px]">{u.organizationName || "N/A"}</span>
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter opacity-60 truncate max-w-[150px]">{u.branchName || "Global"}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center py-5">
                                                        <div className="flex flex-col items-center">
                                                            <span className="font-black text-xs text-slate-900 dark:text-white font-mono tracking-tighter">{u.totalOrders}</span>
                                                            {compare && <span className="text-[9px] text-slate-400 border-t border-slate-100 dark:border-slate-800 mt-0.5 pt-0.5 font-bold tracking-tighter">{u.compareTotalOrders || 0}</span>}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center py-5">
                                                        <div className="inline-flex items-center justify-center p-1.5 px-3 rounded-full bg-emerald-500/5 border border-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black text-xs font-mono tracking-tighter">
                                                            {u.fulfilledOrders}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center py-5">
                                                        <span className={cn("font-black text-xs font-mono tracking-tighter", u.refundedOrders > 0 ? "text-rose-500" : "text-slate-300")}>
                                                            {u.refundedOrders}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-right pr-8 py-5">
                                                        <div className="flex flex-col items-end">
                                                            <span className="font-black text-xs text-slate-950 dark:text-white font-mono tracking-tight">{formatPKR(u.totalSpentCents / 100)}</span>
                                                            {compare && <span className="text-[9px] text-slate-400 border-t border-slate-100 dark:border-slate-800 mt-0.5 pt-0.5 font-bold tracking-tight">{formatPKR((u.compareTotalSpentCents || 0) / 100)}</span>}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="p-6 bg-slate-50/50 dark:bg-slate-900/40 text-center border-t border-slate-100/50 dark:border-slate-800 flex justify-between items-center group">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] italic">System Generated Audit • {generatedDate}</p>
                                <div className="h-1 w-24 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-500 w-1/3 group-hover:w-full transition-all duration-1000" />
                                </div>
                            </div>
                        </Card>


                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
}

// ━━━ PREMIUM HELPER COMPONENTS ━━━

function KPICard({ label, value, icon, iconBg, trend, trendColor, subtitle, compare, compareValue }: any) {
    return (
        <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900/40 backdrop-blur-xl rounded-3xl p-6 relative group transition-all duration-500 hover:shadow-indigo-500/10">
            <div className="flex items-start justify-between relative z-10">
                <div className={cn("p-3 rounded-2xl shadow-sm transition-transform duration-500 group-hover:scale-110", iconBg)}>
                    {icon}
                </div>
                {trend && (
                    <div className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black tracking-tight shadow-sm border animate-in fade-in zoom-in duration-700",
                        trendColor === "emerald" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                        trendColor === "blue" ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                        "bg-slate-500/10 text-slate-500 border-slate-500/20"
                    )}>
                        {trend.isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {trend.value}%
                    </div>
                )}
            </div>
            <div className="mt-5 space-y-1 relative z-10">
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
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </Card>
    )
}

function MonthFilter({ selected, onChange }: any) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    const items = months.map((m, i) => ({ id: i + 1, label: m }))
    return (
        <MultiSelectFilter
            title="Months"
            items={items}
            selectedIds={selected}
            onChange={(ids) => onChange(ids.sort((a,b) => a - b))}
            icon={<Calendar className="h-3.5 w-3.5 mr-2 text-indigo-500" />}
            placeholder="Months"
            showSearch={false}
        />
    )
}

function YearFilter({ selected, onChange, availableYears }: any) {
    const items = (availableYears || []).map((y: number) => ({ id: y, label: String(y) }))
    return (
        <MultiSelectFilter
            title="Years"
            items={items}
            selectedIds={selected}
            onChange={(ids) => onChange(ids.sort((a,b) => b - a))}
            icon={<Layers className="h-3.5 w-3.5 mr-2 text-indigo-500" />}
            placeholder="Years"
            showSearch={false}
        />
    )
}
