"use client"

import React, { ReactNode, useCallback, useEffect, useMemo, useState } from "react"
import useSWR, { useSWRConfig } from "swr"
import { useSession } from "next-auth/react"
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Edit2,
  PackageCheck,
  PackagePlus,
  PieChart,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
  Zap,
} from "lucide-react"

import { useToast } from "@/hooks/use-toast"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { GlobalDateFilter, type FilterPreset } from "@/components/dashboard/global-date-filter"
import { BranchFilter } from "@/components/reports/branch-filter"
import { GroupFilter } from "@/components/reports/group-filter"
import { useAppContext } from "@/components/context/app-context"
import { type DateRange } from "@/lib/hooks/use-sales-performance"
import { cn, formatPKR } from "@/lib/utils"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface BudgetAllocation {
  branchId: number
  branchName: string
  organizationId: number
  groupId?: number
  groupName?: string
  amountAllocatedCents: number
  amountSpentCents: number
  amountHeldCents: number
  amountCreditedCents: number
  remainingCents: number
  baselineBudgetCents: number
}

interface ProductOption {
  id: number
  productCode?: string | null
  name?: string | null
  productName?: string | null
  customName?: string | null
  unit?: string | null
  basePrice?: number | string | null
  customPrice?: number | string | null
  isEnabled?: boolean | null
  isAvailable?: boolean | null
}

interface QuantityAllocationLine {
  id: string
  productId: string
  quantity: string
}

const createAllocationLine = (): QuantityAllocationLine => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  productId: "",
  quantity: "",
})

const toCents = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const getProductName = (product?: ProductOption) => product?.customName || product?.productName || product?.name || "Select product"

const getProductPriceCents = (product?: ProductOption) => {
  if (!product) return null
  return toCents(product.customPrice) ?? toCents(product.basePrice)
}

const getBudgetUsagePercentage = (budget: BudgetAllocation) => {
  const total = (budget.amountAllocatedCents || 0) + (budget.amountCreditedCents || 0)
  if (total <= 0) return 0
  return (((budget.amountSpentCents || 0) + (budget.amountHeldCents || 0)) / total) * 100
}

const formatPercentageNoRound = (value: number) => {
  const scaled = Math.trunc(value * 100)
  const sign = scaled < 0 ? "-" : ""
  const absoluteScaled = Math.abs(scaled)
  const whole = Math.trunc(absoluteScaled / 100)
  const decimal = String(absoluteScaled % 100).padStart(2, "0")
  return `${sign}${whole}.${decimal}%`
}

