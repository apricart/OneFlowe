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
import { DateRange } from "@/lib/hooks/use-sales-performance"
import { startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns"
import { Building2, Users, TrendingUp, RefreshCw, CheckCircle2, RotateCcw, BarChart3, ListOrdered } from "lucide-react"
import { useOrganizations } from "@/lib/hooks/use-api"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

import { 
    ResponsiveContainer, 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    Legend, 
    Cell 
} from "recharts"
import { BranchFilter } from "@/components/reports/branch-filter"

const getDefaultDateRange = (): DateRange => ({
    startDate: startOfMonth(new Date()),
    endDate: endOfMonth(new Date()),
})

export default function OrganizationReportPage() {
    const [dateRange, setDateRange] = useState<DateRange | null>(getDefaultDateRange())
    const [activePreset, setActivePreset] = useState<FilterPreset>("thisMonth")
    const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>([])
    const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([])
    const [statusFilter, setStatusFilter] = useState<string>("all")
    const [compare, setCompare] = useState(false)
    const [compareRange, setCompareRange] = useState<DateRange | null>(null)

    // Multi-select month/year states
    const [selectedMonths, setSelectedMonths] = useState<number[]>([])
    const [selectedYears, setSelectedYears] = useState<number[]>([])
    const [compareMonths, setCompareMonths] = useState<number[]>([])
    const [compareYears, setCompareYears] = useState<number[]>([])

    const { data: orgsData } = useOrganizations()
    
    // Construct API URL
    const apiUrl = useMemo(() => {
        const params = new URLSearchParams()
        if (dateRange) {
            params.set("startDate", dateRange.startDate.toISOString())
            params.set("endDate", dateRange.endDate.toISOString())
        }
        if (selectedOrgIds.length > 0) params.set("organizationIds", selectedOrgIds.join(","))
        if (selectedBranchIds.length > 0) params.set("branchIds", selectedBranchIds.join(","))
        if (statusFilter !== "all") params.set("status", statusFilter)

        if (selectedMonths.length > 0) params.set("months", selectedMonths.join(","))
        if (selectedYears.length > 0) params.set("years", selectedYears.join(","))
        if (compareMonths.length > 0) params.set("compareMonths", compareMonths.join(","))
        if (compareYears.length > 0) params.set("compareYears", compareYears.join(","))

        if (compare) {
            params.set("compare", "true")
            if (compareRange) {
                params.set("compareStartDate", compareRange.startDate.toISOString())
                params.set("compareEndDate", compareRange.endDate.toISOString())
            }
        }
        return `/api/v1/analytics/organization-stats?${params.toString()}`
    }, [dateRange, selectedOrgIds, selectedBranchIds, statusFilter, compare, compareRange, selectedMonths, selectedYears, compareMonths, compareYears])


    const { data, isLoading } = useSWR<any>(apiUrl, fetcher)
    const stats = data?.items || []
    const trendData = data?.trend || []
    const comparisonTrend = data?.comparisonTrend || []

    const totals = useMemo(() => {
        return stats.reduce((acc: any, curr: any) => ({
            revenue: acc.revenue + curr.revenue,
            orders: acc.orders + curr.orderCount,
            users: acc.users + curr.totalUserCount,
            orgs: acc.orgs + 1
        }), { revenue: 0, orders: 0, users: 0, orgs: 0 })
    }, [stats])

    const getTrend = (current: number, prev: number) => {
        if (!prev || prev === 0) return null
        const diff = ((current - prev) / prev) * 100
        return {
            value: Math.abs(diff).toFixed(1),
            isUp: diff > 0,
            isDown: diff < 0
        }
    }

    return (
        <div className="p-6 space-y-6 bg-slate-50/50 min-h-screen dark:bg-slate-950">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                <div className="space-y-1.5">
                    <h1 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white flex items-center gap-3">
                        <Building2 className="w-8 h-8 text-indigo-600" />
                        Organization Report
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-bold text-sm ml-1">Performance insights across all registered companies</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 bg-white/50 dark:bg-slate-900/50 p-2 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md shadow-sm">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[140px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl font-bold text-xs h-10 shadow-sm">
                            <SelectValue placeholder="Branch Status" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="active">Active Only</SelectItem>
                            <SelectItem value="inactive">Inactive Only</SelectItem>
                        </SelectContent>
                    </Select>

                    <BranchFilter 
                        selectedIds={selectedBranchIds} 
                        onChange={setSelectedBranchIds} 
                        organizationId={selectedOrgIds.length === 1 ? selectedOrgIds[0] : undefined}
                    />

                    <GlobalDateFilter 
                        value={dateRange} 
                        activePreset={activePreset} 
                        compare={compare}
                        compareRange={compareRange}
                        months={selectedMonths}
                        years={selectedYears}
                        compareMonths={compareMonths}
                        compareYears={compareYears}
                        onChange={(r, p, c, cr, m, y, cm, cy) => { 
                            setDateRange(r); 
                            setActivePreset(p);
                            if (c !== undefined) setCompare(c);
                            if (cr !== undefined) setCompareRange(cr);
                            if (m !== undefined) setSelectedMonths(m);
                            if (y !== undefined) setSelectedYears(y);
                            if (cm !== undefined) setCompareMonths(cm);
                            if (cy !== undefined) setCompareYears(cy);
                        }} 
                    />
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="rounded-2xl border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
                                <TrendingUp className="w-6 h-6 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Revenue</p>
                                <p className="text-2xl font-black text-slate-900 dark:text-white">{formatPKR(totals.revenue)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
                                <BarChart3 className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Orders</p>
                                <p className="text-2xl font-black text-slate-900 dark:text-white">{totals.orders.toLocaleString()}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center">
                                <Users className="w-6 h-6 text-indigo-600" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Users</p>
                                <p className="text-2xl font-black text-slate-900 dark:text-white">{totals.users.toLocaleString()}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                <Building2 className="w-6 h-6 text-slate-600" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Companies</p>
                                <p className="text-2xl font-black text-slate-900 dark:text-white">{totals.orgs}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Analytics Chart */}
            <Card className="rounded-[24px] border border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
                <CardHeader className="px-8 py-6 border-b border-slate-100 dark:border-slate-800">
                    <CardTitle className="text-lg font-black tracking-tight text-slate-800 dark:text-slate-100 flex items-center gap-3">
                        <TrendingUp className="w-5 h-5 text-emerald-500" />
                        Performance Analytics
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                    {isLoading ? (
                        <div className="h-[350px] flex items-center justify-center">
                            <RefreshCw className="w-8 h-8 animate-spin text-slate-200" />
                        </div>
                    ) : (
                        <div className="h-[350px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={trendData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                    <XAxis 
                                        dataKey="period" 
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 700 }}
                                        dy={10}
                                    />
                                    <YAxis 
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 700 }}
                                        tickFormatter={(val) => `Rs ${val >= 1000 ? (val/1000).toFixed(0)+'k' : val}`}
                                    />
                                    <Tooltip 
                                        cursor={{ fill: '#F1F5F9', radius: 4 }}
                                        content={({ active, payload, label }) => {
                                            if (active && payload && payload.length) {
                                                return (
                                                    <div className="bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 shadow-xl rounded-2xl">
                                                        <p className="text-[10px] font-black uppercase text-slate-400 mb-2">{label}</p>
                                                        <div className="space-y-1">
                                                            <div className="flex items-center justify-between gap-8">
                                                                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Revenue</span>
                                                                <span className="text-xs font-black text-slate-900 dark:text-white">{formatPKR(payload[0].value as number)}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between gap-8">
                                                                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Orders</span>
                                                                <span className="text-xs font-black text-indigo-600">{(payload[0].payload as any).orders}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            }
                                            return null
                                        }}
                                    />
                                    <Bar 
                                        dataKey="revenue" 
                                        fill="#6366F1"
                                        radius={[4, 4, 0, 0]} 
                                        barSize={trendData.length > 20 ? 10 : 30}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="border-none shadow-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[2rem] overflow-hidden transition-all duration-500 hover:shadow-indigo-500/5">
                <CardHeader className="px-8 pt-8 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <CardTitle className="flex items-center gap-3 text-slate-900 dark:text-white font-black tracking-tight">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                            <ListOrdered className="w-5 h-5 text-indigo-600" />
                        </div>
                        Organization Performance Table
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
                                    <TableHead className="font-black text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 h-14 pl-8">Organization</TableHead>
                                    <TableHead className="font-black text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 h-14 text-center">Branches (Act/Ina)</TableHead>
                                    <TableHead className="font-black text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 h-14 text-center">Users (Total)</TableHead>
                                    <TableHead className="font-black text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 h-14 text-right">Revenue</TableHead>
                                    <TableHead className="font-black text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 h-14 text-right">Orders</TableHead>
                                    <TableHead className="font-black text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 h-14 text-center px-8">Fulf / Ref</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array(5).fill(0).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell colSpan={6} className="h-20 animate-pulse bg-slate-50/50 dark:bg-slate-900/50" />
                                        </TableRow>
                                    ))
                                ) : stats.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-40 text-center text-slate-400 font-bold italic">
                                            No organization data found for this period.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    stats.map((org: any) => (
                                        <TableRow key={org.organizationId} className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 transition-all duration-200 h-20">
                                            <TableCell className="pl-8">
                                                <div className="flex flex-col">
                                                    <span className="text-[13px] font-black text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{org.organizationName}</span>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Org ID: #{org.organizationId}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex items-center justify-center gap-3">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[12px] font-black text-emerald-600">{org.activeBranchCount}</span>
                                                        <span className="text-[8px] font-black text-slate-400 uppercase">Active</span>
                                                    </div>
                                                    <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-700" />
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[12px] font-black text-slate-400">{org.inactiveBranchCount}</span>
                                                        <span className="text-[8px] font-black text-slate-400 uppercase">Inactive</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                                                    <Users className="w-3.5 h-3.5 text-indigo-500" />
                                                    <span className="text-[12px] font-black text-slate-900 dark:text-white">{org.totalUserCount}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-black text-slate-900 dark:text-white">
                                                <div className="flex flex-col items-end">
                                                    <span>{formatPKR(org.revenue)}</span>
                                                    {compare && <span className="text-[10px] text-slate-400 border-t border-slate-100 mt-0.5 font-normal">{formatPKR(org.comparison?.revenue || 0)}</span>}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-black text-slate-900 dark:text-white">
                                                <div className="flex flex-col items-end">
                                                    <span>{org.orderCount}</span>
                                                    {compare && <span className="text-[10px] text-slate-400 border-t border-slate-100 mt-0.5 font-normal">{org.comparison?.orderCount || 0}</span>}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center px-8">
                                                <div className="flex items-center justify-center gap-6">
                                                    <div className="flex flex-col items-center">
                                                        <div className="flex items-center gap-1 text-emerald-600">
                                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                                            <span className="text-[12px] font-black">{org.fulfilledCount}</span>
                                                        </div>
                                                        <span className="text-[8px] font-black text-slate-400 uppercase">Fulf</span>
                                                    </div>
                                                    <div className="flex flex-col items-center">
                                                        <div className="flex items-center gap-1 text-orange-500">
                                                            <RotateCcw className="w-3.5 h-3.5" />
                                                            <span className="text-[12px] font-black">{org.refundedCount}</span>
                                                        </div>
                                                        <span className="text-[8px] font-black text-slate-400 uppercase">Ref</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
