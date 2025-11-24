"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"

type TrendPoint = { label: string; value: number }

export function TrendAreaChart({ data, className }: { data: TrendPoint[]; className?: string }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const max = useMemo(() => Math.max(...data.map(d => d.value)), [data])
  const min = useMemo(() => Math.min(...data.map(d => d.value)), [data])

  const points = useMemo(() => {
    if (!data.length) return ""
    return data
      .map((point, index) => {
        const x = (index / (data.length - 1)) * 100
        const normalized = (point.value - min) / (max - min || 1)
        const y = 100 - normalized * 80 - 10
        return `${x},${y}`
      })
      .join(" ")
  }, [data, max, min])

  const handlePointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const relativeX = event.clientX - bounds.left
    const ratio = relativeX / bounds.width
    const index = Math.min(data.length - 1, Math.max(0, Math.round(ratio * (data.length - 1))))
    setActiveIndex(index)
  }

  return (
    <div
      className={cn("relative h-48 select-none", className)}
      onPointerMove={handlePointer}
      onPointerLeave={() => setActiveIndex(null)}
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
        <defs>
          <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.6 0.18 260)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="oklch(0.6 0.18 260)" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <polyline
          fill="none"
          stroke="oklch(0.62 0.18 260)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points}
        />
        <polygon
          fill="url(#trendFill)"
          points={`0,100 ${points} 100,100`}
          opacity={0.6}
        />
        {activeIndex !== null && (
          <circle
            cx={(activeIndex / (data.length - 1)) * 100}
            cy={(() => {
              const normalized = (data[activeIndex].value - min) / (max - min || 1)
              return 100 - normalized * 80 - 10
            })()}
            r="3"
            fill="white"
            stroke="oklch(0.62 0.18 260)"
            strokeWidth={1.5}
          />
        )}
      </svg>
      {activeIndex !== null && (
        <div className="absolute bottom-3 left-3 rounded-lg border bg-background/95 px-3 py-2 text-xs shadow-sm">
          <p className="font-semibold">{data[activeIndex].label}</p>
          <p className="text-muted-foreground">PKR {Intl.NumberFormat("en-PK").format(data[activeIndex].value)}</p>
        </div>
      )}
    </div>
  )
}

export function ComparisonBarChart({
  data,
  className,
  title,
}: {
  data: TrendPoint[]
  className?: string
  title?: string
}) {
  const max = useMemo(() => Math.max(...data.map(d => d.value)), [data])
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  return (
    <div className={cn("h-48", className)}>
      {title && <p className="mb-3 text-sm font-medium text-muted-foreground">{title}</p>}
      <div className="flex h-full items-end gap-2">
        {data.map((point, index) => {
          const height = (point.value / (max || 1)) * 100
          const isActive = index === activeIndex
          return (
            <button
              key={point.label}
              className="flex-1"
              onPointerEnter={() => setActiveIndex(index)}
              onPointerLeave={() => setActiveIndex(null)}
            >
              <div
                className={cn(
                  "mx-auto w-8 rounded-t-md bg-gradient-to-t from-slate-300 to-slate-100 transition-all",
                  isActive && "from-indigo-500/80 to-indigo-400 shadow-md"
                )}
                style={{ height: `${Math.max(8, height)}%` }}
                aria-label={`${point.label} ${point.value}`}
              />
              <p className="mt-2 text-center text-xs text-muted-foreground">{point.label}</p>
            </button>
          )
        })}
      </div>
      {activeIndex !== null && (
        <div className="mt-3 rounded-lg border bg-background/95 px-3 py-2 text-xs shadow-sm">
          <p className="font-semibold">{data[activeIndex].label}</p>
          <p className="text-muted-foreground">Orders {data[activeIndex].value}</p>
        </div>
      )}
    </div>
  )
}

