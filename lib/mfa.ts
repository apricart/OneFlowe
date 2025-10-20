/**
 * Multi-Factor Authentication (MFA) System
 * Handles OTP generation, validation, and security features
 * Uses Redis for caching and cooldown management
 */

import { db } from "@/lib/db"
import { users, mfaCodes } from "@/db/schema"
import { eq, and, gte, desc } from "drizzle-orm"
import { randomInt } from "crypto"
import { RedisMFA, redis, REDIS_KEYS } from "@/lib/redis"

export interface MFACode {
  id: string
  userId: string
  code: string
  type: 'LOGIN' | 'VERIFY_EMAIL' | 'RESET_PASSWORD'
  expiresAt: Date
  attempts: number
  isUsed: boolean
  createdAt: Date
}

export interface MFAResult {
  success: boolean
  message: string
  remainingAttempts?: number
  cooldownUntil?: Date
}

export interface MFACooldown {
  userId: string
  type: 'OTP_REQUEST' | 'OTP_VERIFY'
  cooldownUntil: Date
  attempts: number
  timestamp?: number
}

// OTP Configuration
const OTP_CONFIG = {
  LENGTH: 6,
  EXPIRY_MINUTES: 2,
  MAX_ATTEMPTS: 5,
  COOLDOWN_MINUTES: 1, // Reduced to 1 minute for better UX
  MAX_DAILY_REQUESTS: 20
} as const

/**
 * Generate a secure 6-digit OTP
 */
export function generateOTP(): string {
  return randomInt(100000, 999999).toString()
}

/**
 * Send OTP via email (placeholder - integrate with your email service)
 */
export async function sendOTPEmail(email: string, code: string, type: string): Promise<boolean> {
  try {
    // TODO: Integrate with your email service (SendGrid, AWS SES, etc.)
    console.log(`Sending OTP to ${email}: ${code} (${type})`)
    
    // For now, just log to console
    // In production, replace with actual email service
    return true
  } catch (error) {
    console.error("Failed to send OTP email:", error)
    return false
  }
}

/**
 * Check if user is in cooldown period
 */
export async function checkCooldown(userId: string, type: 'OTP_REQUEST' | 'OTP_VERIFY'): Promise<MFACooldown | null> {
  try {
    const cooldown = await RedisMFA.getCooldown(userId, type)
    if (cooldown && new Date(cooldown.cooldownUntil) > new Date()) {
      return cooldown
    }
    return null
  } catch (error) {
    console.error("Error checking cooldown:", error)
    return null
  }
}

/**
 * Set cooldown for user
 */
export async function setCooldown(userId: string, type: 'OTP_REQUEST' | 'OTP_VERIFY', attempts: number): Promise<void> {
  try {
    const ttlSeconds = OTP_CONFIG.COOLDOWN_MINUTES * 60
    await RedisMFA.setCooldown(userId, type, ttlSeconds, attempts)
  } catch (error) {
    console.error("Error setting cooldown:", error)
  }
}

/**
 * Check daily OTP request limit
 */
export async function checkDailyLimit(userId: string): Promise<boolean> {
  try {
    const count = await RedisMFA.getDailyCount(userId)
    return count < OTP_CONFIG.MAX_DAILY_REQUESTS
  } catch (error) {
    console.error("Error checking daily limit:", error)
    return true // Allow request if Redis fails
  }
}

/**
 * Generate and send OTP for user
 */
export async function generateAndSendOTP(
  userId: string,
  email: string,
  type: 'LOGIN' | 'VERIFY_EMAIL' | 'RESET_PASSWORD'
): Promise<MFAResult> {
  try {
    console.log("MFA - generateAndSendOTP called for userId:", userId, "email:", email, "type:", type)
    
    // Check cooldown
    const cooldown = await checkCooldown(userId, 'OTP_REQUEST')
    console.log("MFA - Cooldown check result:", cooldown)
    
    if (cooldown) {
      const remainingMs = cooldown.timestamp ? 
        cooldown.timestamp - Date.now() : 
        new Date(cooldown.cooldownUntil).getTime() - Date.now()
      
      if (remainingMs > 0) {
        console.log("MFA - Cooldown active, remaining:", remainingMs)
        return {
          success: false,
          message: `Please wait ${Math.ceil(remainingMs / 60000)} minutes before requesting another OTP`,
          cooldownUntil: new Date(cooldown.cooldownUntil)
        }
      }
    }
    
    // Check daily limit
    const withinLimit = await checkDailyLimit(userId)
    console.log("MFA - Daily limit check:", withinLimit)
    
    if (!withinLimit) {
      console.log("MFA - Daily limit exceeded")
      return {
        success: false,
        message: "Daily OTP request limit exceeded. Please try again tomorrow."
      }
    }
    
    // Generate OTP
    const code = generateOTP()
    const ttlSeconds = OTP_CONFIG.EXPIRY_MINUTES * 60
    console.log("MFA - Generated OTP:", code, "TTL:", ttlSeconds)
    
    // Save OTP to Redis
    console.log("MFA - Saving OTP to Redis")
    await RedisMFA.setOTP(userId, code, ttlSeconds, type)
    
    // Also save to database for audit trail
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000)
    console.log("MFA - Saving OTP to database")
    await db.insert(mfaCodes).values({
      userId,
      code,
      type,
      expiresAt,
      attempts: 0,
      isUsed: false
    })
    
    // Send OTP via email
    console.log("MFA - Sending OTP email")
    const emailSent = await sendOTPEmail(email, code, type)
    console.log("MFA - Email sent result:", emailSent)
    
    if (!emailSent) {
      console.log("MFA - Email sending failed")
      return {
        success: false,
        message: "Failed to send OTP. Please try again."
      }
    }
    
    // Don't set cooldown on first successful OTP send
    // Cooldown will only be set if there are multiple failed attempts
    
    // Increment daily count
    await RedisMFA.incrementDailyCount(userId)
    
    return {
      success: true,
      message: `OTP sent to ${email}. Valid for ${OTP_CONFIG.EXPIRY_MINUTES} minutes.`
    }
    
  } catch (error) {
    console.error("Error generating OTP:", error)
    return {
      success: false,
      message: "Failed to generate OTP. Please try again."
    }
  }
}

