/**
 * API Rate Limiting using Upstash Redis
 * Protects endpoints from brute force and DoS attacks
 */

import { redis } from "@/lib/redis"
import { NextResponse } from "next/server"
import { headers } from "next/headers"

// Rate limit configurations for different endpoint types
const RATE_LIMITS = {
    // Login/auth endpoints - strict limits
    login: { requests: 5, windowSeconds: 60 * 15 },     // 5 per 15 minutes

    // Standard API endpoints
    api: { requests: 100, windowSeconds: 60 },           // 100 per minute

    // Sensitive operations (password reset, user creation)
    sensitive: { requests: 10, windowSeconds: 60 * 5 },  // 10 per 5 minutes

    // Search/listing endpoints - slightly higher
    search: { requests: 200, windowSeconds: 60 },        // 200 per minute

    // Write operations (POST/PUT/DELETE)
    write: { requests: 50, windowSeconds: 60 },          // 50 per minute
} as const

export type RateLimitType = keyof typeof RATE_LIMITS

// Redis key patterns for rate limiting
const RATE_LIMIT_KEY = (type: string, identifier: string) =>
    `rate_limit:${type}:${identifier}`

/**
 * Get client identifier for rate limiting
 * Uses IP address or user ID if available
 */
export async function getClientIdentifier(userId?: string): Promise<string> {
    if (userId) {
        return `user:${userId}`
    }

    const headersList = await headers()
    const forwardedFor = headersList.get("x-forwarded-for")
    const realIp = headersList.get("x-real-ip")
    const ip = forwardedFor?.split(",")[0] || realIp || "unknown"

    return `ip:${ip}`
}

/**
 * Check rate limit for a given identifier and type
 * Returns whether the request is allowed and remaining requests
 */
export async function checkRateLimit(
    identifier: string,
    type: RateLimitType = "api"
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
    try {
        const config = RATE_LIMITS[type]
        const key = RATE_LIMIT_KEY(type, identifier)

        // Increment counter
        const current = await redis.incr(key)

        // Set expiry on first request
        if (current === 1) {
            await redis.expire(key, config.windowSeconds)
        }

        // Get TTL for reset time
        const ttl = await redis.ttl(key)

        return {
            allowed: current <= config.requests,
            remaining: Math.max(0, config.requests - current),
            resetIn: ttl > 0 ? ttl : config.windowSeconds
        }
    } catch (error) {
        // If Redis fails, allow the request but log the error
        console.error("Rate limit check failed:", error)
        return { allowed: true, remaining: 0, resetIn: 0 }
    }
}

/**
 * Rate limit response with proper headers
 */
export function rateLimitResponse(resetIn: number): NextResponse {
    return NextResponse.json(
        {
            error: "Too many requests. Please try again later.",
            retryAfter: resetIn
        },
        {
            status: 429,
            headers: {
                "Retry-After": String(resetIn),
                "X-RateLimit-Remaining": "0"
            }
        }
    )
}

/**
 * Middleware helper to check rate limits
 * Use at the start of API route handlers
 */
export async function withRateLimit(
    type: RateLimitType = "api",
    userId?: string
): Promise<NextResponse | null> {
    const identifier = await getClientIdentifier(userId)
    const { allowed, remaining, resetIn } = await checkRateLimit(identifier, type)

    if (!allowed) {
        return rateLimitResponse(resetIn)
    }

    return null
}

/**
 * Rate limit decorator for use in API routes
 * Returns headers to add to successful responses
 */
export function getRateLimitHeaders(remaining: number, resetIn: number): Record<string, string> {
    return {
        "X-RateLimit-Remaining": String(remaining),
        "X-RateLimit-Reset": String(resetIn)
    }
}
