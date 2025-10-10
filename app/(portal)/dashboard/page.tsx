import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { SuperAdminDashboard } from "@/components/dashboard/super-admin-dashboard"
import { HeadOfficeDashboard } from "@/components/dashboard/head-office-dashboard"
import { BranchAdminDashboard } from "@/components/dashboard/branch-admin-dashboard"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (role === "SUPER_ADMIN") return <SuperAdminDashboard />
  if (role === "HEAD_OFFICE") return <HeadOfficeDashboard />
  if (role === "BRANCH_ADMIN") return <BranchAdminDashboard />
  return null
}
