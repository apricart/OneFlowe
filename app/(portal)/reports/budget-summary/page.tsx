"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import useSWR from "swr"
import { format } from "date-fns"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RotateCcw } from "lucide-react"

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
    branchBreakdown: Array<{
        branchId: number;
        branchName: string;
        allocated: number;
        spent: number;
        held: number;
        remaining: number;
        utilization: number;
        baselineAmount: number;
    }>;
    chartData: Array<{
        date: string;
        spentCents: number;
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
    const activeTab = searchParams.get("tab") || "analytics"

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

    const diffMs = dateRange ? (dateRange.endDate.getTime() - dateRange.startDate.getTime()) : 0;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    const granularity: "daily" | "monthly" | "yearly" = activePreset === "all" ? "monthly" : diffDays > 365 ? "yearly" : diffDays > 31 ? "monthly" : "daily";
    queryParams.set("granularity", granularity);

    const { data, isLoading, mutate } = useSWR<BudgetSummaryResponse>(`/api/v1/analytics/budgets/summary?${queryParams.toString()}`, fetcher)

    useEffect(() => {
        setHasMounted(true)
        setGeneratedDate(new Date().toLocaleString())

        // If no explicit preset/dates, force "All Time" filter
        if (!startFromUrl && !endFromUrl && !searchParams.has("preset")) {
            handleDateChange(null, "all")
        }
    }, [startFromUrl, endFromUrl, searchParams, handleDateChange])

    const summary = data?.summary || { totalAllocated: 0, totalSpent: 0, totalHeld: 0, totalCredited: 0, totalRemaining: 0 }
    const insights = data?.insights || { spentGrowth: 0, allocationGrowth: 0 }
    const categories = data?.categories || []
    const branchBreakdown = data?.branchBreakdown || []

    const filteredCategories = categories.filter((c: any) =>
        (c.categoryName || "Uncategorized").toLowerCase().includes(searchTerm.toLowerCase())
    )

    const filteredBranches = branchBreakdown.filter((b: any) =>
        (b.branchName || "").toLowerCase().includes(searchTerm.toLowerCase())
    )

    const transformedChartData = useMemo(() => {
        if (!data?.chartData?.length) return []
        return data.chartData.map((d: any) => {
            const item: any = {
                date: format(new Date(d.date + "-01"), granularity === "yearly" ? "yyyy" : "MMM yyyy"),
                totalSpent: 0,
                totalBaseline: 0,
                totalAddon: 0
            };
            if (d.branches) {
                d.branches.forEach((b: any) => {
                    const baseline = b.baseline / 100;
                    const addon = b.addon / 100;
                    const spent = (b.spent || 0) / 100;
                    item[`${b.branchId}_baseline`] = baseline;
                    item[`${b.branchId}_addon`] = addon;
                    item[`${b.branchId}_spent`] = spent;
                    item.totalSpent += spent;
                    item.totalBaseline += baseline;
                    item.totalAddon += addon;
                });
            }
            return item;
        })
    }, [data?.chartData, granularity])

    const uniqueBranches = useMemo(() => {
        if (!data?.chartData?.length) return []
        const branches: any[] = [];
        data.chartData.forEach((d: any) => {
            if (d.branches) {
                d.branches.forEach((b: any) => {
                    if (!branches.find(br => br.id === b.branchId)) {
                        branches.push({ id: b.branchId, name: b.branchName });
                    }
                });
            }
        });
        return branches;
    }, [data?.chartData])

    const getBranchColor = (idx: number, type: 'baseline' | 'addon') => {
        const h = (idx * 137.5) % 360; // Golden angle for distribution
        return type === 'baseline' ? `hsl(${h}, 60%, 45%)` : `hsl(${h}, 40%, 70%)`;
    }

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

    const renderSparkline = (dataKey: 'totalSpent' | 'totalBaseline' | 'totalAddon', color: string) => (
        <div className="h-10 w-full mt-2 opacity-80">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={transformedChartData.slice(-14)}>
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

                <Tabs value={activeTab} onValueChange={(val) => {
                    const params = new URLSearchParams(searchParams.toString())
                    params.set("tab", val)
                    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
                }} className="space-y-6">
                    <TabsList className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-1 rounded-xl">
                        <TabsTrigger value="analytics" className="px-6 py-2 rounded-lg data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all font-bold text-xs uppercase tracking-widest">
                            Budget Analytics
                        </TabsTrigger>
                        <TabsTrigger value="reports" className="px-6 py-2 rounded-lg data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all font-bold text-xs uppercase tracking-widest">
                            Budget Reports
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="analytics" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                        {/* ━━━ KPI BENTO GRID ━━━ */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <Card className="relative overflow-hidden p-5 rounded-2xl border border-teal-200 dark:border-teal-800/50 shadow-sm transition-all hover:shadow-md bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl">
                                <div className="relative z-10">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="p-2 rounded-xl bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400">
                                            <Wallet className="h-4 w-4" />
                                        </div>
                                        <Badge variant="outline" className="border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 text-[10px] uppercase font-bold tracking-wider">Allocated</Badge>
                                    </div>
                                    <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{formatPKR(summary.totalAllocated / 100)}</p>
                                    <div className="h-4" /> {/* Spacer for removed growth indicator */}
                                    <div className="h-10 mt-2 w-full border-b-2 border-dashed border-teal-200 dark:border-teal-800/50" />
                                </div>
                            </Card>

                            <Card className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                                        <ReceiptText className="h-4 w-4" />
                                    </div>
                                    <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider opacity-60">Actual Spent</Badge>
                                </div>
                                <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{formatPKR(summary.totalSpent / 100)}</p>
                                <div className="h-4" /> {/* Spacer for removed growth indicator */}
                                {renderSparkline("totalSpent", "#3b82f6")}
                            </Card>

                            <Card className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-50/50 via-white to-white dark:from-indigo-900/20 dark:via-slate-900 dark:to-slate-900">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
                                        <PiggyBank className="h-4 w-4" />
                                    </div>
                                    <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider opacity-60">Remaining</Badge>
                                </div>
                                <p className={cn(
                                    "text-3xl font-bold mb-1",
                                    summary.totalRemaining < 0 ? "text-rose-500 dark:text-rose-400" : "text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-indigo-500 dark:from-indigo-400 dark:to-indigo-300"
                                )}>
                                    {summary.totalRemaining < 0 ? "-" : "+"}{formatPKR(Math.abs(summary.totalRemaining) / 100)}
                                </p>
                                <p className="text-[10px] font-bold text-slate-400 mt-2 leading-relaxed uppercase tracking-tighter italic">Net Liquidity Asset Projection</p>
                            </Card>
                        </div>

                        {/* ━━━ CENTERPIECE DASHBOARD ━━━ */}
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                            <Card className="xl:col-span-2 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl">
                                <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800/50">
                                    <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase tracking-tight text-slate-800 dark:text-slate-200">
                                        Expenditure Graph (<span className="text-indigo-500 lowercase italic">{granularity}</span>)
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 pt-6">
                                    <div className="h-[350px] w-full">
                                        {transformedChartData.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={transformedChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.1} />
                                                    <XAxis
                                                        dataKey="date"
                                                        axisLine={false}
                                                        tickLine={false}
                                                        tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }}
                                                        dy={10}
                                                    />
                                                    <YAxis
                                                        axisLine={false}
                                                        tickLine={false}
                                                        tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }}
                                                        tickFormatter={(v) => `Rs ${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`}
                                                        dx={-10}
                                                    />
                                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} />
                                                    <Legend 
                                                        verticalAlign="top" 
                                                        align="right" 
                                                        iconType="circle" 
                                                        wrapperStyle={{ fontSize: '10px', paddingBottom: '20px', fontWeight: 'bold' }} 
                                                    />
                                                    {uniqueBranches.map((b, idx) => (
                                                        <React.Fragment key={b.id}>
                                                            <Bar 
                                                                dataKey={`${b.id}_baseline`} 
                                                                stackId="a" 
                                                                fill={getBranchColor(idx, 'baseline')} 
                                                                name={`${b.name} (Base)`} 
                                                                radius={[0, 0, 0, 0]}
                                                            />
                                                            <Bar 
                                                                dataKey={`${b.id}_addon`} 
                                                                stackId="a" 
                                                                fill={getBranchColor(idx, 'addon')} 
                                                                name={`${b.name} (Addon)`} 
                                                                radius={[idx === uniqueBranches.length - 1 ? 4 : 0, idx === uniqueBranches.length - 1 ? 4 : 0, 0, 0]}
                                                            />
                                                        </React.Fragment>
                                                    ))}
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
                                                <ReceiptText className="h-10 w-10 opacity-20" />
                                                <p className="text-sm font-medium italic">No spectral expenditure points detected</p>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="xl:col-span-1 border border-slate-200 dark:border-slate-800 shadow-sm bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl flex flex-col">
                                <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/50">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase tracking-tight text-slate-800 dark:text-slate-200">
                                            <Building2 className="h-4 w-4 text-indigo-500" />
                                            Branch Deployment
                                        </CardTitle>
                                        <Badge variant="secondary" className="text-[9px] font-bold tracking-widest bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 border-none">BY REMAINING</Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0 flex-1 overflow-y-auto h-[350px]">
                                    {branchBreakdown.length > 0 ? (
                                        <div className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                                            {[...branchBreakdown].sort((a, b) => b.remaining - a.remaining).map((b: any) => (
                                                <div key={b.branchId} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors flex items-center justify-between group">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 flex items-center justify-center text-indigo-500 font-black text-xs">
                                                            {b.branchName?.substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tighter">{b.branchName}</p>
                                                              <div className="flex items-center gap-1 mt-0.5">
                                                                <span className="text-[9px] font-bold text-slate-400">SPENT: {formatPKR(b.spent / 100)}</span>
                                                              </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className={cn("text-xs font-black", b.remaining < 0 ? "text-rose-500" : "text-emerald-500")}>
                                                            {b.remaining < 0 ? "-" : "+"}{formatPKR(Math.abs(b.remaining) / 100)}
                                                        </p>
                                                          <p className="text-[8px] font-black text-slate-400 tracking-widest uppercase">Remaining</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="h-full flex items-center justify-center p-8 text-center bg-slate-50/50 dark:bg-slate-900/20">
                                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">No branch metrics</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="reports" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                        {!organizationId ? (
                            <Card className="border-dashed border-2 p-20 flex flex-col items-center justify-center text-center space-y-4 bg-white/50 dark:bg-slate-900/20">
                                <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800">
                                    <Building2 className="h-8 w-8 text-slate-400" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight font-mono">Organization Selection Required</h3>
                                    <p className="text-sm text-slate-500 max-w-sm">Please select an organization from the top filter to generate the detailed budget deployment report.</p>
                                </div>
                            </Card>
                        ) : (
                            <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-lg bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl">
                                <div className="p-6 border-b border-slate-100 dark:border-slate-800/50 flex flex-wrap justify-between items-center gap-4 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900/40 dark:to-slate-900/10">
                                    <div className="space-y-1">
                                        <h3 className="font-black text-sm uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                                            <FileText className="h-4 w-4" />
                                            Budget Deployment Report
                                        </h3>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase">Transaction Audit Period: {startFromUrl ? format(new Date(startFromUrl), 'MMM dd, yyyy') : 'Origin'} — {endFromUrl ? format(new Date(endFromUrl), 'MMM dd, yyyy') : 'Current'}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="relative">
                                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                            <Input
                                                placeholder="Search branch..."
                                                className="pl-10 h-10 w-64 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 font-bold uppercase tracking-tighter"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                            />
                                        </div>
                                        <Button variant="outline" className="h-10 border-slate-200 font-black text-[10px] uppercase tracking-widest gap-2 bg-white dark:bg-slate-950 hover:bg-slate-50 transition-all dark:hover:bg-slate-900 rounded-lg pr-4">
                                            <DownloadIcon className="h-4 w-4" /> Export Report
                                        </Button>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                                            <TableRow className="hover:bg-transparent border-b border-slate-200 dark:border-slate-800">
                                                <TableHead className="pl-6 h-12 text-[10px] font-black uppercase tracking-widest text-slate-500">Branch Identity</TableHead>
                                                <TableHead className="h-12 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Monthly Base</TableHead>
                                                <TableHead className="h-12 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Add-On (Adj)</TableHead>
                                                <TableHead className="h-12 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Spent (Period)</TableHead>
                                                <TableHead className="h-12 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Remaining</TableHead>
                                                <TableHead className="h-12 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center pr-6">Utilization</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody className="font-mono">
                                            {filteredBranches.map((b: any) => {
                                                const addon = Math.max(0, b.allocated - (b.baselineAmount || 0));
                                                const utilization = b.allocated > 0 ? (b.spent / b.allocated) * 100 : 0;
                                                return (
                                                    <TableRow key={b.branchId} className="hover:bg-slate-50/50 dark:hover:bg-indigo-950/10 border-b border-slate-100 dark:border-slate-800/50 transition-colors">
                                                        <TableCell className="pl-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="font-black text-xs text-slate-900 dark:text-slate-100 uppercase tracking-tighter">{b.branchName}</span>
                                                                <span className="text-[9px] text-indigo-500 font-bold uppercase tracking-widest mt-0.5">NET_BRANCH_ID: {b.branchId}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right py-4 font-bold text-xs text-slate-700 dark:text-slate-300">
                                                            {formatPKR(b.baselineAmount / 100)}
                                                        </TableCell>
                                                        <TableCell className="text-right py-4 font-bold text-xs text-indigo-600 dark:text-indigo-400">
                                                            +{formatPKR(addon / 100)}
                                                        </TableCell>
                                                        <TableCell className="text-right py-4 font-bold text-xs text-slate-900 dark:text-white">
                                                            {formatPKR(b.spent / 100)}
                                                        </TableCell>
                                                        <TableCell className="text-right py-4 font-bold text-xs">
                                                            <span className={cn(b.remaining < 0 ? "text-rose-500" : "text-emerald-500")}>
                                                                {b.remaining < 0 ? "-" : "+"}{formatPKR(Math.abs(b.remaining) / 100)}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-center pr-6 py-4">
                                                            <div className="flex flex-col items-center gap-1.5 min-w-[100px]">
                                                                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200/50 dark:border-slate-700/50">
                                                                    <div 
                                                                        className={cn("h-full transition-all duration-500 rounded-full", utilization > 90 ? "bg-rose-500" : utilization > 70 ? "bg-amber-500" : "bg-emerald-500")}
                                                                        style={{ width: `${Math.min(utilization, 100)}%` }}
                                                                    />
                                                                </div>
                                                                <span className={cn("text-[10px] font-black", utilization > 90 ? "text-rose-500" : "text-slate-500")}>{utilization.toFixed(1)}%</span>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </Card>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
}


