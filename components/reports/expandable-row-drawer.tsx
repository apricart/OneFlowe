"use client"

import { Drawer } from "vaul"
import { X, FileText, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useState } from "react"
import { cn } from "@/lib/utils"

export interface DetailField {
    key?: string
    label: string
    value: string | number | React.ReactNode
    type?: "text" | "badge" | "currency" | "date" | "mono"
}

interface ExpandableRowDrawerProps {
    open: boolean
    onClose: () => void
    title: string
    subtitle?: string
    fields: DetailField[]
}

export function ExpandableRowDrawer({ open, onClose, title, subtitle, fields }: ExpandableRowDrawerProps) {
    const [copiedField, setCopiedField] = useState<string | null>(null)

    const handleCopy = (label: string, value: string | number | React.ReactNode) => {
        if (typeof value === "string" || typeof value === "number") {
            navigator.clipboard.writeText(String(value))
            setCopiedField(label)
            setTimeout(() => setCopiedField(null), 2000)
        }
    }

    return (
        <Drawer.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()} direction="right">
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
                <Drawer.Content
                    className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col outline-none"
                    style={{ borderTopLeftRadius: "16px", borderBottomLeftRadius: "16px" }}
                >
                    {/* Header */}
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-800/50">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <FileText className="h-4 w-4 text-indigo-500" />
                                    <Drawer.Title className="text-lg font-bold text-slate-900 dark:text-white truncate">
                                        {title}
                                    </Drawer.Title>
                                </div>
                                {subtitle && (
                                    <Drawer.Description className="text-xs text-slate-400 dark:text-slate-500">{subtitle}</Drawer.Description>
                                )}
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onClose}
                                className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="space-y-1">
                            {fields.map((field, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-start justify-between gap-4 py-3 border-b border-slate-50 dark:border-slate-800/50 last:border-0 group"
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">
                                            {field.label}
                                        </p>
                                        <div className={cn(
                                            "text-sm text-slate-900 dark:text-white",
                                            field.type === "mono" && "font-mono text-xs",
                                            field.type === "currency" && "font-mono font-bold text-indigo-600 dark:text-indigo-400",
                                            field.type === "date" && "font-mono text-xs"
                                        )}>
                                            {field.type === "badge" ? (
                                                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-tighter">
                                                    {field.value}
                                                </Badge>
                                            ) : (
                                                field.value
                                            )}
                                        </div>
                                    </div>
                                    {(typeof field.value === "string" || typeof field.value === "number") && (
                                        <button
                                            onClick={() => handleCopy(field.label, field.value)}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                                        >
                                            {copiedField === field.label ? (
                                                <Check className="h-3 w-3 text-emerald-500" />
                                            ) : (
                                                <Copy className="h-3 w-3 text-slate-400" />
                                            )}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <Button
                            onClick={onClose}
                            variant="outline"
                            className="w-full h-9 text-xs font-bold border-slate-200 dark:border-slate-700"
                        >
                            Close Details
                        </Button>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    )
}
