import { Pool, PoolClient } from "pg"
import { drizzle } from "drizzle-orm/node-postgres"

// Do NOT throw before seed loads env
if (!process.env.DATABASE_URL) {
  console.warn("⚠️ DATABASE_URL not found yet. If you're running a script, dotenv will load shortly.")
}

/**
 * Parse DATABASE_URL to handle potential encoding issues
 * @param url - Database connection URL
 * @returns Database configuration object
 */
function parseDatabaseUrl(url: string | undefined) {
  if (!url) {
    throw new Error("DATABASE_URL is required but not provided")
  }

  // Validate URL is not empty or whitespace
  if (typeof url !== 'string' || url.trim().length === 0) {
    throw new Error("DATABASE_URL must be a non-empty string")
  }

  try {
    const urlObj = new URL(url)

    // Validate required components
    if (!urlObj.hostname) {
      throw new Error("DATABASE_URL must contain a valid hostname")
    }

    if (!urlObj.pathname || urlObj.pathname === '/') {
      throw new Error("DATABASE_URL must contain a database name in the path")
    }

    const port = parseInt(urlObj.port) || 5432

    // Validate port range
    if (port < 1 || port > 65535) {
      throw new Error(`Invalid port number: ${port}. Must be between 1 and 65535`)
    }

    const isSupabase = urlObj.hostname.includes('supabase')

    return {
      host: urlObj.hostname,
      port,
      database: urlObj.pathname.slice(1), // Remove leading slash
      user: urlObj.username || 'postgres',
      password: urlObj.password || '',
      // Supabase ALWAYS requires SSL, even in development
      ssl: isSupabase || process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error("Failed to parse DATABASE_URL:", error.message)
      throw new Error(`Invalid DATABASE_URL configuration: ${error.message}`)
    }
    throw error
  }
}

// Parse and validate database configuration
let dbConfig: any
try {
  dbConfig = process.env.DATABASE_URL
    ? parseDatabaseUrl(process.env.DATABASE_URL)
    : { connectionString: process.env.DATABASE_URL }
} catch (error) {
  console.error("❌ Database configuration error:", error)
  throw error
}

// Validate pool configuration values  
const poolMax = Number(process.env.PGPOOL_MAX || 10)  // Reduced from 20 for Supabase
const idleTimeout = Number(process.env.PGPOOL_IDLE_MS || 60000)
const connectionTimeout = Number(process.env.PGPOOL_CONN_TIMEOUT_MS || 30000)  // Increased to 30s

if (isNaN(poolMax) || poolMax < 1 || poolMax > 100) {
  console.warn(`Invalid PGPOOL_MAX value: ${process.env.PGPOOL_MAX}. Using default: 20`)
}

if (isNaN(idleTimeout) || idleTimeout < 0) {
  console.warn(`Invalid PGPOOL_IDLE_MS value: ${process.env.PGPOOL_IDLE_MS}. Using default: 60000`)
}

if (isNaN(connectionTimeout) || connectionTimeout < 0) {
  console.warn(`Invalid PGPOOL_CONN_TIMEOUT_MS value: ${process.env.PGPOOL_CONN_TIMEOUT_MS}. Using default: 10000`)
}

// Create connection pool with error handling
const pool = new Pool({
  ...dbConfig,
  max: Math.min(Math.max(poolMax, 1), 100), // Ensure between 1-100
  idleTimeoutMillis: Math.max(idleTimeout, 0),
  connectionTimeoutMillis: Math.max(connectionTimeout, 1000), // Minimum 1 second
  allowExitOnIdle: true,
})

// Enhanced error handling for pool
pool.on("error", (err, client) => {
  console.error("❌ Unexpected error on idle database client:", {
    error: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString()
  })
})

pool.on("connect", (client) => {
  if (process.env.NODE_ENV === 'development') {
    console.log("✅ Database client connected")
  }
})

pool.on("acquire", (client) => {
  if (process.env.NODE_ENV === 'development') {
    console.log("🔄 Database client acquired from pool")
  }
})

pool.on("remove", (client) => {
  if (process.env.NODE_ENV === 'development') {
    console.log("🗑️ Database client removed from pool")
  }
})

export const db = drizzle(pool, { logger: true })

/**
 * Test database connection
 * @returns Promise that resolves if connection is successful
 */
export async function testConnection(): Promise<boolean> {
  let client: PoolClient | null = null
  try {
    client = await pool.connect()
    await client.query('SELECT 1')
    console.log("✅ Database connection test successful")
    return true
  } catch (error) {
    console.error("❌ Database connection test failed:", error)
    return false
  } finally {
    if (client) {
      try {
        client.release()
      } catch (releaseError) {
        console.error("❌ Error releasing database client:", releaseError)
      }
    }
  }
}

/**
 * Gracefully close database pool
 */
export async function closePool(): Promise<void> {
  try {
    await pool.end()
    console.log("✅ Database pool closed successfully")
  } catch (error) {
    console.error("❌ Error closing database pool:", error)
    throw error
  }
}

/**
 * Get current pool statistics
 */
export function getPoolStats() {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    timestamp: new Date().toISOString()
  }
}

// Export pool for advanced use cases
export { pool }
