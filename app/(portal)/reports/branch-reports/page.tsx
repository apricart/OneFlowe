"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import useSWR from "swr"
import { useAppContext } from "@/components/context/app-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    Loader2, Building2, TrendingUp, Search, Download, FileText, FileSpreadsheet, FileIcon as FilePdf, RefreshCw, Trophy, Crown, BarChart3, Calculator, ChevronDown
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
import { GroupFilter } from "@/components/reports/group-filter"

import { KPICard } from "@/components/reports/kpi-card"
import { SalesPerformanceLineChart } from "@/components/dashboard/charts"
import { useSalesPerformance } from "@/lib/hooks/use-sales-performance"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function BranchReportsPage() {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const {
        organizationId,
        setBranchIds: setContextBranchIds
    } = useAppContext()

    const [searchTerm, setSearchTerm] = useState("")
    const [generatedDate, setGeneratedDate] = useState("")
    const [groupIds, setGroupIds] = useState<string[]>([])
    const [selectedMonths, setSelectedMonths] = useState<number[]>([new Date().getMonth()])
    const [selectedYears, setSelectedYears] = useState<number[]>([new Date().getFullYear()])
    const [compareMonths, setCompareMonths] = useState<number[]>([])
    const [compareYears, setCompareYears] = useState<number[]>([])

    const [compare, setCompare] = useState(false)
    const [compareRange, setCompareRange] = useState<{ startDate: Date; endDate: Date } | null>(null)

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

    const handleDateChange = useCallback((
        range: { startDate: Date; endDate: Date } | null, 
        preset: FilterPreset, 
        compareMode?: boolean, 
        compRange?: { startDate: Date; endDate: Date } | null,
        months?: number[],
        years?: number[],
        cMonths?: number[],
        cYears?: number[]
    ) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("preset", preset)
        if (compareMode !== undefined) setCompare(compareMode)
        if (compRange !== undefined) setCompareRange(compRange)
        if (months) setSelectedMonths(months)
        if (years) setSelectedYears(years)
        if (cMonths) setCompareMonths(cMonths)
        if (cYears) setCompareYears(cYears)
        
        if (range) {
            params.set("startDate", range.startDate.toISOString())
            params.set("endDate", range.endDate.toISOString())
        } else {
            params.delete("startDate")
            params.delete("endDate")
        }
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }, [searchParams, pathname, router])

    const queryParams = new URLSearchParams()
    if (organizationId) queryParams.set("organizationId", organizationId.toString())
    if (startFromUrl) queryParams.set("startDate", startFromUrl)
    if (endFromUrl) queryParams.set("endDate", endFromUrl)
    if (selectedMonths.length > 0) queryParams.set("months", selectedMonths.join(","))
    if (selectedYears.length > 0) queryParams.set("years", selectedYears.join(","))

    if (compare) {
        queryParams.set("compare", "true")
        if (compareRange) {
            queryParams.set("compareStartDate", compareRange.startDate.toISOString())
            queryParams.set("compareEndDate", compareRange.endDate.toISOString())
        }
        if (compareMonths.length > 0) queryParams.set("compareMonths", compareMonths.join(","))
        if (compareYears.length > 0) queryParams.set("compareYears", compareYears.join(","))
    }

    if (groupIds.length > 0) queryParams.set("groupIds", groupIds.join(","))
    queryParams.set("limit", "10000")

    const { data, isLoading, mutate } = useSWR(`/api/v1/analytics/summary?${queryParams.toString()}`, fetcher)

    // Sales performance chart data
    const { data: perfData, isLoading: isLoadingPerf } = useSalesPerformance(
        organizationId || undefined,
        undefined,
        undefined,
        groupIds.length > 0 ? groupIds.join(",") : undefined,
        dateRange,
        "all",
        compare,
        compareRange,
        undefined,
        undefined,
        undefined,
        undefined,
        activePreset === "all" ? "yearly" : "daily"
    )

    useEffect(() => {
        setHasMounted(true)
        setGeneratedDate(new Date().toLocaleString())
    }, [])

    const handleGroupChange = (ids: string[]) => {
        setGroupIds(ids)
    }

    const topPerformers = data?.topPerformers || []
    const summary = data?.summary || { totalSales: 0, orderCount: 0 }

    const filteredBranches = topPerformers.filter((p: any) =>
        (p.branchName || "").toLowerCase().includes(searchTerm.toLowerCase())
    )

    const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
        const headers = ["Rank", "Branch", "Group", "Orders", "Fulfilled", "Revenue"]
        const rows = filteredBranches.map((p: any, i: number) => [
            `#${i + 1}`, p.branchName, p.groupName || "-", p.orderCount, p.fulfilledCount, (p.sales / 100).toFixed(2)
        ])

        if (format === 'pdf') {
            const doc = new jsPDF()
            doc.setFontSize(20); doc.text("Branch Performance Ledger", 14, 20)
            doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28)
            autoTable(doc, { startY: 40, head: [headers], body: rows, theme: 'grid' })
            doc.save(`branch-performance-${new Date().getTime()}.pdf`)
            return
        }

        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Branches")
        XLSX.writeFile(workbook, `branch-performance-${new Date().getTime()}.${format === 'excel' ? 'xlsx' : 'csv'}`)
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
                    <GroupFilter
                        selectedIds={groupIds}
                        onChange={handleGroupChange}
                        organizationId={organizationId || undefined}
                    />
                )}
                <div className="flex-1" />
                
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => mutate()}
                    disabled={isLoading}
                    className="h-9 text-[12px] font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-full px-4"
                >
                    <RefreshCw className={`h-3.5 w-3.5 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                    REFRESH
                </Button>
            </div>

            <div className="px-4 md:px-6 space-y-5">

                {/* ━━━ "INTELLIGENCE" HEADER ━━━ */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#064e3b] via-[#065f46] to-[#047857] px-6 py-8 text-white shadow-xl ring-1 ring-emerald-500/30">
                    <div className="flex flex-col gap-2 relative z-10">
                        <p className="text-xs tracking-[0.3em] text-emerald-200 font-bold uppercase">Multi-Unit Surveillance</p>
                        <h1 className="text-4xl font-bold tracking-tight">Branch Performance</h1>
                        <p className="text-sm text-emerald-100/80 font-medium max-w-xl">
                            Comparative analysis of branch output, fulfillment efficiency, and market share across <strong>{topPerformers.length}</strong> active units.
                        </p>
                    </div>
                    <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
                </div>

                {/* ━━━ KPI BENTO GRID ━━━ */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <KPICard
                        title="Top Performer"
                        value={topPerformers[0]?.branchName || "N/A"}
                        icon={Trophy}
                        colorScheme="amber"
                        subtitle="Highest revenue branch"
                    />
                    <KPICard
                        title="Total Units"
                        value={topPerformers.length}
                        icon={Building2}
                        colorScheme="blue"
                    />
                    <KPICard
                        title="Network Revenue"
                        value={formatPKR(summary.totalSales / 100)}
                        icon={TrendingUp}
                        colorScheme="emerald"
                    />
                    <KPICard
                        title="Avg Order Value"
                        value={formatPKR(summary.orderCount > 0 ? (summary.totalSales / summary.orderCount) / 100 : 0)}
                        icon={BarChart3}
                        colorScheme="indigo"
                    />
                </div>

                {/* ━━━ PERFORMANCE ANALYTICS CHART ━━━ */}
                <Card className="rounded-[24px] border border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
                    <CardHeader className="px-8 py-6 border-b border-slate-100 dark:border-slate-800">
                        <CardTitle className="text-lg font-black tracking-tight text-slate-800 dark:text-slate-100 flex items-center gap-3">
                            <TrendingUp className="w-5 h-5 text-emerald-500" />
                            Performance Analytics
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8">
                        {isLoadingPerf ? (
                            <div className="h-[300px] flex items-center justify-center">
                                <RefreshCw className="w-8 h-8 animate-spin text-slate-200" />
                            </div>
                        ) : (
                            <SalesPerformanceLineChart
                                seriesData={perfData?.seriesData ?? []}
                                comparisonSeries={perfData?.comparison?.seriesData}
                                totalSales={perfData?.totalSales ?? 0}
                                avgSales={perfData?.avgSales ?? 0}
                                totalOrders={perfData?.totalOrders ?? 0}
                                peakPeriod={perfData?.peakPeriod ?? null}
                                granularity={perfData?.granularity ?? "daily"}
                                dateRange={dateRange}
                            />
                        )}
                    </CardContent>
                </Card>

                {/* ━━━ REFINED TABLE ━━━ */}
                <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900/50 backdrop-blur-xl">
                    <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap justify-between items-center gap-4">
                        <div className="flex items-center gap-3">
                            <h3 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-wider">Performance Rankings</h3>
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <Input
                                    placeholder="Search branches..."
                                    className="pl-9 h-10 w-64 text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-10 text-xs font-bold gap-2 rounded-lg border-slate-200 dark:border-slate-800">
                                    <Download className="h-4 w-4" />
                                    EXPORT
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-xl">
                                <DropdownMenuItem onClick={() => handleExport('csv')} className="text-xs py-2.5 cursor-pointer">
                                    <FileText className="mr-2 h-4 w-4" /> CSV
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
                                    <TableHead className="pl-6 h-12 text-[10px] font-bold uppercase tracking-widest text-slate-500">Unit Name</TableHead>
                                    <TableHead className="h-12 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-right">{compare ? "Orders (A/B)" : "Orders"}</TableHead>
                                    <TableHead className="h-12 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-right">{compare ? "Fulfilled (A/B)" : "Fulfilled"}</TableHead>
                                    <TableHead className="h-12 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-right">{compare ? "Rejected (A/B)" : "Rejected"}</TableHead>
                                    <TableHead className="h-12 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-right">{compare ? "Refunded (A/B)" : "Refunded"}</TableHead>
                                    <TableHead className="text-right pr-6 h-12 text-[10px] font-bold uppercase tracking-widest text-slate-500">{compare ? "Net Rev (A/B)" : "Net Revenue"}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={6} className="h-40 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-500/50" /></TableCell></TableRow>
                                ) : filteredBranches.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="h-40 text-center text-slate-500">No matching branches found.</TableCell></TableRow>
                                ) : (
                                    filteredBranches.map((p: any, index: number) => {
                                        const marketShare = summary.totalSales > 0 ? (p.sales / summary.totalSales) * 100 : 0
                                        return (
                                            <TableRow key={p.branchId} className="group hover:bg-emerald-50/20 transition-colors">
                                                <TableCell className="pl-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn(
                                                            "h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold border",
                                                            index === 0 ? "bg-amber-100 border-amber-200 text-amber-700 shadow-sm" :
                                                                index === 1 ? "bg-slate-100 border-slate-200 text-slate-700" :
                                                                    index === 2 ? "bg-orange-100 border-orange-200 text-orange-700" :
                                                                        "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400"
                                                        )}>
                                                            {index === 0 ? <Crown className="h-3.5 w-3.5" /> : index + 1}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-xs text-slate-900 dark:text-white">{p.branchName}</span>
                                                            <span className="text-[10px] text-slate-400 font-medium lowercase tracking-tighter">{p.groupName || "no category"}</span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-xs font-medium text-slate-500 py-4">
                                                    <div className="flex flex-col items-end">
                                                        <span>{p.orderCount.toLocaleString()}</span>
                                                        {compare && <span className="text-[10px] text-slate-400 mt-0.5">{p.compareOrderCount || 0}</span>}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right py-4">
                                                    <div className="flex flex-col items-end">
                                                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[10px] font-bold h-5">
                                                            {p.fulfilledCount || 0}
                                                        </Badge>
                                                        {compare && <span className="text-[9px] text-slate-400 mt-0.5">{p.compareFulfilledCount || 0}</span>}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right py-4">
                                                    <div className="flex flex-col items-end">
                                                        <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-100 text-[10px] font-bold h-5">
                                                            {p.rejectedCount || 0}
                                                        </Badge>
                                                        {compare && <span className="text-[9px] text-slate-400 mt-0.5">{p.compareRejectedCount || 0}</span>}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right py-4">
                                                    <div className="flex flex-col items-end">
                                                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-100 text-[10px] font-bold h-5">
                                                            {p.refundedCount || 0}
                                                        </Badge>
                                                        {compare && <span className="text-[9px] text-slate-400 mt-0.5">{p.compareRefundedCount || 0}</span>}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right pr-6 font-mono font-bold text-xs text-slate-900 dark:text-white py-4">
                                                    <div className="flex flex-col items-end">
                                                        <div className="flex flex-col items-end">
                                                            <span>{formatPKR(p.sales / 100)}</span>
                                                            {compare && <span className="text-[10px] text-slate-400 border-t border-slate-100 mt-0.5 pt-0.5">{formatPKR(p.compareSales / 100)}</span>}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 mt-1">
                                                            <div className="w-12 h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                                                <div className="h-full bg-emerald-500" style={{ width: `${marketShare}%` }} />
                                                            </div>
                                                            <span className="text-[9px] text-slate-400 uppercase font-black">{marketShare.toFixed(1)}%</span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="p-4 bg-slate-50/50 dark:bg-slate-900/20 text-center border-t border-slate-100 dark:border-slate-800">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Ledger State Finalized at {generatedDate}</p>
                    </div>
                </Card>
            </div>
        </div>
    )
}
