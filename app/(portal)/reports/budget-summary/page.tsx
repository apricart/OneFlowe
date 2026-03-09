"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import useSWR from "swr"
import { fetcher } from "@/lib/fetcher"
import { useAppContext } from "@/components/context/app-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    Loader2, RefreshCw, ArrowUpRight, ArrowDownRight, Search, FileText, FileSpreadsheet, FileIcon as FilePdf, Wallet, PiggyBank, ReceiptText, ShieldCheck, Download, Building2, PieChart as PieChartIcon, LayoutDashboard, Database, FileText as FileSpreadsheetIcon, Download as DownloadIcon
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
import { ScheduleReportModal } from "@/components/reports/schedule-report-modal"

import {
    ResponsiveContainer,
    ComposedChart,
    Area,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    BarChart,
    Cell
} from 'recharts'

interface BudgetSummaryResponse {
    summary: {
        totalAllocated: number;
        totalSpent: number;
        totalHeld: number;
        totalCredited: number;
        totalRemaining: number;
    };
    insights: {
        spentGrowth: number;
        allocationGrowth: number;
    };
    categories: Array<{
        categoryId: number;
        categoryName: string;
        allocated: number;
        spent: number;
        held: number;
        remaining: number;
        utilization: number;
    }>;
    dailySpending: Array<{
        date: string;
        spentCents: number;
    }>;
    branchBreakdown: Array<{
        branchId: number;
        branchName: string;
        allocated: number;
        spent: number;
        held: number;
        remaining: number;
        utilization: number;
    }>;
}

