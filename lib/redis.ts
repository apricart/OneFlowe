import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export { redis }

// Redis key patterns for MFA system
export const REDIS_KEYS = {
  MFA_COOLDOWN: (userId: string, type: string) => `mfa:cooldown:${userId}:${type}`,
  MFA_OTP: (userId: string, code: string) => `mfa:otp:${userId}:${code}`,
  MFA_ATTEMPTS: (userId: string, type: string) => `mfa:attempts:${userId}:${type}`,
  MFA_DAILY_COUNT: (userId: string, date: string) => `mfa:daily:${userId}:${date}`,
} as const

// Helper functions for Redis operations
export class RedisMFA {
  // Set cooldown with TTL
  static async setCooldown(userId: string, type: string, ttlSeconds: number, attempts: number = 1): Promise<void> {
    const key = REDIS_KEYS.MFA_COOLDOWN(userId, type)
    const cooldownUntil = new Date(Date.now() + ttlSeconds * 1000)
    const cooldownData = {
      userId,
      type,
      attempts,
      cooldownUntil: cooldownUntil.toISOString(),
      timestamp: cooldownUntil.getTime()
    }
    await redis.setex(key, ttlSeconds, JSON.stringify(cooldownData))
  }

  // Get cooldown data
  static async getCooldown(userId: string, type: string): Promise<any | null> {
    const key = REDIS_KEYS.MFA_COOLDOWN(userId, type)
    const data = await redis.get(key)
    if (!data) return null
    
    // Handle different data types from Upstash Redis
    if (typeof data === 'string') {
      try {
        return JSON.parse(data)
      } catch (error) {
        console.error('Error parsing cooldown data:', error, 'Data:', data)
        return null
      }
    } else if (typeof data === 'object') {
      return data
    }
    return null
  }

  // Delete cooldown
  static async deleteCooldown(userId: string, type: string): Promise<void> {
    const key = REDIS_KEYS.MFA_COOLDOWN(userId, type)
    await redis.del(key)
  }

  // Set OTP with TTL
  static async setOTP(userId: string, code: string, ttlSeconds: number, type: string): Promise<void> {
    const key = REDIS_KEYS.MFA_OTP(userId, code)
    const otpData = {
      userId,
      code,
      type,
      createdAt: new Date().toISOString(),
      attempts: 0,
      isUsed: false,
    }
    console.log("Redis - Setting OTP with key:", key, "data:", otpData, "TTL:", ttlSeconds)
    await redis.setex(key, ttlSeconds, JSON.stringify(otpData))
    console.log("Redis - OTP set successfully")
  }

  // Get OTP data
  static async getOTP(userId: string, code: string): Promise<any | null> {
    const key = REDIS_KEYS.MFA_OTP(userId, code)
    const data = await redis.get(key)
    if (!data) return null
    
    // Handle different data types from Upstash Redis
    if (typeof data === 'string') {
      try {
        return JSON.parse(data)
      } catch (error) {
        console.error('Error parsing OTP data:', error, 'Data:', data)
        return null
      }
    } else if (typeof data === 'object') {
      return data
    }
    return null
  }

  // Update OTP attempts
  static async updateOTPAttempts(userId: string, code: string, attempts: number): Promise<void> {
    const key = REDIS_KEYS.MFA_OTP(userId, code)
    const data = await redis.get(key)
    if (data) {
      let otpData
      if (typeof data === 'string') {
        try {
          otpData = JSON.parse(data)
        } catch (error) {
          console.error('Error parsing OTP data for update:', error)
          return
        }
      } else if (typeof data === 'object') {
        otpData = data
      } else {
        return
      }
      
      otpData.attempts = attempts
      await redis.setex(key, 120, JSON.stringify(otpData)) // 2 minutes TTL
    }
  }

  // Mark OTP as used
  static async markOTPUsed(userId: string, code: string): Promise<void> {
    const key = REDIS_KEYS.MFA_OTP(userId, code)
    const data = await redis.get(key)
    if (data) {
      let otpData
      if (typeof data === 'string') {
        try {
          otpData = JSON.parse(data)
        } catch (error) {
          console.error('Error parsing OTP data for mark used:', error)
          return
        }
      } else if (typeof data === 'object') {
        otpData = data
      } else {
        return
      }
      
      otpData.isUsed = true
      await redis.setex(key, 120, JSON.stringify(otpData)) // 2 minutes TTL
    }
  }

  // Delete OTP
  static async deleteOTP(userId: string, code: string): Promise<void> {
    const key = REDIS_KEYS.MFA_OTP(userId, code)
    await redis.del(key)
  }

  // Increment daily count
  static async incrementDailyCount(userId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0]
    const key = REDIS_KEYS.MFA_DAILY_COUNT(userId, today)
    console.log("Redis - Incrementing daily count for key:", key)
    const count = await redis.incr(key)
    // Set expiry to end of day (24 hours from now)
    const ttl = Math.ceil((new Date().setHours(23, 59, 59, 999) - Date.now()) / 1000)
    await redis.expire(key, ttl)
    console.log("Redis - Daily count incremented to:", count)
    return count
  }

  // Get daily count
  static async getDailyCount(userId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0]
    const key = REDIS_KEYS.MFA_DAILY_COUNT(userId, today)
    const count = await redis.get(key)
    if (!count) return 0
    
    if (typeof count === 'string') {
      const parsed = parseInt(count)
      return isNaN(parsed) ? 0 : parsed
    } else if (typeof count === 'number') {
      return count
    }
    return 0
  }

  // Clean up expired keys (optional maintenance function)
  static async cleanupExpiredKeys(): Promise<void> {
    // Redis automatically handles TTL, but we can add cleanup logic here if needed
    console.log('Redis cleanup completed - TTL handled automatically')
  }
}
