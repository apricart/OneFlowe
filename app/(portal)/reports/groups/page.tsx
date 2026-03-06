"use client"

import { useState, useEffect, Fragment } from "react"
import useSWR from "swr"
import { useAppContext } from "@/components/context/app-context"
import { SectionHeader } from "@/components/ui/section-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Download, Upload, RefreshCw, Loader2, Building, ChevronDown, ChevronRight, Users, FolderTree, ShoppingBag, TrendingUp, Calculator } from "lucide-react"
import { formatPKR, cn } from "@/lib/utils"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"
import { Badge } from "@/components/ui/badge"
import { Role } from "@/lib/rbac"
import { useSession } from "next-auth/react"

import { ReportFilters } from "@/components/reports/report-filters"
import { QuickDateRange } from "@/components/reports/quick-date-range"
import { KPICard } from "@/components/reports/kpi-card"
import { FilterTagBar, type FilterTag } from "@/components/reports/filter-tag-bar"

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
    const { organizationId, branchId } = useAppContext()
    const [searchTerm, setSearchTerm] = useState("")
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")
    const [groupId, setGroupId] = useState("")
    const [generatedDate, setGeneratedDate] = useState("")
    const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set())

    const { data: session } = useSession()
    const role = (session?.user as any)?.role as Role
    const [hasMounted, setHasMounted] = useState(false)

    // Build query params - this needs to be before useSWR
    const queryParams = new URLSearchParams()
    if (organizationId) queryParams.set("organizationId", organizationId.toString())
    if (groupId && groupId !== "all") queryParams.set("groupId", groupId)
    if (startDate) queryParams.set("startDate", startDate)
    if (endDate) queryParams.set("endDate", endDate)

    // All hooks must be called before any conditional returns
    const { data, isLoading, mutate } = useSWR(`/api/v1/analytics/groups?${queryParams.toString()}`, fetcher)

    useEffect(() => {
        setHasMounted(true)
        setGeneratedDate(new Date().toLocaleString())
    }, [])

    // Now safe to return early after all hooks are called
    if (!hasMounted) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        )
    }

    const summary = data?.summary || { totalGroups: 0, totalOrders: 0, totalRevenue: 0, avgRevenuePerGroup: 0 }
    const groups: Group[] = data?.groups || []

    const filteredGroups = groups.filter((group) =>
        group.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        group.organizationName?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const toggleGroupExpansion = (groupId: number) => {
        setExpandedGroups((prev) => {
            const newSet = new Set(prev)
            if (newSet.has(groupId)) {
                newSet.delete(groupId)
            } else {
                newSet.add(groupId)
            }
            return newSet
        })
    }

    const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
        const headers = ["Group Name", "Organization", "Branch Count", "Total Orders", role === "HEAD_OFFICE" ? "Total Expense" : "Total Revenue", "Branch Name", "Branch Orders", role === "HEAD_OFFICE" ? "Branch Expense" : "Branch Revenue"]
        const dataRows: any[][] = []

        filteredGroups.forEach((group) => {
            if (group.branches && group.branches.length > 0) {
                group.branches.forEach((branch, idx) => {
                    dataRows.push([
                        idx === 0 ? group.name : "",
                        idx === 0 ? group.organizationName : "",
                        idx === 0 ? group.branchCount : "",
                        idx === 0 ? group.totalOrders : "",
                        idx === 0 ? (group.totalAmountCents / 100).toFixed(2) : "",
                        branch.name,
                        branch.orders,
                        (branch.revenue / 100).toFixed(2)
                    ])
                })
            } else {
                dataRows.push([
                    group.name,
                    group.organizationName,
                    group.branchCount,
                    group.totalOrders,
                    (group.totalAmountCents / 100).toFixed(2),
                    "-",
                    "-",
                    "-"
                ])
            }
        })

        if (format === 'pdf') {
            const doc = new jsPDF()
            doc.setFontSize(20)
            doc.text("Groups Report", 14, 20)
            doc.setFontSize(10)
            doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28)

            autoTable(doc, {
                startY: 40,
                head: [headers],
                body: dataRows,
                theme: 'grid',
                headStyles: { fillColor: [66, 66, 66], fontSize: 7 },
                styles: { fontSize: 7 }
            })
            doc.save(`groups-report-${new Date().getTime()}.pdf`)
            return
        }

        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows])
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Groups")

        if (format === 'excel') {
            XLSX.writeFile(workbook, `groups-report-${new Date().getTime()}.xlsx`)
        } else {
            XLSX.writeFile(workbook, `groups-report-${new Date().getTime()}.csv`)
        }
    }

    const filterTags: FilterTag[] = []
    if (organizationId) filterTags.push({ key: "org", label: "Org", value: String(organizationId), color: "blue" as const })
    if (startDate || endDate) filterTags.push({ key: "dates", label: "Period", value: `${startDate || "..."} – ${endDate || "..."}`, color: "emerald" as const })
    if (groupId) filterTags.push({ key: "group", label: "Group", value: groupId, color: "amber" as const })

    const handleRemoveFilter = (key: string) => {
        if (key === "dates") { setStartDate(""); setEndDate("") }
        if (key === "group") setGroupId("")
    }

    return (
        <div className="space-y-5">
            <SectionHeader title="Groups Report" subtitle="Analyze group performance, member branches, order counts, and revenue breakdowns." />


            <ReportFilters
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                startDate={startDate}
                setStartDate={setStartDate}
                endDate={endDate}
                setEndDate={setEndDate}
                groupId={groupId}
                setGroupId={setGroupId}
                onRefresh={() => mutate()}
                isLoading={isLoading}
                role={role}
                organizationId={organizationId || undefined}
                searchPlaceholder="Search groups or organizations..."
                onExport={handleExport}
                showGroupFilter={true}
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <KPICard title="Total Groups" value={isLoading ? "..." : summary.totalGroups} icon={FolderTree} colorScheme="blue" />
                <KPICard title="Total Orders" value={isLoading ? "..." : summary.totalOrders} icon={ShoppingBag} colorScheme="violet" />
                <KPICard title={role === "HEAD_OFFICE" ? "Total Expense" : "Total Revenue"} value={isLoading ? "..." : formatPKR(summary.totalRevenue / 100)} icon={TrendingUp} colorScheme="emerald" />
            </div>

            <Card className="overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
                            <TableHead className="w-12"></TableHead>
                            <TableHead className="text-[10px] font-bold uppercase">Group Name</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase">Organization</TableHead>
                            <TableHead className="text-center text-[10px] font-bold uppercase">Units</TableHead>
                            <TableHead className="text-right text-[10px] font-bold uppercase">Orders</TableHead>
                            <TableHead className="text-right text-[10px] font-bold uppercase text-rose-500">Refunds</TableHead>
                            <TableHead className="text-right text-[10px] font-bold uppercase text-amber-600">Rejected</TableHead>
                            <TableHead className="text-right text-[10px] font-bold uppercase text-indigo-600">Net {role === "HEAD_OFFICE" ? "Expense" : "Revenue"}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                </TableCell>
                            </TableRow>
                        ) : filteredGroups.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                    No groups found for the selected criteria.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredGroups.map((group) => {
                                const isExpanded = expandedGroups.has(group.id)
                                const hasBranches = group.branches && group.branches.length > 0

                                return (
                                    <Fragment key={group.id}>
                                        <TableRow className="cursor-pointer hover:bg-muted/50 transition-colors group" onClick={() => hasBranches && toggleGroupExpansion(group.id)}>
                                            <TableCell>
                                                {hasBranches && (
                                                    isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />
                                                )}
                                            </TableCell>
                                            <TableCell className="font-bold text-slate-700 dark:text-slate-200">{group.name}</TableCell>
                                            <TableCell className="text-[11px] text-muted-foreground">{group.organizationName}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="outline" className="text-[10px] font-bold">
                                                    {group.branchCount}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-xs font-bold">{group.totalOrders.toLocaleString()}</TableCell>
                                            <TableCell className="text-right font-mono text-xs text-rose-500">{formatPKR(group.totalRefundCents / 100)}</TableCell>
                                            <TableCell className="text-right font-mono text-xs text-amber-600">{group.rejectedOrders}</TableCell>
                                            <TableCell className="text-right font-mono text-xs font-bold text-indigo-600">{formatPKR(group.totalAmountCents / 100)}</TableCell>
                                        </TableRow>
                                        {isExpanded && hasBranches && (
                                            group.branches.map((branch) => (
                                                <TableRow key={`${group.id}-${branch.id}`} className="bg-slate-50/30 dark:bg-slate-800/20">
                                                    <TableCell></TableCell>
                                                    <TableCell className="pl-8 text-[11px] text-muted-foreground font-medium">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></div>
                                                            {branch.name}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-[10px] text-slate-400 italic">Branch unit</TableCell>
                                                    <TableCell></TableCell>
                                                    <TableCell className="text-right font-mono text-xs text-muted-foreground/70">{branch.orders}</TableCell>
                                                    <TableCell className="text-right font-mono text-xs text-rose-400/70">{formatPKR(branch.refunds / 100)}</TableCell>
                                                    <TableCell className="text-right font-mono text-xs text-amber-500/70">{branch.rejected}</TableCell>
                                                    <TableCell className="text-right font-mono text-xs text-indigo-400/70">{formatPKR(branch.revenue / 100)}</TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </Fragment>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </Card>

            <div className="text-xs text-muted-foreground text-center">Report Generated: {generatedDate}</div>
        </div>
    )
}
