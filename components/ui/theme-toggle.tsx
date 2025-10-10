"use client"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Moon, Sun } from "lucide-react"

const THEME_KEY = "oneflowe:theme" // "light" | "dark" | "system"

export function ThemeToggle() {
  const [theme, setTheme] = useState<string>("system")

  useEffect(() => {
    const persisted = localStorage.getItem(THEME_KEY) || "system"
    setTheme(persisted)
    applyTheme(persisted)
  }, [])

  function applyTheme(next: string) {
    const root = document.documentElement
    const isDark =
      next === "dark" ||
      (next === "system" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches)
    root.classList.toggle("dark", isDark)
  }

  function cycle() {
    const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light"
    setTheme(next)
    localStorage.setItem(THEME_KEY, next)
    applyTheme(next)
  }

  const icon = theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />
  const label = theme === "system" ? "System" : theme === "dark" ? "Dark" : "Light"

  return (
    <Button variant="ghost" size="sm" onClick={cycle} aria-label="Toggle theme" title={`Theme: ${label}`}>
      {icon}
      <span className="ml-2 hidden md:inline">{label}</span>
    </Button>
  )
}
