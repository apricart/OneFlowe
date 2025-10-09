import type { ReactNode } from "react"
import { Sidebar } from "@/components/shell/sidebar"
import { Topbar } from "@/components/shell/topbar"

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh w-full flex">
      <Sidebar />
      <div className="flex-1 grid grid-rows-[auto_1fr]">
        <Topbar />
        <main className="p-4">{children}</main>
      </div>
    </div>
  )
}
