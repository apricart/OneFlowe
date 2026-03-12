"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import useSWR from "swr"
import { useAppContext } from "@/components/context/app-context"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    Loader2, RefreshCw, Search, FileText, FileSpreadsheet, FileIcon as FilePdf, Download, Users, Package, CheckCircle, TrendingUp, Filter, UserCircle
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

    const { data: session } = useSession()
    const role = (session?.user as any)?.role as Role
    const [hasMounted, setHasMounted] = useState(false)

    // URL States for filtering
    const presetFromUrl = (searchParams.get("preset") as FilterPreset) || "thisMonth"
    const startFromUrl = searchParams.get("startDate") || ""
    const endFromUrl = searchParams.get("endDate") || ""
    const compareFromUrl = searchParams.get("compare") === "true"

    const [compare, setCompare] = useState(compareFromUrl)

    const activePreset = presetFromUrl
    const dateRange = useMemo(() => {
        if (startFromUrl && endFromUrl) {
            return { startDate: new Date(startFromUrl), endDate: new Date(endFromUrl) }
        }
        return null
    }, [startFromUrl, endFromUrl])

    const handleDateChange = useCallback((range: { startDate: Date; endDate: Date } | null, preset: FilterPreset, compareMode?: boolean) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("preset", preset)
        if (compareMode !== undefined) {
            params.set("compare", String(compareMode))
            setCompare(compareMode)
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
    if (compare) queryParams.set("compare", "true")

    const { data, isLoading, mutate } = useSWR(`/api/v1/analytics/users/performance?${queryParams.toString()}`, fetcher)

    useEffect(() => {
        setHasMounted(true)
        setGeneratedDate(new Date().toLocaleString())
    }, [])

    const usersData = data?.data || []

    const filteredUsers = usersData.filter((u: any) =>
        (u.userName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.userEmail || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.branchName || "").toLowerCase().includes(searchTerm.toLowerCase())
    )

    const totalUsers = usersData.length
    const totalOrders = usersData.reduce((sum: number, u: any) => sum + (Number(u.totalOrders) || 0), 0)
    const totalFulfilled = usersData.reduce((sum: number, u: any) => sum + (Number(u.fulfilledOrders) || 0), 0)
    const totalSpent = usersData.reduce((sum: number, u: any) => sum + (Number(u.totalSpentCents) || 0), 0)

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
        const headers = ["Name", "Email", "Branch", "Total Orders", "Fulfilled", "Refunded", "Total Spent"]
        const rows = filteredUsers.map((u: any) => [
            u.userName, u.userEmail, u.branchName || 'N/A', u.totalOrders, u.fulfilledOrders, u.refundedOrders,
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
                />
                {(role === "SUPER_ADMIN" || role === "HEAD_OFFICE") && (
                    <BranchFilter
                        selectedIds={contextBranchIds}
                        onChange={handleBranchChange}
                        organizationId={organizationId || undefined}
                    />
                )}
                <div className="flex-1" />
                <ScheduleReportModal reportName="User Report" />
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
                                {usersTrend && (
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
                                {ordersTrend && (
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
                                {successTrend && (
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
                                {spentTrend && (
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
                                    <TableHead className="pl-6 h-12 text-[11px] font-bold uppercase text-slate-500">User Identity</TableHead>
                                    <TableHead className="h-12 text-[11px] font-bold uppercase text-slate-500">Email Address</TableHead>
                                    <TableHead className="h-12 text-[11px] font-bold uppercase text-slate-500">Branch Assignment</TableHead>
                                    <TableHead className="h-12 text-[11px] font-bold uppercase text-slate-500 text-center">Total Orders</TableHead>
                                    <TableHead className="h-12 text-[11px] font-bold uppercase text-slate-500 text-center">Fulfilled</TableHead>
                                    <TableHead className="h-12 text-[11px] font-bold uppercase text-slate-500 text-center">Refunded</TableHead>
                                    <TableHead className="text-right pr-6 h-12 text-[11px] font-bold uppercase text-slate-500">Total Spent</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={7} className="h-40 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-500 opacity-50" /></TableCell></TableRow>
                                ) : filteredUsers.length === 0 ? (
                                    <TableRow><TableCell colSpan={7} className="h-40 text-center text-slate-500 italic">No user activity recorded in this period.</TableCell></TableRow>
                                ) : (
                                    filteredUsers.map((u: any) => (
                                        <TableRow key={u.userId} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                                            <TableCell className="pl-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                                                        <UserCircle className="h-5 w-5" />
                                                    </div>
                                                    <span className="font-semibold text-xs text-slate-900 dark:text-white capitalize">{u.userName || "Anonymous"}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs text-slate-500 dark:text-slate-400 font-mono">{u.userEmail}</TableCell>
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
