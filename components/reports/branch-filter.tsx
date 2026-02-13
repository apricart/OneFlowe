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
import { useBranches } from "@/lib/hooks/use-api"
import { Building2 } from "lucide-react"

interface Branch {
    id: number
    name: string
}

interface BranchFilterProps {
    onBranchChange: (branchId: string) => void
    organizationId?: string | number
}

export function BranchFilter({ onBranchChange, organizationId }: BranchFilterProps) {
    const [selectedBranch, setSelectedBranch] = useState<string>("all")

    const { data } = useBranches(organizationId ? String(organizationId) : undefined)

    const handleValueChange = (value: string) => {
        setSelectedBranch(value)
        onBranchChange(value === "all" ? "" : value)
    }

    const branches = data?.items || []

    return (
        <div className="flex items-center gap-2">
            <Select value={selectedBranch} onValueChange={handleValueChange}>
                <SelectTrigger className="w-[200px] h-9 rounded-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm focus:ring-blue-500">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <Building2 size={16} className="text-blue-600 shrink-0" />
                        <SelectValue placeholder="Filter by Branch" />
                    </div>
                </SelectTrigger>
                <SelectContent className="rounded-md border-slate-200 dark:border-slate-800">
                    <SelectItem value="all">All Branches</SelectItem>
                    {branches.map((branch: Branch) => (
                        <SelectItem key={branch.id} value={branch.id.toString()}>
                            {branch.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}
