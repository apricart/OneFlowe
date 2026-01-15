"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { signOut, useSession } from "next-auth/react"
import Image from "next/image"
import { Moon, Sun, ShoppingBag } from "lucide-react"
import { useTheme } from "next-themes"
import { CommandPalette } from "@/components/ui/command-palette"
import { ContextSelector } from "@/components/shell/context-selector"
import Link from "next/link"
import { NotificationBell } from "@/components/notifications/notification-center"

export function Topbar() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  const userRole = (session?.user as any)?.role

  async function logout() {
    // Clear theme preference so next login starts with light theme
    localStorage.removeItem('theme')
    await signOut({ callbackUrl: "/login", redirect: true })
  }

  return (
    <header
      className="sticky top-0 z-40 w-full h-14 flex items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800 backdrop-blur supports-[backdrop-filter]:bg-background/80 dark:supports-[backdrop-filter]:bg-slate-950/80 bg-white dark:bg-slate-950"
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
        {/* Order Portal link - Forces logout to switch context */}
        <Button
          variant="outline"
          size="sm"
          className="gap-2 hidden sm:flex"
          onClick={() => signOut({ callbackUrl: "/shop" })}
        >
          <ShoppingBag className="h-4 w-4" />
          Order Portal
        </Button>
        {/* Notifications */}
        <NotificationBell />

        {/* Theme Toggle */}
        {mounted ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              // Get resolved theme (if system, check actual preference)
              let resolvedTheme = theme
              if (theme === "system" || !theme) {
                resolvedTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
              }
              // Toggle to opposite
              const newTheme = resolvedTheme === "dark" ? "light" : "dark"
              setTheme(newTheme)
            }}
            className="relative"
            aria-label="Toggle theme"
            title={mounted && theme ? `Current: ${theme === "system" ? "System" : theme === "dark" ? "Dark" : "Light"}` : "Toggle theme"}
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        ) : (
          <div className="h-10 w-10" />
        )}

        {/* Profile Menu */}
        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 rounded-full px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Image
              src="/placeholder-user.jpg"
              alt="avatar"
              width={32}
              height={32}
              className="rounded-full ring-2 ring-slate-200 dark:ring-slate-700"
            />
            <span className="text-sm hidden md:inline font-medium text-slate-900 dark:text-white">
              {(session?.user as any)?.email?.split("@")[0] || "Account"}
            </span>
          </button>
          {open && (
            <div className="absolute right-0 top-12 z-50 min-w-56 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-lg dark:shadow-slate-900/50">
              <div className="px-3 py-2 text-sm">
                <p className="font-medium text-slate-900 dark:text-white">{(session?.user as any)?.fullName || "User"}</p>
                <p className="text-xs text-muted-foreground">{(session?.user as any)?.email || "user@example.com"}</p>
                <p className="text-xs text-muted-foreground mt-1 capitalize">{userRole?.toLowerCase().replace("_", " ")}</p>
              </div>
              <div className="h-px my-1 bg-slate-200 dark:bg-slate-700" />
              <button
                className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-white transition-colors"
                onClick={() => (window.location.href = "/settings")}
              >
                Settings
              </button>
              <button
                className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-red-600 dark:text-red-400 transition-colors"
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
