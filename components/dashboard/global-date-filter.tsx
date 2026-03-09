"use client"

import { useState, useCallback } from "react"
import { format, subDays, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns"
import { Calendar, X } from "lucide-react"
import type { DateRange } from "@/lib/hooks/use-sales-performance"

export type FilterPreset = "today" | "3d" | "7d" | "monthly" | "thisMonth" | "yearly" | "all" | "custom"

interface GlobalDateFilterProps {
    value: DateRange | null
    onChange: (range: DateRange | null, preset: FilterPreset) => void
    activePreset: FilterPreset
    className?: string
    hidePresets?: boolean
}

export const presets: { id: FilterPreset; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "3d", label: "3 Days" },
    { id: "7d", label: "7 Days" },
    { id: "monthly", label: "This Month" },
    { id: "yearly", label: "This Year" },
    { id: "all", label: "All Time" },
    { id: "custom", label: "Custom" },
]

export function getPresetLabel(preset: FilterPreset, range?: DateRange | null): string {
    if (preset === "custom" && range) {
        return `${format(range.startDate, "dd MMM yyyy")} – ${format(range.endDate, "dd MMM yyyy")}`
    }
    return presets.find(p => p.id === preset)?.label || "Selected Period"
}

function getPresetRange(preset: FilterPreset): DateRange {
    const now = new Date()
    switch (preset) {
        case "today":
            return { startDate: startOfDay(now), endDate: endOfDay(now) }
        case "3d":
            return { startDate: startOfDay(subDays(now, 2)), endDate: endOfDay(now) }
        case "7d":
            return { startDate: startOfDay(subDays(now, 6)), endDate: endOfDay(now) }
        case "monthly":
        case "thisMonth":
            return { startDate: startOfMonth(now), endDate: endOfMonth(now) }
        case "yearly":
            return { startDate: startOfYear(now), endDate: endOfYear(now) }
        case "all":
            return { startDate: new Date("2000-01-01"), endDate: endOfDay(now) }
        default:
            return { startDate: startOfDay(now), endDate: endOfDay(now) }
    }
}

export function GlobalDateFilter({ value, onChange, activePreset, className, hidePresets }: GlobalDateFilterProps) {
    const [showCalendar, setShowCalendar] = useState(false)
    const [fromDate, setFromDate] = useState<string>("")
    const [toDate, setToDate] = useState<string>("")

    const handlePreset = useCallback((preset: FilterPreset) => {
        if (preset === "custom") {
            setShowCalendar(prev => !prev)
            return
        }
        setShowCalendar(false)
        const range = getPresetRange(preset)
        onChange(range, preset)
    }, [onChange])

    const handleApplyCustom = useCallback(() => {
        if (!fromDate || !toDate) return
        const start = startOfDay(new Date(fromDate))
        const end = endOfDay(new Date(toDate))
        if (start > end) return
        onChange({ startDate: start, endDate: end }, "custom")
        setShowCalendar(false)
    }, [fromDate, toDate, onChange])

    const displayLabel = activePreset === "custom" && value
        ? `${format(value.startDate, "dd MMM yyyy")} – ${format(value.endDate, "dd MMM yyyy")}`
        : null

    return (
        <div className={`relative ${className || ""}`}>
            <div className="flex items-center gap-1.5 flex-wrap">
                {!hidePresets && presets.map(p => (
                    <button
                        key={p.id}
                        onClick={() => handlePreset(p.id)}
                        className={`
              relative px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 select-none
              ${activePreset === p.id
                                ? "bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-blue-900/40 scale-105"
                                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400"
                            }
            `}
                    >
                        {p.id === "custom" && activePreset === "custom" && displayLabel
                            ? (
                                <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {displayLabel}
                                </span>
                            )
                            : p.id === "custom"
                                ? <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Custom</span>
                                : p.label
                        }
                    </button>
                ))}
            </div>

            {/* Calendar Dropdown */}
            {showCalendar && (
                <div className="absolute top-full left-0 mt-2 z-50">
                    <div
                        className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl p-5 min-w-[300px]"
                        style={{ animation: "slideDown 0.2s ease-out" }}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Select Date Range</span>
                            <button
                                onClick={() => setShowCalendar(false)}
                                className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                                <X className="h-4 w-4 text-slate-500" />
                            </button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">From</label>
                                <input
                                    type="date"
                                    value={fromDate}
                                    onChange={e => setFromDate(e.target.value)}
                                    max={toDate || undefined}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">To</label>
                                <input
                                    type="date"
                                    value={toDate}
                                    onChange={e => setToDate(e.target.value)}
                                    min={fromDate || undefined}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                                />
                            </div>
                            <button
                                onClick={handleApplyCustom}
                                disabled={!fromDate || !toDate}
                                className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Apply Range
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
