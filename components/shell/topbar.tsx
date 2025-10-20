"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { signOut, useSession } from "next-auth/react"
import Image from "next/image"
import { Bell, Moon, Sun, ShoppingBag } from "lucide-react"
import { useTheme } from "next-themes"
import { CommandPalette } from "@/components/ui/command-palette"
import { ContextSelector } from "@/components/shell/context-selector"
import Link from "next/link"

export function Topbar() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  
  const userRole = (session?.user as any)?.role

  async function logout() {
    await signOut({ callbackUrl: "/login", redirect: true })
  }
  
  return (
    <header
      className="sticky top-0 z-40 w-full h-14 flex items-center justify-between px-4 border-b backdrop-blur supports-[backdrop-filter]:bg-background/80"
      style={{ borderColor: "var(--color-border)" }}
    >
      {/* Left Side - Context Selector & Command Palette */}
      <div className="flex items-center gap-3">
        <div className="hidden lg:flex">
          <ContextSelector />
        </div>
        <CommandPalette />
      </div>

      {/* Right Side - Actions & Profile */}
      <div className="flex items-center gap-3">
        {/* Order Portal link */}
        <Link 
          href={
            userRole === "BRANCH_ADMIN" || userRole === "HEAD_OFFICE" || userRole === "SUPER_ADMIN"
              ? "/shop"
              : "/shop/login"
          } 
          className="hidden sm:block"
        >
          <Button variant="outline" size="sm" className="gap-2">
            <ShoppingBag className="h-4 w-4" />
            Order Portal
          </Button>
        </Link>
        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full" />
        </Button>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        {/* Profile Menu */}
        <div className="relative">
          <button 
            onClick={() => setOpen((v) => !v)} 
            className="flex items-center gap-2 rounded-full px-2 py-1 hover:bg-accent transition-colors"
          >
            <Image 
              src="/placeholder-user.jpg" 
              alt="avatar" 
              width={32} 
              height={32} 
              className="rounded-full ring-2 ring-background" 
            />
            <span className="text-sm hidden md:inline font-medium">
              {(session?.user as any)?.email?.split("@")[0] || "Account"}
            </span>
          </button>
          {open && (
            <div className="absolute right-0 top-12 z-50 min-w-56 rounded-lg border bg-card p-2 shadow-lg">
              <div className="px-3 py-2 text-sm">
                <p className="font-medium">{(session?.user as any)?.fullName || "User"}</p>
                <p className="text-xs text-muted-foreground">{(session?.user as any)?.email || "user@example.com"}</p>
                <p className="text-xs text-muted-foreground mt-1 capitalize">{userRole?.toLowerCase().replace("_", " ")}</p>
              </div>
              <div className="h-px my-1 bg-border" />
              <button 
                className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors" 
                onClick={() => (window.location.href = "/settings")}
              >
                Settings
              </button>
              <button 
                className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent text-destructive transition-colors" 
                onClick={logout}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
