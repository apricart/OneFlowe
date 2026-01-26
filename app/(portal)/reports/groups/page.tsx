"use client"

import { useState, useEffect, Fragment } from "react"
import useSWR from "swr"
import { useAppContext } from "@/components/context/app-context"
import { SectionHeader } from "@/components/ui/section-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Download, RefreshCw, Loader2, Building, ChevronDown, ChevronRight, Users } from "lucide-react"
import { formatPKR } from "@/lib/utils"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { GroupFilter } from "@/components/reports/group-filter"
import { Role } from "@/lib/rbac"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"

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
    const [groupId, setGroupId] = useState("")
    const [generatedDate, setGeneratedDate] = useState("")
    const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set())

    const { data: session } = useSession()
    const role = (session?.user as any)?.role as Role
    const [hasMounted, setHasMounted] = useState(false)

    // Build query params - this needs to be before useSWR
    const queryParams = new URLSearchParams()
    if (organizationId) queryParams.set("organizationId", organizationId)
    if (groupId && groupId !== "all") queryParams.set("groupId", groupId)

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

    const handleExportPDF = () => {
        const doc = new jsPDF()

        doc.setFontSize(20)
        doc.text("Groups Report", 14, 20)
        doc.setFontSize(10)
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28)

        let filterText = ""
        if (organizationId) filterText += `Org ID: ${organizationId} `
        if (filterText) doc.text(filterText, 14, 33)

        // Summary Section
        doc.setFillColor(240, 240, 240)
        doc.rect(14, 40, 180, 30, 'F')
        doc.setFontSize(12)
        doc.text(`Total Groups: ${summary.totalGroups}`, 20, 50)
        doc.text(`Total Orders: ${summary.totalOrders}`, 100, 50)
        doc.text(`Total Revenue: ${formatPKR(summary.totalRevenue / 100)}`, 20, 60)
        doc.text(`Avg Revenue/Group: ${formatPKR(summary.avgRevenuePerGroup / 100)}`, 100, 60)

        let currentY = 75

        // Add each group with its branches
        filteredGroups.forEach((group, index) => {
            // Group header
            if (index > 0) currentY += 10 // Add spacing between groups

            doc.setFontSize(14)
            doc.setTextColor(59, 130, 246)
            doc.text(`${group.name}`, 14, currentY)
            currentY += 6

            doc.setFontSize(10)
            doc.setTextColor(100, 100, 100)
            doc.text(`Organization: ${group.organizationName} | Branches: ${group.branchCount} | Orders: ${group.totalOrders} | Revenue: ${formatPKR(group.totalAmountCents / 100)}`, 14, currentY)
            currentY += 8

            // Branch details table
            if (group.branches && group.branches.length > 0) {
                const branchData = group.branches.map(branch => [
                    branch.name,
                    branch.orders.toString(),
                    formatPKR(branch.revenue / 100)
                ])

                autoTable(doc, {
                    startY: currentY,
                    head: [["Branch Name", "Orders", "Revenue"]],
                    body: branchData,
                    theme: 'striped',
                    headStyles: { fillColor: [100, 100, 100], fontSize: 9 },
                    bodyStyles: { fontSize: 8 },
                    margin: { left: 20 },
                    tableWidth: 170
                })

                currentY = (doc as any).lastAutoTable.finalY + 5
            } else {
                doc.setFontSize(9)
                doc.setTextColor(150, 150, 150)
                doc.text("No branches in this group", 20, currentY)
                currentY += 8
            }

            // Add new page if needed
            if (currentY > 270 && index < filteredGroups.length - 1) {
                doc.addPage()
                currentY = 20
            }
        })

        doc.save("groups-report.pdf")
    }

    const handleExportCSV = () => {
        // Helper function to escape CSV values
        const escapeCSV = (value: string | number) => {
            const str = String(value)
            // If value contains comma, quote, or newline, wrap in quotes and escape quotes
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`
            }
            return str
        }

        const headers = ["Group Name", "Organization", "Branch Count", "Total Orders", "Total Revenue", "Branch Name", "Branch Orders", "Branch Revenue"]
        const rows: string[][] = []

        filteredGroups.forEach((group) => {
            if (group.branches && group.branches.length > 0) {
                group.branches.forEach((branch, idx) => {
                    rows.push([
                        idx === 0 ? escapeCSV(group.name) : "",
                        idx === 0 ? escapeCSV(group.organizationName) : "",
                        idx === 0 ? escapeCSV(group.branchCount) : "",
                        idx === 0 ? escapeCSV(group.totalOrders) : "",
                        idx === 0 ? escapeCSV(formatPKR(group.totalAmountCents / 100)) : "",
                        escapeCSV(branch.name),
                        escapeCSV(branch.orders),
                        escapeCSV(formatPKR(branch.revenue / 100))
                    ])
                })
            } else {
                rows.push([
                    escapeCSV(group.name),
                    escapeCSV(group.organizationName),
                    escapeCSV(group.branchCount),
                    escapeCSV(group.totalOrders),
                    escapeCSV(formatPKR(group.totalAmountCents / 100)),
                    "-",
                    "-",
                    "-"
                ])
            }
        })

        // Create CSV content with proper formatting
        const csvContent = [headers.map(h => escapeCSV(h)), ...rows].map(row => row.join(",")).join("\n")
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "groups-report.csv"
        a.click()
        window.URL.revokeObjectURL(url)
    }

    return (
        <div className="space-y-6">
            <SectionHeader title="Groups Report" subtitle="Analyze group performance, member branches, order counts, and revenue breakdowns." />

            {organizationId && (
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground bg-muted/30 p-2 rounded-md border border-dashed">
                    <span className="font-medium">Active Filters:</span>
                    <span className="flex items-center gap-1">
                        <Building className="h-3 w-3" /> Org ID: {organizationId}
                    </span>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Groups</CardTitle>
                        <span className="text-muted-foreground">📊</span>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{isLoading ? "..." : summary.totalGroups}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                        <span className="text-muted-foreground">📦</span>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{isLoading ? "..." : summary.totalOrders}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <span className="text-muted-foreground">💰</span>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{isLoading ? "..." : formatPKR(summary.totalRevenue / 100)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg Revenue/Group</CardTitle>
                        <span className="text-muted-foreground">📈</span>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{isLoading ? "..." : formatPKR(summary.avgRevenuePerGroup / 100)}</div>
                    </CardContent>
                </Card>
            </div>

            <Card className="p-4">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
                    <div className="relative w-full md:w-auto flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search groups or organizations..."
                            className="pl-9 w-full md:max-w-xs"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            suppressHydrationWarning
                        />
                    </div>

                    {(role === "SUPER_ADMIN" || role === "HEAD_OFFICE") && (
                        <GroupFilter
                            onGroupChange={setGroupId}
                            organizationId={organizationId || undefined}
                        />
                    )}

                    <div className="flex gap-2 w-full md:w-auto ml-auto">
                        <Button variant="outline" onClick={() => mutate()} className="flex-1 md:flex-none">
                            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                            Refresh
                        </Button>
                        <Button className="gap-2 flex-1 md:flex-none" onClick={handleExportPDF} disabled={isLoading || filteredGroups.length === 0}>
                            <Download className="h-4 w-4" />
                            PDF
                        </Button>
                        <Button className="gap-2 flex-1 md:flex-none" onClick={handleExportCSV} disabled={isLoading || filteredGroups.length === 0}>
                            <Download className="h-4 w-4" />
                            CSV
                        </Button>
                    </div>
                </div>
            </Card>

            <Card className="overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12"></TableHead>
                            <TableHead>Group Name</TableHead>
                            <TableHead>Organization</TableHead>
                            <TableHead className="text-center">Branches</TableHead>
                            <TableHead className="text-right">Orders</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
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
