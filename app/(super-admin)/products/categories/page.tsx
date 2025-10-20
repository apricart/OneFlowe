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
  FolderTree,
  Package,
} from "lucide-react"
import useSWR from "swr"

interface Category {
  id: number
  name: string
  parentId: number | null
  createdAt: string
  updatedAt: string
  subCategoriesCount: number
  productsCount: number
}

const fetcher = (url: string) => fetch(url).then(res => res.json())

export default function CategoriesPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    parentId: null as number | null,
  })

  // Fetch categories
  const { data, error, isLoading, mutate } = useSWR<{ items: Category[] }>(
    `/api/v1/categories?search=${searchQuery}`,
    fetcher
  )

  const categories = data?.items || []

  // Filter categories by search
  const filteredCategories = useMemo(() => {
    if (!searchQuery) return categories
    const query = searchQuery.toLowerCase()
    return categories.filter(category =>
      category.name.toLowerCase().includes(query)
    )
  }, [categories, searchQuery])

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const url = editingCategory 
        ? `/api/v1/categories` 
        : `/api/v1/categories`
      const method = editingCategory ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          ...(editingCategory && { id: editingCategory.id })
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save category')
      }

      mutate()
      setShowAddDialog(false)
      setEditingCategory(null)
      setFormData({ name: "", parentId: null })
    } catch (error) {
      console.error('Error saving category:', error)
      alert(error instanceof Error ? error.message : 'Failed to save category')
    }
  }

  // Handle edit
  const handleEdit = (category: Category) => {
    setEditingCategory(category)
    setFormData({
      name: category.name,
      parentId: category.parentId,
    })
    setShowAddDialog(true)
  }

  // Handle delete
  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this category?')) return

    try {
      const response = await fetch(`/api/v1/categories?id=${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete category')
      }

      mutate()
    } catch (error) {
      console.error('Error deleting category:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete category')
    }
  }

  // Reset form
  const resetForm = () => {
    setFormData({ name: "", parentId: null })
    setEditingCategory(null)
    setShowAddDialog(false)
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Categories"
        subtitle="Manage product categories and subcategories"
      />

      {/* Search and Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <Input
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus size={16} className="mr-2" />
          Add Category
        </Button>
      </div>

      {/* Categories Table */}
      <Card>
        <Table>
          <thead>
            <tr className="border-b">
              <th className="text-left p-4 font-medium">Name</th>
              <th className="text-left p-4 font-medium">Type</th>
              <th className="text-left p-4 font-medium">Sub Categories</th>
              <th className="text-left p-4 font-medium">Products</th>
              <th className="text-left p-4 font-medium">Created</th>
              <th className="text-right p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">
                  Loading categories...
                </td>
              </tr>
            ) : filteredCategories.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">
                  No categories found
                </td>
              </tr>
            ) : (
              filteredCategories.map((category) => (
                <tr key={category.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <FolderTree size={16} className="text-blue-500" />
                      <span className="font-medium">{category.name}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge variant={category.parentId ? "secondary" : "default"}>
                      {category.parentId ? "Sub Category" : "Category"}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1">
                      <Package size={14} className="text-gray-400" />
                      <span>{category.subCategoriesCount}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1">
                      <Package size={14} className="text-gray-400" />
                      <span>{category.productsCount}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-gray-500">
                    {new Date(category.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(category)}
                      >
                        <Edit size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(category.id)}
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
              {editingCategory ? "Edit Category" : "Add New Category"}
            </DialogTitle>
            <DialogDescription>
              {editingCategory ? "Update the category information below." : "Enter the details to create a new category."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter category name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Parent Category (Optional)</label>
              <select
                value={formData.parentId || ""}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  parentId: e.target.value ? parseInt(e.target.value) : null 
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select parent category (leave empty for top-level)</option>
                {categories
                  .filter(cat => !cat.parentId)
                  .map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button type="submit">
                {editingCategory ? "Update" : "Create"} Category
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
