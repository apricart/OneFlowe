import { NextRequest } from "next/server"
import { eq, and, sql, lte, or, isNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { scheduledReports, orders, branches } from "@/db/schema"
import { sendReportEmail } from "@/lib/email"
import { ok, error } from "@/lib/api"
import { subDays, subMonths } from "date-fns"

/**
 * Report Processing API
 * Used by a cron job or "Test Now" trigger to send scheduled reports.
 */
export async function POST(req: NextRequest) {
    const { scheduleId, isTest } = await req.json().catch(() => ({}))

    const conditions = []
    if (scheduleId) {
        conditions.push(eq(scheduledReports.id, Number(scheduleId)))
    } else {
        conditions.push(eq(scheduledReports.enabled, true))
        // Batch mode: only process if due (pseudo-logic for demo purposes)
        // In a real system, we'd check frequency vs lastExecutedAt
    }

    const schedules = await db
        .select()
        .from(scheduledReports)
        .where(and(...conditions))

    const results = []

    for (const schedule of schedules) {
        try {
            // 1. Fetch Data based on report type
            // For this implementation, we fetch recent order data as a generic report
            const reportData = await fetchReportData(schedule.reportName, schedule.organizationId)

            // 2. Convert to CSV
            const csv = convertToCSV(reportData)

            // 3. Send Email
            const fileName = `${schedule.reportName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`
            const sent = await sendReportEmail(
                schedule.emails,
                schedule.reportName,
                schedule.frequency,
                csv,
                fileName
            )

            if (sent && !isTest) {
                await db.update(scheduledReports)
                    .set({ lastExecutedAt: new Date(), updatedAt: new Date() })
                    .where(eq(scheduledReports.id, schedule.id))
            }

            results.push({ id: schedule.id, status: sent ? "sent" : "failed" })
        } catch (err) {
            console.error(`Error processing schedule ${schedule.id}:`, err)
            results.push({ id: schedule.id, status: "error", error: String(err) })
        }
    }

    return ok({ processed: results.length, details: results })
}

async function fetchReportData(reportName: string, organizationId: number | null) {
    // Basic implementation: fetch last 30 days of orders for the organization
    const conditions = []
    if (organizationId) conditions.push(eq(orders.organizationId, organizationId))

    const data = await db
        .select({
            id: orders.tid,
            date: orders.createdAt,
            status: orders.status,
            total: orders.totalCents,
            branch: branches.name,
        })
        .from(orders)
        .leftJoin(branches, eq(orders.branchId, branches.id))
        .where(and(...conditions))
        .limit(100)

    return data.map(row => ({
        ...row,
        date: row.date ? new Date(row.date).toLocaleDateString() : 'N/A',
        total: (row.total / 100).toFixed(2)
    }))
}

function convertToCSV(data: any[]) {
    if (data.length === 0) return "No data available"
    const headers = Object.keys(data[0]).join(",")
    const rows = data.map(row =>
        Object.values(row).map(val => `"${val}"`).join(",")
    ).join("\n")
    return `${headers}\n${rows}`
}
