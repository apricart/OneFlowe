"use client"

import { useState } from "react"
import useSWR from "swr"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { LayoutGrid } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface Group {
    id: number
    name: string
}

interface GroupFilterProps {
    value?: string
    onChange: (groupId: string) => void
    organizationId?: string | number
}

export function GroupFilter({ value, onChange, organizationId }: GroupFilterProps) {
    const internalValue = value || "all"

    const { data } = useSWR(
        organizationId ? `/api/v1/groups?organizationId=${organizationId}` : "/api/v1/groups",
        fetcher
    )

    const handleValueChange = (val: string) => {
        onChange(val === "all" ? "" : val)
    }

    const groups = data?.groups || []

    return (
        <div className="flex items-center gap-2">
            <Select value={internalValue} onValueChange={handleValueChange}>
                <SelectTrigger className="w-[200px] h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm focus:ring-blue-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all font-bold text-xs text-slate-700 dark:text-slate-300 ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                        <LayoutGrid size={16} className="text-blue-600 shrink-0" />
                        <SelectValue placeholder="Filter by Group" />
                    </div>
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl p-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
                    <SelectItem value="all" className="rounded-xl px-3 py-2.5 text-xs font-semibold focus:bg-blue-50 dark:focus:bg-blue-900/40 focus:text-blue-600 dark:focus:text-blue-400">All Groups</SelectItem>
                    {groups.map((group: Group) => (
                        <SelectItem key={group.id} value={group.id.toString()} className="rounded-xl px-3 py-2.5 text-xs font-semibold focus:bg-blue-50 dark:focus:bg-blue-900/40 focus:text-blue-600 dark:focus:text-blue-400">
                            {group.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}
