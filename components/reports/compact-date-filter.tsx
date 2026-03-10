"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon, ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"
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
import { presets, getPresetLabel, FilterPreset } from "@/components/dashboard/global-date-filter"
import type { DateRange } from "@/lib/hooks/use-sales-performance"

interface CompactDateFilterProps {
    value: DateRange | null
    onChange: (range: DateRange | null, preset: FilterPreset) => void
    activePreset: FilterPreset
    className?: string
}

export function CompactDateFilter({ value, onChange, activePreset, className }: CompactDateFilterProps) {
    const [calendarOpen, setCalendarOpen] = React.useState(false)

    const handleSelectPreset = (preset: FilterPreset) => {
        if (preset === "custom") {
            setCalendarOpen(true)
            return
        }
        // We import the logic from the global filter if possible, but here we'll just trigger the same onChange
        // The page.tsx already has the handleDateChange which handles the preset logic
        onChange(null, preset)
    }

    const selectedLabel = getPresetLabel(activePreset, value)

    return (
        <div className={cn("flex items-center gap-2", className)}>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-9 px-3 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all rounded-xl gap-2 font-bold text-xs text-slate-700 dark:text-slate-300"
                    >
                        <CalendarIcon className="h-3.5 w-3.5 text-indigo-500" />
                        <span className="truncate max-w-[150px]">{selectedLabel}</span>
                        <ChevronDown className="h-3 w-3 opacity-50" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 rounded-xl border-slate-200 dark:border-slate-800 shadow-2xl p-1">
                    {presets.map((p) => (
                        <DropdownMenuItem
                            key={p.id}
                            onClick={() => handleSelectPreset(p.id)}
                            className={cn(
                                "rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer flex items-center justify-between",
                                activePreset === p.id ? "bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400"
                            )}
                        >
                            {p.label}
                            {activePreset === p.id && <Check className="h-3 w-3" />}
                        </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800" />

                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                        <PopoverTrigger asChild>
                            <DropdownMenuItem
                                onSelect={(e) => e.preventDefault()}
                                className={cn(
                                    "rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer flex items-center gap-2",
                                    activePreset === "custom" ? "bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400"
                                )}
                            >
                                <CalendarIcon className="h-3 w-3" />
                                Custom Range...
                            </DropdownMenuItem>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl" align="start">
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={value?.startDate}
                                selected={{
                                    from: value?.startDate,
                                    to: value?.endDate,
                                }}
                                onSelect={(range: any) => {
                                    if (range?.from && range?.to) {
                                        onChange({ startDate: range.from, endDate: range.to }, "custom")
                                        setCalendarOpen(false)
                                    }
                                }}
                                numberOfMonths={2}
                                className="rounded-2xl border-none"
                            />
                        </PopoverContent>
                    </Popover>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}
