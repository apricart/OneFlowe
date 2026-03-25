"use client"

import React from "react"
import useSWR from "swr"
import { LayoutGrid } from "lucide-react"
import { MultiSelectFilter } from "./multi-select-filter"
import { cn } from "@/lib/utils"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface Group {
    id: number
    name: string
}

interface GroupFilterProps {
    selectedIds: string[]
    onChange: (ids: string[]) => void
    organizationId?: string | number
    organizationIds?: string[]
    placeholder?: string
}

export function GroupFilter({ selectedIds, onChange, organizationId, organizationIds, placeholder = "Select Groups" }: GroupFilterProps) {
    const orgsQuery = organizationIds?.length ? organizationIds.join(",") : (organizationId ? String(organizationId) : undefined)
    const { data } = useSWR(
        orgsQuery ? `/api/v1/groups?organizationId=${orgsQuery}` : "/api/v1/groups",
        fetcher
    )

    const groups = (data?.groups || []) as Group[]
    const items = groups.map((g: Group) => ({ id: g.id.toString(), label: g.name }))

    return (
        <MultiSelectFilter
            title="Groups"
            items={items}
            selectedIds={selectedIds}
            onChange={onChange}
            icon={<LayoutGrid size={16} className={cn(selectedIds.length > 0 ? "text-indigo-600" : "text-slate-400", "shrink-0")} />}
            placeholder={placeholder}
            className="w-[240px]"
        />
    )
}
