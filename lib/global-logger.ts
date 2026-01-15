/**
 * Global Security Logger
 * 
 * Logs security-critical events to a dedicated log file.
 * Used for audit trail of approval tokens and fulfillment attempts.
 */

import fs from 'fs'
import path from 'path'

const LOG_DIR = path.join(process.cwd(), 'logs')
const LOG_FILE = path.join(LOG_DIR, 'order-security.log')

export interface SecurityLogEntry {
    event: string
    orderId?: number
    tid?: string
    userId?: string
    userEmail?: string
    userRole?: string
    result?: 'SUCCESS' | 'FAILED'
    details?: Record<string, any>
}

/**
 * Append a security event to the global log file
 * @param entry Log entry data
 */
export function logSecurityEvent(entry: SecurityLogEntry): void {
    try {
        // Ensure logs directory exists
        if (!fs.existsSync(LOG_DIR)) {
            fs.mkdirSync(LOG_DIR, { recursive: true })
        }

        const logLine = JSON.stringify({
            ...entry,
            timestamp: new Date().toISOString(),
        }) + '\n'

        fs.appendFileSync(LOG_FILE, logLine, 'utf-8')
    } catch (error) {
        // Don't throw - logging should never break the main flow
        console.error('[SecurityLogger] Failed to write log:', error)
    }
}

/**
 * Log approval token generation
 */
export function logTokenGenerated(
    orderId: number,
    tid: string,
    userId: string,
    userEmail: string
): void {
    logSecurityEvent({
        event: 'APPROVAL_TOKEN_GENERATED',
        orderId,
        tid,
        userId,
        userEmail,
        result: 'SUCCESS',
    })
}

/**
 * Log fulfillment attempt (success or failure)
 */
export function logFulfillmentAttempt(
    orderId: number,
    tid: string,
    userId: string,
    userEmail: string,
    userRole: string,
    success: boolean,
    reason?: string
): void {
    logSecurityEvent({
        event: success ? 'ORDER_FULFILLED_WITH_TOKEN' : 'FULFILLMENT_TOKEN_MISMATCH',
        orderId,
        tid,
        userId,
        userEmail,
        userRole,
        result: success ? 'SUCCESS' : 'FAILED',
        details: reason ? { reason } : undefined,
    })
}
