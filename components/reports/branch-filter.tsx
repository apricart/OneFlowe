"use client"

import React, { useState, useCallback, useMemo } from "react"
import { Check, ChevronDown, Building2, X, Search } from "lucide-react"
import { useBranches } from "@/lib/hooks/use-api"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"

interface Branch {
    id: number
    name: string
}

interface BranchFilterProps {
    selectedIds: string[]
    onChange: (ids: string[]) => void
    organizationId?: string | number
    placeholder?: string
}

export function BranchFilter({ selectedIds, onChange, organizationId, placeholder = "Select Branches" }: BranchFilterProps) {
    const [open, setOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")

    const { data, isLoading } = useBranches(organizationId ? String(organizationId) : undefined)
    const branches = (data?.items || []) as Branch[]

    const filteredBranches = useMemo(() => {
        return branches.filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase()))
    }, [branches, searchQuery])

    const toggleBranch = useCallback((id: string) => {
        const newIds = selectedIds.includes(id)
            ? selectedIds.filter(i => i !== id)
            : [...selectedIds, id]
        onChange(newIds)
    }, [selectedIds, onChange])

    const selectAll = () => onChange(branches.map(b => b.id.toString()))
    const clearAll = () => onChange([])

    const label = selectedIds.length === 0
        ? "All Branches"
        : selectedIds.length === 1
            ? branches.find(b => b.id.toString() === selectedIds[0])?.name || "1 Branch"
            : `${selectedIds.length} Branches`

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={`h-10 justify-between gap-2 min-w-[200px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all ${selectedIds.length > 0 ? "border-blue-500/50 ring-1 ring-blue-500/10" : ""}`}
                >
                    <div className="flex items-center gap-2 overflow-hidden">
                        <Building2 className={`h-4 w-4 ${selectedIds.length > 0 ? "text-blue-600" : "text-slate-400"}`} />
                        <span className="truncate text-xs font-medium">
                            {label}
                        </span>
                    </div>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0 border-slate-200 dark:border-slate-800 shadow-xl" align="start">
                <div className="flex flex-col h-full max-h-[400px]">
                    <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <div className="relative mb-2">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                            <Input
                                placeholder="Search branches..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="h-8 pl-8 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                            />
                        </div>
                        <div className="flex items-center justify-between px-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Selection</span>
                            <div className="flex gap-2">
                                <button
                                    onClick={selectAll}
                                    className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-tighter"
                                >
                                    Select All
                                </button>
                                <button
                                    onClick={clearAll}
                                    className="text-[10px] font-bold text-slate-500 hover:text-slate-600 uppercase tracking-tighter"
                                >
                                    Clear
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-y-auto flex-1 p-1">
                        {isLoading ? (
                            <div className="p-4 text-center text-xs text-slate-400">Loading branches...</div>
                        ) : filteredBranches.length === 0 ? (
                            <div className="p-4 text-center text-xs text-slate-400">No branches found.</div>
                        ) : (
                            filteredBranches.map((branch) => {
                                const isSelected = selectedIds.includes(branch.id.toString())
                                return (
                                    <div
                                        key={branch.id}
                                        className={`
                                            flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors
                                            ${isSelected ? "bg-blue-50/50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-300" : "hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-300"}
                                        `}
                                        onClick={() => toggleBranch(branch.id.toString())}
                                    >
                                        <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={() => toggleBranch(branch.id.toString())}
                                            className="h-4 w-4 border-slate-300 dark:border-slate-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                        />
                                        <span className="text-xs font-medium truncate">{branch.name}</span>
                                    </div>
                                )
                            })
                        )}
                    </div>

                    {selectedIds.length > 0 && (
                        <div className="p-2 border-t border-slate-100 dark:border-slate-800">
                            <Button
                                className="w-full h-8 text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                                onClick={() => setOpen(false)}
                            >
                                Apply Selection ({selectedIds.length})
                            </Button>
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}
