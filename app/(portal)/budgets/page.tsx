"use client"
import React, { useState, useMemo } from "react"
import useSWR, { useSWRConfig } from "swr"
import { useSession } from "next-auth/react"
import { useToast } from "@/hooks/use-toast"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Wallet, AlertCircle, Edit2, Zap, PieChart, CheckCircle2, Clock, AlertTriangle, RefreshCw, Trash2, Search } from "lucide-react"
import { formatPKR, cn } from "@/lib/utils"
import { useAppContext } from "@/components/context/app-context"
import { GlobalDateFilter, type FilterPreset } from "@/components/dashboard/global-date-filter"
import { OrganizationFilter } from "@/components/reports/organization-filter"
import { GroupFilter } from "@/components/reports/group-filter"
import { BranchFilter } from "@/components/reports/branch-filter"
import { useCallback } from "react"
import { type DateRange } from "@/lib/hooks/use-sales-performance"

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface BudgetAllocation {
  branchId: number
  branchName: string
  organizationId: number
  amountAllocatedCents: number
  amountSpentCents: number
  amountHeldCents: number
  amountCreditedCents: number
  remainingCents: number
  baselineBudgetCents: number
}

export default function BudgetsPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const { mutate: globalMutate } = useSWRConfig()
  const role = (session?.user as any)?.role
  const isHeadOffice = role === "HEAD_OFFICE" || role === "SUPER_ADMIN"
  const { organizationId, branchId, isInitialized } = useAppContext()

  const [searchQuery, setSearchQuery] = useState("")
  const [editingBudget, setEditingBudget] = useState<BudgetAllocation | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [newAmount, setNewAmount] = useState("")
  const [bulkAmount, setBulkAmount] = useState("")
  const [showBulkDialog, setShowBulkDialog] = useState(false)
  const [showEmptyDialog, setShowEmptyDialog] = useState(false)
  const [showEmptyAllDialog, setShowEmptyAllDialog] = useState(false)
  const [emptyingBudget, setEmptyingBudget] = useState<BudgetAllocation | null>(null)
  const [allocationType, setAllocationType] = useState<"monthly" | "addon">("addon")

  // ━━━ GLOBAL FILTERS ━━━
  const [dateRange, setDateRange] = useState<DateRange | null>({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    endDate: new Date()
  })
  const [activePreset, setActivePreset] = useState<FilterPreset>("thisMonth")
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([])
  const [selectedMonths, setSelectedMonths] = useState<number[]>([])
  const [selectedYears, setSelectedYears] = useState<number[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<string>(organizationId ? String(organizationId) : "")

  const handleDateChange = useCallback((range: DateRange | null, preset: FilterPreset, c?: boolean, cr?: DateRange | null, m?: number[], y?: number[]) => {
    setDateRange(range)
    setActivePreset(preset)
    if (m !== undefined) setSelectedMonths(m)
    if (y !== undefined) setSelectedYears(y)
  }, [])

  // Sync selectedOrgId when context changes
  React.useEffect(() => {
    if (organizationId && !selectedOrgId) {
      setSelectedOrgId(String(organizationId))
    }
  }, [organizationId])

  // Build endpoint respecting context (organization scope)
  const budgetsEndpoint = useMemo(() => {
    if (!isHeadOffice || !isInitialized) return null
    const params = new URLSearchParams()
    params.set("all", "true")
    if (selectedOrgId) {
      params.set("organizationId", selectedOrgId)
    }

    if (dateRange?.startDate) {
      const year = dateRange.startDate.getFullYear()
      const month = String(dateRange.startDate.getMonth() + 1).padStart(2, '0')
      params.set("period", `${year}-${month}`)
    }

    if (selectedGroupIds.length > 0) params.set("groupIds", selectedGroupIds.join(","))
    if (selectedBranchIds.length > 0) params.set("branchIds", selectedBranchIds.join(","))

    return `/api/v1/budgets?${params.toString()}`
  }, [isHeadOffice, isInitialized, selectedOrgId, dateRange, selectedGroupIds, selectedBranchIds])

  const { data: budgetsData, mutate } = useSWR<any>(budgetsEndpoint, fetcher)

  const budgets: BudgetAllocation[] = budgetsData?.budgets || []

  const formatAmount = (cents: number) => formatPKR(cents / 100)

  // Filter by organization scope only (not branch) - budgets should show all branches in the org
  const scopedBudgets = useMemo(() => {
    return budgets.filter((b) => {
      if (selectedOrgId && String(b.organizationId) !== selectedOrgId) return false
      // Branch-level filtering removed - Head Office needs to see all branches for budget management
      return true
    })
  }, [budgets, selectedOrgId])

  const filteredBudgets = useMemo(() => {
    return scopedBudgets.filter((b) =>
      b.branchName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.branchId.toString().includes(searchQuery)
    )
  }, [scopedBudgets, searchQuery])

  const totalAllocated = scopedBudgets.reduce((sum, b) => sum + b.amountAllocatedCents + (b.amountCreditedCents || 0), 0)
  const totalSpent = scopedBudgets.reduce((sum, b) => sum + b.amountSpentCents, 0)
  const totalHeld = scopedBudgets.reduce((sum, b) => sum + b.amountHeldCents, 0)
  const totalRemaining = scopedBudgets.reduce((sum, b) => sum + b.remainingCents, 0)
  const avgBudget = scopedBudgets.length > 0 ? totalAllocated / scopedBudgets.length : 0

  const handleEditBudget = (budget: BudgetAllocation) => {
    setEditingBudget(budget)
    setNewAmount("") // Start with empty field since we're adding, not replacing
    setAllocationType("addon")
    setShowDialog(true)
  }

  const handleSaveBudget = async () => {
    if (!editingBudget || !newAmount) return
    const amountCents = Math.round(parseFloat(newAmount) * 100)
    if (!Number.isFinite(amountCents) || amountCents < 0) {
      return toast({ title: "Invalid amount", variant: "destructive" })
    }

    // Client-side validation: Total Proposed Budget >= Current Total Spent
    const currentSpentCents = (editingBudget.amountSpentCents || 0) + (editingBudget.amountHeldCents || 0)
    let proposedTotalCents = 0
    if (allocationType === "monthly") {
      proposedTotalCents = amountCents + (editingBudget.amountCreditedCents || 0)
    } else {
      // Add-on type: adding to the current credits
      proposedTotalCents = (editingBudget.amountAllocatedCents || 0) + (editingBudget.amountCreditedCents || 0) + amountCents
    }

    if (proposedTotalCents < currentSpentCents) {
      return toast({
        title: "Allocation Blocked",
        description: `Total budget (₨${(proposedTotalCents / 100).toFixed(2)}) cannot be lower than current spending (₨${(currentSpentCents / 100).toFixed(2)}).`,
        variant: "destructive"
      })
    }

    try {
      const res = await fetch("/api/v1/budgets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: editingBudget.branchId,
          amountAllocatedCents: amountCents,
          type: allocationType,
        })
      })

      if (!res.ok) {
        const json = await res.json()
        return toast({ title: "Failed", description: json.error, variant: "destructive" })
      }

      const newRemaining = (editingBudget.remainingCents / 100) + parseFloat(newAmount)
      toast({
        title: "Budget Updated",
        description: `Added ${formatPKR(parseFloat(newAmount))} to ${editingBudget.branchName}. New remaining: ${formatPKR(newRemaining)}`,
      })
      setShowDialog(false)
      setEditingBudget(null)
      mutate()
      
      // Global revalidation for analytics
      globalMutate(key => typeof key === 'string' && key.includes('/api/v1/analytics/budgets/summary'))
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }

  const handleEmptyBudget = (budget: BudgetAllocation) => {
    setEmptyingBudget(budget)
    setShowEmptyDialog(true)
  }

  const handleConfirmEmptyBudget = async () => {
    if (!emptyingBudget) return

    // Client-side validation: Cannot empty budget if there is spending
    const currentSpentCents = (emptyingBudget.amountSpentCents || 0) + (emptyingBudget.amountHeldCents || 0)
    if (currentSpentCents > 0) {
      return toast({
        title: "Cannot Reset Budget",
        description: `This branch has already spent ₨${(currentSpentCents / 100).toFixed(2)}. You must maintain at least enough budget to cover existing spending.`,
        variant: "destructive"
      })
    }

    try {
      const res = await fetch("/api/v1/budgets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: emptyingBudget.branchId,
          amountAllocatedCents: 0,
          setAbsolute: true,
          resetAddons: true,
        })
      })

      if (!res.ok) {
        const json = await res.json()
        return toast({ title: "Failed", description: json.error, variant: "destructive" })
      }

      toast({
        title: "Budget Emptied",
        description: `Successfully reset budget for ${emptyingBudget.branchName} to ₨0.00`,
      })
      setShowEmptyDialog(false)
      setEmptyingBudget(null)
      mutate()
      
      // Global revalidation for analytics
      globalMutate(key => typeof key === 'string' && key.includes('/api/v1/analytics/budgets/summary'))
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }

  const handleEmptyAllBudgets = async () => {
    try {
      let successCount = 0
      for (const budget of scopedBudgets) {
        const res = await fetch("/api/v1/budgets", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            branchId: budget.branchId,
            amountAllocatedCents: 0,
            setAbsolute: true,
            resetAddons: true,
          })
        })
        if (res.ok) successCount++
      }

      toast({
        title: "Bulk Empty Complete",
        description: `Reset ${successCount}/${scopedBudgets.length} branch budgets to ₨0.00`
      })
      setShowEmptyAllDialog(false)
      mutate()
      
      // Global revalidation for analytics
      globalMutate(key => typeof key === 'string' && key.includes('/api/v1/analytics/budgets/summary'))
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }

  const handleBulkAllocate = async () => {
    if (!bulkAmount) return
    const amountCents = Math.round(parseFloat(bulkAmount) * 100)
    if (!Number.isFinite(amountCents) || amountCents < 0) {
      return toast({ title: "Invalid amount", variant: "destructive" })
    }

    try {
      let successCount = 0
      // Apply only to branches in current context scope
      for (const budget of scopedBudgets) {
        const res = await fetch("/api/v1/budgets", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            branchId: budget.branchId,
            amountAllocatedCents: amountCents,
          })
        })
        if (res.ok) successCount++
      }

      toast({
        title: "Bulk Allocation Complete",
        description: `Allocated ${formatPKR(parseFloat(bulkAmount))} to ${successCount}/${scopedBudgets.length} branches in view`
      })
      setShowBulkDialog(false)
      setBulkAmount("")
      mutate()

      // Global revalidation for analytics
      globalMutate(key => typeof key === 'string' && key.includes('/api/v1/analytics/budgets/summary'))
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }

  const getSpendingPercentage = (budget: BudgetAllocation) => {
    const total = (budget.amountAllocatedCents || 0) + (budget.amountCreditedCents || 0)
    if (total <= 0) return 0
    const usage = (budget.amountSpentCents + budget.amountHeldCents)
    return (usage / total) * 100
  }

  const getStatusColor = (percentage: number) => {
    if (percentage >= 90) return "bg-red-500"
    if (percentage >= 70) return "bg-yellow-500"
    return "bg-green-500"
  }

  if (!isHeadOffice) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-muted-foreground">You do not have permission to access this page</p>
        </Card>
      </div>
    )
  }

  const currentMonth = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] pb-20">
      {/* ━━━ STICKY PREMIUM HEADER ━━━ */}
      <div className="sticky top-0 z-50 w-full backdrop-blur-xl bg-white/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center shadow-lg shadow-indigo-500/20 rotate-3 group hover:rotate-0 transition-all duration-500">
              <Wallet className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Budget Intelligence</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
                <PieChart className="h-3.5 w-3.5" />
                Financial Allocation Hub
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner">
              <GlobalDateFilter 
                value={dateRange} 
                activePreset={activePreset} 
                onChange={handleDateChange} 
              />
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
              {role === "SUPER_ADMIN" && (
                <OrganizationFilter 
                  selectedIds={selectedOrgId ? [selectedOrgId] : []} 
                  onChange={(ids) => {
                    setSelectedOrgId(ids[0] || "");
                    setSelectedGroupIds([]);
                    setSelectedBranchIds([]);
                  }}
                  maxSelect={1}
                />
              )}
              {selectedOrgId && (
                <GroupFilter 
                  selectedIds={selectedGroupIds} 
                  onChange={(ids) => {
                    setSelectedGroupIds(ids);
                    setSelectedBranchIds([]);
                  }} 
                  organizationId={parseInt(selectedOrgId)} 
                />
              )}
              {selectedOrgId && (
                <BranchFilter 
                  selectedIds={selectedBranchIds} 
                  onChange={setSelectedBranchIds} 
                  organizationId={selectedOrgId}
                  groupIds={selectedGroupIds}
                />
              )}
            </div>
            <Button variant="ghost" size="icon" className="rounded-xl text-slate-400 hover:text-indigo-500 transition-colors" onClick={() => mutate()}>
              <RefreshCw className={cn("h-4 w-4", !budgetsData && "animate-spin")} />
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-4 md:p-6 max-w-[1600px] mx-auto">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0A1C92] via-[#2F2CC9] to-[#7C3AED] px-6 py-6 text-white shadow-xl ring-1 ring-indigo-500/30">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs tracking-[0.2em] text-white/70">HEAD OFFICE · FINANCE</p>
              <h2 className="text-3xl font-semibold">Monthly Allocations</h2>
              <p className="text-sm text-white/80">
                Manage {currentMonth} spending and baseline budgets for every unit.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-full bg-white/20 px-4 py-2 text-sm font-semibold">
                {scopedBudgets.length} units in view
              </div>
            </div>
          </div>
        </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: "Total Budget Limit", value: formatAmount(totalAllocated), icon: Wallet, gradient: "from-indigo-500 to-purple-500", sub: `Base + Addons for ${currentMonth}` },
          { label: "Consumed This Month", value: formatAmount(totalSpent + totalHeld), icon: PieChart, gradient: "from-orange-400 to-pink-500", sub: "Includes pending orders" },
          { label: "Remaining This Month", value: formatAmount(totalRemaining), icon: CheckCircle2, gradient: "from-emerald-400 to-teal-500", sub: `Available for ${currentMonth}` },
        ].map((metric) => {
          const Icon = metric.icon
          return (
            <Card key={metric.label} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-slate-900/50 bg-white dark:bg-slate-900">
              <div className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${metric.gradient} text-white shadow-inner`}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{metric.label}</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{metric.value}</p>
              <p className="text-xs text-muted-foreground">{metric.sub}</p>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Org Budget</p>
          <p className="text-xl font-black text-slate-900 dark:text-white">{formatAmount(totalAllocated)}</p>
          <div className="h-1 w-8 bg-blue-500 mt-2" />
        </Card>
        <Card className="p-4 border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Spent This Period</p>
          <p className="text-xl font-black text-rose-600 dark:text-rose-400">{formatAmount(totalSpent)}</p>
          <div className="h-1 w-8 bg-rose-500 mt-2" />
        </Card>
        <Card className="p-4 border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Credits / Remaining</p>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{formatAmount(totalRemaining)}</p>
          <div className="h-1 w-8 bg-emerald-500 mt-2" />
        </Card>
        <Card className="p-4 border border-slate-200 dark:border-slate-800 shadow-sm bg-indigo-50 dark:bg-indigo-950/30">
          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">Avg Utilization</p>
          <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">
            {totalAllocated > 0 ? ((totalSpent / totalAllocated) * 100).toFixed(1) : "0.0"}%
          </p>
          <div className="h-1 w-8 bg-indigo-500 mt-2" />
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search branches..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold uppercase tracking-tight focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button onClick={() => setShowBulkDialog(true)} variant="outline" className="flex-1 font-bold uppercase text-[10px] tracking-widest border-slate-200 dark:border-slate-800 rounded-xl px-6">
            <Zap className="h-3.5 w-3.5 mr-2 text-amber-500" /> Bulk Allocate
          </Button>
          <Button onClick={() => setShowEmptyAllDialog(true)} variant="outline" className="flex-1 font-bold uppercase text-[10px] tracking-widest border-slate-200 dark:border-slate-800 rounded-xl px-6 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 transition-colors">
            <Trash2 className="h-3.5 w-3.5 mr-2" /> Empty All
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-slate-900/50 bg-white dark:bg-slate-900">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                <TableHead className="font-semibold text-slate-900 dark:text-slate-200">Branch Identity</TableHead>
                <TableHead className="text-right font-semibold text-slate-900 dark:text-slate-200">Monthly Base</TableHead>
                <TableHead className="text-right font-semibold text-slate-900 dark:text-slate-200">Add-on Credit</TableHead>
                <TableHead className="text-right font-semibold text-slate-900 dark:text-slate-200">Total Budget</TableHead>
                <TableHead className="text-right font-semibold text-slate-900 dark:text-slate-200">Spent (Month)</TableHead>
                <TableHead className="text-right font-semibold text-slate-900 dark:text-slate-200">Remaining (Month)</TableHead>
                <TableHead className="text-center font-semibold text-slate-900 dark:text-slate-200">Usage</TableHead>
                <TableHead className="text-center font-semibold text-slate-900 dark:text-slate-200">Status</TableHead>
                <TableHead className="text-right font-semibold text-slate-900 dark:text-slate-200">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {budgets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto mb-2 opacity-50" />
                    <p className="text-muted-foreground">No branches found</p>
                  </TableCell>
                </TableRow>
              ) : filteredBudgets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No branches match your search
                  </TableCell>
                </TableRow>
              ) : (
                filteredBudgets.map(budget => {
                  const spendingPercent = getSpendingPercentage(budget)
                  const isNearLimit = spendingPercent >= 90
                  const isMedium = spendingPercent >= 70
                  const isUnderutilized = budget.amountAllocatedCents === 0

                  return (
                    <TableRow key={budget.branchId} className={isUnderutilized ? "bg-gray-50 dark:bg-gray-900" : isNearLimit ? "bg-red-50 dark:bg-red-950/20" : isMedium ? "bg-yellow-50 dark:bg-yellow-950/20" : ""}>
                      <TableCell className="font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          {budget.branchName}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium text-slate-500 dark:text-slate-400">
                        {formatAmount(budget.baselineBudgetCents)}
                      </TableCell>
                      <TableCell className="text-right">
                        {budget.amountCreditedCents > 0 ? (
                          <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 font-bold">
                            +{formatAmount(budget.amountCreditedCents)}
                          </Badge>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-700">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-black">
                        <span className="text-slate-900 dark:text-white text-base">
                          {formatAmount(budget.amountAllocatedCents + budget.amountCreditedCents)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-rose-600 font-semibold" title={`Actual Spent: ${formatAmount(budget.amountSpentCents)}, Pending: ${formatAmount(budget.amountHeldCents)}`}>
                          {formatAmount(budget.amountSpentCents + budget.amountHeldCents)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-black tracking-tight">
                        <span className={budget.remainingCents < 0 ? "text-red-600" : "text-emerald-600"}>{formatAmount(budget.remainingCents)}</span>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 w-24">
                          <div className="text-xs font-semibold text-center text-slate-900 dark:text-white">{spendingPercent.toFixed(0)}%</div>
                          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full transition-all ${getStatusColor(spendingPercent)}`} style={{ width: `${Math.min(100, spendingPercent)}%` }} />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {isUnderutilized ? (
                          <Badge className="bg-gray-500 text-xs">Not Set</Badge>
                        ) : isNearLimit ? (
                          <Badge className="bg-red-500 text-xs gap-1"><AlertTriangle className="h-2 w-2" />At Limit</Badge>
                        ) : isMedium ? (
                          <Badge className="bg-yellow-500 text-xs"><Clock className="h-2 w-2 mr-1" />Medium</Badge>
                        ) : (
                          <Badge className="bg-green-500 text-xs"><CheckCircle2 className="h-2 w-2 mr-1" />Good</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" onClick={() => handleEditBudget(budget)} className="gap-1 whitespace-nowrap">
                            <Edit2 className="h-3 w-3" />
                            <span className="hidden sm:inline">Allocate</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleEmptyBudget(budget)}
                            className="gap-1 whitespace-nowrap"
                            title="Reset budget to zero"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span className="hidden sm:inline">Empty</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-6 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-slate-900/50 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3 mb-4">
            <PieChart className="h-5 w-5 text-blue-600" />
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Budget Overview</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-700 dark:text-slate-300">Spent (Inc. Pending)</span>
              <span className="font-bold text-slate-900 dark:text-white">{totalAllocated > 0 ? (((totalSpent + totalHeld) / totalAllocated) * 100).toFixed(1) : 0}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-700 dark:text-slate-300">Available Remaining</span>
              <span className="font-bold text-green-600">{totalAllocated > 0 ? ((totalRemaining / totalAllocated) * 100).toFixed(1) : 0}%</span>
            </div>
          </div>
        </Card>

        <Card className="p-6 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-slate-900/50 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-900">
          <div className="flex items-center gap-3 mb-4">
            <Wallet className="h-5 w-5 text-blue-600" />
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">At-Risk Branches</h3>
          </div>
          <div className="space-y-2">
            {scopedBudgets.filter(b => getSpendingPercentage(b) >= 70).length > 0 ? (
              <>
                <p className="text-2xl font-bold text-red-600">{scopedBudgets.filter(b => getSpendingPercentage(b) >= 90).length}</p>
                <p className="text-xs text-muted-foreground">Branches at/near budget limit ({scopedBudgets.filter(b => getSpendingPercentage(b) >= 90).length} at 90%+)</p>
              </>
            ) : (
              <p className="text-sm text-green-600 font-medium">All branches within safe limits</p>
            )}
          </div>
        </Card>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white">Allocate Budget</DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-400">Configure budget allocation for {editingBudget?.branchName}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setAllocationType("monthly")}
                className={cn(
                  "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                  allocationType === "monthly"
                    ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                Monthly Base
              </button>
              <button
                onClick={() => setAllocationType("addon")}
                className={cn(
                  "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                  allocationType === "addon"
                    ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                One-time Add-on
              </button>
            </div>

            {allocationType === "monthly" ? (
              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 rounded-lg">
                <p className="text-[11px] text-indigo-700 dark:text-indigo-300 font-medium">
                  <strong>Monthly Base:</strong> This sets the recurring baseline budget for this branch. It will persist every month.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 rounded-lg">
                <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                  <strong>One-time Add-on:</strong> This adds extra budget for the current month ONLY. It will reset at the end of the month.
                </p>
              </div>
            )}
            <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monthly Budget</span>
                <span className="font-semibold">{formatAmount(editingBudget?.amountAllocatedCents || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Spent (Incl. Pending)</span>
                <span className="font-semibold text-orange-600">{formatAmount((editingBudget?.amountSpentCents || 0) + (editingBudget?.amountHeldCents || 0))}</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex justify-between font-bold">
                <span>Remaining</span>
                <span className="text-green-600">{formatAmount(editingBudget?.remainingCents || 0)}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-slate-900 dark:text-white">
                {allocationType === "monthly" ? "New Baseline Amount (PKR)" : "Amount to Add (PKR)"}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">PKR</span>
                <Input type="number" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} placeholder="0.00" step="0.01" min="0" className="pl-12 text-lg font-bold h-11" />
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 font-medium">
                {allocationType === "monthly"
                  ? `Branch baseline will be updated to ${formatPKR(parseFloat(newAmount || "0"))}`
                  : `New total budget will be: ${formatPKR((editingBudget?.amountAllocatedCents || 0) / 100 + (editingBudget?.amountCreditedCents || 0) / 100 + parseFloat(newAmount || "0"))}`
                }
              </p>
              {(() => {
                const amt = parseFloat(newAmount || "0")
                const amtCents = Math.round(amt * 100)
                const currentSpentCents = (editingBudget?.amountSpentCents || 0) + (editingBudget?.amountHeldCents || 0)
                let proposedTotalCents = 0
                if (allocationType === "monthly") {
                  proposedTotalCents = amtCents + (editingBudget?.amountCreditedCents || 0)
                } else {
                  proposedTotalCents = (editingBudget?.amountAllocatedCents || 0) + (editingBudget?.amountCreditedCents || 0) + amtCents
                }
                
                if (proposedTotalCents < currentSpentCents && newAmount) {
                  return (
                    <div className="mt-2 p-2 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                      <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
                      <p className="text-[10px] font-black uppercase text-rose-600">Insufficient to cover ₨{(currentSpentCents/100).toFixed(2)} spent</p>
                    </div>
                  )
                }
                return null
              })()}
              <p className="text-xs text-muted-foreground mt-1">
                {allocationType === "monthly"
                  ? "Changes will affect future months automatically."
                  : "This amount will be added to the current month's allocation."}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveBudget} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
              <CheckCircle2 className="h-4 w-4" />
              {allocationType === "monthly" ? "Update Baseline" : "Apply Add-on"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent className="max-w-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white">Allocate Budget to All Branches</DialogTitle>
            <DialogDescription>
              Quickly allocate the same monthly budget to all {scopedBudgets.length} branches in the current context
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">This will update ALL branches to the same amount</p>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-slate-900 dark:text-white">Monthly Budget Amount (PKR)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">PKR</span>
                <Input type="number" value={bulkAmount} onChange={(e) => setBulkAmount(e.target.value)} placeholder="0.00" step="0.01" min="0" className="pl-12 text-lg font-bold h-11" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                This amount will be assigned to all {scopedBudgets.length} branches currently in view
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDialog(false)}>Cancel</Button>
            <Button onClick={handleBulkAllocate} className="gap-2">
              <Zap className="h-4 w-4" />
              Allocate All Branches
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEmptyDialog} onOpenChange={setShowEmptyDialog}>
        <DialogContent className="max-w-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white">Empty Budget Confirmation</DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-400">
              Are you sure you want to reset the budget for {emptyingBudget?.branchName} to ₨0.00?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-red-900 dark:text-red-100">This will reset the allocated budget to zero</p>
                  <p className="text-xs text-red-700 dark:text-red-300">Current budget: {formatAmount(emptyingBudget?.amountAllocatedCents || 0)}</p>
                  <p className="text-xs text-red-700 dark:text-red-300">This action can be reversed by allocating a new budget.</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmptyDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleConfirmEmptyBudget} className="gap-2">
              <Trash2 className="h-4 w-4" />
              Empty Budget
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEmptyAllDialog} onOpenChange={setShowEmptyAllDialog}>
        <DialogContent className="max-w-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white">Empty All Budgets Confirmation</DialogTitle>
            <DialogDescription>
              Are you sure you want to reset ALL {scopedBudgets.length} branch budgets to ₨0.00?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-red-900 dark:text-red-100">This will reset ALL branch budgets in the current view to zero</p>
                  <p className="text-xs text-red-700 dark:text-red-300">Total allocated: {formatAmount(totalAllocated)}</p>
                  <p className="text-xs text-red-700 dark:text-red-300">Branches affected: {scopedBudgets.length}</p>
                  <p className="text-xs text-red-700 dark:text-red-300">This action can be reversed by allocating new budgets.</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmptyAllDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleEmptyAllBudgets} className="gap-2">
              <Trash2 className="h-4 w-4" />
              Empty All Budgets
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  )
}