export default function BudgetSummaryPage() {
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

    const { data: session } = useSession()
    const role = (session?.user as any)?.role as Role
    const [hasMounted, setHasMounted] = useState(false)

    // URL States for filtering
    const presetFromUrl = (searchParams.get("preset") as FilterPreset) || "thisMonth"
    const startFromUrl = searchParams.get("startDate") || ""
    const endFromUrl = searchParams.get("endDate") || ""

    const activePreset = presetFromUrl
    const dateRange = useMemo(() => {
        if (startFromUrl && endFromUrl) {
            return { startDate: new Date(startFromUrl), endDate: new Date(endFromUrl) }
        }
        return null
    }, [startFromUrl, endFromUrl])

    const handleDateChange = useCallback((range: { startDate: Date; endDate: Date } | null, preset: FilterPreset) => {
        const params = new URLSearchParams(searchParams.toString())
        if (preset) params.set("preset", preset)
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

    const { data, isLoading, mutate } = useSWR<BudgetSummaryResponse>(`/api/v1/analytics/budgets/summary?${queryParams.toString()}`, fetcher)

    useEffect(() => {
        setHasMounted(true)
        setGeneratedDate(new Date().toLocaleString())

        // If no explicit preset/dates, force month filter
        if (!startFromUrl && !endFromUrl && !searchParams.has("preset")) {
            const today = new Date()
            const start = new Date(today.getFullYear(), today.getMonth(), 1)
            const end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999)
            handleDateChange({ startDate: start, endDate: end }, "thisMonth")
        }
    }, [startFromUrl, endFromUrl, searchParams, handleDateChange])

    const summary = data?.summary || { totalAllocated: 0, totalSpent: 0, totalHeld: 0, totalCredited: 0, totalRemaining: 0 }
    const insights = data?.insights || { spentGrowth: 0, allocationGrowth: 0 }
    const categories = data?.categories || []
    const dailySpending = data?.dailySpending || []
    const branchBreakdown = data?.branchBreakdown || []

    const filteredCategories = categories.filter((c: any) =>
        (c.categoryName || "Uncategorized").toLowerCase().includes(searchTerm.toLowerCase())
    )

    const filteredBranches = branchBreakdown.filter((b: any) =>
        (b.branchName || "").toLowerCase().includes(searchTerm.toLowerCase())
    )

    const chartData = useMemo(() => {
        if (!dailySpending.length) return []
        return dailySpending.map((d: any) => ({
            date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            spent: (d.spentCents || 0) / 100
        }))
    }, [dailySpending])

    const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
        const headers = ["Category Name", "Total Spent (PKR)"]
        const rows = filteredCategories.map((c: any) => [
            c.categoryName || 'Uncategorized',
            (c.spentCents / 100).toFixed(2)
        ])

        if (format === 'pdf') {
            const doc = new jsPDF()
            doc.setFontSize(20)
            doc.text("Budget Intelligence Report", 14, 20)
            doc.setFontSize(10)
            doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28)
            autoTable(doc, { startY: 40, head: [headers], body: rows, theme: 'grid', headStyles: { fillColor: [66, 66, 66] } })
            doc.save(`budget-intelligence-${new Date().getTime()}.pdf`)
            return
        }

        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Budget Intelligence")

        if (format === 'excel') {
            XLSX.writeFile(workbook, `budget-intelligence-${new Date().getTime()}.xlsx`)
        } else {
            XLSX.writeFile(workbook, `budget-intelligence-${new Date().getTime()}.csv`)
        }
    }

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/50 p-3 rounded-lg shadow-xl">
                    <p className="text-white font-medium text-sm mb-2">{label}</p>
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center gap-2 text-xs">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-slate-300">{entry.name}:</span>
                            <span className="text-white font-mono font-bold">
                                {formatPKR(entry.value)}
                            </span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    const renderSparkline = (dataKey: 'spent', color: string) => (
        <div className="h-10 w-full mt-2 opacity-80">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData.slice(-14)}>
                    <Area type="monotone" dataKey={dataKey} stroke={color} fill={color} fillOpacity={0.2} strokeWidth={2} isAnimationActive={false} />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    )

    if (!hasMounted) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        )
    }

    const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9'];

    return (
        <div className="space-y-5 pb-12 bg-slate-50 dark:bg-slate-950 min-h-screen">

            {/* ━━━ GLOBAL STICKY HEADER ━━━ */}
            <div className="sticky top-0 z-30 flex flex-wrap items-center gap-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 p-4 shadow-sm">
                <GlobalDateFilter
                    value={dateRange}
                    onChange={handleDateChange}
                    activePreset={activePreset}
                    hidePresets={false}
                />
                {(role === "SUPER_ADMIN" || role === "HEAD_OFFICE") && (
                    <BranchFilter
                        selectedIds={contextBranchIds}
                        onChange={handleBranchChange}
                        organizationId={organizationId || undefined}
                    />
                )}
                <div className="flex-1" />
                <ScheduleReportModal reportName="Budget Intelligence" />
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
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0d9488] via-[#0f766e] to-[#1e3a8a] px-6 py-6 text-white shadow-xl ring-1 ring-teal-500/30">
                    <div className="flex flex-wrap flex-col gap-2 relative z-10">
                        <p className="text-xs tracking-[0.2em] text-white/70 font-bold">EXECUTIVE DASHBOARD</p>
                        <h1 className="text-3xl font-semibold tracking-tight">Budget Intelligence</h1>
                        <p className="text-sm text-white/80 font-medium max-w-2xl">
                            Analyzing <strong className="text-white">{formatPKR(summary.totalAllocated / 100)}</strong> allocated across <strong className="text-white">{contextBranchIds.length || "all"}</strong> selected branches for the current period. Compare spending against your limits.
                        </p>
                    </div>
                    {/* Abstract background shapes */}
                    <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute bottom-0 left-1/4 translate-y-1/2 w-64 h-64 bg-teal-400/20 rounded-full blur-3xl pointer-events-none" />
                </div>

                {/* ━━━ KPI BENTO GRID ━━━ */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="relative overflow-hidden p-5 rounded-2xl border border-teal-200 dark:border-teal-800/50 shadow-sm dark:shadow-teal-900/20 bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl before:absolute before:inset-0 before:bg-gradient-to-br before:from-teal-500/5 before:to-emerald-500/5">
                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-2">
                                <div className="p-2 rounded-xl bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400">
                                    <Wallet className="h-4 w-4" />
                                </div>
                                <Badge variant="outline" className="border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 text-[10px] uppercase font-bold tracking-wider">Allocated</Badge>
                            </div>
                            <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{formatPKR(summary.totalAllocated / 100)}</p>
                            <div className={cn("flex items-center gap-1.5 text-xs font-semibold", insights.allocationGrowth >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400")}>
                                {insights.allocationGrowth >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                <span>{insights.allocationGrowth > 0 ? "+" : ""}{insights.allocationGrowth.toFixed(1)}%</span>
                                <span className="text-slate-400 dark:text-slate-500 ml-1 font-medium">vs prior period</span>
                            </div>
                            {/* Fake a sparkline baseline */}
                            <div className="h-10 mt-2 w-full border-b-2 border-dashed border-teal-200 dark:border-teal-800/50" />
                        </div>
                    </Card>

                    <Card className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                                <ReceiptText className="h-4 w-4" />
                            </div>
                            <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider opacity-60">Actual Spent</Badge>
                        </div>
                        <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{formatPKR(summary.totalSpent / 100)}</p>
                        <div className={cn("flex items-center gap-1.5 text-xs font-semibold", insights.spentGrowth > 0 ? "text-amber-500" : "text-emerald-600 dark:text-emerald-400")}>
                            {insights.spentGrowth >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            <span>{insights.spentGrowth > 0 ? "+" : ""}{insights.spentGrowth.toFixed(1)}%</span>
                            <span className="text-slate-400 dark:text-slate-500 ml-1 font-medium">vs prior period</span>
                        </div>
                        {renderSparkline("spent", "#3b82f6")}
                    </Card>

                    <Card className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
                                <ShieldCheck className="h-4 w-4" />
                            </div>
                            <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider opacity-60">Held (Pending)</Badge>
                        </div>
                        <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{formatPKR(summary.totalHeld / 100)}</p>
                        <p className="text-xs font-medium text-slate-500 mt-2 leading-relaxed">Funds engaged in unfulfilled, active orders.</p>
                    </Card>

                    <Card className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-teal-50/50 via-white to-white dark:from-teal-900/20 dark:via-slate-900 dark:to-slate-900">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                                <PiggyBank className="h-4 w-4" />
                            </div>
                            <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider opacity-60">Variance (Remaining)</Badge>
                        </div>
                        <p className={cn(
                            "text-3xl font-bold mb-1",
                            summary.totalRemaining < 0 ? "text-rose-500 dark:text-rose-400" : "text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-emerald-500 dark:from-teal-400 dark:to-emerald-300"
                        )}>
                            {summary.totalRemaining < 0 ? "-" : "+"}{formatPKR(Math.abs(summary.totalRemaining) / 100)}
                        </p>
                        <p className="text-xs font-medium text-slate-500 mt-2 leading-relaxed">Available surplus after expenditure and holds.</p>
                    </Card>
                </div>

                {/* ━━━ CENTERPIECE DASHBOARD ━━━ */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                    <Card className="xl:col-span-2 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl">
                        <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800/50">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase tracking-tight text-slate-800 dark:text-slate-200">
                                Daily Budget Expenditure
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-6">
                            <div className="h-[350px] w-full">
                                {chartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorSpent" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                                            <XAxis
                                                dataKey="date"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fontSize: 11, fill: '#64748b' }}
                                                dy={10}
                                            />
                                            <YAxis
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fontSize: 11, fill: '#64748b' }}
                                                tickFormatter={(v) => `Rs ${v / 1000}k`}
                                                dx={-10}
                                            />
                                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(13, 148, 136, 0.05)' }} />
                                            <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                                            <Area type="monotone" dataKey="spent" name="Spent" stroke="#0d9488" strokeWidth={3} fillOpacity={1} fill="url(#colorSpent)" />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
                                        <ReceiptText className="h-10 w-10 opacity-20" />
                                        <p className="text-sm font-medium">Insufficient data for visualization</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* ━━━ BRANCH BREAKDOWN (New Requirement) ━━━ */}
                    <Card className="xl:col-span-1 border border-slate-200 dark:border-slate-800 shadow-sm bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl flex flex-col">
                        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/50">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase tracking-tight text-slate-800 dark:text-slate-200">
                                    <Building2 className="h-4 w-4 text-teal-500" />
                                    Branch Utilization
                                </CardTitle>
                                <Badge variant="secondary" className="text-[9px] font-bold tracking-widest bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border-none">BY REMAINING</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0 flex-1 overflow-y-auto h-[350px]">
                            {branchBreakdown.length > 0 ? (
                                <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                    {[...branchBreakdown].sort((a, b) => b.remaining - a.remaining).map((b: any, index: number) => (
                                        <div key={b.branchId} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors flex items-center justify-between group">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-bold text-xs uppercase">
                                                    {b.branchName?.substring(0, 2)}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-teal-600 transition-colors">
                                                        {b.branchName}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[10px] font-medium text-slate-400">Spent: {formatPKR(b.spent / 100)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className={cn("text-xs font-bold font-mono", b.remaining < 0 ? "text-rose-500" : "text-emerald-600")}>
                                                    {b.remaining < 0 ? "-" : "+"}{formatPKR(Math.abs(b.remaining) / 100)}
                                                </p>
                                                <p className="text-[9px] font-semibold text-slate-400">REMAINING</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-full flex items-center justify-center p-8 text-center">
                                    <p className="text-sm text-slate-500 font-medium">No branch data</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
                    {/* ━━━ CATEGORY BREAKDOWN ━━━ */}
                    <Card className="xl:col-span-1 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl flex flex-col">
                        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/50">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase tracking-tight text-slate-800 dark:text-slate-200">
                                    <PieChartIcon className="h-4 w-4 text-indigo-500" />
                                    Category Yield
                                </CardTitle>
                                <Badge variant="secondary" className="text-[9px] font-bold tracking-widest bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 border-none">BY SPEND</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 flex-1 h-[360px]">
                            {categories.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={filteredCategories.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#334155" opacity={0.1} />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="categoryName" type="category" width={110} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                        <Tooltip cursor={{ fill: 'transparent' }} content={<CustomTooltip />} />
                                        <Bar dataKey="spentCents" name="Spent" radius={[0, 4, 4, 0]} barSize={20}>
                                            {filteredCategories.slice(0, 10).map((entry: any, index: number) => (
                                                <Cell key={`cell-${entry.categoryId || index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center p-8 text-center text-slate-500 text-sm font-medium">No category data</div>
                            )}
                        </CardContent>
                    </Card>

                    {/* ━━━ CATEGORY LEDGER TABLE ━━━ */}
                    <Card className="xl:col-span-3 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800/50 flex flex-wrap justify-between items-center gap-3 bg-white/50 dark:bg-slate-900/20">
                            <h3 className="font-semibold text-sm uppercase tracking-tight text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                <FileText className="h-4 w-4 text-teal-600" />
                                Category Expense Ledger
                            </h3>
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                    <Input
                                        placeholder="Search..."
                                        className="pl-8 h-8 w-40 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 focus:ring-1 focus:ring-teal-500/50 rounded-md"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button size="sm" className="h-8 text-[11px] font-bold bg-teal-600 hover:bg-teal-700 text-white gap-1.5 px-3 rounded-md">
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
                        <div className="overflow-x-auto max-h-[360px]">
                            <Table>
                                <TableHeader className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                                    <TableRow>
                                        <TableHead className="pl-6 h-10 text-[10px] uppercase font-bold text-slate-500">Category</TableHead>
                                        <TableHead className="h-10 text-[10px] uppercase font-bold text-slate-500 text-right pr-6">Spent</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredCategories.map((cat: any, i: number) => (
                                        <TableRow key={cat.categoryId || i} className="hover:bg-teal-50/40 dark:hover:bg-teal-900/10 border-b border-slate-100 dark:border-slate-800/50">
                                            <TableCell className="font-medium text-xs pl-6 py-3">{cat.categoryName || 'Uncategorized'}</TableCell>
                                            <TableCell className="text-right font-mono font-bold text-xs pr-6 py-3">{formatPKR(cat.spentCents / 100)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    )
}


