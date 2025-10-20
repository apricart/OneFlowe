"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { HeadOfficeUsersTable } from "@/components/users/head-office-users-table"
import { CreateUserDialog } from "@/components/users/create-user-dialog"
import { useAppContext } from "@/components/context/app-context"
import { SectionHeader } from "@/components/ui/section-header"
import { Button } from "@/components/ui/button"
import { RefreshCw, Users, UserPlus, Building2 } from "lucide-react"
import useSWR from "swr"
import { jsonFetcher } from "@/lib/fetcher"

const fetcher = (url: string) => fetch(url).then(res => res.json())

export default function UsersPage() {
  const { organizationId, branchId, userRole } = useAppContext()
  
  const { data: usersData, mutate: mutateUsers } = useSWR(
    "/api/v1/users",
    fetcher
  )
  
  const { data: branchesData } = useSWR(
    organizationId ? `/api/v1/branches?organizationId=${organizationId}` : null,
    fetcher
  )

  const users = usersData?.items || []
  const branches = branchesData?.items || []

  // Filter users based on role and organization
  const filteredUsers = users.filter((user: any) => {
    // Super Admin can see all users
    if (userRole === "SUPER_ADMIN") return true
    
    // Head Office can only see users in their organization
    if (userRole === "HEAD_OFFICE") {
      return user.organizationId === parseInt(organizationId || "0")
    }
    
    // Branch Admin can only see users in their branch
    if (userRole === "BRANCH_ADMIN") {
      return user.branchId === parseInt(branchId || "0")
    }
    
    return false
  })

  // Calculate stats
  const stats = {
    total: filteredUsers.length,
    headOffice: filteredUsers.filter((u: any) => u.role === "HEAD_OFFICE").length,
    branchAdmin: filteredUsers.filter((u: any) => u.role === "BRANCH_ADMIN").length,
    active: filteredUsers.filter((u: any) => u.mfaEnabled).length
  }

  return (
    <div className="space-y-6 p-6">
      <SectionHeader
        title="User Management"
        subtitle="Manage Head Office and Branch Admin users for your organization"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => mutateUsers()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <CreateUserDialog onSuccess={() => mutateUsers()} />
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total Users</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Head Office</div>
          <div className="text-2xl font-bold text-blue-600">{stats.headOffice}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Branch Admins</div>
          <div className="text-2xl font-bold text-green-600">{stats.branchAdmin}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">MFA Enabled</div>
          <div className="text-2xl font-bold text-purple-600">{stats.active}</div>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Users
            {userRole === "HEAD_OFFICE" && (
              <span className="text-sm font-normal text-muted-foreground">
                in your organization
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <HeadOfficeUsersTable 
            users={filteredUsers} 
            branches={branches}
            onUserUpdate={() => mutateUsers()}
          />
        </CardContent>
      </Card>
    </div>
  )
}