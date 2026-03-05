"use client"

import { useState, useEffect, useMemo } from "react"
import useSWR from "swr"
import { useAppContext } from "@/components/context/app-context"
import { SectionHeader } from "@/components/ui/section-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Building2, TrendingUp, ShoppingBag, AlertTriangle, Crown, Trophy } from "lucide-react"
import { formatPKR, cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Role } from "@/lib/rbac"
import { useSession } from "next-auth/react"

import { QuickDateRange } from "@/components/reports/quick-date-range"
import { KPICard } from "@/components/reports/kpi-card"
import { FilterTagBar, type FilterTag } from "@/components/reports/filter-tag-bar"
import { ReportFilters } from "@/components/reports/report-filters"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function BranchReportsPage() {
    const { organizationId, branchId: contextBranchId } = useAppContext()
    const [searchTerm, setSearchTerm] = useState("")
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")
    const [groupId, setGroupId] = useState("")
    const [generatedDate, setGeneratedDate] = useState("")

    const { data: session } = useSession()
    const role = (session?.user as any)?.role as Role
    const [hasMounted, setHasMounted] = useState(false)

    const queryParams = new URLSearchParams()
    if (organizationId) queryParams.set("organizationId", organizationId.toString())
    if (startDate) queryParams.set("startDate", startDate)
    if (endDate) queryParams.set("endDate", endDate)
    if (groupId) queryParams.set("groupId", groupId)
    queryParams.set("limit", "10000")

    const { data, isLoading, mutate } = useSWR(`/api/v1/analytics/summary?${queryParams.toString()}`, fetcher)

    useEffect(() => {
        setHasMounted(true)
        setGeneratedDate(new Date().toLocaleString())
    }, [])

    if (!hasMounted) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        )
    }

    const topPerformers = data?.topPerformers || []
    const summary = data?.summary || { totalSales: 0, orderCount: 0 }
    const maxSales = topPerformers.length > 0 ? Math.max(...topPerformers.map((p: any) => p.sales)) : 0
    const totalBranches = topPerformers.length
    const avgRevenue = totalBranches > 0 ? (topPerformers.reduce((s: number, p: any) => s + (p.sales || 0), 0) / totalBranches) : 0

    // Filter tags
    const filterTags: FilterTag[] = []
    if (organizationId) filterTags.push({ key: "org", label: "Org", value: String(organizationId), color: "blue" })
    if (startDate || endDate) filterTags.push({ key: "dates", label: "Period", value: `${startDate || "..."} – ${endDate || "..."}`, color: "emerald" })
    if (groupId) filterTags.push({ key: "group", label: "Group", value: groupId, color: "amber" })

    const handleRemoveFilter = (key: string) => {
        if (key === "dates") { setStartDate(""); setEndDate("") }
        if (key === "group") setGroupId("")
    }

    // Filter branches by search
    const filteredBranches = topPerformers.filter((p: any) =>
        (p.branchName || "").toLowerCase().includes(searchTerm.toLowerCase())
    )

    // Threshold alert: branches with concerning metrics (simulated — highlight bottom performers)
    const avgOrders = totalBranches > 0 ? topPerformers.reduce((s: number, p: any) => s + (p.orderCount || 0), 0) / totalBranches : 0
    const alertBranches = topPerformers.filter((p: any) => p.orderCount < avgOrders * 0.3)

    const getRankColor = (index: number) => {
        if (index === 0) return "from-amber-400 to-amber-500"
        if (index === 1) return "from-slate-300 to-slate-400"
        if (index === 2) return "from-orange-400 to-orange-500"
        return "from-slate-200 to-slate-300"
    }

    const getRankIcon = (index: number) => {
        if (index === 0) return <Crown className="h-4 w-4 text-amber-600" />
        if (index === 1) return <Trophy className="h-4 w-4 text-slate-500" />
        if (index === 2) return <Trophy className="h-4 w-4 text-orange-500" />
        return <span className="text-[10px] font-bold text-slate-400">#{index + 1}</span>
    }

    const progressColors = [
        "bg-gradient-to-r from-indigo-500 to-purple-500",
        "bg-gradient-to-r from-blue-500 to-cyan-500",
        "bg-gradient-to-r from-emerald-500 to-teal-500",
        "bg-gradient-to-r from-amber-500 to-orange-500",
        "bg-gradient-to-r from-rose-500 to-pink-500",
        "bg-gradient-to-r from-violet-500 to-fuchsia-500",
        "bg-gradient-to-r from-sky-500 to-blue-500",
        "bg-gradient-to-r from-lime-500 to-green-500",
        "bg-gradient-to-r from-pink-500 to-rose-500",
        "bg-gradient-to-r from-teal-500 to-emerald-500",
    ]

    return (
        <div className="space-y-5 pb-12">
            <SectionHeader title="Branch Reports" subtitle="Branch-level performance rankings, threshold alerts, and comparisons." />

            <QuickDateRange startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate} storageKey="branch-reports-dates" />

            <FilterTagBar tags={filterTags} onRemove={handleRemoveFilter} />

            <ReportFilters
                searchTerm={searchTerm} setSearchTerm={setSearchTerm}
                startDate={startDate} setStartDate={setStartDate}
                endDate={endDate} setEndDate={setEndDate}
                groupId={groupId} setGroupId={setGroupId}
                onRefresh={() => mutate()} isLoading={isLoading}
                role={role} organizationId={organizationId || undefined}
                searchPlaceholder="Search branches..."
                showGroupFilter={true}
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard title="Total Branches" value={totalBranches} icon={Building2} colorScheme="blue" />
                <KPICard title="Total Revenue" value={formatPKR((summary.totalSales || 0) / 100)} icon={TrendingUp} colorScheme="emerald" />
                <KPICard title="Total Orders" value={summary.orderCount || 0} icon={ShoppingBag} colorScheme="violet" />
                <KPICard title="Avg. Revenue/Branch" value={formatPKR(avgRevenue / 100)} icon={TrendingUp} colorScheme="amber" />
            </div>

            {/* Threshold Alerts */}
            {alertBranches.length > 0 && (
                <Card className="border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-bold flex items-center gap-2 text-red-700 dark:text-red-400">
                            <AlertTriangle className="h-4 w-4" />
                            Threshold Alerts
                            <Badge variant="destructive" className="text-[10px] font-bold">{alertBranches.length} flagged</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {alertBranches.map((branch: any) => (
                                <div key={branch.branchId} className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/30">
                                    <div className="h-8 w-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                        <AlertTriangle className="h-4 w-4 text-red-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{branch.branchName || `Branch #${branch.branchId}`}</p>
                                        <p className="text-[10px] text-red-600 dark:text-red-400 font-semibold">
                                            Low activity: {branch.orderCount} orders (avg: {Math.round(avgOrders)})
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Branch Rankings */}
            <Card className="overflow-hidden border-none shadow-sm bg-white dark:bg-slate-900">
                <CardHeader className="pb-3 border-b border-slate-50 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-tight">
                            <Crown className="h-4 w-4 text-amber-500" />
                            Branch Performance Rankings
                        </CardTitle>
                        <Badge variant="secondary" className="text-[10px] font-bold">
                            {filteredBranches.length} branches
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-5">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-32">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : filteredBranches.length === 0 ? (
                        <div className="text-center text-muted-foreground text-sm py-12">No branch data available.</div>
                    ) : (
                        <div className="space-y-4">
                            {filteredBranches.map((performer: any, index: number) => {
                                const percentage = maxSales > 0 ? (performer.sales / maxSales) * 100 : 0
                                const isAlert = alertBranches.some((a: any) => a.branchId === performer.branchId)
                                return (
                                    <div key={performer.branchId} className={cn("group rounded-xl p-4 transition-all duration-200 hover:shadow-sm border", isAlert ? "border-red-200 dark:border-red-900/30 bg-red-50/30 dark:bg-red-950/10" : "border-transparent hover:border-slate-200 dark:hover:border-slate-700")}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-3">
                                                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center bg-gradient-to-br", getRankColor(index))}>
                                                    {getRankIcon(index)}
                                                </div>
                                                <div>
                                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                        {performer.branchName || `Branch #${performer.branchId}`}
                                                    </span>
                                                    {isAlert && (
                                                        <span className="ml-2 text-[9px] font-bold text-red-600 bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded-md">
                                                            ⚠ LOW ACTIVITY
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <Badge variant="outline" className="text-[9px] h-5 px-2 border-slate-200 dark:border-slate-700 mb-0.5">
                                                        {performer.orderCount} orders
                                                    </Badge>
                                                </div>
                                                <span className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400 min-w-[100px] text-right">
                                                    {formatPKR(performer.sales / 100)}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="relative h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                            <div
                                                className={cn(
                                                    "absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out",
                                                    isAlert ? "bg-gradient-to-r from-red-400 to-red-500" : progressColors[index % progressColors.length]
                                                )}
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between mt-1">
                                            <span className="text-[10px] text-slate-400">{percentage.toFixed(1)}% of top</span>
                                            <span className="text-[10px] text-slate-400">
                                                Avg: {formatPKR(performer.orderCount > 0 ? performer.sales / performer.orderCount / 100 : 0)}/order
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="text-xs text-muted-foreground text-center">Report Generated: {generatedDate}</div>
        </div>
    )
}
