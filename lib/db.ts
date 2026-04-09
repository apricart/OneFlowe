import { Pool, PoolClient } from "pg"
import { drizzle } from "drizzle-orm/node-postgres"
import { sql } from "drizzle-orm"

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
      user: urlObj.username ? decodeURIComponent(urlObj.username) : 'postgres',
      password: urlObj.password ? decodeURIComponent(urlObj.password) : '',
      // Supabase pooler requires rejectUnauthorized: false
      // For non-Supabase production, enforce certificate verification
      ssl: isSupabase
        ? { rejectUnauthorized: false }
        : process.env.NODE_ENV === 'production'
          ? { rejectUnauthorized: true }
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
  if (process.env.DB_USER && process.env.DB_PASSWORD && process.env.DB_HOST) {
    dbConfig = {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'postgres',
      ssl: { rejectUnauthorized: false }
    }
  } else if (process.env.DATABASE_URL) {
    dbConfig = parseDatabaseUrl(process.env.DATABASE_URL)
  } else {
    throw new Error("No database configuration found (DATABASE_URL or DB_USER/DB_PASSWORD/DB_HOST)")
  }
} catch (error) {
  console.error("❌ Database configuration error:", error)
  throw error
}

// Validate pool configuration values  
const poolMax = Number(process.env.PGPOOL_MAX || 20)  // 20 for 1000+ concurrent users
const idleTimeout = Number(process.env.PGPOOL_IDLE_MS || 30000)  // 30s to recycle faster under load
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

import * as schema from "@/db/schema"

export const db = drizzle(pool, { schema, logger: process.env.NODE_ENV === 'development' })

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

// ============================================================
// ROW-LEVEL SECURITY (RLS) TENANT ISOLATION
// ============================================================

/**
 * Session user type for RLS context.
 * This matches the shape of `session.user` from NextAuth.
 * Supports 4-tier RBAC hierarchy.
 */
export interface TenantUser {
  role: string
  organizationId?: number | null
  branchId?: number | null
  id?: string | null
}

/**
 * Execute a database operation within a tenant-scoped transaction.
 * 
 * This function enforces Row-Level Security (RLS) by setting session variables
 * before executing any queries. PostgreSQL will then automatically filter all 
 * rows based on the 4-tier RBAC hierarchy:
 * 
 * - SUPER_ADMIN: Full access (bypasses RLS)
 * - HEAD_OFFICE: Organization-level access
 * - BRANCH_ADMIN: Branch-level access
 * - ORDER_PORTAL: User-level access (own orders only)
 * 
 * Usage:
 * ```ts
 * const orders = await withTenant(session.user, async (tx) => {
 *   return tx.select().from(ordersTable);
 * });
 * ```
 * 
 * @param user - The authenticated user with role, orgId, branchId, and id
 * @param callback - The database operation to execute within the tenant context
 * @returns The result of the callback
 */
export async function withTenant<T>(
  user: TenantUser,
  callback: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    const role = user.role?.toUpperCase()
    
    if (role === 'SUPER_ADMIN') {
      // Super Admins bypass RLS entirely — they see all organizations' data
      await tx.execute(sql`SET LOCAL row_security = off`)
    } else {
      // Set role context for all non-super-admin users
      if (role) {
        await tx.execute(
          sql`SET LOCAL "app.current_role" = ${sql.raw(`'${role}'`)}`
        )
      }
      
      // Set organization context
      if (user.organizationId) {
        await tx.execute(
          sql`SET LOCAL "app.current_org_id" = ${sql.raw(String(user.organizationId))}`
        )
      }
      
      // Set branch context for BRANCH_ADMIN and ORDER_PORTAL
      if (user.branchId && (role === 'BRANCH_ADMIN' || role === 'ORDER_PORTAL')) {
        await tx.execute(
          sql`SET LOCAL "app.current_branch_id" = ${sql.raw(String(user.branchId))}`
        )
      }
      
      // Set user context for ORDER_PORTAL (for created_by filtering)
      if (user.id && role === 'ORDER_PORTAL') {
        await tx.execute(
          sql`SET LOCAL "app.current_user_id" = ${sql.raw(`'${user.id}'`)}`
        )
      }
    }
    
    // Enable RLS (ensures policies are enforced)
    await tx.execute(sql`SET LOCAL row_security = on`)

    return callback(tx)
  })
}

/**
 * Execute a database operation with RLS disabled (Super Admin context).
 * 
 * Use this for system-level operations that need to access data across
 * all organizations, such as:
 * - Super Admin dashboards and reports
 * - Background cron jobs
 * - System migrations and maintenance
 * - Authentication (login must query users across all orgs)
 * 
 * ⚠️ WARNING: Only use this when you explicitly need cross-org access.
 * For normal API routes, always use `withTenant` instead.
 * 
 * Usage:
 * ```ts
 * const allOrgs = await withSuperAdmin(async (tx) => {
 *   return tx.select().from(organizationsTable);
 * });
 * ```
 */
export async function withSuperAdmin<T>(
  callback: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL row_security = off`)
    return callback(tx)
  })
}

