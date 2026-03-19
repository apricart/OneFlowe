"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import useSWR from "swr"
import { useAppContext } from "@/components/context/app-context"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    Loader2, RefreshCw, Search, FileText, FileSpreadsheet, FileIcon as FilePdf, Download, Users, Package, CheckCircle, TrendingUp, Filter, UserCircle, Calculator, ChevronDown, UserPlus
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
import { BranchFilter } from "@/components/reports/branch-filter"


const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function UserReportPage() {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const {
        organizationId,
        branchId: contextBranchId,
        branchIds: contextBranchIds,
        setBranchIds: setContextBranchIds
    } = useAppContext()

    const [searchTerm, setSearchTerm] = useState("")
    const [generatedDate, setGeneratedDate] = useState("")
    const [selectedChartUsers, setSelectedChartUsers] = useState<number[]>([])
    const [chartUserDropdownOpen, setChartUserDropdownOpen] = useState(false)

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

    // Build query string
    const queryParams = new URLSearchParams()
    if (organizationId) queryParams.set("organizationId", organizationId.toString())
    if (startFromUrl) queryParams.set("startDate", startFromUrl)
    if (endFromUrl) queryParams.set("endDate", endFromUrl)

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

    const { data, isLoading, mutate } = useSWR(`/api/v1/analytics/users/performance?${queryParams.toString()}`, fetcher)

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

    const currentYear = dateRange?.startDate.getFullYear() || new Date().getFullYear()
    const currentMonthIdx = dateRange?.startDate.getMonth() || new Date().getMonth()

    const usersData = data?.data || []

    const filteredUsers = usersData.filter((u: any) =>
        (u.userName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.userEmail || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.branchName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.employeeId || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.tids || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.organizationName || "").toLowerCase().includes(searchTerm.toLowerCase())
    )

    const totalUsers = usersData.length
    const totalOrders = usersData.reduce((sum: number, u: any) => sum + (Number(u.totalOrders) || 0), 0)
    const totalFulfilled = usersData.reduce((sum: number, u: any) => sum + (Number(u.fulfilledOrders) || 0), 0)
    const totalSpent = usersData.reduce((sum: number, u: any) => sum + (Number(u.totalSpentCents) || 0), 0)

    // Chart data: build per-user comparison data
    const chartUsers = selectedChartUsers.length > 0
        ? usersData.filter((u: any) => selectedChartUsers.includes(u.userId))
        : usersData.slice(0, 5) // Default: top 5 users by spend

    const chartData = chartUsers.map((u: any) => ({
        name: u.userName?.split(' ')[0] || "User",
        fullName: u.userName,
        orders: u.totalOrders || 0,
        fulfilled: u.fulfilledOrders || 0,
        spent: Math.round((u.totalSpentCents || 0) / 100),
    }))

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

    const usersTrend = getTrend(totalUsers, comparison?.totalUsers || 0)
    const ordersTrend = getTrend(totalOrders, comparison?.totalOrders || 0)
    const spentTrend = getTrend(totalSpent, comparison?.totalSpentCents || 0)

    const currentSuccess = totalOrders > 0 ? (totalFulfilled / totalOrders) * 100 : 0
    const prevSuccess = (comparison?.totalOrders || 0) > 0 ? (comparison.totalFulfilled / comparison.totalOrders) * 100 : 0
    const successTrend = getTrend(currentSuccess, prevSuccess)

    const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
        const headers = ["Employee ID", "Name", "Email", "Organization", "Branch", "Total Orders", "Fulfilled", "Refunded", "Total Spent"]
        const rows = filteredUsers.map((u: any) => [
            u.employeeId || "-", u.userName, u.userEmail, u.organizationName || 'N/A', u.branchName || 'N/A', u.totalOrders, u.fulfilledOrders, u.refundedOrders,
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
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0f172a] via-[#1e293b] to-[#334155] px-6 py-8 text-white shadow-xl ring-1 ring-slate-700/50">
                    <div className="flex flex-col gap-2 relative z-10">
                        <p className="text-xs tracking-[0.3em] text-slate-400 font-bold uppercase">Purchasing Patterns</p>
                        <h1 className="text-4xl font-bold tracking-tight">User Ordering Statistics</h1>
                        <p className="text-sm text-slate-400 font-medium max-w-xl">
                            Holistic consumption overview for <strong className="text-white">{totalUsers}</strong> active users across filtered branches.
                        </p>
                    </div>
                    <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                </div>

                {/* ━━━ KPI BENTO GRID ━━━ */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900/50">
                        <div className="flex items-center justify-between mb-3">
                            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                                <Users className="h-5 w-5" />
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <Badge variant="secondary" className="text-[10px] font-bold">Active Transactors</Badge>
                                {usersTrend && usersTrend.value !== "0.0" && (
                                    <div className={cn(
                                        "text-[10px] font-black tracking-tighter",
                                        usersTrend.isUp ? "text-emerald-500" : usersTrend.isDown ? "text-rose-500" : "text-slate-400"
                                    )}>
                                        {usersTrend.isUp ? "↑" : usersTrend.isDown ? "↓" : "•"} {usersTrend.value}%
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <p className="text-3xl font-bold text-slate-900 dark:text-white">{totalUsers}</p>
                            {compare && comparison && (
                                <span className="text-[10px] font-bold text-slate-400 line-through opacity-50">
                                    {comparison.totalUsers}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1 font-medium">Distinct ordering profiles found.</p>
                    </Card>

                    <Card className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900/50">
                        <div className="flex items-center justify-between mb-3">
                            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                <Package className="h-5 w-5" />
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <Badge variant="secondary" className="text-[10px] font-bold">Volume</Badge>
                                {ordersTrend && ordersTrend.value !== "0.0" && (
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
                            <p className="text-3xl font-bold text-slate-900 dark:text-white">{totalOrders}</p>
                            {compare && comparison && (
                                <span className="text-[10px] font-bold text-slate-400 line-through opacity-50">
                                    {comparison.totalOrders}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1 font-medium">Total orders initiated by users.</p>
                    </Card>

                    <Card className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900/50">
                        <div className="flex items-center justify-between mb-3">
                            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                                <CheckCircle className="h-5 w-5" />
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <Badge variant="secondary" className="text-[10px] font-bold">Success Rate</Badge>
                                {successTrend && successTrend.value !== "0.0" && (
                                    <div className={cn(
                                        "text-[10px] font-black tracking-tighter",
                                        successTrend.isUp ? "text-emerald-500" : successTrend.isDown ? "text-rose-500" : "text-slate-400"
                                    )}>
                                        {successTrend.isUp ? "↑" : successTrend.isDown ? "↓" : "•"} {successTrend.value}%
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <p className="text-3xl font-bold text-slate-900 dark:text-white">
                                {currentSuccess.toFixed(1)}%
                            </p>
                            {compare && comparison && (
                                <span className="text-[10px] font-bold text-slate-400 line-through opacity-50">
                                    {prevSuccess.toFixed(1)}%
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1 font-medium">{totalFulfilled} fulfilled orders.</p>
                    </Card>

                    <Card className="p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 shadow-md bg-white dark:bg-slate-900/50 ring-1 ring-indigo-500/10">
                        <div className="flex items-center justify-between mb-3">
                            <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none">
                                <TrendingUp className="h-5 w-5" />
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 text-[10px] font-bold">Yield</Badge>
                                {spentTrend && spentTrend.value !== "0.0" && (
                                    <div className={cn(
                                        "text-[10px] font-black tracking-tighter",
                                        spentTrend.isUp ? "text-emerald-500" : spentTrend.isDown ? "text-rose-500" : "text-slate-400"
                                    )}>
                                        {spentTrend.isUp ? "↑" : spentTrend.isDown ? "↓" : "•"} {spentTrend.value}%
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <p className="text-3xl font-bold text-slate-900 dark:text-white">{formatPKR(totalSpent / 100)}</p>
                            {compare && comparison && (
                                <span className="text-[10px] font-bold text-slate-400 line-through opacity-50">
                                    {formatPKR(comparison.totalSpentCents / 100)}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1 font-medium">Total net value across all users.</p>
                    </Card>
                </div>

                {/* ━━━ USER ANALYTICS CHART ━━━ */}
                <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900/50 backdrop-blur-xl rounded-3xl">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800/50 flex flex-wrap justify-between items-center gap-4 bg-slate-50/50 dark:bg-slate-900/20">
                        <div className="flex flex-col">
                            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">User Comparison</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">Volume & Spend Analysis</p>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Time Span Presets */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-8 text-[11px] font-bold border-indigo-100 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400 gap-1.5 px-3 rounded-md bg-indigo-50/20">
                                        <Calculator className="h-3.5 w-3.5" />
                                        {activePreset === "thisMonth" ? "This Month" : activePreset === "yearly" ? "This Year" : activePreset === "all" ? "All Time" : activePreset === "custom" ? "Custom" : "Time Span"}
                                        <ChevronDown className="h-3 w-3 opacity-50" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48 rounded-xl">
                                    <div className="p-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 mb-1">Select Time Span</div>
                                    <DropdownMenuItem onClick={() => handleDateChange(null, "thisMonth")} className="text-xs py-2 cursor-pointer font-medium">This Month</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => {
                                        const end = new Date();
                                        const start = new Date();
                                        start.setMonth(start.getMonth() - 1);
                                        start.setDate(1);
                                        end.setDate(0);
                                        handleDateChange({ startDate: start, endDate: end }, "custom");
                                    }} className="text-xs py-2 cursor-pointer font-medium">Last Month</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => {
                                        const start = new Date();
                                        start.setMonth(start.getMonth() - 6);
                                        handleDateChange({ startDate: start, endDate: new Date() }, "custom");
                                    }} className="text-xs py-2 cursor-pointer font-medium font-bold text-indigo-600">Last 6 Months</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleDateChange(null, "yearly")} className="text-xs py-2 cursor-pointer font-medium">This Year</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleDateChange(null, "all")} className="text-xs py-2 cursor-pointer font-medium text-slate-400">All Time</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />

                            {/* Month/Year Selector */}
                            <div className="flex items-center gap-1 bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-lg">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-6 text-[10px] font-bold px-2 hover:bg-white dark:hover:bg-slate-700 rounded-md uppercase">
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
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-6 text-[10px] font-bold px-2 hover:bg-white dark:hover:bg-slate-700 rounded-md">
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

                            <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />

                            <DropdownMenu open={chartUserDropdownOpen} onOpenChange={setChartUserDropdownOpen}>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-8 text-[11px] font-bold border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 gap-1.5 px-3 rounded-md bg-emerald-50/20">
                                        <UserPlus className="h-3.5 w-3.5" />
                                        {selectedChartUsers.length > 0 ? `${selectedChartUsers.length} Selected` : "Select Users"}
                                        <ChevronDown className="h-3 w-3 opacity-50" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-64 max-h-[400px] overflow-y-auto rounded-xl p-2 shadow-2xl">
                                    <div className="p-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 mb-1 flex justify-between items-center">
                                        <span>Compare Users</span>
                                        {selectedChartUsers.length > 0 && (
                                            <button onClick={(e) => { e.stopPropagation(); setSelectedChartUsers([]); }} className="text-indigo-500 hover:text-indigo-600 transition-colors lowercase font-bold">reset</button>
                                        )}
                                    </div>
                                    {usersData.length === 0 ? (
                                        <div className="p-4 text-center text-[10px] text-slate-400 font-bold uppercase italic">No data available</div>
                                    ) : (
                                        usersData.slice(0, 15).map((u: any) => (
                                            <DropdownMenuItem 
                                                key={u.userId} 
                                                onSelect={(e) => {
                                                    e.preventDefault()
                                                    setSelectedChartUsers(prev => 
                                                        prev.includes(u.userId) 
                                                            ? prev.filter(id => id !== u.userId)
                                                            : [...prev, u.userId]
                                                    )
                                                }}
                                                className="text-[11px] py-2 cursor-pointer flex items-center justify-between rounded-lg px-3 transition-all hover:bg-slate-50"
                                            >
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-700 dark:text-slate-300 capitalize">{u.userName}</span>
                                                    <span className="text-[9px] text-slate-400 lowercase">{formatPKR(u.totalSpentCents / 100)} spent</span>
                                                </div>
                                                <div className={cn(
                                                    "w-4 h-4 rounded-md border flex items-center justify-center transition-all",
                                                    selectedChartUsers.includes(u.userId) ? "bg-emerald-500 border-emerald-600 text-white" : "border-slate-200 dark:border-slate-700"
                                                )}>
                                                    {selectedChartUsers.includes(u.userId) && <CheckCircle className="h-3 w-3" />}
                                                </div>
                                            </DropdownMenuItem>
                                        ))
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                    <CardContent className="p-6">
                        <div className="h-[350px] w-full mt-4">
                            {chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.5} />
                                        <XAxis 
                                            dataKey="name" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }}
                                            dy={10}
                                        />
                                        <YAxis 
                                            yAxisId="left"
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }}
                                            tickFormatter={(value) => value.toLocaleString()}
                                        />
                                        <YAxis 
                                            yAxisId="right"
                                            orientation="right"
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }}
                                            tickFormatter={(value) => `Rs ${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`}
                                        />
                                        <RechartsTooltip 
                                            content={({ active, payload, label }) => {
                                                if (active && payload && payload.length) {
                                                    const u = chartUsers.find((cu: any) => cu.userName.split(' ')[0] === label) || chartUsers[0];
                                                    return (
                                                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl shadow-2xl min-w-[200px] ring-1 ring-slate-200/50">
                                                            <p className="text-[12px] font-black uppercase tracking-widest text-slate-900 dark:text-white mb-2 border-b border-slate-100 pb-2">{u.userName}</p>
                                                            <div className="space-y-1.5">
                                                                <div className="flex justify-between items-center bg-blue-50/30 p-1.5 rounded-lg">
                                                                    <span className="text-[10px] font-bold text-blue-600 uppercase">Total Orders</span>
                                                                    <span className="text-[11px] font-black text-blue-700">{payload[0].value}</span>
                                                                </div>
                                                                <div className="flex justify-between items-center bg-emerald-50/30 p-1.5 rounded-lg">
                                                                    <span className="text-[10px] font-bold text-emerald-600 uppercase">Fulfilled</span>
                                                                    <span className="text-[11px] font-black text-emerald-700">{payload[1].value}</span>
                                                                </div>
                                                                <div className="flex justify-between items-center bg-indigo-50/30 p-1.5 rounded-lg mt-1 border border-indigo-100/50">
                                                                    <span className="text-[10px] font-bold text-indigo-600 uppercase">Total Spent</span>
                                                                    <span className="text-[11px] font-black text-indigo-700">{formatPKR(Number(payload[2].value))}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Legend verticalAlign="top" align="right" height={36} iconType="circle" />
                                        <Bar yAxisId="left" dataKey="orders" name="Orders Initiated" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={24} />
                                        <Bar yAxisId="left" dataKey="fulfilled" name="Fulfilled Orders" fill="#10b981" radius={[6, 6, 0, 0]} barSize={24} />
                                        <Line yAxisId="right" type="monotone" dataKey="spent" name="Total Expenditure" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
                                    <Users className="h-10 w-10 opacity-20" />
                                    <p className="text-sm font-medium italic">Insufficient transactional data for visualization</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* ━━━ USER LIST TABLE ━━━ */}
                <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900/50">
                    <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap justify-between items-center gap-4">
                        <div className="flex items-center gap-3">
                            <h3 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-wider">User Ledger</h3>
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <Input
                                    placeholder="Filter by name or email..."
                                    className="pl-9 h-10 w-64 text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:ring-1 focus:ring-indigo-500/50"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-10 text-xs font-bold gap-2 rounded-lg border-slate-200 dark:border-slate-800">
                                    <Download className="h-4 w-4" />
                                    EXPORT REPORT
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-xl border-slate-200 dark:border-slate-800">
                                <DropdownMenuItem onClick={() => handleExport('csv')} className="text-xs py-2.5 cursor-pointer">
                                    <FileText className="mr-2 h-4 w-4 text-slate-400" /> CSV
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExport('excel')} className="text-xs py-2.5 cursor-pointer">
                                    <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-500" /> Excel
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExport('pdf')} className="text-xs py-2.5 cursor-pointer">
                                    <FilePdf className="mr-2 h-4 w-4 text-rose-500" /> PDF
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50/50 dark:bg-slate-800/30">
                                    <TableHead className="pl-6 h-12 text-[10px] font-bold uppercase tracking-widest text-slate-500">Employee</TableHead>
                                    <TableHead className="h-12 text-[10px] font-bold uppercase tracking-widest text-slate-500">Emp ID</TableHead>
                                    <TableHead className="h-12 text-[11px] font-bold uppercase text-slate-500 text-left">Organization</TableHead>
                                    <TableHead className="h-12 text-[11px] font-bold uppercase text-slate-500">Branch Assignment</TableHead>
                                    <TableHead className="h-12 text-[11px] font-bold uppercase text-slate-500 text-center">Total Orders</TableHead>
                                    <TableHead className="h-12 text-[11px] font-bold uppercase text-slate-500 text-center">Fulfilled</TableHead>
                                    <TableHead className="h-12 text-[11px] font-bold uppercase text-slate-500 text-center">Refunded</TableHead>
                                    <TableHead className="text-right pr-6 h-12 text-[11px] font-bold uppercase text-slate-500">Total Spent</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={8} className="h-40 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-500 opacity-50" /></TableCell></TableRow>
                                ) : filteredUsers.length === 0 ? (
                                    <TableRow><TableCell colSpan={8} className="h-40 text-center text-slate-500 italic">No user activity recorded in this period.</TableCell></TableRow>
                                ) : (
                                    filteredUsers.map((u: any) => (
                                        <TableRow key={u.userId} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                                            <TableCell className="pl-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-semibold text-xs text-slate-900 dark:text-white capitalize">{u.userName || "Anonymous"}</span>
                                                    <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{u.userEmail}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <Badge variant="outline" className="text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                                                    {u.employeeId || "-"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-left font-semibold text-[11px] text-slate-700 dark:text-slate-300">
                                                {u.organizationName || "N/A"}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-[10px] font-medium border-slate-200 dark:border-slate-800">{u.branchName || "Unassigned"}</Badge>
                                            </TableCell>
                                            <TableCell className="text-center font-mono text-xs font-semibold">{u.totalOrders}</TableCell>
                                            <TableCell className="text-center font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold">{u.fulfilledOrders}</TableCell>
                                            <TableCell className="text-center font-mono text-xs text-rose-500">{u.refundedOrders}</TableCell>
                                            <TableCell className="text-right pr-6 font-mono font-bold text-xs text-slate-900 dark:text-white">
                                                {formatPKR(u.totalSpentCents / 100)}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="p-4 bg-slate-50/50 dark:bg-slate-900/20 text-center border-t border-slate-100 dark:border-slate-800">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Analytics generated at {generatedDate}</p>
                    </div>
                </Card>
            </div>
        </div>
    )
}
