"use client"

import { useState, useCallback } from "react"
import { format, subDays, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns"
import { X } from "lucide-react"
import type { DateRange } from "@/lib/hooks/use-sales-performance"

export type MonthPreset = "jan" | "feb" | "mar" | "apr" | "may" | "jun" | "jul" | "aug" | "sep" | "oct" | "nov" | "dec"
export type FilterPreset = "today" | "3d" | "7d" | "monthly" | "thisMonth" | "yearly" | "all" | "custom" | MonthPreset

interface GlobalDateFilterProps {
    value: DateRange | null
    onChange: (range: DateRange | null, preset: FilterPreset, compare?: boolean) => void
    activePreset: FilterPreset
    className?: string
    hidePresets?: boolean
    compare?: boolean
}

export const presets: { id: FilterPreset; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "3d", label: "3 Days" },
    { id: "7d", label: "7 Days" },
    { id: "thisMonth", label: "This Month" },
    { id: "yearly", label: "This Year" },
    { id: "all", label: "All Time" },
]

export const monthPresets: { id: MonthPreset; label: string }[] = [
    { id: "jan", label: "January" },
    { id: "feb", label: "February" },
    { id: "mar", label: "March" },
    { id: "apr", label: "April" },
    { id: "may", label: "May" },
    { id: "jun", label: "June" },
    { id: "jul", label: "July" },
    { id: "aug", label: "August" },
    { id: "sep", label: "September" },
    { id: "oct", label: "October" },
    { id: "nov", label: "November" },
    { id: "dec", label: "December" },
]

export function getPresetLabel(preset: FilterPreset, range?: DateRange | null): string {
    if (preset === "custom" && range) {
        return `${format(range.startDate, "dd MMM yyyy")} – ${format(range.endDate, "dd MMM yyyy")}`
    }
    const allPresets = [...presets, ...monthPresets, { id: "custom", label: "Custom" }]
    return allPresets.find(p => p.id === preset)?.label || "Selected Period"
}

export function getPresetRange(preset: FilterPreset): DateRange {
    const now = new Date()
    const year = now.getFullYear()

    // Check if it's a month preset
    const monthIndex = monthPresets.findIndex(m => m.id === preset)
    if (monthIndex !== -1) {
        const start = new Date(year, monthIndex, 1)
        return { startDate: startOfDay(start), endDate: endOfDay(endOfMonth(start)) }
    }

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

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Switch } from "@/components/ui/switch"
import { Check, ChevronDown, Calendar as CalendarIcon, ArrowRightLeft } from "lucide-react"
import { cn } from "@/lib/utils"

export function GlobalDateFilter({ value, onChange, activePreset, className, hidePresets, compare }: GlobalDateFilterProps) {
    const [calendarOpen, setCalendarOpen] = useState(false)

    const handleSelectPreset = (preset: FilterPreset) => {
        if (preset === "custom") {
            setCalendarOpen(true)
            return
        }
        const range = getPresetRange(preset)
        onChange(range, preset, compare)
    }

    const toggleCompare = (checked: boolean) => {
        onChange(value, activePreset, checked)
    }

    const selectedLabel = getPresetLabel(activePreset, value)

    return (
        <div className={cn("flex items-center gap-2", className)}>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                            "h-10 px-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all rounded-xl gap-2.5 font-bold text-xs text-slate-700 dark:text-slate-300 min-w-[140px] justify-between",
                            compare && "border-indigo-500/50 bg-indigo-50/10"
                        )}
                    >
                        <div className="flex items-center gap-2.5 truncate">
                            <CalendarIcon className={cn("h-4 w-4 shrink-0", compare ? "text-indigo-600" : "text-indigo-500")} />
                            <span className="truncate">{selectedLabel}{compare && " (vs Prev)"}</span>
                        </div>
                        <ChevronDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-60 rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl p-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
                    <div className="px-2 py-1.5 mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <span>Date Range</span>
                    </div>
                    {presets.map((p) => (
                        <DropdownMenuItem
                            key={p.id}
                            onClick={() => handleSelectPreset(p.id)}
                            className={cn(
                                "rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer flex items-center justify-between mb-0.5 transition-colors",
                                activePreset === p.id
                                    ? "bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400"
                                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                            )}
                        >
                            {p.label}
                            {activePreset === p.id && <Check className="h-3.5 w-3.5" />}
                        </DropdownMenuItem>
                    ))}

                    <div className="px-2 py-2 mt-2 border-t border-slate-100 dark:border-slate-800 mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Select Month
                    </div>
                    <div className="grid grid-cols-3 gap-1 px-1">
                        {monthPresets.map((m) => (
                            <div
                                key={m.id}
                                onClick={() => handleSelectPreset(m.id)}
                                className={cn(
                                    "px-2 py-1.5 rounded-lg text-[10px] font-bold text-center cursor-pointer transition-all uppercase tracking-tighter",
                                    activePreset === m.id
                                        ? "bg-indigo-600 text-white"
                                        : "bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 hover:text-indigo-600"
                                )}
                            >
                                {m.id}
                            </div>
                        ))}
                    </div>

                    <DropdownMenuSeparator className="my-1.5 bg-slate-100 dark:bg-slate-800" />

                    <div className="px-1 mb-1.5">
                        <div className={cn(
                            "flex items-center justify-between p-2 rounded-xl transition-colors",
                            compare ? "bg-indigo-50/50 dark:bg-indigo-950/30" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        )}>
                            <div className="flex items-center gap-2">
                                <ArrowRightLeft className={cn("w-3.5 h-3.5", compare ? "text-indigo-600" : "text-slate-400")} />
                                <span className={cn("text-[11px] font-bold", compare ? "text-indigo-600" : "text-slate-600")}>Compare to Previous</span>
                            </div>
                            <Switch
                                checked={compare}
                                onCheckedChange={toggleCompare}
                                className="scale-75 data-[state=checked]:bg-indigo-600"
                            />
                        </div>
                    </div>

                    <DropdownMenuSeparator className="my-1.5 bg-slate-100 dark:border-slate-800" />

                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                        <PopoverTrigger asChild>
                            <DropdownMenuItem
                                onSelect={(e) => e.preventDefault()}
                                className={cn(
                                    "rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer flex items-center gap-2.5 transition-colors",
                                    activePreset === "custom"
                                        ? "bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400"
                                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                )}
                            >
                                <CalendarIcon className="h-4 w-4 text-indigo-500" />
                                Custom Range...
                            </DropdownMenuItem>
                        </PopoverTrigger>
                        <PopoverContent
                            className="w-auto p-0 rounded-3xl border-slate-200 dark:border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden"
                            align="start"
                            side="bottom"
                            sideOffset={8}
                            onInteractOutside={(e) => {
                                // Prevent closing if clicking inside the calendar area
                                e.preventDefault()
                            }}
                            onOpenAutoFocus={(e) => e.preventDefault()}
                        >
                            <div onClick={(e) => e.stopPropagation()}>
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={value?.startDate || new Date()}
                                    selected={{
                                        from: value?.startDate,
                                        to: value?.endDate,
                                    }}
                                    onSelect={(range: any) => {
                                        if (range?.from && range?.to) {
                                            onChange({ startDate: range.from, endDate: range.to }, "custom", compare)
                                            setCalendarOpen(false)
                                        }
                                    }}
                                    numberOfMonths={2}
                                    className="p-4 bg-white dark:bg-slate-900"
                                />
                            </div>
                        </PopoverContent>
                    </Popover>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}
