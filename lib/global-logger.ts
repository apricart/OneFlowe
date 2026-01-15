/**
 * Global Security Logger
 * 
 * Logs security-critical events to a dedicated log file.
 * Used for audit trail of approval tokens and fulfillment attempts.
 */

import fs from 'fs'
import path from 'path'

const LOG_DIR = path.join(process.cwd(), 'logs')
const SYSTEM_LOG_FILE = path.join(LOG_DIR, 'system-audit.log')

export interface LogEntry {
    event: string
    timestamp?: string
    userId?: string
    userEmail?: string
    userRole?: string
    resourceId?: string
    organizationId?: number
    branchId?: number
    result?: 'SUCCESS' | 'FAILED'
    details?: any
}

/**
 * Log a generic system event to the audit file
 */
export function logEvent(entry: LogEntry): void {
    try {
        if (!fs.existsSync(LOG_DIR)) {
            fs.mkdirSync(LOG_DIR, { recursive: true })
        }

        const logLine = JSON.stringify({
            ...entry,
            timestamp: entry.timestamp || new Date().toISOString(),
        }) + '\n'

        fs.appendFileSync(SYSTEM_LOG_FILE, logLine, 'utf-8')
    } catch (error) {
        console.error('[Logger] Failed to write log:', error)
    }
}

/**
 * Specifically log order activities with full details
 */
export function logOrderActivity(
    action: 'CREATE' | 'APPROVE' | 'FULFILL' | 'CANCEL' | 'REJECT',
    order: any,
    user: { id: string, email: string, role: string }
): void {
    logEvent({
        event: `ORDER_${action}`,
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        resourceId: String(order.id),
        organizationId: order.organizationId,
        branchId: order.branchId,
        result: 'SUCCESS',
        details: {
            tid: order.tid,
            status: order.status,
            total: order.totalCents,
            items: order.orderItems || [],
            notes: order.notes,
            timestamp: new Date().toISOString()
        }
    })
}

/**
 * Legacy support for specific token events (optional but kept for internal use)
 */
export function logSecurityEvent(entry: any): void {
    logEvent({
        ...entry,
        event: entry.event || 'SECURITY_EVENT'
    })
}

export function logTokenGenerated(
    orderId: number,
    tid: string,
    userId: string,
    userEmail: string
): void {
    logEvent({
        event: 'APPROVAL_TOKEN_GENERATED',
        resourceId: String(orderId),
        userId,
        userEmail,
        details: { tid },
        result: 'SUCCESS'
    })
}

export function logFulfillmentAttempt(
    orderId: number,
    tid: string,
    userId: string,
    userEmail: string,
    userRole: string,
    success: boolean,
    reason?: string
): void {
    logEvent({
        event: success ? 'ORDER_FULFILLED_WITH_TOKEN' : 'FULFILLMENT_TOKEN_MISMATCH',
        resourceId: String(orderId),
        userId,
        userEmail,
        userRole,
        result: success ? 'SUCCESS' : 'FAILED',
        details: { tid, reason }
    })
}

