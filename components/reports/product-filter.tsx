"use client"

import React from "react"
import { Package } from "lucide-react"
import { useGlobalProducts } from "@/lib/hooks/use-api"
import { cn } from "@/lib/utils"
import { MultiSelectFilter } from "./multi-select-filter"

interface Product {
    id: number
    name: string
    productCode?: string
}

interface ProductFilterProps {
    selectedIds: string[]
    onChange: (ids: string[]) => void
    organizationId?: string | number
    organizationIds?: string[]
    groupIds?: string[]
    placeholder?: string
}

export function ProductFilter({ 
    selectedIds, 
    onChange, 
    organizationId, 
    organizationIds,
    groupIds,
    placeholder = "Select Products" 
}: ProductFilterProps) {
    const orgsQuery = organizationIds?.length ? organizationIds.join(",") : (organizationId ? String(organizationId) : undefined)
    const groupsQuery = groupIds?.length ? groupIds.join(",") : undefined
    const { data, isLoading } = useGlobalProducts(orgsQuery, groupsQuery)
    const products = (data?.items || []) as Product[]
    const items = products.map(p => ({ 
        id: p.id.toString(), 
        label: p.productCode ? `[${p.productCode}] ${p.name}` : p.name 
    }))

    return (
        <MultiSelectFilter
            title="Products"
            items={items}
            selectedIds={selectedIds}
            onChange={onChange}
            icon={<Package className={cn("h-4 w-4 shrink-0", selectedIds.length > 0 ? "text-indigo-600" : "text-slate-400")} />}
            placeholder={placeholder}
            className="w-[300px]"
        />
    )
}
