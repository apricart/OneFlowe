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
    selectedBranchIds?: string[]
    onBranchChange?: (ids: string[]) => void
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
    selectedBranchIds = [],
    onBranchChange,
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
        <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300">
            {/* Global Search - Focal point */}
            <div className="relative flex-1 min-w-[240px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                    placeholder={searchPlaceholder}
                    className="pl-9 h-9 text-xs bg-slate-50/50 dark:bg-slate-950/50 border-slate-200/60 dark:border-slate-800/60 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Date Range Selection - Compact */}
            <div className="flex items-center gap-1 bg-slate-50/50 dark:bg-slate-950/50 rounded-lg p-1 border border-slate-100 dark:border-slate-800/50">
                <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="text-[10px] h-7 w-[110px] bg-transparent border-none focus-visible:ring-0 p-1"
                />
                <span className="text-[10px] text-slate-400 font-bold uppercase px-1">to</span>
                <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="text-[10px] h-7 w-[110px] bg-transparent border-none focus-visible:ring-0 p-1"
                />
            </div>

            <div className="flex items-center gap-1.5 ml-auto">
                {/* Group Filter */}
                {showGroupFilter && setGroupId && (role === "SUPER_ADMIN" || role === "HEAD_OFFICE") && (
                    <GroupFilter
                        value={groupId}
                        onChange={setGroupId}
                        organizationId={organizationId}
                    />
                )}

                {/* Branch Filter */}
                {showBranchFilter && onBranchChange && (role === "SUPER_ADMIN" || role === "HEAD_OFFICE") && (
                    <BranchFilter
                        selectedIds={selectedBranchIds}
                        onChange={onBranchChange}
                        organizationId={organizationId}
                    />
                )}

                <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1" />

                {/* Explicit Actions */}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRefresh}
                    disabled={isLoading}
                    className="h-8 text-[11px] font-bold hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                >
                    <RotateCcw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
                    REFRESH
                </Button>

                {onExport && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                size="sm"
                                className="h-8 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm gap-1.5 px-3"
                                disabled={isLoading}
                            >
                                <Upload className="h-3.5 w-3.5" />
                                EXPORT
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[140px]">
                            <DropdownMenuItem onClick={() => onExport('csv')} className="text-xs font-medium cursor-pointer py-2">
                                <FileText className="mr-2.5 h-3.5 w-3.5 text-slate-400" />
                                Download CSV
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onExport('excel')} className="text-xs font-medium cursor-pointer py-2">
                                <FileSpreadsheet className="mr-2.5 h-3.5 w-3.5 text-emerald-500" />
                                Download Excel
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onExport('pdf')} className="text-xs font-medium cursor-pointer py-2">
                                <FilePdf className="mr-2.5 h-3.5 w-3.5 text-rose-500" />
                                Download PDF
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
        </div>
    )
}
