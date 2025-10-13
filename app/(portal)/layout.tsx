import type { ReactNode } from "react"
import { Sidebar } from "@/components/shell/sidebar"
import { Topbar } from "@/components/shell/topbar"
import { PreloadData } from "@/components/preload-data"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { redirect } from "next/navigation"
import { OrgBranchProvider } from "@/components/context/org-branch-context"

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  const role = (session.user as any)?.role || "HEAD_OFFICE"
  return (
    <OrgBranchProvider initialRole={role}>
      <div className="min-h-svh w-full flex bg-[oklch(0.98_0.01_250)]">
        <PreloadData />
        <Sidebar />
        <div className="flex-1 grid grid-rows-[auto_1fr]">
          <Topbar />
          <main className="p-4">{children}</main>
        </div>
      </div>
    </OrgBranchProvider>
  )
}
