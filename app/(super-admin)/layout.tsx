import type React from "react"
import { OrgBranchProvider } from "@/components/context/org-branch-context"
export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return <OrgBranchProvider initialRole="SUPER_ADMIN">{children}</OrgBranchProvider>
}
