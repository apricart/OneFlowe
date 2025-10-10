import { Pool } from "pg"
import { drizzle } from "drizzle-orm/node-postgres"

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL env var is required")
}

const max = Number(process.env.PGPOOL_MAX || 10)
const idleTimeoutMillis = Number(process.env.PGPOOL_IDLE_MS || 30000)
const connectionTimeoutMillis = Number(process.env.PGPOOL_CONN_TIMEOUT_MS || 5000)

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max,
  idleTimeoutMillis,
  connectionTimeoutMillis,
  allowExitOnIdle: true,
})

export const db = drizzle(pool)
