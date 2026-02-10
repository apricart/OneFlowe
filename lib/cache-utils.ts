import { redis } from './redis'

// ── TTL Constants (seconds) ──
export const CACHE_TTL = {
    STATIC: 600,     // 10 min — roles, categories (rarely change)
    SETTINGS: 300,   // 5 min  — org settings
    LISTING: 60,     // 1 min  — branches, groups, orgs
    INVENTORY: 30,   // 30 sec — branch inventory (shop page, changes often)
    ANALYTICS: 120,  // 2 min  — dashboard, charts
} as const

// ── Scoped Cache Key Generator ──
// Prevents cross-org data leaks by embedding org/branch/role into the key
export function scopedCacheKey(
    prefix: string,
    scope: { orgId?: number | string | null; branchId?: number | string | null; role?: string },
    params?: Record<string, any>
): string {
    const parts = [`cache:${prefix}`]
    if (scope.role) parts.push(`r:${scope.role}`)
    if (scope.orgId) parts.push(`o:${scope.orgId}`)
    if (scope.branchId) parts.push(`b:${scope.branchId}`)
    if (params) {
        const sorted = Object.keys(params)
            .sort()
            .filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '')
            .map(k => `${k}=${params[k]}`)
            .join('&')
        if (sorted) parts.push(sorted)
    }
    return parts.join(':')
}

// ── Get Cached Data ──
export async function getCached<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = CACHE_TTL.LISTING
): Promise<T> {
    try {
        const cached = await redis.get(key)
        if (cached && typeof cached === 'string') {
            return JSON.parse(cached) as T
        }
        // Upstash sometimes returns parsed objects directly
        if (cached && typeof cached === 'object') {
            return cached as T
        }
    } catch {
        // Cache miss or error — fall through to fetch
    }

    const data = await fetchFn()

    try {
        await redis.setex(key, ttl, JSON.stringify(data))
    } catch {
        // Cache set failure is non-fatal
    }

    return data
}

// ── Invalidate by Prefix ──
// Uses SCAN-based KEYS to find and delete all keys matching a prefix
export async function invalidateByPrefix(prefix: string): Promise<void> {
    try {
        const pattern = `cache:${prefix}:*`
        const keys = await redis.keys(pattern)
        if (keys.length > 0) {
            await redis.del(...keys)
        }
    } catch {
        // Invalidation failure is non-fatal — data will expire via TTL
    }
}

// ── Invalidate Specific Key ──
export async function invalidateCache(key: string): Promise<void> {
    try {
        await redis.del(key)
    } catch {
        // Non-fatal
    }
}

// ── Generate Simple Cache Key (legacy compat) ──
export function generateCacheKey(prefix: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
        .sort()
        .map(key => `${key}=${params[key]}`)
        .join('&')
    return `${prefix}:${sortedParams}`
}
