"use client"

import { useState, useCallback, useEffect } from "react"
import { format, subDays, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns"
import { X, Loader2 } from "lucide-react"
import type { DateRange } from "@/lib/hooks/use-sales-performance"

export type MonthPreset = "jan" | "feb" | "mar" | "apr" | "may" | "jun" | "jul" | "aug" | "sep" | "oct" | "nov" | "dec"
export type FilterPreset = "today" | "3d" | "7d" | "monthly" | "thisMonth" | "yearly" | "all" | "custom" | MonthPreset

interface GlobalDateFilterProps {
    value: DateRange | null
    onChange: (
        range: DateRange | null, 
        preset: FilterPreset, 
        compare?: boolean, 
        compareRange?: DateRange | null,
        months?: number[],
        years?: number[],
        compareMonths?: number[],
        compareYears?: number[]
    ) => void
    activePreset: FilterPreset
    className?: string
    hidePresets?: boolean
    compare?: boolean
    compareRange?: DateRange | null
    months?: number[]
    years?: number[]
    compareMonths?: number[]
    compareYears?: number[]
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
            // Fallback if earliestDate is not provided by the component state
            // Default to start of 2024 as a more reasonable recent beginning for this system
            return { startDate: new Date("2024-01-01"), endDate: endOfDay(now) }
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
    DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Switch } from "@/components/ui/switch"
import { Check, ChevronDown, Calendar as CalendarIcon, ArrowRightLeft, Calculator } from "lucide-react"
import { cn } from "@/lib/utils"

export function GlobalDateFilter({ 
    value, onChange, activePreset, className, hidePresets, 
    compare, compareRange, months = [], years = [], 
    compareMonths = [], compareYears = [] 
}: GlobalDateFilterProps) {
    const [calendarOpen, setCalendarOpen] = useState(false)
    const [compareCalendarOpen, setCompareCalendarOpen] = useState(false)
    const [earliestDate, setEarliestDate] = useState<Date | null>(null)

    useEffect(() => {
        const fetchEarliest = async () => {
            try {
                const res = await fetch('/api/v1/analytics/earliest-record')
                const data = await res.json()
                if (data.earliestDate) {
                    setEarliestDate(new Date(data.earliestDate))
                }
            } catch (e) {
                console.error("Failed to fetch earliest record:", e)
            }
        }
        fetchEarliest()
    }, [])

    const [monthsOpen, setMonthsOpen] = useState(false)
    const [yearsOpen, setYearsOpen] = useState(false)
    const [compareMonthsOpen, setCompareMonthsOpen] = useState(false)
    const [compareYearsOpen, setCompareYearsOpen] = useState(false)

    const handleSelectPreset = (preset: FilterPreset) => {
        if (preset === "custom") {
            setCalendarOpen(true)
            return
        }
        let range = getPresetRange(preset)
        if (preset === "all" && earliestDate) {
            range = { startDate: startOfDay(earliestDate), endDate: endOfDay(new Date()) }
        }
        
        // When picking a classic preset, clear the array selections to avoid conflicts
        onChange(range, preset, compare, compareRange, [], [], compareMonths, compareYears)
    }

    const toggleCompare = (checked: boolean) => {
        onChange(value, activePreset, checked, compareRange, months, years, compareMonths, compareYears)
    }

    const toggleArraySelection = (type: 'months' | 'years' | 'compareMonths' | 'compareYears', val: number) => {
        const isSelected = type === 'months' ? months.includes(val) :
                           type === 'years' ? years.includes(val) :
                           type === 'compareMonths' ? compareMonths.includes(val) :
                           compareYears.includes(val);
                           
        const newArr = isSelected 
            ? (type === 'months' ? months : type === 'years' ? years : type === 'compareMonths' ? compareMonths : compareYears).filter(v => v !== val)
            : [...(type === 'months' ? months : type === 'years' ? years : type === 'compareMonths' ? compareMonths : compareYears), val];

        onChange(
            null, // Clear DateRange
            "custom", // Force custom mode 
            compare, 
            compareRange,
            type === 'months' ? newArr : months,
            type === 'years' ? newArr : years,
            type === 'compareMonths' ? newArr : compareMonths,
            type === 'compareYears' ? newArr : compareYears
        )
    }

    const [tempMonths, setTempMonths] = useState<number[]>(months)
    const [tempYears, setTempYears] = useState<number[]>(years)
    const [tempCompareMonths, setTempCompareMonths] = useState<number[]>(compareMonths)
    const [tempCompareYears, setTempCompareYears] = useState<number[]>(compareYears)

    useEffect(() => {
        setTempMonths(months)
    }, [months])

    useEffect(() => {
        setTempYears(years)
    }, [years])

    useEffect(() => {
        setTempCompareMonths(compareMonths)
    }, [compareMonths])

    useEffect(() => {
        setTempCompareYears(compareYears)
    }, [compareYears])

    const applyArraySelection = (type: 'months' | 'years' | 'compareMonths' | 'compareYears') => {
        onChange(
            null, 
            "custom", 
            compare, 
            compareRange,
            type === 'months' ? tempMonths : months,
            type === 'years' ? tempYears : years,
            type === 'compareMonths' ? tempCompareMonths : compareMonths,
            type === 'compareYears' ? tempCompareYears : compareYears
        )
        setMonthsOpen(false)
        setYearsOpen(false)
        setCompareMonthsOpen(false)
        setCompareYearsOpen(false)
    }

    const toggleTempSelection = (type: 'months' | 'years' | 'compareMonths' | 'compareYears', val: number) => {
        if (type === 'months') {
            setTempMonths(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])
        } else if (type === 'years') {
            setTempYears(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])
        } else if (type === 'compareMonths') {
            setTempCompareMonths(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])
        } else if (type === 'compareYears') {
            setTempCompareYears(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])
        }
    }

    const selectedLabel = (months.length > 0 || years.length > 0) 
        ? "Custom Arrays" 
        : getPresetLabel(activePreset, value)

    const currentYear = new Date().getFullYear()
    const startYear = earliestDate ? earliestDate.getFullYear() : currentYear
    const dynamicYears = Array.from({ length: currentYear - startYear + 1 }, (_, i) => currentYear - i)

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
                        Select Arbitrary Period A
                    </div>
                    
                    {/* Advanced Multi-Select Arrays */}
                    <div className="grid grid-cols-2 gap-2 px-1 mb-2">
                        <Popover open={monthsOpen} onOpenChange={setMonthsOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className={cn("text-[10px] w-full gap-1 h-7 border-slate-200 dark:border-slate-800", months.length > 0 && "bg-indigo-50 border-indigo-200 text-indigo-700")}>
                                    <CalendarIcon className="w-3 h-3 opacity-60" /> {months.length > 0 ? `${months.length} Months` : 'Months'}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-48 p-2 rounded-2xl shadow-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900" align="start">
                                <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                                    {monthPresets.map((m, i) => (
                                        <div 
                                            key={m.id} 
                                            className={cn(
                                                "flex items-center justify-between px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors",
                                                tempMonths.includes(i) ? "bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                            )}
                                            onClick={() => toggleTempSelection('months', i)}
                                        >
                                            {m.label}
                                            {tempMonths.includes(i) && <Check className="h-3.5 w-3.5" />}
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <Button 
                                        size="sm" 
                                        onClick={() => applyArraySelection('months')}
                                        className="w-full h-8 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
                                    >
                                        OK
                                    </Button>
                                </div>
                            </PopoverContent>
                        </Popover>

                        <Popover open={yearsOpen} onOpenChange={setYearsOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className={cn("text-[10px] w-full gap-1 h-7 border-slate-200 dark:border-slate-800", years.length > 0 && "bg-indigo-50 border-indigo-200 text-indigo-700")}>
                                    <Calculator className="w-3 h-3 opacity-60" /> {years.length > 0 ? `${years.length} Years` : 'Years'}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-32 p-2 rounded-2xl shadow-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900" align="start">
                                <div className="space-y-1">
                                    {YEARS.map((y) => (
                                        <div 
                                            key={y} 
                                            className={cn(
                                                "flex items-center justify-between px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors",
                                                tempYears.includes(y) ? "bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                            )}
                                            onClick={() => toggleTempSelection('years', y)}
                                        >
                                            {y}
                                            {tempYears.includes(y) && <Check className="h-3.5 w-3.5" />}
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <Button 
                                        size="sm" 
                                        onClick={() => applyArraySelection('years')}
                                        className="w-full h-8 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
                                    >
                                        OK
                                    </Button>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>

                    <DropdownMenuSeparator className="my-1.5 bg-slate-100 dark:bg-slate-800" />

                    <div className="px-1 mb-1.5">
                        <div className={cn(
                            "flex items-center justify-between p-2 rounded-xl transition-colors",
                            compare ? "bg-indigo-50/50 dark:bg-indigo-950/30" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        )}>
                            <div className="flex items-center gap-2">
                                <ArrowRightLeft className={cn("w-3.5 h-3.5", compare ? "text-indigo-600" : "text-slate-400")} />
                                <span className={cn("text-[11px] font-bold", compare ? "text-indigo-600" : "text-slate-600")}>Compare To</span>
                            </div>
                            <Switch
                                checked={compare}
                                onCheckedChange={toggleCompare}
                                className="scale-75 data-[state=checked]:bg-indigo-600"
                            />
                        </div>
                        {compare && (
                            <div className="mt-2 text-center" onClick={(e) => e.stopPropagation()}>
                                <Popover open={compareCalendarOpen} onOpenChange={setCompareCalendarOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" size="sm" className="w-full h-8 text-[11px] justify-start px-2.5 font-semibold text-slate-600 dark:text-slate-400 border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/50 hover:bg-indigo-100/50 hover:text-indigo-600">
                                            <CalendarIcon className="mr-2 h-3.5 w-3.5 opacity-60" />
                                            {compareRange ? `${format(compareRange.startDate, "dd MMM yyyy")} – ${format(compareRange.endDate, "dd MMM yyyy")}` : (compareMonths.length > 0 || compareYears.length > 0) ? "Complex Comparison Array" : "Previous Period (Auto)"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                        className="w-auto p-0 rounded-3xl border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden z-[100]"
                                        align="center"
                                        side="bottom"
                                        sideOffset={8}
                                        onInteractOutside={(e) => e.preventDefault()}
                                        onOpenAutoFocus={(e) => e.preventDefault()}
                                    >
                                        <div onClick={(e) => e.stopPropagation()}>
                                            <div className="px-4 pt-3 pb-1 border-b border-slate-100 dark:border-slate-800">
                                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Compare Period B Range</p>
                                            </div>
                                            
                                            <div className="p-3 bg-slate-50/50 dark:bg-slate-900 grid grid-cols-2 gap-2 border-b border-slate-100 dark:border-slate-800">
                                                <Popover open={compareMonthsOpen} onOpenChange={setCompareMonthsOpen}>
                                                    <PopoverTrigger asChild>
                                                        <Button variant="outline" size="sm" className={cn("text-[10px] w-full gap-1 h-7 border-slate-200 dark:border-slate-800", compareMonths.length > 0 && "bg-rose-50 border-rose-200 text-rose-700")}>
                                                            <CalendarIcon className="w-3 h-3 opacity-60" /> {compareMonths.length > 0 ? `${compareMonths.length} Months` : 'Months'}
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-48 p-2 rounded-2xl shadow-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900" align="start">
                                                        <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                                                            {monthPresets.map((m, i) => (
                                                                <div 
                                                                    key={m.id} 
                                                                    className={cn(
                                                                        "flex items-center justify-between px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors",
                                                                        tempCompareMonths.includes(i) ? "bg-rose-50 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                                                    )}
                                                                    onClick={() => toggleTempSelection('compareMonths', i)}
                                                                >
                                                                    {m.label}
                                                                    {tempCompareMonths.includes(i) && <Check className="h-3.5 w-3.5" />}
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                                            <Button 
                                                                size="sm" 
                                                                onClick={() => applyArraySelection('compareMonths')}
                                                                className="w-full h-8 text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl"
                                                            >
                                                                OK
                                                            </Button>
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>

                                                <Popover open={compareYearsOpen} onOpenChange={setCompareYearsOpen}>
                                                    <PopoverTrigger asChild>
                                                        <Button variant="outline" size="sm" className={cn("text-[10px] w-full gap-1 h-7 border-slate-200 dark:border-slate-800", compareYears.length > 0 && "bg-rose-50 border-rose-200 text-rose-700")}>
                                                            <Calculator className="w-3 h-3 opacity-60" /> {compareYears.length > 0 ? `${compareYears.length} Years` : 'Years'}
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-32 p-2 rounded-2xl shadow-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900" align="start">
                                                        <div className="space-y-1">
                                                            {YEARS.map((y) => (
                                                                <div 
                                                                    key={y} 
                                                                    className={cn(
                                                                        "flex items-center justify-between px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors",
                                                                        tempCompareYears.includes(y) ? "bg-rose-50 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                                                    )}
                                                                    onClick={() => toggleTempSelection('compareYears', y)}
                                                                >
                                                                    {y}
                                                                    {tempCompareYears.includes(y) && <Check className="h-3.5 w-3.5" />}
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                                            <Button 
                                                                size="sm" 
                                                                onClick={() => applyArraySelection('compareYears')}
                                                                className="w-full h-8 text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl"
                                                            >
                                                                OK
                                                            </Button>
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            </div>

                                            <Calendar
                                                initialFocus
                                                mode="range"
                                                defaultMonth={compareRange?.startDate || value?.startDate || new Date()}
                                                selected={{
                                                    from: compareRange?.startDate,
                                                    to: compareRange?.endDate,
                                                }}
                                                onSelect={(range: any) => {
                                                    if (range?.from && range?.to) {
                                                        const newCompareRange = { startDate: range.from, endDate: range.to }
                                                        onChange(value, activePreset, compare, newCompareRange, months, years, [], []) // Clear advanced when standard clicked
                                                        setCompareCalendarOpen(false)
                                                    }
                                                }}
                                                numberOfMonths={2}
                                                className="p-4 bg-white dark:bg-slate-900"
                                            />
                                            {compareRange && (
                                                <div className="p-2 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-center">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        className="h-8 text-[11px] text-rose-500 hover:text-rose-600 hover:bg-rose-50 w-full"
                                                        onClick={() => {
                                                            onChange(value, activePreset, compare, undefined, months, years, compareMonths, compareYears);
                                                            setCompareCalendarOpen(false);
                                                        }}
                                                    >
                                                        Clear & Use Default Previous
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        )}
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
                                            // Normal range selection clears the arrays
                                            onChange({ startDate: range.from, endDate: range.to }, "custom", compare, compareRange, [], [], compareMonths, compareYears)
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
