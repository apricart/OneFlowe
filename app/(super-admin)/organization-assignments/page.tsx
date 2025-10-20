"use client"

import React, { useState, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { SectionHeader } from "@/components/ui/section-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Search,
  X,
  Package,
  Building2,
  Check,
  Eye,
  EyeOff,
  Trash2,
} from "lucide-react"
import useSWR from "swr"
import { useToast } from "@/components/ui/use-toast"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface OrganizationAssignment {
  id: number
  organizationId: number
  globalProductId: number
  isActive: boolean
  customName?: string
  customPrice?: number
  customDescription?: string
  customImageUrl?: string
  assignedAt: string
  productName: string
  productCode: string
  productImageUrl?: string
  organizationName: string
}

interface Organization {
  id: number
  name: string
  description?: string
  createdAt: string
}

export default function OrganizationAssignmentsPage() {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [organizationFilter, setOrganizationFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedAssignments, setSelectedAssignments] = useState<number[]>([])
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)

  // Fetch data
  const { data: assignments, error: assignmentsError, isLoading: assignmentsLoading, mutate: mutateAssignments } = useSWR<{
    items: OrganizationAssignment[]
    total: number
  }>(`/api/v1/admin/organization-assignments?${new URLSearchParams({
    ...(organizationFilter && { organizationId: organizationFilter }),
  })}`, fetcher, {
    fallbackData: { items: [], total: 0 }
  })

  const { data: organizations, error: orgsError } = useSWR<Organization[]>("/api/v1/organizations", fetcher, {
    fallbackData: []
  })

  // Filter assignments
  const filteredAssignments = useMemo(() => {
    if (!assignments?.items) return []
    
    let filtered = assignments.items

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(assignment =>
        assignment.productName.toLowerCase().includes(query) ||
        assignment.productCode.toLowerCase().includes(query) ||
        assignment.organizationName.toLowerCase().includes(query) ||
        (assignment.customName && assignment.customName.toLowerCase().includes(query))
      )
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(assignment =>
        statusFilter === "active" ? assignment.isActive : !assignment.isActive
      )
    }

    return filtered
  }, [assignments?.items, searchQuery, statusFilter])

  // Calculate summary stats
  const totalAssignments = assignments?.total || 0
  const activeAssignments = useMemo(() => {
    if (!assignments?.items) return 0
    return assignments.items.filter(a => a.isActive).length
  }, [assignments?.items])

  const uniqueOrganizations = useMemo(() => {
    if (!assignments?.items) return 0
    const orgIds = new Set(assignments.items.map(a => a.organizationId))
    return orgIds.size
  }, [assignments?.items])

  const handleRemoveAssignment = async (assignmentId: number) => {
    try {
      const response = await fetch(`/api/v1/admin/organization-assignments?id=${assignmentId}`, {
        method: "DELETE",
      })

      const result = await response.json()

      if (response.ok) {
        toast({
          title: "Success",
          description: result.message,
        })
        mutateAssignments()
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to remove assignment",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error removing assignment:", error)
      toast({
        title: "Error",
        description: "Failed to remove assignment",
        variant: "destructive",
      })
    }
  }

  const handleBulkRemove = async () => {
    if (selectedAssignments.length === 0) {
      toast({
        title: "No Assignments Selected",
        description: "Please select assignments to remove",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch("/api/v1/admin/organization-assignments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentIds: selectedAssignments,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        toast({
          title: "Success",
          description: result.message,
        })
        setSelectedAssignments([])
        setShowRemoveDialog(false)
        mutateAssignments()
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to remove assignments",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error removing assignments:", error)
      toast({
        title: "Error",
        description: "Failed to remove assignments",
        variant: "destructive",
      })
    }
  }

  const toggleAssignmentSelection = (assignmentId: number) => {
    setSelectedAssignments(prev => 
      prev.includes(assignmentId) 
        ? prev.filter(id => id !== assignmentId)
        : [...prev, assignmentId]
    )
  }

  const selectAllAssignments = () => {
    setSelectedAssignments(
      selectedAssignments.length === filteredAssignments.length 
        ? [] 
        : filteredAssignments.map(a => a.id)
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Organization Assignments"
        subtitle="Manage which products are assigned to which organizations"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Assignments</p>
              <p className="text-2xl font-bold">{totalAssignments}</p>
            </div>
            <Package className="h-8 w-8 text-blue-600" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Assignments</p>
              <p className="text-2xl font-bold">{activeAssignments}</p>
            </div>
            <Check className="h-8 w-8 text-green-600" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Organizations</p>
              <p className="text-2xl font-bold">{uniqueOrganizations}</p>
            </div>
            <Building2 className="h-8 w-8 text-purple-600" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Selected</p>
              <p className="text-2xl font-bold">{selectedAssignments.length}</p>
            </div>
            <Eye className="h-8 w-8 text-orange-600" />
          </div>
        </Card>
      </div>

      {/* Filters and Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <Input
              placeholder="Search assignments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          <select
            value={organizationFilter}
            onChange={(e) => setOrganizationFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Organizations</option>
            {organizations && Array.isArray(organizations) ? organizations.map(org => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            )) : (
              <option value="" disabled>Loading organizations...</option>
            )}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          {selectedAssignments.length > 0 && (
            <Button 
              variant="destructive" 
              onClick={() => setShowRemoveDialog(true)}
            >
              <Trash2 size={16} className="mr-2" />
              Remove Selected ({selectedAssignments.length})
            </Button>
          )}
        </div>
      </div>

      {/* Assignments Table */}
      <Card>
        <Table>
          <thead>
            <tr>
              <th className="text-left p-4 font-medium w-12">
                <input
                  type="checkbox"
                  checked={selectedAssignments.length === filteredAssignments.length && filteredAssignments.length > 0}
                  onChange={selectAllAssignments}
                  className="rounded"
                />
              </th>
              <th className="text-left p-4 font-medium">Product</th>
              <th className="text-left p-4 font-medium">Organization</th>
              <th className="text-left p-4 font-medium">Status</th>
              <th className="text-left p-4 font-medium">Custom Name</th>
              <th className="text-left p-4 font-medium">Custom Price</th>
              <th className="text-left p-4 font-medium">Assigned Date</th>
              <th className="text-right p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {assignmentsLoading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-gray-500">
                  Loading assignments...
                </td>
              </tr>
            ) : filteredAssignments.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-gray-500">
                  No assignments found
                </td>
              </tr>
            ) : (
              filteredAssignments.map(assignment => (
                <tr key={assignment.id} className="hover:bg-gray-50">
                  <td className="p-4">
                    <input
                      type="checkbox"
                      checked={selectedAssignments.includes(assignment.id)}
                      onChange={() => toggleAssignmentSelection(assignment.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {assignment.productImageUrl ? (
                        <img
                          src={assignment.productImageUrl}
                          alt={assignment.productName}
                          className="w-12 h-12 object-cover rounded-lg border"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded-lg border flex items-center justify-center">
                          <Package className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                      <div>
                        <div className="font-medium">{assignment.productName}</div>
                        <div className="text-xs text-gray-500">{assignment.productCode}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="font-medium">{assignment.organizationName}</div>
                  </td>
                  <td className="p-4">
                    <Badge
                      variant={assignment.isActive ? "default" : "secondary"}
                      className={assignment.isActive ? "bg-green-100 text-green-800" : ""}
                    >
                      {assignment.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <div className="text-sm">
                      {assignment.customName || (
                        <span className="text-gray-400 italic">No override</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm">
                      {assignment.customPrice ? (
                        `$${(assignment.customPrice / 100).toFixed(2)}`
                      ) : (
                        <span className="text-gray-400 italic">No override</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm text-gray-600">
                      {new Date(assignment.assignedAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveAssignment(assignment.id)}
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Card>

      {/* Remove Confirmation Dialog */}
      <Dialog open={showRemoveDialog} onOpenChange={() => setShowRemoveDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Assignments</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {selectedAssignments.length} assignment(s)? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRemoveDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBulkRemove}>
              Remove Assignments
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
