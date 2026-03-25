"use client"

import * as React from "react"
import { Check, ChevronDown, Search, X, Filter } from "lucide-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"

interface Item {
    id: string | number
    label: string
}

interface MultiSelectFilterProps {
    title: string
    items: Item[]
    selectedIds: (string | number)[]
    onChange: (ids: any[]) => void
    icon?: React.ReactNode
    placeholder?: string
    searchPlaceholder?: string
    showSearch?: boolean
    className?: string
    buttonClassName?: string
    disabled?: boolean
}

export function MultiSelectFilter({
    title,
    items,
    selectedIds,
    onChange,
    icon,
    placeholder = "Select Items",
    searchPlaceholder = "Search...",
    showSearch = true,
    className,
    buttonClassName,
    disabled = false
}: MultiSelectFilterProps) {
    const [open, setOpen] = React.useState(false)
    const [draft, setDraft] = React.useState<(string | number)[]>(selectedIds)
    const [searchQuery, setSearchQuery] = React.useState("")

    // Sync draft with selectedIds when opening
    React.useEffect(() => {
        if (open) {
            setDraft(selectedIds)
        }
    }, [open, selectedIds])

    const filteredItems = React.useMemo(() => {
        if (!searchQuery) return items
        return items.filter(item => 
            item.label?.toString().toLowerCase().includes(searchQuery.toLowerCase())
        )
    }, [items, searchQuery])

    const toggleItem = (id: string | number) => {
        setDraft(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        )
    }

    const selectAll = () => setDraft(items.map(i => i.id))
    const clearAll = () => setDraft([])

    const handleApply = () => {
        onChange(draft)
        setOpen(false)
    }

    const displayText = selectedIds.length === 0 
        ? placeholder 
        : `${selectedIds.length} Selected`

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={disabled}
                    className={cn(
                        "h-10 px-4 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-bold text-xs shadow-sm hover:bg-slate-50 dark:hover:bg-slate-900 transition-all gap-2",
                        selectedIds.length > 0 && "border-indigo-500/50 ring-1 ring-indigo-500/10",
                        disabled && "opacity-60 cursor-not-allowed bg-slate-50 dark:bg-slate-900 border-dashed",
                        buttonClassName
                    )}
                >
                    {icon}
                    <span className="truncate max-w-[150px]">{displayText}</span>
                    {!disabled && <ChevronDown className={cn("h-3 w-3 opacity-50 transition-transform duration-200", open && "rotate-180")} />}
                </Button>
            </PopoverTrigger>
            <PopoverContent className={cn("w-64 p-0 rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden", className)} align="start">
                <div className="flex flex-col max-h-[400px]">
                    <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</span>
                            <div className="flex gap-2">
                                <button type="button" onClick={selectAll} className="text-[10px] font-bold text-indigo-600 hover:underline uppercase tracking-tighter">All</button>
                                <span className="text-slate-200 dark:text-slate-800 text-[10px]">|</span>
                                <button type="button" onClick={clearAll} className="text-[10px] font-bold text-rose-500 hover:underline uppercase tracking-tighter">None</button>
                            </div>
                        </div>
                        {showSearch && (
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                                <Input
                                    placeholder={searchPlaceholder}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="h-8 pl-8 text-[11px] bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:ring-1 focus:ring-indigo-500/50"
                                />
                            </div>
                        )}
                    </div>

                    <div className="overflow-y-auto flex-1 p-1">
                        {filteredItems.length === 0 ? (
                            <div className="p-4 text-center text-[10px] font-bold text-slate-400 italic">No matches found</div>
                        ) : (
                            filteredItems.map((item) => {
                                const isChecked = draft.includes(item.id)
                                return (
                                    <div
                                        key={item.id}
                                        className={cn(
                                            "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all",
                                            isChecked ? "bg-indigo-50/50 dark:bg-indigo-900/10 text-indigo-700 dark:text-indigo-300" : "hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400"
                                        )}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleItem(item.id);
                                        }}
                                    >
                                        <Checkbox
                                            checked={isChecked}
                                            onCheckedChange={() => {}}
                                            className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 data-[state=checked]:bg-indigo-600 pointer-events-none"
                                        />
                                        <span className="text-xs font-bold truncate uppercase">{item.label}</span>
                                    </div>
                                )
                            })
                        )}
                    </div>

                    <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950">
                        <Button 
                            className="w-full h-8 text-[11px] font-black uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20"
                            onClick={handleApply}
                        >
                            Apply Selection ({draft.length})
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}
