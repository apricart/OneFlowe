import type React from "react"
import { Sidebar } from "@/components/shell/sidebar"
import { Topbar } from "@/components/shell/topbar"
import { PreloadData } from "@/components/preload-data"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { redirect } from "next/navigation"
import { AppContextProvider } from "@/components/context/app-context"
import { OrgBranchProvider } from "@/components/context/org-branch-context"
import { Toaster } from "@/components/ui/toaster"

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  
  return (
    <AppContextProvider>
      <OrgBranchProvider initialRole="SUPER_ADMIN">
        <div className="min-h-svh w-full flex bg-background dark:bg-slate-950">
          <PreloadData />
          <Sidebar />
          <div className="flex-1 grid grid-rows-[auto_1fr] bg-background dark:bg-slate-950">
            <Topbar />
            <main className="p-4 bg-background dark:bg-slate-950">{children}</main>
          </div>
        </div>
        <Toaster />
      </OrgBranchProvider>
    </AppContextProvider>
  )
}
