import { Pool } from "pg"
import { drizzle } from "drizzle-orm/node-postgres"

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL env var is required")
}

const max = Number(process.env.PGPOOL_MAX || 20) // Increased from 10 to 20
const idleTimeoutMillis = Number(process.env.PGPOOL_IDLE_MS || 60000) // Increased from 30s to 60s
const connectionTimeoutMillis = Number(process.env.PGPOOL_CONN_TIMEOUT_MS || 10000) // Increased from 5s to 10s

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max,
  idleTimeoutMillis,
  connectionTimeoutMillis,
  allowExitOnIdle: true,
})

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err)
})

export const db = drizzle(pool)
