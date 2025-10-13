"use client"
import { useState } from "react"

type Tab = { value: string; label: string }

export function Tabs({ tabs, value, onValueChange }: { tabs: Tab[]; value?: string; onValueChange?: (v: string) => void }) {
  const [internal, setInternal] = useState(tabs[0]?.value || "")
  const current = value ?? internal
  function set(v: string) {
    setInternal(v)
    onValueChange?.(v)
  }
  return (
    <div className="flex items-center gap-1 border-b">
      {tabs.map((t) => {
        const active = current === t.value
        return (
          <button
            key={t.value}
            className={`px-3 py-2 text-sm rounded-t-md ${active ? "font-semibold" : "opacity-70 hover:opacity-100"}`}
            style={{
              color: active ? "var(--color-brand-primary)" : "inherit",
              background: active ? "color-mix(in oklab, var(--color-brand-accent), transparent 85%)" : "transparent",
            }}
            onClick={() => set(t.value)}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

export { }
