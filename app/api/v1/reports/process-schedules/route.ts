import { NextRequest, NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"
import { withSuperAdmin } from "@/lib/db"
import { scheduledReports, orders, branches } from "@/db/schema"
import { sendReportEmail } from "@/lib/email"
import { getRequestScope } from "@/lib/auth"
import { error, ok, unauthorized, forbidden } from "@/lib/api"

export async function POST(req: NextRequest) {
  try {
    // Audit check: Allow SUPER_ADMIN to trigger manually, or system processes
    const scope = await getRequestScope()
    if (!scope) return unauthorized()
    if (scope.role !== "SUPER_ADMIN") return forbidden()

    const { scheduleId, isTest } = await req.json().catch(() => ({}))

    const results = await withSuperAdmin(async (tx: any) => {
      const conditions = []
      if (scheduleId) conditions.push(eq(scheduledReports.id, Number(scheduleId)))
      else conditions.push(eq(scheduledReports.enabled, true))

      const schedules = await tx.select().from(scheduledReports).where(and(...conditions))
      const processResults = []

      for (const schedule of schedules) {
        if (!schedule.organizationId) {
          processResults.push({ id: schedule.id, status: "error", error: "Schedule has no organization ID" })
          continue
        }

        try {
          const reportData = await tx.select({
            id: orders.tid, date: orders.createdAt, status: orders.status, total: orders.totalCents, branch: branches.name,
          }).from(orders).leftJoin(branches, eq(orders.branchId, branches.id)).where(eq(orders.organizationId, schedule.organizationId)).limit(100)

          const formattedData = reportData.map((row: any) => ({
            ...row,
            date: row.date ? new Date(row.date).toLocaleDateString() : 'N/A',
            total: (row.total / 100).toFixed(2)
          }))

          const csv = convertToCSV(formattedData)
          const fileName = `${schedule.reportName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`
          const sent = await sendReportEmail(schedule.emails, schedule.reportName, schedule.frequency, csv, fileName)

          if (sent && !isTest) {
            await tx.update(scheduledReports).set({ lastExecutedAt: new Date(), updatedAt: new Date() }).where(eq(scheduledReports.id, schedule.id))
          }
          processResults.push({ id: schedule.id, status: sent ? "sent" : "failed" })
        } catch (err) {
          console.error(`Error processing schedule ${schedule.id}:`, err)
          processResults.push({ id: schedule.id, status: "error", error: String(err) })
        }
      }
      return processResults
    })

    return ok({ processed: results.length, details: results })
  } catch (e: any) {
    return error(e.message || "Internal error")
  }
}

function convertToCSV(data: any[]) {
  if (data.length === 0) return "No data available"
  const headers = Object.keys(data[0]).join(",")
  const rows = data.map(row => Object.values(row).map(val => `"${val}"`).join(",")).join("\n")
  return `${headers}\n${rows}`
}
