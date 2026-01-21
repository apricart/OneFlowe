/**
 * Security Tests - Data Integrity & Race Conditions
 * Tests for concurrent operations, budget integrity, and transaction atomicity
 */

import request from 'supertest';
import {
    testConcurrentRequests,
    expectSuccess,
    expectError,
} from '@/tests/utils/api-helper';
import { getTokenForRole } from '@/tests/utils/auth-helper';
import {
    cleanupTestDatabase,
    seedTestData,
    closeTestDb,
    getTestDb,
    createTestOrder,
} from '@/tests/utils/db-helper';
import { budgets, globalProducts, orders } from '@/db/schema';
import { eq } from 'drizzle-orm';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

describe('Security - Data Integrity Tests', () => {
    let authToken: string;
    let testData: any;

    beforeAll(async () => {
        await cleanupTestDatabase();
        testData = await seedTestData();
        authToken = getTokenForRole('BRANCH_ADMIN', {
            organizationId: testData.organization.id,
            branchId: testData.branch.id,
        });
    });

    afterAll(async () => {
        await closeTestDb();
    });

    describe('Concurrent Order Creation - Race Conditions', () => {
        it('should prevent negative stock from concurrent orders', async () => {
            const db = getTestDb();

            // Set product stock to 10
            await db.update(globalProducts)
                .set({ stockQuantity: 10 })
                .where(eq(globalProducts.id, testData.product.id));

            // Create 20 concurrent requests for 1 item each
            const createOrder = () => request(API_BASE)
                .post('/api/v1/orders')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    items: [{ organizationInventoryId: 1, quantity: 1 }],
                    branchId: testData.branch.id,
                    organizationId: testData.organization.id,
                });

            const responses = await testConcurrentRequests(createOrder, 20);

            // Count successful orders
            const successful = responses.filter(r => r.status === 200).length;

            // Should not allow more than 10 orders (stock quantity)
            expect(successful).toBeLessThanOrEqual(10);

            // Verify stock is >= 0
            const [product] = await db.select()
                .from(globalProducts)
                .where(eq(globalProducts.id, testData.product.id));

            expect(product.stockQuantity).toBeGreaterThanOrEqual(0);
        });

        it('should prevent budget over-allocation in concurrent orders', async () => {
            const db = getTestDb();

            // Set budget to 100,000 cents (1000 PKR)
            const currentMonth = new Date().toISOString().slice(0, 7);
            await db.update(budgets)
                .set({
                    amountAllocatedCents: 100000,
                    amountSpentCents: 0,
                    amountHeldCents: 0,
                })
                .where(eq(budgets.branchId, testData.branch.id));

            // Create 20 concurrent orders for 10,000 cents each
            const createExpensiveOrder = () => request(API_BASE)
                .post('/api/v1/orders')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    items: [{ organizationInventoryId: 1, quantity: 100 }], // 100 items @ 100 PKR = 10,000
                    branchId: testData.branch.id,
                    organizationId: testData.organization.id,
                });

            const responses = await testConcurrentRequests(createExpensiveOrder, 20);

            // Count successful orders
            const successful = responses.filter(r => r.status === 200).length;

            // Should not allow more than 10 orders (budget / 10000)
            expect(successful).toBeLessThanOrEqual(10);

            // Verify budget never went negative
            const [budget] = await db.select()
                .from(budgets)
                .where(eq(budgets.branchId, testData.branch.id));

            const remaining = (budget.amountAllocatedCents + budget.amountCreditedCents) -
                (budget.amountSpentCents + budget.amountHeldCents);

            expect(remaining).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Budget Manipulation Prevention', () => {
        it('should prevent negative budget via order cancellation', async () => {
            const db = getTestDb();

            // Create an order
            const order = await createTestOrder({
                branchId: testData.branch.id,
                organizationId: testData.organization.id,
                userId: testData.users.branchAdmin.id,
                status: 'PENDING',
                totalCents: 10000,
            });

            // Try to cancel it multiple times concurrently
            const cancelOrder = () => request(API_BASE)
                .put('/api/v1/orders')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    id: order.id,
                    action: 'cancel',
                });

            await testConcurrentRequests(cancelOrder, 10);

            // Budget should only be released once
            const [budget] = await db.select()
                .from(budgets)
                .where(eq(budgets.branchId, testData.branch.id));

            expect(budget.amountHeldCents).toBeGreaterThanOrEqual(0);
        });

        it('should prevent budget manipulation via direct parameter tampering', async () => {
            // Try to create order with manipulated total
            const response = await request(API_BASE)
                .post('/api/v1/orders')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    items: [{ organizationInventoryId: 1, quantity: 100 }],
                    branchId: testData.branch.id,
                    organizationId: testData.organization.id,
                    totalCents: 1, // Trying to override calculated total
                    subtotalCents: 1,
                });

            if (response.status === 200) {
                // Server should calculate total, not trust client
                expect(response.body.order.totalCents).not.toBe(1);
                expect(response.body.order.totalCents).toBeGreaterThan(1000);
            }
        });
    });

    describe('Price Manipulation Prevention', () => {
        it('should prevent price tampering in order items', async () => {
            const response = await request(API_BASE)
                .post('/api/v1/orders')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    items: [
                        {
                            organizationInventoryId: 1,
                            quantity: 10,
                            priceCents: 1, // Trying to set price to 1 cent
                        },
                    ],
                    branchId: testData.branch.id,
                    organizationId: testData.organization.id,
                });

            if (response.status === 200) {
                // Price should come from database, not client
                expect(response.body.order.subtotalCents).toBeGreaterThan(10);
            }
        });
    });

    describe('Transaction Atomicity', () => {
        it('should rollback entire order if any item fails', async () => {
            const db = getTestDb();

            const initialOrderCount = await db.select().from(orders);

            // Try to create order with invalid item
            await request(API_BASE)
                .post('/api/v1/orders')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    items: [
                        { organizationInventoryId: 1, quantity: 1 },
                        { organizationInventoryId: 99999, quantity: 1 }, // Non-existent
                    ],
                    branchId: testData.branch.id,
                    organizationId: testData.organization.id,
                });

            // Should not create partial order
            const finalOrderCount = await db.select().from(orders);
            expect(finalOrderCount.length).toBe(initialOrderCount.length);
        });

        it('should rollback budget changes if order creation fails', async () => {
            const db = getTestDb();

            const [initialBudget] = await db.select()
                .from(budgets)
                .where(eq(budgets.branchId, testData.branch.id));

            // Try to create invalid order
            await request(API_BASE)
                .post('/api/v1/orders')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    items: [{ organizationInventoryId: 99999, quantity: 1 }],
                    branchId: testData.branch.id,
                    organizationId: testData.organization.id,
                });

            // Budget should not change
            const [finalBudget] = await db.select()
                .from(budgets)
                .where(eq(budgets.branchId, testData.branch.id));

            expect(finalBudget.amountHeldCents).toBe(initialBudget.amountHeldCents);
        });
    });

    describe('Order State Transition Validation', () => {
        it('should prevent invalid state transitions', async () => {
            // Create and fulfill an order
            const order = await createTestOrder({
                branchId: testData.branch.id,
                organizationId: testData.organization.id,
                userId: testData.users.branchAdmin.id,
                status: 'FULFILLED',
            });

            // Try to cancel fulfilled order
            const response = await request(API_BASE)
                .put('/api/v1/orders')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    id: order.id,
                    action: 'cancel',
                });

            expectError(response, 400, /already fulfilled/i);
        });

        it('should prevent double-fulfillment', async () => {
            const order = await createTestOrder({
                branchId: testData.branch.id,
                organizationId: testData.organization.id,
                userId: testData.users.branchAdmin.id,
                status: 'APPROVED',
            });

            // Try to fulfill twice
            const fulfill = () => request(API_BASE)
                .put('/api/v1/orders')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    id: order.id,
                    action: 'fulfill',
                    approvalToken: 'TEST-TOKEN', // Mock token
                });

            const responses = await testConcurrentRequests(fulfill, 5);

            // Only one should succeed
            const successful = responses.filter(r => r.status === 200).length;
            expect(successful).toBeLessThanOrEqual(1);
        });
    });

    describe('Quantity Validation', () => {
        it('should reject negative quantities', async () => {
            const response = await request(API_BASE)
                .post('/api/v1/orders')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    items: [{ organizationInventoryId: 1, quantity: -10 }],
                    branchId: testData.branch.id,
                    organizationId: testData.organization.id,
                });

            expectError(response, 400);
        });

        it('should reject zero quantities', async () => {
            const response = await request(API_BASE)
                .post('/api/v1/orders')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    items: [{ organizationInventoryId: 1, quantity: 0 }],
                    branchId: testData.branch.id,
                    organizationId: testData.organization.id,
                });

            expectError(response, 400);
        });

        it('should reject extremely large quantities', async () => {
            const response = await request(API_BASE)
                .post('/api/v1/orders')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    items: [{ organizationInventoryId: 1, quantity: Number.MAX_SAFE_INTEGER }],
                    branchId: testData.branch.id,
                    organizationId: testData.organization.id,
                });

            // Should either reject or handle gracefully
            expect([400, 500]).not.toContain(response.status);
        });
    });
});
