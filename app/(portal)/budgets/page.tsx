"use client"
import React, { useState, useMemo } from "react"
import useSWR from "swr"
import { useSession } from "next-auth/react"
import { useToast } from "@/components/ui/use-toast"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { SectionHeader } from "@/components/ui/section-header"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Wallet, AlertCircle, Edit2, Zap, PieChart, Calendar, CheckCircle2, Clock, AlertTriangle } from "lucide-react"
import { formatPKR } from "@/lib/utils"

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
}

export default function BudgetsPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const role = (session?.user as any)?.role
  const isHeadOffice = role === "HEAD_OFFICE" || role === "SUPER_ADMIN"

  const [searchQuery, setSearchQuery] = useState("")
  const [editingBudget, setEditingBudget] = useState<BudgetAllocation | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [newAmount, setNewAmount] = useState("")
  const [bulkAmount, setBulkAmount] = useState("")
  const [showBulkDialog, setShowBulkDialog] = useState(false)

  const { data: budgetsData, mutate } = useSWR<any>(
    isHeadOffice ? "/api/v1/budgets?all=true" : null,
    fetcher
  )

  const budgets: BudgetAllocation[] = budgetsData?.budgets || []

const formatAmount = (cents: number) => formatPKR(cents / 100)

  const filteredBudgets = useMemo(() => {
    return budgets.filter(b =>
      b.branchName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.branchId.toString().includes(searchQuery)
    )
  }, [budgets, searchQuery])

  const totalAllocated = budgets.reduce((sum, b) => sum + b.amountAllocatedCents, 0)
  const totalSpent = budgets.reduce((sum, b) => sum + b.amountSpentCents, 0)
  const totalHeld = budgets.reduce((sum, b) => sum + b.amountHeldCents, 0)
  const totalRemaining = budgets.reduce((sum, b) => sum + b.remainingCents, 0)
  const avgBudget = budgets.length > 0 ? totalAllocated / budgets.length : 0

  const handleEditBudget = (budget: BudgetAllocation) => {
    setEditingBudget(budget)
    setNewAmount((budget.amountAllocatedCents / 100).toFixed(2))
    setShowDialog(true)
  }

  const handleSaveBudget = async () => {
    if (!editingBudget || !newAmount) return
    const amountCents = Math.round(parseFloat(newAmount) * 100)
    if (!Number.isFinite(amountCents) || amountCents < 0) {
      return toast({ title: "Invalid amount", variant: "destructive" })
    }

    try {
      const res = await fetch("/api/v1/budgets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: editingBudget.branchId,
          amountAllocatedCents: amountCents,
        })
      })

      if (!res.ok) {
        const json = await res.json()
        return toast({ title: "Failed", description: json.error, variant: "destructive" })
      }

      toast({
        title: "Budget Updated",
        description: `${editingBudget.branchName} monthly budget set to ${formatPKR(parseFloat(newAmount))}`,
      })
      setShowDialog(false)
      setEditingBudget(null)
      mutate()
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
      for (const budget of budgets) {
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
        description: `Allocated ${formatPKR(parseFloat(bulkAmount))} to ${successCount}/${budgets.length} branches` 
      })
      setShowBulkDialog(false)
      setBulkAmount("")
      mutate()
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }

  const getSpendingPercentage = (budget: BudgetAllocation) => {
    const total = budget.amountAllocatedCents || 1
    return ((budget.amountSpentCents + budget.amountHeldCents) / total) * 100
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
    <div className="space-y-6">
      <SectionHeader
        title="Monthly Budget Allocation"
        subtitle={`Manage and allocate monthly budgets for all branches - ${currentMonth}`}
        actions={
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            Financial Control
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Total Allocated</p>
          <p className="text-2xl font-bold text-blue-600">{formatAmount(totalAllocated)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Total Spent</p>
          <p className="text-2xl font-bold text-orange-600">{formatAmount(totalSpent)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">On Hold</p>
          <p className="text-2xl font-bold text-yellow-600">{formatAmount(totalHeld)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Remaining</p>
          <p className="text-2xl font-bold text-green-600">{formatAmount(totalRemaining)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Avg per Branch</p>
          <p className="text-2xl font-bold text-slate-600">{formatAmount(avgBudget)}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <label className="text-sm font-medium mb-2 block">Search Branches</label>
          <input
            type="text"
            placeholder="Search by name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
        </Card>
        <Card className="p-4">
          <label className="text-sm font-medium mb-2 block">Quick Actions</label>
          <Button 
            onClick={() => setShowBulkDialog(true)}
            className="w-full gap-2"
            variant="outline"
          >
            <Zap className="h-4 w-4" />
            Allocate All
          </Button>
        </Card>
        <Card className="p-4 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <p className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-1">Total Branches</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{budgets.length}</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 dark:bg-slate-800">
                <TableHead className="font-semibold">Branch</TableHead>
                <TableHead className="text-right font-semibold">Monthly Budget</TableHead>
                <TableHead className="text-right font-semibold">Spent</TableHead>
                <TableHead className="text-right font-semibold">Pending</TableHead>
                <TableHead className="text-right font-semibold">Remaining</TableHead>
                <TableHead className="text-center font-semibold">Usage</TableHead>
                <TableHead className="text-center font-semibold">Status</TableHead>
                <TableHead className="text-right font-semibold">Action</TableHead>
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
                      <TableCell className="font-semibold text-slate-900 dark:text-white">{budget.branchName}</TableCell>
                      <TableCell className="text-right font-bold text-lg">
                        <span className="text-blue-600 dark:text-blue-400">{formatAmount(budget.amountAllocatedCents)}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-orange-600">{formatAmount(budget.amountSpentCents)}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-yellow-600 dark:text-yellow-400">{formatAmount(budget.amountHeldCents)}</span>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        <span className={budget.remainingCents < 0 ? "text-red-600" : "text-green-600"}>{formatAmount(budget.remainingCents)}</span>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 w-24">
                          <div className="text-xs font-semibold text-center">{spendingPercent.toFixed(0)}%</div>
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
                        <Button size="sm" onClick={() => handleEditBudget(budget)} className="gap-1 whitespace-nowrap">
                          <Edit2 className="h-3 w-3" />
                          <span className="hidden sm:inline">Allocate</span>
                        </Button>
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
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <PieChart className="h-5 w-5 text-blue-600" />
            <h3 className="font-bold text-lg">Budget Overview</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Spent</span>
              <span className="font-bold">{totalAllocated > 0 ? ((totalSpent / totalAllocated) * 100).toFixed(1) : 0}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Pending (On Hold)</span>
              <span className="font-bold">{totalAllocated > 0 ? ((totalHeld / totalAllocated) * 100).toFixed(1) : 0}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Available</span>
              <span className="font-bold text-green-600">{totalAllocated > 0 ? ((totalRemaining / totalAllocated) * 100).toFixed(1) : 0}%</span>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
          <div className="flex items-center gap-3 mb-4">
            <Wallet className="h-5 w-5 text-blue-600" />
            <h3 className="font-bold text-lg">At-Risk Branches</h3>
          </div>
          <div className="space-y-2">
            {budgets.filter(b => getSpendingPercentage(b) >= 70).length > 0 ? (
              <>
                <p className="text-2xl font-bold text-red-600">{budgets.filter(b => getSpendingPercentage(b) >= 90).length}</p>
                <p className="text-xs text-muted-foreground">Branches at/near budget limit ({budgets.filter(b => getSpendingPercentage(b) >= 90).length} at 90%+)</p>
              </>
            ) : (
              <p className="text-sm text-green-600 font-medium">All branches within safe limits</p>
            )}
          </div>
        </Card>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set Monthly Budget</DialogTitle>
            <DialogDescription>Allocate the monthly budget for {editingBudget?.branchName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Monthly Budget</span>
                <span className="font-semibold">{formatAmount(editingBudget?.amountAllocatedCents || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Already Spent</span>
                <span className="font-semibold text-orange-600">{formatAmount(editingBudget?.amountSpentCents || 0)}</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex justify-between font-bold">
                <span>Remaining</span>
                <span className="text-green-600">{formatAmount(editingBudget?.remainingCents || 0)}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">New Monthly Budget (PKR)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">PKR</span>
                <Input type="number" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} placeholder="0.00" step="0.01" min="0" className="pl-12 text-lg font-bold h-11" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">Set the total budget this branch can spend this month</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveBudget} className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Save Monthly Budget
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Allocate Budget to All Branches</DialogTitle>
            <DialogDescription>Quickly allocate the same monthly budget to all {budgets.length} branches</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">This will update ALL branches to the same amount</p>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Monthly Budget Amount (PKR)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">PKR</span>
                <Input type="number" value={bulkAmount} onChange={(e) => setBulkAmount(e.target.value)} placeholder="0.00" step="0.01" min="0" className="pl-12 text-lg font-bold h-11" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">This amount will be assigned to all {budgets.length} branches</p>
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
    </div>
  )
}
