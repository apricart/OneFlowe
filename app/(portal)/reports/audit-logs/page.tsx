"use client"

import { AuditLogViewer } from "@/components/admin/audit-log-viewer"

export default function AuditLogsPage() {
    return (
        <div className="space-y-6">
            <div className="relative overflow-hidden rounded-3xl bg-slate-900 px-6 py-6 text-white shadow-xl">
                <div>
                    <p className="text-xs tracking-[0.2em] text-white/70">SUPER ADMIN · SYSTEM</p>
                    <h1 className="text-3xl font-semibold">Audit Logs</h1>
                    <p className="text-sm text-white/80">
                        Comprehensive system activity tracking for security and compliance.
                    </p>
                </div>
            </div>

            <AuditLogViewer />
        </div>
    )
}
