"use client"

import { Search, RotateCcw, Upload, FileText, FileSpreadsheet, FileIcon as FilePdf } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { GroupFilter } from "./group-filter"
import { BranchFilter } from "./branch-filter"
import { Role } from "@/lib/rbac"

interface ReportFiltersProps {
    searchTerm: string
    setSearchTerm: (value: string) => void
    startDate: string
    setStartDate: (value: string) => void
    endDate: string
    setEndDate: (value: string) => void
    groupId?: string
    setGroupId?: (value: string) => void
    branchId?: string
    setBranchId?: (value: string) => void
    onRefresh: () => void
    onExport?: (format: 'csv' | 'excel' | 'pdf') => void
    isLoading: boolean
    role?: Role
    organizationId?: string | number
    searchPlaceholder?: string
    showGroupFilter?: boolean
    showBranchFilter?: boolean
}

export function ReportFilters({
    searchTerm,
    setSearchTerm,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    groupId,
    setGroupId,
    branchId,
    setBranchId,
    onRefresh,
    onExport,
    isLoading,
    role,
    organizationId,
    searchPlaceholder = "Search...",
    showGroupFilter = true,
    showBranchFilter = false
}: ReportFiltersProps) {
    return (
        <Card className="p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">

                {/* Date Ranges */}
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-[150px]">
                        <Input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full text-xs h-10"
                            placeholder="Start Date"
                        />
                    </div>
                    <span className="text-muted-foreground text-xs font-medium">to</span>
                    <div className="relative flex-1 md:w-[150px]">
                        <Input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full text-xs h-10"
                            placeholder="End Date"
                        />
                    </div>
                </div>

                {/* Global Search */}
                <div className="relative w-full md:w-auto flex-1 min-w-[200px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                        placeholder={searchPlaceholder}
                        className="pl-9 w-full h-10 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Group Filter (Scope based) */}
                {showGroupFilter && setGroupId && (role === "SUPER_ADMIN" || role === "HEAD_OFFICE") && (
                    <div className="w-full md:w-auto">
                        <GroupFilter
                            onGroupChange={setGroupId}
                            organizationId={organizationId}
                        />
                    </div>
                )}

                {/* Branch Filter */}
                {showBranchFilter && setBranchId && (role === "SUPER_ADMIN" || role === "HEAD_OFFICE") && (
                    <div className="w-full md:w-auto">
                        <BranchFilter
                            onBranchChange={setBranchId}
                            organizationId={organizationId}
                        />
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 w-full md:w-auto ml-auto">
                    <Button
                        variant="outline"
                        onClick={onRefresh}
                        disabled={isLoading}
                        className="flex-1 md:flex-none h-10 border-slate-200 dark:border-slate-800"
                    >
                        <RotateCcw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>

                    {onExport && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    className="gap-2 flex-1 md:flex-none h-10 bg-indigo-600 hover:bg-indigo-700 text-white"
                                    disabled={isLoading}
                                >
                                    <Upload className="h-4 w-4" />
                                    Export
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => onExport('csv')} className="cursor-pointer">
                                    <FileText className="mr-2 h-4 w-4" />
                                    CSV
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onExport('excel')} className="cursor-pointer">
                                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                                    Excel
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onExport('pdf')} className="cursor-pointer">
                                    <FilePdf className="mr-2 h-4 w-4" />
                                    PDF
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            </div>
        </Card>
    )
}
