import { NextResponse } from "next/server"
import { Pool } from "pg"

export const runtime = "nodejs"

export async function GET() {
  const startedAt = Date.now()
  const details: Record<string, unknown> = {
    uptimeMs: process.uptime() * 1000,
    timestamp: new Date().toISOString(),
  }

  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    return NextResponse.json(
      {
        status: "degraded",
        checks: { database: { ok: false, error: "DATABASE_URL is not set" } },
        details,
      },
      { status: 503 }
    )
  }

  try {
    const pool = new Pool({ connectionString: dbUrl })
    await pool.query("select 1")
    const elapsedMs = Date.now() - startedAt
    return NextResponse.json(
      {
        status: "ok",
        checks: { database: { ok: true, latencyMs: elapsedMs } },
        details,
      },
      { status: 200 }
    )
  } catch (error: unknown) {
    return NextResponse.json(
      {
        status: "error",
        checks: { database: { ok: false, error: (error as Error).message } },
        details,
      },
      { status: 503 }
    )
  }
}
