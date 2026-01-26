"use client"

import * as React from "react"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { AlertCircle, HelpCircle, AlertTriangle, Info, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

type ConfirmType = "danger" | "warning" | "info" | "success"

interface PremiumConfirmProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: () => void
    title: string
    description?: string
    confirmText?: string
    cancelText?: string
    type?: ConfirmType
    isLoading?: boolean
}

export function PremiumConfirmDialog({
    open,
    onOpenChange,
    onConfirm,
    title,
    description,
    confirmText = "Confirm",
    cancelText = "Cancel",
    type = "info",
    isLoading = false,
}: PremiumConfirmProps) {

    const iconConfig = {
        danger: {
            icon: AlertCircle,
            color: "text-red-500",
            bg: "bg-red-50 dark:bg-red-950/30",
            button: "bg-red-600 hover:bg-red-700 text-white",
            pulse: "bg-red-500/20"
        },
        warning: {
            icon: AlertTriangle,
            color: "text-amber-500",
            bg: "bg-amber-50 dark:bg-amber-950/30",
            button: "bg-amber-600 hover:bg-amber-700 text-white",
            pulse: "bg-amber-500/20"
        },
        info: {
            icon: Info,
            color: "text-blue-500",
            bg: "bg-blue-50 dark:bg-blue-950/30",
            button: "bg-blue-600 hover:bg-blue-700 text-white",
            pulse: "bg-blue-500/20"
        },
        success: {
            icon: CheckCircle2,
            color: "text-emerald-500",
            bg: "bg-emerald-50 dark:bg-emerald-950/30",
            button: "bg-emerald-600 hover:bg-emerald-700 text-white",
            pulse: "bg-emerald-500/20"
        }
    }[type]

    const Icon = iconConfig.icon

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className="max-w-[400px] border-none bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] p-8 overflow-hidden relative">
                {/* Abstract Background Elements */}
                <div className={cn("absolute -top-24 -right-24 w-48 h-48 opacity-20 blur-3xl rounded-full", iconConfig.pulse)} />

                <AlertDialogHeader className="relative z-10 flex flex-col items-center sm:items-center text-center">
                    <div className={cn("w-20 h-20 rounded-[2rem] flex items-center justify-center mb-6 relative group", iconConfig.bg)}>
                        <div className={cn("absolute inset-0 rounded-[2rem] opacity-40 animate-ping", iconConfig.pulse)} />
                        <Icon size={40} className={cn("relative z-10", iconConfig.color)} />
                    </div>
                    <AlertDialogTitle className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
                        {title}
                    </AlertDialogTitle>
                    {description && (
                        <AlertDialogDescription className="text-slate-500 dark:text-slate-400 font-medium text-base mt-3 leading-relaxed">
                            {description}
                        </AlertDialogDescription>
                    )}
                </AlertDialogHeader>

                <AlertDialogFooter className="flex-col sm:flex-row gap-3 mt-8 relative z-10 w-full sm:justify-center">
                    <AlertDialogCancel className="w-full sm:w-1/2 h-14 rounded-2xl border-slate-200 dark:border-slate-800 font-bold text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-300">
                        {cancelText}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e: React.MouseEvent) => {
                            e.preventDefault()
                            if (!isLoading) onConfirm()
                        }}
                        disabled={isLoading}
                        className={cn(
                            "w-full sm:w-1/2 h-14 rounded-2xl font-black text-base shadow-lg shadow-blue-500/20 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]",
                            iconConfig.button
                        )}
                    >
                        {isLoading ? "Processing..." : confirmText}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
