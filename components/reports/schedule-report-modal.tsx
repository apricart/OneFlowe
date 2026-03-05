"use client"

import { useState, useEffect } from "react"
import { Clock, Mail, FileText, FileSpreadsheet, FileIcon as FilePdf, CalendarClock, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface ScheduleReportModalProps {
    reportName: string
    storageKey?: string
}

interface ScheduleConfig {
    frequency: "daily" | "weekly" | "monthly"
    format: "pdf" | "csv" | "excel"
    emails: string[]
    enabled: boolean
}

export function ScheduleReportModal({ reportName, storageKey = "schedule-report" }: ScheduleReportModalProps) {
    const [open, setOpen] = useState(false)
    const [saved, setSaved] = useState(false)
    const [config, setConfig] = useState<ScheduleConfig>({
        frequency: "weekly",
        format: "pdf",
        emails: [],
        enabled: false,
    })
    const [emailInput, setEmailInput] = useState("")

    useEffect(() => {
        try {
            const savedConfig = localStorage.getItem(`${storageKey}-${reportName}`)
            if (savedConfig) setConfig(JSON.parse(savedConfig))
        } catch { }
    }, [storageKey, reportName])

    const handleSave = () => {
        const newConfig = { ...config, enabled: true }
        setConfig(newConfig)
        try {
            localStorage.setItem(`${storageKey}-${reportName}`, JSON.stringify(newConfig))
        } catch { }
        setSaved(true)
        setTimeout(() => {
            setSaved(false)
            setOpen(false)
        }, 1500)
    }

    const addEmail = () => {
        const email = emailInput.trim()
        if (email && email.includes("@") && !config.emails.includes(email)) {
            setConfig(prev => ({ ...prev, emails: [...prev.emails, email] }))
            setEmailInput("")
        }
    }

    const removeEmail = (email: string) => {
        setConfig(prev => ({ ...prev, emails: prev.emails.filter(e => e !== email) }))
    }

    const formatIcons = {
        pdf: <FilePdf className="h-4 w-4" />,
        csv: <FileText className="h-4 w-4" />,
        excel: <FileSpreadsheet className="h-4 w-4" />,
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-2 text-xs font-semibold border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                    <CalendarClock className="h-3.5 w-3.5 text-slate-400" />
                    Schedule
                    {config.enabled && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md border-slate-200 dark:border-slate-700">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <Clock className="h-5 w-5 text-indigo-500" />
                        Schedule Report
                    </DialogTitle>
                    <DialogDescription>
                        Configure automated {reportName} delivery to your inbox.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 pt-2">
                    {/* Frequency */}
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                            Frequency
                        </label>
                        <div className="flex gap-2">
                            {(["daily", "weekly", "monthly"] as const).map(freq => (
                                <button
                                    key={freq}
                                    onClick={() => setConfig(prev => ({ ...prev, frequency: freq }))}
                                    className={cn(
                                        "flex-1 py-2 rounded-lg text-xs font-bold capitalize transition-all border",
                                        config.frequency === freq
                                            ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300"
                                            : "border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300 dark:hover:border-slate-600"
                                    )}
                                >
                                    {freq}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Format */}
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                            Export Format
                        </label>
                        <div className="flex gap-2">
                            {(["pdf", "csv", "excel"] as const).map(fmt => (
                                <button
                                    key={fmt}
                                    onClick={() => setConfig(prev => ({ ...prev, format: fmt }))}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold uppercase transition-all border",
                                        config.format === fmt
                                            ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300"
                                            : "border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300 dark:hover:border-slate-600"
                                    )}
                                >
                                    {formatIcons[fmt]}
                                    {fmt}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Email Recipients */}
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                            Email Recipients
                        </label>
                        <div className="flex gap-2">
                            <Input
                                type="email"
                                placeholder="email@example.com"
                                value={emailInput}
                                onChange={(e) => setEmailInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && addEmail()}
                                className="h-9 text-xs"
                            />
                            <Button onClick={addEmail} size="sm" className="h-9 px-3 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white">
                                Add
                            </Button>
                        </div>
                        {config.emails.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {config.emails.map(email => (
                                    <Badge
                                        key={email}
                                        variant="secondary"
                                        className="text-[10px] font-medium cursor-pointer hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 transition-colors"
                                        onClick={() => removeEmail(email)}
                                    >
                                        <Mail className="h-2.5 w-2.5 mr-1 opacity-50" />
                                        {email} ×
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Save Button */}
                    <Button
                        onClick={handleSave}
                        className={cn(
                            "w-full h-10 text-xs font-bold transition-all",
                            saved
                                ? "bg-emerald-600 hover:bg-emerald-600 text-white"
                                : "bg-indigo-600 hover:bg-indigo-700 text-white"
                        )}
                        disabled={config.emails.length === 0}
                    >
                        {saved ? (
                            <span className="flex items-center gap-2"><Check className="h-4 w-4" /> Saved Successfully</span>
                        ) : (
                            "Save Schedule"
                        )}
                    </Button>
                    <p className="text-[10px] text-center text-slate-400">
                        Schedule is saved locally. Server-side email delivery requires additional configuration.
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    )
}
