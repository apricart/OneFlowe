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
  Plus,
  Search,
  Edit,
  Trash2,
  Tags,
  Package,
  Filter,
  MoreHorizontal,
} from "lucide-react"
import useSWR from "swr"

interface Modifier {
  id: number
  name: string
  description: string | null
  type: string
  status: string
  createdAt: string
  updatedAt: string
  usageCount: number
}

const MODIFIER_TYPES = [
  { value: "unit", label: "Unit" },
  { value: "size", label: "Size" },
  { value: "packaging", label: "Packaging" },
  { value: "weight", label: "Weight" },
  { value: "volume", label: "Volume" },
  { value: "count", label: "Count" },
]

const fetcher = (url: string) => fetch(url).then(res => res.json())

export default function ModifiersPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingModifier, setEditingModifier] = useState<Modifier | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "unit",
    status: "active",
  })

  // Fetch modifiers
  const { data, error, isLoading, mutate } = useSWR<{ items: Modifier[] }>(
    `/api/v1/modifiers?search=${searchQuery}&type=${typeFilter}&status=${statusFilter}`,
    fetcher
  )

  const modifiers = data?.items || []

  // Filter modifiers by search
  const filteredModifiers = useMemo(() => {
    if (!searchQuery) return modifiers
    const query = searchQuery.toLowerCase()
    return modifiers.filter(modifier =>
      modifier.name.toLowerCase().includes(query) ||
      modifier.description?.toLowerCase().includes(query) ||
      modifier.type.toLowerCase().includes(query)
    )
  }, [modifiers, searchQuery])

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const url = editingModifier 
        ? `/api/v1/modifiers` 
        : `/api/v1/modifiers`
      const method = editingModifier ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          ...(editingModifier && { id: editingModifier.id })
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save modifier')
      }

      mutate()
      setShowAddDialog(false)
      setEditingModifier(null)
      setFormData({ name: "", description: "", type: "unit", status: "active" })
    } catch (error) {
      console.error('Error saving modifier:', error)
      alert(error instanceof Error ? error.message : 'Failed to save modifier')
    }
  }

  // Handle edit
  const handleEdit = (modifier: Modifier) => {
    setEditingModifier(modifier)
    setFormData({
      name: modifier.name,
      description: modifier.description || "",
      type: modifier.type,
      status: modifier.status,
    })
    setShowAddDialog(true)
  }

  // Handle delete
  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this modifier?')) return

    try {
      const response = await fetch(`/api/v1/modifiers?id=${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete modifier')
      }

      mutate()
    } catch (error) {
      console.error('Error deleting modifier:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete modifier')
    }
  }

  // Reset form
  const resetForm = () => {
    setFormData({ name: "", description: "", type: "unit", status: "active" })
    setEditingModifier(null)
    setShowAddDialog(false)
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Modifiers"
        subtitle="Manage product modifiers like sizes, units, and packaging"
      />

      {/* Search and Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <Input
              placeholder="Search modifiers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              {MODIFIER_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus size={16} className="mr-2" />
          Add Modifier
        </Button>
      </div>

      {/* Modifiers Table */}
      <Card>
        <Table>
          <thead>
            <tr className="border-b">
              <th className="text-left p-4 font-medium">Name</th>
              <th className="text-left p-4 font-medium">Type</th>
              <th className="text-left p-4 font-medium">Description</th>
              <th className="text-left p-4 font-medium">Status</th>
              <th className="text-left p-4 font-medium">Usage</th>
              <th className="text-left p-4 font-medium">Created</th>
              <th className="text-right p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500">
                  Loading modifiers...
                </td>
              </tr>
            ) : filteredModifiers.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500">
                  No modifiers found
                </td>
              </tr>
            ) : (
              filteredModifiers.map((modifier) => (
                <tr key={modifier.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Tags size={16} className="text-purple-500" />
                      <span className="font-medium">{modifier.name}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge variant="outline">
                      {MODIFIER_TYPES.find(t => t.value === modifier.type)?.label || modifier.type}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-gray-600">
                      {modifier.description || "—"}
                    </span>
                  </td>
                  <td className="p-4">
                    <Badge
                      variant={modifier.status === "active" ? "default" : "secondary"}
                      className={modifier.status === "active" ? "bg-green-100 text-green-800" : ""}
                    >
                      {modifier.status}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1">
                      <Package size={14} className="text-gray-400" />
                      <span>{modifier.usageCount}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-gray-500">
                    {new Date(modifier.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(modifier)}
                      >
                        <Edit size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(modifier.id)}
                        className="text-red-600 hover:text-red-700"
                        disabled={modifier.usageCount > 0}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={resetForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingModifier ? "Edit Modifier" : "Add New Modifier"}
            </DialogTitle>
            <DialogDescription>
              {editingModifier ? "Update the modifier information below." : "Enter the details to create a new product modifier like size, unit, or packaging."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., 1 Ltr, 500gm, Pack of 6"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                {MODIFIER_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Description (Optional)</label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter description"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button type="submit">
                {editingModifier ? "Update" : "Create"} Modifier
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