export default function BudgetByQuantityPage() {
  const { data: session, status } = useSession()
  const { toast } = useToast()
  const { mutate: globalMutate } = useSWRConfig()
  const role = (session?.user as any)?.role
  const isHeadOffice = role === "HEAD_OFFICE" || role === "SUPER_ADMIN"
  const {
    organizationId,
    branchIds: contextBranchIds,
    setBranchIds: setContextBranchIds,
    isInitialized,
  } = useAppContext()

  const [searchQuery, setSearchQuery] = useState("")
  const [editingBudget, setEditingBudget] = useState<BudgetAllocation | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [allocationType, setAllocationType] = useState<"monthly" | "addon">("addon")
  const [allocationLines, setAllocationLines] = useState<QuantityAllocationLine[]>(() => [createAllocationLine()])
  const [isSavingAllocation, setIsSavingAllocation] = useState(false)

  const [dateRange, setDateRange] = useState<DateRange | null>(null)
  const [activePreset, setActivePreset] = useState<FilterPreset>("all")
  const [selectedMonths, setSelectedMonths] = useState<number[]>([])
  const [selectedYears, setSelectedYears] = useState<number[]>([])
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])

  const handleDateChange = useCallback((
    range: DateRange | null,
    preset: FilterPreset,
    _compare?: boolean,
    _compareRange?: DateRange | null,
    months?: number[],
    years?: number[]
  ) => {
    setDateRange(range)
    setActivePreset(preset)
    setSelectedMonths(months || [])
    setSelectedYears(years || [])
  }, [])

  useEffect(() => {
    if (isInitialized) {
      handleDateChange(null, "all")
    }
  }, [isInitialized, handleDateChange])

  const budgetsEndpoint = useMemo(() => {
    if (!isHeadOffice || !isInitialized) return null

    const params = new URLSearchParams()
    params.set("all", "true")
    if (organizationId) params.set("organizationId", String(organizationId))
    if (dateRange) {
      params.set("startDate", dateRange.startDate.toISOString())
      params.set("endDate", dateRange.endDate.toISOString())
    }
    params.set("preset", activePreset)
    if (selectedMonths.length > 0) params.set("months", selectedMonths.join(","))
    const effectiveSelectedYears = selectedMonths.length > 0 && selectedYears.length === 0 && !dateRange
      ? [new Date().getFullYear()]
      : selectedYears
    if (effectiveSelectedYears.length > 0) params.set("years", effectiveSelectedYears.join(","))
    if (selectedGroupIds.length > 0) params.set("groupIds", selectedGroupIds.join(","))
    if (contextBranchIds.length > 0) params.set("branchIds", contextBranchIds.join(","))

    return `/api/v1/budgets?${params.toString()}`
  }, [activePreset, contextBranchIds, dateRange, isHeadOffice, isInitialized, organizationId, selectedGroupIds, selectedMonths, selectedYears])

  const catalogEndpoint = useMemo(() => {
    if (!isHeadOffice || !isInitialized || !organizationId) return null

    const params = new URLSearchParams()
    params.set("organizationId", String(organizationId))
    if (selectedGroupIds.length > 0) params.set("groupIds", selectedGroupIds.join(","))

    return `/api/v1/inventory/organization-products?${params.toString()}`
  }, [isHeadOffice, isInitialized, organizationId, selectedGroupIds])

  const dialogProductsEndpoint = useMemo(() => {
    if (!showDialog || !editingBudget) return null

    const params = new URLSearchParams()
    params.set("branchId", String(editingBudget.branchId))
    params.set("organizationId", String(editingBudget.organizationId))

    params.set("limit", "500")

    return `/api/v1/branch/inventory?${params.toString()}`
  }, [editingBudget, showDialog])

  const { data: budgetsData, mutate } = useSWR<any>(budgetsEndpoint, fetcher)
  const { data: catalogData } = useSWR<any>(catalogEndpoint, fetcher)
  const { data: dialogProductsData, isLoading: productsLoading } = useSWR<any>(dialogProductsEndpoint, fetcher)

  const budgets: BudgetAllocation[] = budgetsData?.budgets || []
  const catalogProducts: ProductOption[] = catalogData?.items || []
  const dialogProducts: ProductOption[] = dialogProductsData?.items || []
  const productsById = useMemo(() => {
    return new Map(dialogProducts.map((product) => [String(product.id), product]))
  }, [dialogProducts])

  const scopedBudgets = useMemo(() => {
    return budgets.filter((budget) => {
      if (organizationId && String(budget.organizationId) !== String(organizationId)) return false
      if (selectedGroupIds.length > 0 && budget.groupId && !selectedGroupIds.includes(String(budget.groupId))) return false
      if (contextBranchIds.length > 0 && !contextBranchIds.includes(String(budget.branchId))) return false
      return true
    })
  }, [budgets, contextBranchIds, organizationId, selectedGroupIds])

  const filteredBudgets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return scopedBudgets

    return scopedBudgets.filter((budget) =>
      budget.branchName.toLowerCase().includes(query) ||
      budget.branchId.toString().includes(query) ||
      budget.groupName?.toLowerCase().includes(query)
    )
  }, [scopedBudgets, searchQuery])

  const totalAllocated = scopedBudgets.reduce((sum, budget) => sum + budget.amountAllocatedCents + (budget.amountCreditedCents || 0), 0)
  const totalSpent = scopedBudgets.reduce((sum, budget) => sum + budget.amountSpentCents + budget.amountHeldCents, 0)
  const totalRemaining = scopedBudgets.reduce((sum, budget) => sum + budget.remainingCents, 0)
  const avgUtilization = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0
  const atRiskBranches = scopedBudgets.filter((budget) => getBudgetUsagePercentage(budget) >= 90).length

  const allocationSummary = useMemo(() => {
    return allocationLines.reduce(
      (summary, line) => {
        const product = productsById.get(line.productId)
        const priceCents = getProductPriceCents(product)
        const quantity = Number(line.quantity)
        const validQuantity = Number.isInteger(quantity) && quantity > 0

        if (!product || priceCents === null || !validQuantity) return summary

        summary.totalQuantity += quantity
        summary.totalValueCents += priceCents * quantity
        summary.items += 1
        return summary
      },
      { items: 0, totalQuantity: 0, totalValueCents: 0 }
    )
  }, [allocationLines, productsById])

  const resetBudgetFilters = useCallback(() => {
    handleDateChange(null, "all")
    setSelectedGroupIds([])
    setContextBranchIds([])
    setSearchQuery("")
    mutate()
  }, [handleDateChange, mutate, setContextBranchIds])

  const handleEditBudget = (budget: BudgetAllocation) => {
    setEditingBudget(budget)
    setAllocationType("addon")
    setAllocationLines([createAllocationLine()])
    setShowDialog(true)
  }

  const updateAllocationLine = (lineId: string, patch: Partial<QuantityAllocationLine>) => {
    setAllocationLines((current) =>
      current.map((line) => (line.id === lineId ? { ...line, ...patch } : line))
    )
  }

  const addAllocationLine = () => {
    setAllocationLines((current) => [...current, createAllocationLine()])
  }

  const removeAllocationLine = (lineId: string) => {
    setAllocationLines((current) =>
      current.length === 1 ? [createAllocationLine()] : current.filter((line) => line.id !== lineId)
    )
  }

  const validateAllocation = () => {
    if (!editingBudget) return "Select a branch before allocating quantity."
    if (allocationSummary.items === 0) return "Select at least one product and enter a positive whole quantity."

    const selectedProductIds = allocationLines
      .map((line) => line.productId)
      .filter(Boolean)
    if (new Set(selectedProductIds).size !== selectedProductIds.length) {
      return "Each product can only appear once in a quantity allocation."
    }

    for (const line of allocationLines) {
      if (!line.productId && !line.quantity) continue

      const product = productsById.get(line.productId)
      const quantity = Number(line.quantity)
      const priceCents = getProductPriceCents(product)

      if (!product) return "Select a product for every allocation row."
      if (!Number.isInteger(quantity) || quantity <= 0) return "Quantity must be a positive whole number."
      if (priceCents === null || priceCents <= 0) {
        return `Pricing is unavailable for ${getProductName(product)}. Quantity allocation needs product pricing to update the active budget.`
      }
    }

    const currentSpentCents = (editingBudget.amountSpentCents || 0) + (editingBudget.amountHeldCents || 0)
    const proposedTotalCents = allocationType === "monthly"
      ? allocationSummary.totalValueCents + (editingBudget.amountCreditedCents || 0)
      : (editingBudget.amountAllocatedCents || 0) + (editingBudget.amountCreditedCents || 0) + allocationSummary.totalValueCents

    if (proposedTotalCents < currentSpentCents) {
      return `The resulting budget ${formatPKR(proposedTotalCents / 100)} cannot be lower than current spending ${formatPKR(currentSpentCents / 100)}.`
    }

    return null
  }

  const handleSaveQuantityAllocation = async () => {
    const validationError = validateAllocation()
    if (validationError || !editingBudget) {
      return toast({ title: "Allocation blocked", description: validationError || "Invalid quantity allocation.", variant: "destructive" })
    }

    setIsSavingAllocation(true)
    try {
      const res = await fetch("/api/v1/budget-quantity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: editingBudget.branchId,
          items: allocationLines
            .filter((line) => line.productId && line.quantity)
            .map((line) => ({
              branchInventoryId: Number(line.productId),
              quantity: Number(line.quantity),
            })),
          type: allocationType,
        }),
      })

      if (!res.ok) {
        const json = await res.json()
        return toast({ title: "Failed", description: json.error, variant: "destructive" })
      }

      toast({
        title: "Quantity budget allocated",
        description: `${allocationSummary.totalQuantity} units across ${allocationSummary.items} product${allocationSummary.items === 1 ? "" : "s"} allocated to ${editingBudget.branchName}.`,
      })
      setShowDialog(false)
      setEditingBudget(null)
      setAllocationLines([createAllocationLine()])
      mutate()
      globalMutate((key) => typeof key === "string" && key.includes("/api/v1/analytics/budgets/summary"))
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setIsSavingAllocation(false)
    }
  }

  const getStatusColor = (percentage: number) => {
    if (percentage >= 90) return "bg-red-500"
    if (percentage >= 70) return "bg-yellow-500"
    return "bg-green-500"
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  if (!isHeadOffice) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="p-8 text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
          <p className="text-muted-foreground">You do not have permission to access this page</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20 dark:bg-[#020617]">
      <div className="sticky top-0 z-30 w-full border-b border-slate-200 bg-white/80 shadow-sm backdrop-blur-xl transition-all duration-300 dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="group flex h-12 w-12 rotate-3 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 shadow-lg shadow-indigo-500/20 transition-all duration-500 hover:rotate-0">
              <PackagePlus className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Budget by Quantity</h1>
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                <PackageCheck className="h-3.5 w-3.5" />
                Product Quantity Allocation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <GlobalDateFilter
              value={dateRange}
              activePreset={activePreset}
              onChange={handleDateChange}
              months={selectedMonths}
              years={selectedYears}
            />
            {(role === "SUPER_ADMIN" || role === "HEAD_OFFICE") && (
              <div className="flex h-6 items-center gap-2 border-l border-slate-200 pl-3 dark:border-slate-800">
                <GroupFilter
                  selectedIds={selectedGroupIds}
                  onChange={setSelectedGroupIds}
                  organizationId={organizationId || undefined}
                  disabled={contextBranchIds.length > 0}
                />
                <BranchFilter
                  selectedIds={contextBranchIds}
                  onChange={setContextBranchIds}
                  organizationId={organizationId || undefined}
                  groupIds={selectedGroupIds}
                />
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="ml-2 rounded-xl border border-slate-200 bg-white text-slate-400 transition-colors hover:text-indigo-500 dark:border-slate-800 dark:bg-slate-900"
              onClick={resetBudgetFilters}
            >
              <RefreshCw className={cn("h-4 w-4", !budgetsData && "animate-spin")} />
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] space-y-6 p-4 md:p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <CompactStatCard
            label="Branches in Scope"
            value={scopedBudgets.length}
            icon={<PackageCheck className="h-5 w-5" />}
            gradient="bg-gradient-to-br from-indigo-50/80 to-blue-50/80 border-indigo-100/50 text-indigo-700 dark:from-indigo-900/20 dark:to-blue-900/20 dark:border-indigo-800/30 dark:text-indigo-400"
            iconBadge="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400"
          />
          <CompactStatCard
            label="Selectable Products"
            value={catalogProducts.length}
            icon={<PackagePlus className="h-5 w-5" />}
            gradient="bg-gradient-to-br from-cyan-50/80 to-teal-50/80 border-cyan-100/50 text-cyan-700 dark:from-cyan-900/20 dark:to-teal-900/20 dark:border-cyan-800/30 dark:text-cyan-400"
            iconBadge="bg-cyan-100 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-400"
          />
          <CompactStatCard
            label="Remaining Value"
            value={formatPKR(totalRemaining / 100)}
            icon={<CheckCircle2 className="h-5 w-5" />}
            gradient="bg-gradient-to-br from-teal-50/80 to-emerald-50/80 border-teal-100/50 text-teal-700 dark:from-teal-900/20 dark:to-emerald-900/20 dark:border-teal-800/30 dark:text-teal-400"
            iconBadge="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400"
          />
          <CompactStatCard
            label="Avg Utilization"
            value={formatPercentageNoRound(avgUtilization)}
            icon={<Zap className="h-5 w-5" />}
            gradient="bg-gradient-to-br from-fuchsia-50/80 to-purple-50/80 border-fuchsia-100/50 text-fuchsia-700 dark:from-fuchsia-900/20 dark:to-purple-900/20 dark:border-fuchsia-800/30 dark:text-fuchsia-400"
            iconBadge="bg-fuchsia-100 dark:bg-fuchsia-900/40 text-fuchsia-600 dark:text-fuchsia-400"
          />
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search branches or groups..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm font-bold uppercase tracking-tight outline-none transition-all focus:ring-2 focus:ring-blue-500 dark:border-slate-800 dark:bg-slate-900"
            />
          </div>
          <Badge className="w-fit rounded-full bg-slate-900 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white dark:bg-white dark:text-slate-950">
            {atRiskBranches} branches at 90%+ usage
          </Badge>
        </div>

        <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-900/50">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 dark:border-slate-700 dark:from-slate-900 dark:to-slate-800">
                <TableHead className="pl-5 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Branch</TableHead>
                <TableHead className="text-left text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Group</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Current Value</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Spent</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-indigo-500">Remaining</TableHead>
                <TableHead className="pr-5 text-right text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Quantity Allocation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {budgets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-16 text-center">
                    <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-yellow-500 opacity-40" />
                    <p className="text-sm text-muted-foreground">No branches found</p>
                  </TableCell>
                </TableRow>
              ) : filteredBudgets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    No branches match your search
                  </TableCell>
                </TableRow>
              ) : (
                filteredBudgets.map((budget) => {
                  const spendingPercent = getBudgetUsagePercentage(budget)
                  const isNearLimit = spendingPercent >= 90
                  const isMedium = spendingPercent >= 70
                  const totalBudget = budget.amountAllocatedCents + (budget.amountCreditedCents || 0)
                  const spent = budget.amountSpentCents + budget.amountHeldCents

                  return (
                    <TableRow
                      key={budget.branchId}
                      className={cn(
                        "border-b border-slate-100 transition-colors dark:border-slate-800/50",
                        isNearLimit ? "bg-red-50/60 dark:bg-red-950/10" : "",
                        isMedium && !isNearLimit ? "bg-amber-50/40 dark:bg-amber-950/10" : "",
                        "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      )}
                    >
                      <TableCell className="py-2.5 pl-5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className={cn("h-2 w-2 shrink-0 rounded-full", isNearLimit ? "bg-red-500" : isMedium ? "bg-amber-500" : "bg-emerald-500")} />
                          <span className="truncate text-[13px] font-semibold text-slate-800 dark:text-slate-200" title={budget.branchName}>
                            {budget.branchName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <span className="text-[13px] font-medium text-slate-500 dark:text-slate-400">
                          {budget.groupName || "Ungrouped"}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[13px] font-black tabular-nums text-slate-900 dark:text-white">
                            {formatPKR(totalBudget / 100)}
                          </span>
                          {totalBudget > 0 && (
                            <div className="h-1 w-12 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                              <div
                                className={cn("h-full rounded-full transition-all duration-500", getStatusColor(spendingPercent))}
                                style={{ width: `${Math.min(100, spendingPercent)}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 text-right">
                        <span className="text-[13px] font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                          {formatPKR(spent / 100)}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5 text-right">
                        <span className={cn("text-[13px] font-black tabular-nums", budget.remainingCents < 0 ? "text-red-600" : "text-emerald-600 dark:text-emerald-400")}>
                          {formatPKR(budget.remainingCents / 100)}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5 pr-5 text-right">
                        <Button
                          size="sm"
                          onClick={() => handleEditBudget(budget)}
                          className="h-7 rounded-lg bg-indigo-600 px-2.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm hover:bg-indigo-700"
                        >
                          <Edit2 className="mr-1 h-3 w-3" />
                          Allocate
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-900/50">
            <div className="mb-4 flex items-center gap-3">
              <PieChart className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Quantity Allocation Model</h3>
            </div>
            <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
              <div className="flex items-center justify-between">
                <span>Budget source of truth</span>
                <span className="font-bold text-slate-900 dark:text-white">Existing branch budget</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Allocation input</span>
                <span className="font-bold text-slate-900 dark:text-white">Product quantity</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Calculated from</span>
                <span className="font-bold text-slate-900 dark:text-white">Tenant product pricing</span>
              </div>
            </div>
          </Card>

          <Card className="border border-slate-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:to-slate-900 dark:shadow-slate-900/50">
            <div className="mb-4 flex items-center gap-3">
              <PackageCheck className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Scoped Product Catalog</h3>
            </div>
            <div className="space-y-2">
              <p className="text-2xl font-bold text-indigo-600">{catalogProducts.length}</p>
              <p className="text-xs text-muted-foreground">Products available in the selected organization context.</p>
            </div>
          </Card>
        </div>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <DialogHeader>
              <DialogTitle className="text-slate-900 dark:text-white">Allocate Budget by Quantity</DialogTitle>
              <DialogDescription className="text-slate-600 dark:text-slate-400">
                Select products and quantities for {editingBudget?.branchName}. The budget value is calculated from scoped product pricing.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950 md:grid-cols-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Branch</p>
                  <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{editingBudget?.branchName}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Remaining</p>
                  <p className="text-sm font-bold text-emerald-600">{formatPKR((editingBudget?.remainingCents || 0) / 100)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Quantity Value</p>
                  <p className="text-sm font-bold text-indigo-600">{formatPKR(allocationSummary.totalValueCents / 100)}</p>
                </div>
              </div>

              <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800">
                <button
                  onClick={() => setAllocationType("addon")}
                  className={cn(
                    "flex-1 rounded-lg py-2 text-xs font-bold transition-all",
                    allocationType === "addon"
                      ? "bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-indigo-400"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  )}
                >
                  One-time Quantity Add-on
                </button>
                <button
                  onClick={() => setAllocationType("monthly")}
                  className={cn(
                    "flex-1 rounded-lg py-2 text-xs font-bold transition-all",
                    allocationType === "monthly"
                      ? "bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-indigo-400"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  )}
                >
                  Monthly Quantity Baseline
                </button>
              </div>

              <div className="space-y-3">
                {allocationLines.map((line, index) => {
                  const product = productsById.get(line.productId)
                  const priceCents = getProductPriceCents(product)
                  const quantity = Number(line.quantity)
                  const lineTotal = product && priceCents !== null && Number.isInteger(quantity) && quantity > 0
                    ? priceCents * quantity
                    : 0

                  return (
                    <div key={line.id} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950 md:grid-cols-[minmax(0,1fr)_140px_130px_36px]">
                      <div className="min-w-0">
                        <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Product {index + 1}
                        </label>
                        <Select
                          value={line.productId}
                          onValueChange={(value) => updateAllocationLine(line.id, { productId: value })}
                          disabled={productsLoading}
                        >
                          <SelectTrigger className="h-10 w-full">
                            <SelectValue placeholder={productsLoading ? "Loading products..." : "Select product"} />
                          </SelectTrigger>
                          <SelectContent>
                            {dialogProducts.map((productOption) => {
                              const optionPriceCents = getProductPriceCents(productOption)
                              const productLabel = getProductName(productOption)

                              return (
                                <SelectItem key={productOption.id} value={String(productOption.id)}>
                                  {productOption.productCode ? `${productOption.productCode} - ` : ""}
                                  {productLabel}
                                  {productOption.unit ? ` (${productOption.unit})` : ""}
                                  {optionPriceCents !== null ? ` - ${formatPKR(optionPriceCents / 100)}` : ""}
                                </SelectItem>
                              )
                            })}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Quantity</label>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          step="1"
                          value={line.quantity}
                          onChange={(event) => updateAllocationLine(line.id, { quantity: event.target.value })}
                          placeholder="0"
                          className="h-10 font-bold"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Value</label>
                        <div className="flex h-10 items-center justify-end rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-black tabular-nums text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white">
                          {formatPKR(lineTotal / 100)}
                        </div>
                      </div>

                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/20"
                          onClick={() => removeAllocationLine(line.id)}
                        >
                          {allocationLines.length === 1 ? <X className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-indigo-100 bg-indigo-50 p-4 dark:border-indigo-800/30 dark:bg-indigo-900/20 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-indigo-900 dark:text-indigo-100">
                    {allocationSummary.totalQuantity} total units across {allocationSummary.items} product{allocationSummary.items === 1 ? "" : "s"}
                  </p>
                  <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
                    Equivalent budget value: {formatPKR(allocationSummary.totalValueCents / 100)}
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={addAllocationLine} className="gap-2 rounded-xl bg-white font-bold dark:bg-slate-950">
                  <Plus className="h-4 w-4" />
                  Add Product
                </Button>
              </div>

              {dialogProductsData?.pricesHidden && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
                  Product prices are hidden for this role/context, so quantity allocation cannot be applied until pricing is visible.
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)} disabled={isSavingAllocation}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveQuantityAllocation}
                disabled={isSavingAllocation || productsLoading || allocationSummary.totalValueCents <= 0 || dialogProductsData?.pricesHidden}
                className="gap-2 bg-indigo-600 text-white hover:bg-indigo-700"
              >
                {isSavingAllocation ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Apply Quantity Allocation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

function CompactStatCard({
  label,
  value,
  icon,
  gradient,
  iconBadge,
}: {
  label: string
  value: string | number
  icon: ReactNode
  gradient: string
  iconBadge: string
}) {
  return (
    <Card className={cn("rounded-2xl border shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md [container-type:inline-size]", gradient)}>
      <CardContent className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 p-3">
        <div className="min-w-0 space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">
            {label}
          </p>
          <p className="whitespace-nowrap text-[clamp(1.05rem,8.5cqw,2.1rem)] font-black leading-tight tracking-tight tabular-nums">
            {value}
          </p>
        </div>
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl 2xl:h-12 2xl:w-12", iconBadge)}>
          {icon}
        </div>
      </CardContent>
    </Card>
  )
}
