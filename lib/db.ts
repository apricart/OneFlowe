import { Pool } from "pg"
import { drizzle } from "drizzle-orm/node-postgres"

// Do NOT throw before seed loads env
if (!process.env.DATABASE_URL) {
  console.warn("⚠️ DATABASE_URL not found yet. If you're running a script, dotenv will load shortly.")
}

// Parse DATABASE_URL to handle potential encoding issues
function parseDatabaseUrl(url: string) {
  try {
    const urlObj = new URL(url)
    return {
      host: urlObj.hostname,
      port: parseInt(urlObj.port) || 5432,
      database: urlObj.pathname.slice(1), // Remove leading slash
      user: urlObj.username,
      password: urlObj.password,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    }
  } catch (error) {
    console.warn("Failed to parse DATABASE_URL, using connectionString:", error)
    return { connectionString: url }
  }
}

const dbConfig = process.env.DATABASE_URL 
  ? parseDatabaseUrl(process.env.DATABASE_URL)
  : { connectionString: process.env.DATABASE_URL }

const pool = new Pool({
  ...dbConfig,
  max: Number(process.env.PGPOOL_MAX || 20),
  idleTimeoutMillis: Number(process.env.PGPOOL_IDLE_MS || 60000),
  connectionTimeoutMillis: Number(process.env.PGPOOL_CONN_TIMEOUT_MS || 10000),
  allowExitOnIdle: true,
})

pool.on("error", (err) => console.error("Unexpected error on idle client", err))

export const db = drizzle(pool)
