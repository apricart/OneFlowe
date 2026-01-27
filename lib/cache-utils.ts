import { redis } from './redis'

interface CacheOptions {
    ttl?: number
    tags?: string[]
}

const DEFAULT_TTL = 300

export async function getCached<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions = {}
): Promise<T> {
    const { ttl = DEFAULT_TTL } = options

    try {
        const cached = await redis.get(key)
        if (cached && typeof cached === 'string') {
            return JSON.parse(cached) as T
        }
    } catch (error) {
        console.error('[Cache] Get error:', error)
    }

    const data = await fetchFn()

    try {
        await redis.setex(key, ttl, JSON.stringify(data))
    } catch (error) {
        console.error('[Cache] Set error:', error)
    }

    return data
}

export async function invalidateCache(pattern: string): Promise<void> {
    try {
        const keys = await redis.keys(pattern)
        if (keys.length > 0) {
            await redis.del(...keys)
        }
    } catch (error) {
        console.error('[Cache] Invalidate error:', error)
    }
}

export async function invalidateCacheByTags(tags: string[]): Promise<void> {
    for (const tag of tags) {
        await invalidateCache(`*:${tag}:*`)
    }
}

export function generateCacheKey(prefix: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
        .sort()
        .map(key => `${key}=${params[key]}`)
        .join('&')
    return `${prefix}:${sortedParams}`
}
