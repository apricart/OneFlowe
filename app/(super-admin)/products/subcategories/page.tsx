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
  FolderOpen,
  Package,
  Filter,
} from "lucide-react"
import useSWR from "swr"

interface SubCategory {
  id: number
  name: string
  parentId: number
  createdAt: string
  updatedAt: string
  parentName: string
  productsCount: number
}

interface Category {
  id: number
  name: string
  parentId: number | null
}

const fetcher = (url: string) => fetch(url).then(res => res.json())

export default function SubCategoriesPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [parentFilter, setParentFilter] = useState("")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingSubCategory, setEditingSubCategory] = useState<SubCategory | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    parentId: "",
  })

  // Fetch subcategories
  const { data, error, isLoading, mutate } = useSWR<{ items: SubCategory[] }>(
    `/api/v1/subcategories?search=${searchQuery}&parentId=${parentFilter}`,
    fetcher
  )

  // Fetch parent categories
  const { data: categoriesData } = useSWR<{ items: Category[] }>(
    `/api/v1/categories?type=parent`,
    fetcher
  )

  const subCategories = data?.items || []
  const parentCategories = categoriesData?.items || []

  // Filter subcategories by search
  const filteredSubCategories = useMemo(() => {
    if (!searchQuery) return subCategories
    const query = searchQuery.toLowerCase()
    return subCategories.filter(subCategory =>
      subCategory.name.toLowerCase().includes(query) ||
      subCategory.parentName.toLowerCase().includes(query)
    )
  }, [subCategories, searchQuery])

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.parentId) {
      alert("Please select a parent category")
      return
    }
    
    try {
      const url = editingSubCategory 
        ? `/api/v1/subcategories` 
        : `/api/v1/subcategories`
      const method = editingSubCategory ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          parentId: parseInt(formData.parentId),
          ...(editingSubCategory && { id: editingSubCategory.id })
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save subcategory')
      }

      mutate()
      setShowAddDialog(false)
      setEditingSubCategory(null)
      setFormData({ name: "", parentId: "" })
    } catch (error) {
      console.error('Error saving subcategory:', error)
      alert(error instanceof Error ? error.message : 'Failed to save subcategory')
    }
  }

  // Handle edit
  const handleEdit = (subCategory: SubCategory) => {
    setEditingSubCategory(subCategory)
    setFormData({
      name: subCategory.name,
      parentId: subCategory.parentId.toString(),
    })
    setShowAddDialog(true)
  }

  // Handle delete
  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this subcategory?')) return

    try {
      const response = await fetch(`/api/v1/subcategories?id=${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete subcategory')
      }

      mutate()
    } catch (error) {
      console.error('Error deleting subcategory:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete subcategory')
    }
  }

  // Reset form
  const resetForm = () => {
    setFormData({ name: "", parentId: "" })
    setEditingSubCategory(null)
    setShowAddDialog(false)
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Sub Categories"
        subtitle="Manage product subcategories under main categories"
      />

      {/* Search and Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <Input
              placeholder="Search subcategories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            <select
              value={parentFilter}
              onChange={(e) => setParentFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Parent Categories</option>
              {parentCategories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus size={16} className="mr-2" />
          Add Sub Category
        </Button>
      </div>

      {/* Sub Categories Table */}
      <Card>
        <Table>
          <thead>
            <tr className="border-b">
              <th className="text-left p-4 font-medium">Name</th>
              <th className="text-left p-4 font-medium">Parent Category</th>
              <th className="text-left p-4 font-medium">Products</th>
              <th className="text-left p-4 font-medium">Created</th>
              <th className="text-right p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">
                  Loading subcategories...
                </td>
              </tr>
            ) : filteredSubCategories.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">
                  No subcategories found
                </td>
              </tr>
            ) : (
              filteredSubCategories.map((subCategory) => (
                <tr key={subCategory.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <FolderOpen size={16} className="text-green-500" />
                      <span className="font-medium">{subCategory.name}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge variant="outline">
                      {subCategory.parentName}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1">
                      <Package size={14} className="text-gray-400" />
                      <span>{subCategory.productsCount}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-gray-500">
                    {new Date(subCategory.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(subCategory)}
                      >
                        <Edit size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(subCategory.id)}
                        className="text-red-600 hover:text-red-700"
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
              {editingSubCategory ? "Edit Sub Category" : "Add New Sub Category"}
            </DialogTitle>
            <DialogDescription>
              {editingSubCategory ? "Update the subcategory information below." : "Enter the details to create a new subcategory under a parent category."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter subcategory name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Parent Category</label>
              <select
                value={formData.parentId}
                onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select parent category</option>
                {parentCategories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button type="submit">
                {editingSubCategory ? "Update" : "Create"} Sub Category
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
