"use client"

import { useState, useEffect, useMemo } from "react"
import useSWR from "swr"
import { useAppContext } from "@/components/context/app-context"
import { SectionHeader } from "@/components/ui/section-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Building2, TrendingUp, ShoppingBag, AlertTriangle, Crown, Trophy } from "lucide-react"
import { formatPKR, cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { Role } from "@/lib/rbac"
import { useSession } from "next-auth/react"

import { QuickDateRange } from "@/components/reports/quick-date-range"
import { KPICard } from "@/components/reports/kpi-card"
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



    const topPerformers = data?.topPerformers || []
    const summary = data?.summary || { totalSales: 0, orderCount: 0 }
    const maxSales = topPerformers.length > 0 ? Math.max(...topPerformers.map((p: any) => p.sales)) : 0
    const totalBranches = topPerformers.length
    const avgRevenue = totalBranches > 0 ? (topPerformers.reduce((s: number, p: any) => s + (p.sales || 0), 0) / totalBranches) : 0

    // Filter branches by search
    const filteredBranches = topPerformers.filter((p: any) =>
        (p.branchName || "").toLowerCase().includes(searchTerm.toLowerCase())
    )

    // Threshold alert: branches with concerning metrics (simulated — highlight bottom performers)
    const avgOrders = totalBranches > 0 ? topPerformers.reduce((s: number, p: any) => s + (p.orderCount || 0), 0) / totalBranches : 0
    const alertBranches = topPerformers.filter((p: any) => p.orderCount < avgOrders * 0.3)

    const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
        const headers = ["Rank", "Branch", "Group", "Revenue", "Fulfilled", "Rejected", "Refunded"]
        const rows = topPerformers.map((p: any, i: number) => [
            `#${i + 1}`,
            p.branchName,
            p.groupName || "-",
            (p.sales / 100).toFixed(2), // Changed p.revenue to p.sales based on existing data structure
            p.fulfilledCount || 0,
            p.rejectedCount || 0,
            p.refundedCount || 0
        ])

        if (format === 'pdf') {
            const doc = new jsPDF()
            doc.setFontSize(20); doc.text("Branch Performance Report", 14, 20)
            doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28)
            autoTable(doc, { startY: 40, head: [headers], body: rows, theme: 'grid' })
            doc.save(`branch-report-${new Date().getTime()}.pdf`)
        } else if (format === 'csv') {
            const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r: string[]) => r.join(","))].join("\n")
            const encodedUri = encodeURI(csvContent); const link = document.createElement("a")
            link.setAttribute("href", encodedUri); link.setAttribute("download", `branch-report-${new Date().getTime()}.csv`)
            document.body.appendChild(link); link.click(); document.body.removeChild(link)
        }
    }

    const getRankColor = (index: number) => {
        if (index === 0) return "from-amber-400 to-amber-500"
        if (index === 1) return "from-slate-300 to-slate-400"
        if (index === 2) return "from-orange-400 to-orange-500"
        return "from-slate-200 to-slate-300"
    }


    if (!hasMounted) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        )
    }

    return (
        <div className="space-y-5 pb-12">
            <SectionHeader title="Branch Reports" subtitle="Branch-level performance rankings, threshold alerts, and comparisons." />


            <ReportFilters
                searchTerm={searchTerm} setSearchTerm={setSearchTerm}
                startDate={startDate} setStartDate={setStartDate}
                endDate={endDate} setEndDate={setEndDate}
                groupId={groupId} setGroupId={setGroupId}
                onRefresh={() => {
                    setSearchTerm("")
                    setStartDate("")
                    setEndDate("")
                    setGroupId("")
                    mutate()
                }} isLoading={isLoading}
                role={role} organizationId={organizationId || undefined}
                searchPlaceholder="Search branches..."
                showGroupFilter={true}
                onExport={handleExport}
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <KPICard title="Total Branches" value={totalBranches} icon={Building2} colorScheme="blue" />
                <KPICard title="Total Revenue" value={formatPKR((summary.totalSales || 0) / 100)} icon={TrendingUp} colorScheme="emerald" />
            </div>


            {/* Branch Detailed Report */}
            <Card className="overflow-hidden border-none shadow-sm bg-white dark:bg-slate-900">
                <CardHeader className="pb-3 border-b border-slate-50 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-tight">
                            <Building2 className="h-4 w-4 text-indigo-500" />
                            Detailed Branch Performance
                        </CardTitle>
                        <Badge variant="secondary" className="text-[10px] font-bold">
                            {filteredBranches.length} units
                        </Badge>
                    </div>
                </CardHeader>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Branch Name</th>
                                <th className="px-4 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Total Orders</th>
                                <th className="px-4 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right text-emerald-600">Fulfilled</th>
                                <th className="px-4 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right text-rose-500">Rejected</th>
                                <th className="px-4 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right text-amber-600">Refunded</th>
                                <th className="px-4 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Net Revenue</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Market Share</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {isLoading ? (
                                <tr><td colSpan={7} className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
                            ) : filteredBranches.length === 0 ? (
                                <tr><td colSpan={7} className="py-12 text-center text-muted-foreground italic text-sm">No branch data matched your filters.</td></tr>
                            ) : (
                                filteredBranches.map((performer: any, index: number) => {
                                    const marketShare = summary.totalSales > 0 ? (performer.sales / summary.totalSales) * 100 : 0

                                    return (
                                        <tr key={performer.branchId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs border border-indigo-100/50 dark:border-indigo-800/30">
                                                        {index + 1}
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 transition-colors">
                                                        {performer.branchName || `Branch #${performer.branchId}`}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                                                    {performer.orderCount.toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[10px] font-bold px-2 py-0.5">
                                                    {performer.fulfilledCount?.toLocaleString() || 0}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-100 text-[10px] font-bold px-2 py-0.5">
                                                    {performer.rejectedCount?.toLocaleString() || 0}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-100 text-[10px] font-bold px-2 py-0.5">
                                                    {performer.refundedCount?.toLocaleString() || 0}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                                    {formatPKR(performer.sales / 100)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className="text-[10px] font-bold text-slate-500">{marketShare.toFixed(1)}%</span>
                                                    <div className="w-16 h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                                        <div className="h-full bg-indigo-500" style={{ width: `${marketShare}%` }} />
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <div className="text-xs text-muted-foreground text-center">Report Generated: {generatedDate}</div>
        </div>
    )
}
