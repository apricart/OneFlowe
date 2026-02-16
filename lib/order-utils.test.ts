
import { describe, it, expect } from 'vitest'
import { getAutoApproveMeta, buildStatusTimeline, AUTO_APPROVAL_WINDOW_MS } from './order-utils'

describe('getAutoApproveMeta', () => {
    it('returns null if order is null', () => {
        expect(getAutoApproveMeta(null)).toBeNull()
    })

    it('returns null if status is not pending', () => {
        const order = { status: 'approved', createdAt: new Date().toISOString() }
        expect(getAutoApproveMeta(order)).toBeNull()
    })

    it('returns meta if status is pending and within window', () => {
        const now = Date.now()
        const createdAt = new Date(now - 1000).toISOString() // 1 second ago
        const order = { status: 'pending', createdAt }
        const meta = getAutoApproveMeta(order)

        expect(meta).not.toBeNull()
        expect(meta?.title).toContain('Auto approval in')
    })

    it('returns null if createdAt is invalid', () => {
        const order = { status: 'pending', createdAt: 'invalid-date' }
        expect(getAutoApproveMeta(order)).toBeNull()
    })
})

describe('buildStatusTimeline', () => {
    const baseOrder = {
        id: 1,
        createdAt: new Date().toISOString(),
        status: 'pending',
        approvedAt: null,
        fulfilledAt: null,
        refundedAt: null,
    }

    it('shows pending step as current when status is pending', () => {
        const timeline = buildStatusTimeline(baseOrder.status)
        const pendingStep = timeline.find(s => s.key === 'pending')
        expect(pendingStep?.state).toBe('current')
    })

    it('shows approved step as current when status is approved', () => {
        const timeline = buildStatusTimeline('approved')
        const approvedStep = timeline.find(s => s.key === 'approved')
        expect(approvedStep?.state).toBe('current')
        expect(timeline.find(s => s.key === 'pending')?.state).toBe('complete')
    })

    it('handles fulfilled status correctly', () => {
        const timeline = buildStatusTimeline('fulfilled')
        const fulfilledStep = timeline.find(s => s.key === 'fulfilled')
        expect(fulfilledStep?.state).toBe('complete') // defined as complete in implementation for terminal states
    })

    it('handles refunded status correctly', () => {
        const timeline = buildStatusTimeline('refunded')
        const refundedStep = timeline.find(s => s.key === 'refunded')
        expect(refundedStep?.state).toBe('complete') // defined as complete in implementation for terminal states
    })

    it('shows skipped steps when jumping to refund from pending', () => {
        // pass statusAtRefund as 'pending'
        const timeline = buildStatusTimeline('refunded', 'pending')

        // logic says: if normalized === "refunded" && step.key === "fulfilled"
        // and refundOrigin !== "fulfilled", then state = "skipped"

        const fulfilledStep = timeline.find(s => s.key === 'fulfilled')
        expect(fulfilledStep?.state).toBe('skipped')
    })
})
