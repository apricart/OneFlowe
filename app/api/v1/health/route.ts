import { NextResponse } from "next/server"
import { withSuperAdmin } from "@/lib/db"
import { sql } from "drizzle-orm"

export const runtime = "nodejs"

export async function GET() {
  const startedAt = Date.now()
  const details: Record<string, unknown> = {
    uptimeMs: process.uptime() * 1000,
    timestamp: new Date().toISOString(),
  }

  try {
    const elapsedMs = await withSuperAdmin(async (tx) => {
      const dbStart = Date.now()
      await tx.execute(sql`SELECT 1`)
      return Date.now() - dbStart
    })

    const totalElapsedMs = Date.now() - startedAt
    
    return NextResponse.json(
      {
        status: "ok",
        checks: { database: { ok: true, latencyMs: elapsedMs } },
        details: { ...details, responseTimeMs: totalElapsedMs },
      },
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error(`[Health Check] Database failed:`, error)
    return NextResponse.json(
      {
        status: "error",
        checks: { database: { ok: false, error: "Database connection failed" } },
        details,
      },
      { status: 503 }
    )
  }
}

