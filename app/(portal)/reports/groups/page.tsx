"use client"

import { useState, useEffect, useCallback, useMemo, Fragment } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import useSWR from "swr"
import { useAppContext } from "@/components/context/app-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    Loader2, RefreshCw, Search, FileText, FileSpreadsheet, FileIcon as FilePdf, Download, FolderTree, ShoppingBag, TrendingUp, ChevronDown, ChevronRight, Layers, LayoutGrid
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

import { KPICard } from "@/components/reports/kpi-card"
import { SalesPerformanceLineChart } from "@/components/dashboard/charts"
import { useSalesPerformance } from "@/lib/hooks/use-sales-performance"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface Branch {
    id: number
    name: string
    orders: number
    revenue: number
    refunds: number
    rejected: number
}

interface Group {
    id: number
    name: string
    organizationId: number
    organizationName: string
    branchCount: number
    totalOrders: number
    totalAmountCents: number
    totalRefundCents: number
    rejectedOrders: number
    branches: Branch[]
}

export default function GroupsReportPage() {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const { organizationId } = useAppContext()
    const [searchTerm, setSearchTerm] = useState("")
    const [generatedDate, setGeneratedDate] = useState("")
    const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set())

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

    const queryParams = new URLSearchParams()
    if (organizationId) queryParams.set("organizationId", organizationId.toString())
    if (startFromUrl) queryParams.set("startDate", startFromUrl)
    if (endFromUrl) queryParams.set("endDate", endFromUrl)
    if (compare) {
        queryParams.set("compare", "true")
        if (compareRange) {
            queryParams.set("compareStartDate", compareRange.startDate.toISOString())
            queryParams.set("compareEndDate", compareRange.endDate.toISOString())
        }
    }

    const { data, isLoading, mutate } = useSWR(`/api/v1/analytics/groups?${queryParams.toString()}`, fetcher)

    // Sales performance chart data
    const { data: perfData, isLoading: isLoadingPerf } = useSalesPerformance(
        organizationId || undefined,
        undefined,
        undefined,
        undefined,
        dateRange,
        "all",
        compare,
        compareRange
    )

    useEffect(() => {
        setHasMounted(true)
        setGeneratedDate(new Date().toLocaleString())
    }, [])

    const groups: Group[] = data?.groups || []
    const summary = data?.summary || { totalGroups: 0, totalOrders: 0, totalRevenue: 0 }
    const comparison = data?.comparison

    const getTrendPercentage = (current: number, prev: number) => {
        if (!prev || prev === 0) return undefined
        return ((current - prev) / prev) * 100
    }

    const orderTrend = getTrendPercentage(summary.totalOrders, comparison?.totalOrders || 0)
    const revenueTrend = getTrendPercentage(summary.totalRevenue, comparison?.totalRevenue || 0)
    const groupsTrend = getTrendPercentage(summary.totalGroups, comparison?.totalGroups || 0)

    const filteredGroups = groups.filter((group) =>
        group.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        group.organizationName?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const toggleGroupExpansion = (groupId: number) => {
        setExpandedGroups((prev) => {
            const newSet = new Set(prev)
            if (newSet.has(groupId)) newSet.delete(groupId)
            else newSet.add(groupId)
            return newSet
        })
    }

    const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
        const headers = ["Group Name", "Units", "Total Orders", "Total Spent"]
        const rows = filteredGroups.map((group) => [
            group.name, group.branchCount, group.totalOrders, (group.totalAmountCents / 100).toFixed(2)
        ])

        if (format === 'pdf') {
            const doc = new jsPDF()
            doc.setFontSize(20); doc.text("Group Performance Ledger", 14, 20)
            doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28)
            autoTable(doc, { startY: 40, head: [headers], body: rows, theme: 'grid' })
            doc.save(`group-report-${new Date().getTime()}.pdf`)
            return
        }

        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Groups")
        XLSX.writeFile(workbook, `group-report-${new Date().getTime()}.${format === 'excel' ? 'xlsx' : 'csv'}`)
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
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#4338ca] via-[#3730a3] to-[#312e81] px-6 py-8 text-white shadow-xl ring-1 ring-indigo-500/30">
                    <div className="flex flex-col gap-2 relative z-10">
                        <p className="text-xs tracking-[0.3em] text-indigo-200 font-bold uppercase">Branch Cluster Summary</p>
                        <h1 className="text-4xl font-bold tracking-tight">Organization Groups</h1>
                        <p className="text-sm text-indigo-100/80 font-medium max-w-xl">
                            Cluster-level performance breakdown of <strong>{groups.length}</strong> identified organization groups and their constituent units.
                        </p>
                    </div>
                    <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
                </div>

                {/* ━━━ KPI BENTO GRID ━━━ */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <KPICard
                        title="Total Groups"
                        value={summary.totalGroups}
                        icon={FolderTree}
                        colorScheme="blue"
                        trend={groupsTrend}
                        comparisonValue={compare && comparison ? comparison.totalGroups : undefined}
                        comparisonLabel="Prev"
                    />
                    <KPICard
                        title="Clustered Orders"
                        value={summary.totalOrders}
                        icon={ShoppingBag}
                        colorScheme="violet"
                        trend={orderTrend}
                        comparisonValue={compare && comparison ? comparison.totalOrders : undefined}
                        comparisonLabel="Prev"
                    />
                    <KPICard
                        title="Group Revenue"
                        value={formatPKR(summary.totalRevenue / 100)}
                        icon={TrendingUp}
                        colorScheme="emerald"
                        trend={revenueTrend}
                        comparisonValue={compare && comparison ? formatPKR(comparison.totalRevenue / 100) : undefined}
                        comparisonLabel="Prev"
                    />
                </div>

                {/* ━━━ PERFORMANCE ANALYTICS CHART ━━━ */}
                <Card className="rounded-[24px] border border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
                    <CardHeader className="px-8 py-6 border-b border-slate-100 dark:border-slate-800">
                        <CardTitle className="text-lg font-black tracking-tight text-slate-800 dark:text-slate-100 flex items-center gap-3">
                            <TrendingUp className="w-5 h-5 text-indigo-500" />
                            Group Performance Analytics
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

                {/* ━━━ REFINED HIERARCHICAL TABLE ━━━ */}
                <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900/50 backdrop-blur-xl pt-1">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap justify-between items-center gap-4 bg-white/50 dark:bg-slate-900/20">
                        <div className="flex items-center gap-3">
                            <LayoutGrid className="h-4 w-4 text-indigo-600" />
                            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">Group Performance Ledgers</h3>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                <Input
                                    placeholder="Search groups..."
                                    className="pl-9 h-8 w-48 text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-md"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-8 text-[11px] font-bold gap-2 rounded-md border-slate-200 dark:border-slate-800 shadow-sm">
                                        <Download className="h-3.5 w-3.5" /> EXPORT
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40 rounded-xl">
                                    <DropdownMenuItem onClick={() => handleExport('csv')} className="text-xs py-2 cursor-pointer">CSV</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleExport('excel')} className="text-xs py-2 cursor-pointer">Excel</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleExport('pdf')} className="text-xs py-2 cursor-pointer">PDF</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50/50 dark:bg-slate-800/30">
                                    <TableHead className="w-10 pl-6 h-10"></TableHead>
                                    <TableHead className="h-10 text-[10px] font-bold uppercase text-slate-500">Group Name</TableHead>
                                    <TableHead className="h-10 text-[10px] font-bold uppercase text-slate-500 text-center">Units</TableHead>
                                    <TableHead className="h-10 text-[10px] font-bold uppercase text-slate-500 text-right">Orders</TableHead>
                                    <TableHead className="h-10 text-[10px] font-bold uppercase text-slate-500 text-right text-rose-500">Refunds</TableHead>
                                    <TableHead className="h-10 text-[10px] font-bold uppercase text-slate-500 text-right text-amber-500">Rejected</TableHead>
                                    <TableHead className="text-right pr-6 h-10 text-[10px] font-bold uppercase text-indigo-600">Net Revenue</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={7} className="h-40 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-500/40" /></TableCell></TableRow>
                                ) : filteredGroups.length === 0 ? (
                                    <TableRow><TableCell colSpan={7} className="h-40 text-center text-slate-500 text-sm">No group clusters found in this period.</TableCell></TableRow>
                                ) : (
                                    filteredGroups.map((group) => {
                                        const isExpanded = expandedGroups.has(group.id)
                                        const hasBranches = group.branches && group.branches.length > 0
                                        return (
                                            <Fragment key={group.id}>
                                                <TableRow
                                                    className={cn(
                                                        "group transition-colors border-b border-slate-100 dark:border-slate-800 cursor-pointer",
                                                        isExpanded ? "bg-indigo-50/20" : "hover:bg-slate-50/80 dark:hover:bg-slate-800/20"
                                                    )}
                                                    onClick={() => hasBranches && toggleGroupExpansion(group.id)}
                                                >
                                                    <TableCell className="pl-6">
                                                        {hasBranches && (
                                                            isExpanded ? <ChevronDown className="h-4 w-4 text-indigo-500" /> : <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-400" />
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="py-4">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-sm text-slate-900 dark:text-white capitalize">{group.name}</span>
                                                            <span className="text-[10px] text-slate-400 font-medium tracking-tight uppercase">{group.organizationName}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge variant="secondary" className="bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 text-[10px] font-bold border-none">
                                                            {group.branchCount} MEMBER{group.branchCount !== 1 ? 'S' : ''}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">{group.totalOrders.toLocaleString()}</TableCell>
                                                    <TableCell className="text-right font-mono text-xs text-rose-500">{formatPKR(group.totalRefundCents / 100)}</TableCell>
                                                    <TableCell className="text-right font-mono text-xs text-amber-500">{group.rejectedOrders}</TableCell>
                                                    <TableCell className="text-right pr-6 font-mono font-bold text-sm text-indigo-600 dark:text-indigo-400">
                                                        {formatPKR(group.totalAmountCents / 100)}
                                                    </TableCell>
                                                </TableRow>
                                                {isExpanded && hasBranches && (
                                                    group.branches.map((branch) => (
                                                        <TableRow key={`${group.id}-${branch.id}`} className="bg-slate-50/40 dark:bg-slate-900/40 border-b border-slate-50 dark:border-slate-800/50">
                                                            <TableCell></TableCell>
                                                            <TableCell className="pl-8 py-3">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-200 dark:bg-indigo-800 ring-2 ring-indigo-50 dark:ring-indigo-900/30" />
                                                                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{branch.name}</span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-center text-[9px] text-slate-400 uppercase font-black tracking-tighter">Branch Unit</TableCell>
                                                            <TableCell className="text-right font-mono text-[11px] text-slate-400">{branch.orders}</TableCell>
                                                            <TableCell className="text-right font-mono text-[11px] text-rose-400/60">{formatPKR(branch.refunds / 100)}</TableCell>
                                                            <TableCell className="text-right font-mono text-[11px] text-amber-500/50">{branch.rejected}</TableCell>
                                                            <TableCell className="text-right pr-6 font-mono font-medium text-xs text-indigo-400/80">{formatPKR(branch.revenue / 100)}</TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </Fragment>
                                        )
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="p-4 bg-slate-50/50 dark:bg-slate-900/20 text-center border-t border-slate-100 dark:border-slate-800">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Report State Validated at {generatedDate}</p>
                    </div>
                </Card>
            </div>
        </div>
    )
}