/**
 * Verify OTP code
 */
export async function verifyOTP(
  userId: string, 
  code: string, 
  type: 'LOGIN' | 'VERIFY_EMAIL' | 'RESET_PASSWORD'
): Promise<MFAResult> {
  try {
    // Check cooldown
    const cooldown = await checkCooldown(userId, 'OTP_VERIFY')
    if (cooldown) {
      const remainingMs = cooldown.timestamp ? 
        cooldown.timestamp - Date.now() : 
        new Date(cooldown.cooldownUntil).getTime() - Date.now()
      
      if (remainingMs > 0) {
        return {
          success: false,
          message: `Too many failed attempts. Please wait ${Math.ceil(remainingMs / 60000)} minutes before trying again`,
          cooldownUntil: new Date(cooldown.cooldownUntil)
        }
      }
    }
    
    // Check OTP in Redis first
    const otpData = await RedisMFA.getOTP(userId, code)
    
    if (!otpData || otpData.isUsed || otpData.type !== type) {
      // Increment failed attempts
      const attempts = (cooldown?.attempts || 0) + 1
      await setCooldown(userId, 'OTP_VERIFY', attempts)

      return {
        success: false,
        message: "Invalid or expired OTP code",
        remainingAttempts: OTP_CONFIG.MAX_ATTEMPTS - attempts
      }
    }

    // Check attempt limit
    if (otpData.attempts >= OTP_CONFIG.MAX_ATTEMPTS) {
      return {
        success: false,
        message: "OTP code has exceeded maximum attempts. Please request a new one."
      }
    }

    // Mark OTP as used in Redis
    await RedisMFA.markOTPUsed(userId, code)
    
    // Also update database for audit trail
    await db
      .update(mfaCodes)
      .set({ isUsed: true })
      .where(
        and(
          eq(mfaCodes.userId, userId),
          eq(mfaCodes.code, code),
          eq(mfaCodes.type, type)
        )
      )

    // Clear cooldowns on success
    await clearAllMFACooldowns(userId)
    
    return {
      success: true,
      message: "OTP verified successfully"
    }
    
  } catch (error) {
    console.error("Error verifying OTP:", error)
    return {
      success: false,
      message: "Failed to verify OTP. Please try again."
    }
  }
}

/**
 * Enable MFA for user
 */
export async function enableMFA(userId: string): Promise<MFAResult> {
  try {
    await db
      .update(users)
      .set({ mfaEnabled: true })
      .where(eq(users.id, userId))
    
    return {
      success: true,
      message: "MFA enabled successfully"
    }
  } catch (error) {
    console.error("Error enabling MFA:", error)
    return {
      success: false,
      message: "Failed to enable MFA. Please try again."
    }
  }
}

/**
 * Disable MFA for user
 */
export async function disableMFA(userId: string): Promise<MFAResult> {
  try {
    await db
      .update(users)
      .set({ mfaEnabled: false })
      .where(eq(users.id, userId))

    // Clean up any pending OTP codes from database
    await db
      .delete(mfaCodes)
      .where(eq(mfaCodes.userId, userId))

    // Clean up Redis cooldowns and OTPs
    await clearAllMFACooldowns(userId)

    return {
      success: true,
      message: "MFA disabled successfully"
    }
  } catch (error) {
    console.error("Error disabling MFA:", error)
    return {
      success: false,
      message: "Failed to disable MFA. Please try again."
    }
  }
}

/**
 * Check if user has MFA enabled
 */
export async function isMFAEnabled(userId: string): Promise<boolean> {
  try {
    const [user] = await db
      .select({ mfaEnabled: users.mfaEnabled })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    
    return user?.mfaEnabled || false
  } catch (error) {
    console.error("Error checking MFA status:", error)
    return false
  }
}

/**
 * Check MFA cooldown for auth flow
 */
export async function checkMfaCooldown(userId: string): Promise<number> {
  try {
    const cooldown = await RedisMFA.getCooldown(userId, 'OTP_REQUEST')
    if (cooldown) {
      const remainingMs = cooldown.timestamp ? 
        cooldown.timestamp - Date.now() : 
        new Date(cooldown.cooldownUntil).getTime() - Date.now()
      
      return remainingMs > 0 ? remainingMs : 0
    }
    return 0
  } catch (error) {
    console.error("Error checking MFA cooldown:", error)
    return 0
  }
}

/**
 * Clear all MFA cooldowns for a user
 */
export async function clearAllMFACooldowns(userId: string): Promise<void> {
  try {
    await RedisMFA.deleteCooldown(userId, 'OTP_REQUEST')
    await RedisMFA.deleteCooldown(userId, 'OTP_VERIFY')
  } catch (error) {
    console.error("Error clearing MFA cooldowns:", error)
  }
}

/**
 * Clear daily OTP count for a user (called after successful login)
 */
export async function clearDailyCount(userId: string): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0]
    const key = REDIS_KEYS.MFA_DAILY_COUNT(userId, today)
    await redis.del(key)
    console.log("MFA - Daily count cleared for user:", userId)
  } catch (error) {
    console.error("Error clearing daily count:", error)
  }
}

// Redis is now used for all caching and cooldown management
