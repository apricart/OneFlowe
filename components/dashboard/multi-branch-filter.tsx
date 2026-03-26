"use client"

import React, { useState, useCallback } from "react"
import { Check, ChevronDown, GitBranch, X } from "lucide-react"
import useSWR from "swr"
import { fetcher } from "@/lib/fetcher"

interface Branch {
    id: number
    name: string
}

interface MultiBranchFilterProps {
    organizationId?: string | null
    selectedBranchIds: string[]
    onChange: (ids: string[]) => void
}

export function MultiBranchFilter({ organizationId, selectedBranchIds, onChange }: MultiBranchFilterProps) {
    const [open, setOpen] = useState(false)

    const url = organizationId
        ? `/api/v1/branches?organizationId=${organizationId}&limit=100`
        : null

    const { data } = useSWR<{ items: Branch[] }>(url, fetcher, {
        revalidateOnFocus: false,
    })

    const branches = data?.items || []

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
        onChange(branches.map(b => String(b.id)))
    }, [branches, onChange])

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
                <div className="absolute top-full right-0 mt-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200 min-w-[220px]">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Select Branches</span>
                            <div className="flex gap-2">
                                <button onClick={selectAll} className="text-xs text-blue-600 hover:underline font-medium">All</button>
                                <span className="text-slate-300">|</span>
                                <button onClick={clearAll} className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">Clear</button>
                            </div>
                        </div>
                        <div className="max-h-60 overflow-y-auto py-2">
                            {branches.map(branch => {
                                const isSelected = selectedBranchIds.includes(String(branch.id))
                                return (
                                    <button
                                        key={branch.id}
                                        onClick={() => toggle(String(branch.id))}
                                        className={`
                      w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors
                      ${isSelected
                                                ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                                                : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                            }
                    `}
                                    >
                                        <div className={`
                      h-4 w-4 rounded flex items-center justify-center border transition-all flex-shrink-0
                      ${isSelected
                                                ? "bg-blue-600 border-blue-600"
                                                : "border-slate-300 dark:border-slate-600"
                                            }
                    `}>
                                            {isSelected && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                                        </div>
                                        <span className="truncate font-medium">{branch.name}</span>
                                    </button>
                                )
                            })}
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
