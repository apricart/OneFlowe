"use client"

import React, { useState, useCallback, useMemo } from "react"
import { Check, ChevronDown, GitBranch, X, Search } from "lucide-react"
import useSWR from "swr"
import { fetcher } from "@/lib/fetcher"

interface Branch {
    id: number
    name: string
    groupName?: string
}

interface MultiBranchFilterProps {
    organizationId?: string | null
    selectedBranchIds: string[]
    onChange: (ids: string[]) => void
}

export function MultiBranchFilter({ organizationId, selectedBranchIds, onChange }: MultiBranchFilterProps) {
    const [open, setOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")

    const url = organizationId
        ? `/api/v1/branches?organizationId=${organizationId}&limit=100`
        : null

    const { data } = useSWR<{ items: Branch[] }>(url, fetcher, {
        revalidateOnFocus: false,
    })

    const branches = data?.items || []

    // Filter branches based on search query
    const filteredBranches = useMemo(() => {
        if (!searchQuery.trim()) return branches
        const query = searchQuery.toLowerCase()
        return branches.filter(branch => 
            branch.name.toLowerCase().includes(query) ||
            branch.id.toString().includes(query)
        )
    }, [branches, searchQuery])

    const toggle = useCallback((id: string) => {
        if (selectedBranchIds.includes(id)) {
            onChange(selectedBranchIds.filter(b => b !== id))
        } else {
            onChange([...selectedBranchIds, id])
        }
    }, [selectedBranchIds, onChange])

    const clearAll = useCallback(() => {
        onChange([])
        setOpen(false)
    }, [onChange])

    const selectAll = useCallback(() => {
        onChange(filteredBranches.map(b => String(b.id)))
    }, [filteredBranches, onChange])

    const hasSelection = selectedBranchIds.length > 0
    const label = hasSelection
        ? selectedBranchIds.length === 1
            ? branches.find(b => String(b.id) === selectedBranchIds[0])?.name || "1 Branch"
            : `${selectedBranchIds.length} Branches`
        : "All Branches"

    if (!organizationId || branches.length === 0) return null

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(prev => !prev)}
                className={`
          flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200
          ${hasSelection
                        ? "bg-indigo-600 text-white border-indigo-700 shadow-md shadow-indigo-200 dark:shadow-indigo-900/40"
                        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:text-indigo-600"
                    }
        `}
            >
                <GitBranch className="h-3 w-3" />
                <span>{label}</span>
                {hasSelection ? (
                    <X
                        className="h-3 w-3 ml-0.5 opacity-80 hover:opacity-100"
                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); clearAll() }}
                    />
                ) : (
                    <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
                )}
            </button>

            {open && (
                <div className="absolute top-full right-0 mt-2 z-[999] animate-in fade-in slide-in-from-top-2 duration-200 min-w-[220px]">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Search branches..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        </div>
                        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                                {filteredBranches.length === branches.length ? "All Branches" : `Filtered (${filteredBranches.length})`}
                            </span>
                            <div className="flex gap-2">
                                <button onClick={selectAll} className="text-xs text-blue-600 hover:underline font-medium">All</button>
                                <span className="text-slate-300">|</span>
                                <button onClick={clearAll} className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">Clear</button>
                            </div>
                        </div>
                        <div className="max-h-60 overflow-y-auto py-2">
                            {filteredBranches.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8">
                                    <GitBranch className="h-8 w-8 text-slate-400" />
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">No branches found</p>
                                </div>
                            ) : (
                                filteredBranches.map((branch) => (
                                    <div
                                        key={branch.id}
                                        className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-200 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${
                                            selectedBranchIds.includes(String(branch.id))
                                                ? "bg-indigo-100 dark:bg-indigo-900 border-indigo-200 dark:border-indigo-700"
                                                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900"
                                        }`}
                                        onClick={() => {
                                            if (selectedBranchIds.includes(String(branch.id))) {
                                                onChange(selectedBranchIds.filter(id => String(id) !== String(branch.id)))
                                            } else {
                                                onChange([...selectedBranchIds, String(branch.id)])
                                            }
                                            setOpen(false)
                                        }}
                                    >
                                        <span className="flex items-center gap-2 flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                {selectedBranchIds.includes(String(branch.id)) && (
                                                    <Check className="h-4 w-4 text-indigo-600" />
                                                )}
                                                <span className="text-sm font-medium">{branch.name}</span>
                                            </div>
                                        </span>
                                        {!selectedBranchIds.includes(String(branch.id)) && (
                                            <X
                                                className="h-3 w-3 ml-0.5 opacity-80 hover:opacity-100"
                                                onClick={(e: React.MouseEvent) => { e.stopPropagation(); clearAll() }}
                                            />
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                        {selectedBranchIds.length > 0 && (
                            <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700">
                                <button
                                    onClick={() => setOpen(false)}
                                    className="w-full py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors"
                                >
                                    Apply ({selectedBranchIds.length} selected)
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
