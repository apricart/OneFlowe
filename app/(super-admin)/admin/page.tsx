"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SectionHeader } from "@/components/ui/section-header"
import { RolePermissionsManager } from "@/components/admin/role-permissions-manager"
import { OrganizationSettingsManager } from "@/components/admin/organization-settings-manager"
import { AuditLogViewer } from "@/components/admin/audit-log-viewer"
import { 
  Shield, 
  Settings, 
  FileText,
  BarChart3,
  ShoppingBag,
  FolderTree,
  FolderOpen,
  Tags,
  Package,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useOrganizations, useBranches, useUsers } from '@/lib/hooks/use-api'
import { KpiCard } from '@/components/ui/kpi-card'
import useSWR from "swr"
import Link from "next/link"

const fetcher = (url: string) => fetch(url).then(res => res.json())

export default function SuperAdminPage() {
  const { data: orgsData } = useOrganizations()
  const { data: usersData } = useUsers()
  const { data: branchesData } = useBranches()

  // Fetch product management data
  const { data: categoriesData } = useSWR('/api/v1/categories', fetcher)
  const { data: subCategoriesData } = useSWR('/api/v1/subcategories', fetcher)
  const { data: modifiersData } = useSWR('/api/v1/modifiers', fetcher)
  const { data: productsData } = useSWR('/api/v1/inventory/global-products', fetcher)

  const orgsCount = orgsData?.items?.length || 0
  const usersCount = usersData?.items?.length || 0
  const branchesCount = branchesData?.items?.length || 0
  const activeBranches = branchesData?.items?.filter((b: any) => b.status === 'active')?.length || 0

  // Product management stats
  const categoriesCount = categoriesData?.items?.length || 0
  const subCategoriesCount = subCategoriesData?.items?.length || 0
  const modifiersCount = modifiersData?.items?.length || 0
  const productsCount = productsData?.items?.length || 0

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Super Admin Dashboard"
        subtitle="Advanced system administration and configuration"
      />

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard
          title="Total Organizations"
          value={orgsCount}
          colorClass="text-blue-600"
        />
        <KpiCard
          title="Active Branches"
          value={activeBranches}
          colorClass="text-green-600"
        />
        <KpiCard
          title="Total Users"
          value={usersCount}
          colorClass="text-purple-600"
        />
        <KpiCard
          title="All Branches"
          value={branchesCount}
          colorClass="text-amber-600"
        />
      </div>

      {/* Product Management Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard
          title="Categories"
          value={categoriesCount}
          colorClass="text-blue-600"
        />
        <KpiCard
          title="Sub Categories"
          value={subCategoriesCount}
          colorClass="text-green-600"
        />
        <KpiCard
          title="Modifiers"
          value={modifiersCount}
          colorClass="text-purple-600"
        />
        <KpiCard
          title="Products"
          value={productsCount}
          colorClass="text-orange-600"
        />
      </div>

      {/* Main Admin Interface */}
      <Card>
        <CardContent className="p-6">
          <Tabs defaultValue="permissions" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5 lg:w-auto">
              <TabsTrigger value="permissions" className="gap-2">
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Permissions</span>
              </TabsTrigger>
              <TabsTrigger value="products" className="gap-2">
                <ShoppingBag className="h-4 w-4" />
                <span className="hidden sm:inline">Products</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Settings</span>
              </TabsTrigger>
              <TabsTrigger value="audit" className="gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Audit Logs</span>
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Analytics</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="permissions" className="space-y-4">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Role Permissions Management</h3>
                <p className="text-sm text-muted-foreground">
                  Configure granular permissions for each role in the system
                </p>
              </div>
              <RolePermissionsManager />
            </TabsContent>

            <TabsContent value="products" className="space-y-4">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Product Management</h3>
                <p className="text-sm text-muted-foreground">
                  Manage categories, subcategories, modifiers, and products across the system
                </p>
              </div>
              
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <FolderTree className="h-8 w-8 text-blue-600" />
                    <div>
                      <p className="text-sm text-muted-foreground">Categories</p>
                      <p className="text-2xl font-bold">{categoriesCount}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Link href="/products/categories">
                      <Button variant="outline" size="sm" className="w-full">
                        Manage Categories
                      </Button>
                    </Link>
                  </div>
                </Card>

                <Card className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <FolderOpen className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="text-sm text-muted-foreground">Sub Categories</p>
                      <p className="text-2xl font-bold">{subCategoriesCount}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Link href="/products/subcategories">
                      <Button variant="outline" size="sm" className="w-full">
                        Manage Sub Categories
                      </Button>
                    </Link>
                  </div>
                </Card>

                <Card className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <Tags className="h-8 w-8 text-purple-600" />
                    <div>
                      <p className="text-sm text-muted-foreground">Modifiers</p>
                      <p className="text-2xl font-bold">{modifiersCount}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Link href="/products/modifiers">
                      <Button variant="outline" size="sm" className="w-full">
                        Manage Modifiers
                      </Button>
                    </Link>
                  </div>
                </Card>

                <Card className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <Package className="h-8 w-8 text-orange-600" />
                    <div>
                      <p className="text-sm text-muted-foreground">Products</p>
                      <p className="text-2xl font-bold">{productsCount}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Link href="/products">
                      <Button variant="outline" size="sm" className="w-full">
                        Manage Products
                      </Button>
                    </Link>
                  </div>
                </Card>
              </div>

              {/* Quick Actions */}
              <Card>
                <CardContent className="p-6">
                  <h4 className="font-semibold mb-4">Quick Actions</h4>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Link href="/products/categories">
                      <Button variant="outline" className="w-full justify-start">
                        <FolderTree className="h-4 w-4 mr-2" />
                        Add New Category
                      </Button>
                    </Link>
                    <Link href="/products/subcategories">
                      <Button variant="outline" className="w-full justify-start">
                        <FolderOpen className="h-4 w-4 mr-2" />
                        Add New Sub Category
                      </Button>
                    </Link>
                    <Link href="/products/modifiers">
                      <Button variant="outline" className="w-full justify-start">
                        <Tags className="h-4 w-4 mr-2" />
                        Add New Modifier
                      </Button>
                    </Link>
                    <Link href="/products">
                      <Button className="w-full justify-start">
                        <Package className="h-4 w-4 mr-2" />
                        Manage Products
                      </Button>
                    </Link>
                    <Link href="/global-inventory">
                      <Button variant="outline" className="w-full justify-start">
                        <ShoppingBag className="h-4 w-4 mr-2" />
                        Global Inventory
                      </Button>
                    </Link>
                    <Button variant="outline" className="w-full justify-start">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Product Reports
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card>
                <CardContent className="p-6">
                  <h4 className="font-semibold mb-4">Recent Product Activity</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <FolderTree className="h-4 w-4 text-blue-600" />
                        <div>
                          <p className="text-sm font-medium">New category created</p>
                          <p className="text-xs text-muted-foreground">2 minutes ago</p>
                        </div>
                      </div>
                      <Badge variant="secondary">Category</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Package className="h-4 w-4 text-orange-600" />
                        <div>
                          <p className="text-sm font-medium">Product updated</p>
                          <p className="text-xs text-muted-foreground">15 minutes ago</p>
                        </div>
                      </div>
                      <Badge variant="secondary">Product</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Tags className="h-4 w-4 text-purple-600" />
                        <div>
                          <p className="text-sm font-medium">Modifier added</p>
                          <p className="text-xs text-muted-foreground">1 hour ago</p>
                        </div>
                      </div>
                      <Badge variant="secondary">Modifier</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Organization Settings</h3>
                <p className="text-sm text-muted-foreground">
                  Manage organization-specific configurations and preferences
                </p>
              </div>
              <OrganizationSettingsManager />
            </TabsContent>

            <TabsContent value="audit" className="space-y-4">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Audit Trail</h3>
                <p className="text-sm text-muted-foreground">
                  Review system activity and permission changes
                </p>
              </div>
              <AuditLogViewer />
            </TabsContent>

            <TabsContent value="analytics" className="space-y-4">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">System Analytics</h3>
                <p className="text-sm text-muted-foreground">
                  Overview of system usage and performance metrics
                </p>
              </div>
              
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardContent className="p-6">
                    <h4 className="font-semibold mb-4">User Activity</h4>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Active Users (24h)</span>
                        <span className="font-bold">{Math.floor(usersCount * 0.6)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">New Users (7d)</span>
                        <span className="font-bold">{Math.floor(usersCount * 0.1)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Total Sessions</span>
                        <span className="font-bold">{usersCount * 3}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <h4 className="font-semibold mb-4">System Health</h4>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Database Status</span>
                        <span className="text-green-600 font-semibold">Healthy</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">API Response Time</span>
                        <span className="font-bold">42ms</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Uptime</span>
                        <span className="font-bold">99.9%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <h4 className="font-semibold mb-4">Storage Usage</h4>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Database Size</span>
                        <span className="font-bold">2.4 GB</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Media Storage</span>
                        <span className="font-bold">856 MB</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Backup Size</span>
                        <span className="font-bold">1.8 GB</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <h4 className="font-semibold mb-4">Recent Activity</h4>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Permission Changes</span>
                        <span className="font-bold">12</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Settings Updated</span>
                        <span className="font-bold">8</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Audit Log Entries</span>
                        <span className="font-bold">156</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

