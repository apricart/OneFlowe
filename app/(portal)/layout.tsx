import type { ReactNode } from "react"
import { Sidebar } from "@/components/shell/sidebar"
import { Topbar } from "@/components/shell/topbar"
import { PreloadData } from "@/components/preload-data"
import { AppContextProvider } from "@/components/context/app-context"

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <AppContextProvider>
      <div className="min-h-svh w-full flex bg-background dark:bg-slate-950">
        <PreloadData />
        <Sidebar />
        <div className="flex-1 grid grid-rows-[auto_1fr]">
          <Topbar />
          <main className="p-4">{children}</main>
        </div>
      </div>
    </AppContextProvider>
  )
}
