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
import { formatPKR } from "@/lib/utils"
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
}

interface Group {
    id: number
    name: string
    organizationId: number
    organizationName: string
    branchCount: number
    totalOrders: number
    totalAmountCents: number
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

            <QuickDateRange startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate} storageKey="groups-report-dates" />

            <FilterTagBar tags={filterTags} onRemove={handleRemoveFilter} />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard title="Total Groups" value={isLoading ? "..." : summary.totalGroups} icon={FolderTree} colorScheme="blue" />
                <KPICard title="Total Orders" value={isLoading ? "..." : summary.totalOrders} icon={ShoppingBag} colorScheme="violet" />
                <KPICard title={role === "HEAD_OFFICE" ? "Total Expense" : "Total Revenue"} value={isLoading ? "..." : formatPKR(summary.totalRevenue / 100)} icon={TrendingUp} colorScheme="emerald" />
                <KPICard title={role === "HEAD_OFFICE" ? "Avg Expense/Group" : "Avg Revenue/Group"} value={isLoading ? "..." : formatPKR(summary.avgRevenuePerGroup / 100)} icon={Calculator} colorScheme="amber" />
            </div>

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

            <Card className="overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12"></TableHead>
                            <TableHead>Group Name</TableHead>
                            <TableHead>Organization</TableHead>
                            <TableHead className="text-center">Branches</TableHead>
                            <TableHead className="text-right">Orders</TableHead>
                            <TableHead className="text-right">{role === "HEAD_OFFICE" ? "Expense" : "Revenue"}</TableHead>
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
                                        <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => hasBranches && toggleGroupExpansion(group.id)}>
                                            <TableCell>
                                                {hasBranches && (
                                                    isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                                                )}
                                            </TableCell>
                                            <TableCell className="font-medium">{group.name}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{group.organizationName}</TableCell>
                                            <TableCell className="text-center">
                                                <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium">
                                                    <Users className="h-3 w-3" />
                                                    {group.branchCount}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-xs">{group.totalOrders}</TableCell>
                                            <TableCell className="text-right font-mono text-xs font-medium">{formatPKR(group.totalAmountCents / 100)}</TableCell>
                                        </TableRow>
                                        {isExpanded && hasBranches && (
                                            group.branches.map((branch) => (
                                                <TableRow key={`${group.id}-${branch.id}`} className="bg-muted/30">
                                                    <TableCell></TableCell>
                                                    <TableCell className="pl-8 text-xs text-muted-foreground">
                                                        <span className="inline-flex items-center gap-2">
                                                            <span className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                                                            {branch.name}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">Branch</TableCell>
                                                    <TableCell></TableCell>
                                                    <TableCell className="text-right font-mono text-xs text-muted-foreground">{branch.orders}</TableCell>
                                                    <TableCell className="text-right font-mono text-xs text-muted-foreground">{formatPKR(branch.revenue / 100)}</TableCell>
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
