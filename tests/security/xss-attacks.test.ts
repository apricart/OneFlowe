/**
 * Security Tests - XSS Attack Prevention
 * Tests for Cross-Site Scripting vulnerability prevention
 */

import request from 'supertest';
import { XSS_PAYLOADS, testXSS } from '@/tests/utils/api-helper';
import { getTokenForRole } from '@/tests/utils/auth-helper';
import { cleanupTestDatabase, seedTestData, closeTestDb } from '@/tests/utils/db-helper';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

describe('Security - XSS Prevention', () => {
    let authToken: string;

    beforeAll(async () => {
        await cleanupTestDatabase();
        await seedTestData();
        authToken = getTokenForRole('SUPER_ADMIN');
    });

    afterAll(async () => {
        await closeTestDb();
    });

    describe('User Input Fields', () => {
        it('should prevent XSS in user names', async () => {
            await testXSS((payload) =>
                request(API_BASE)
                    .post('/api/v1/users')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        email: `test${Date.now()}@test.com`,
                        password: 'Test123!',
                        firstName: payload,
                        lastName: payload,
                        fullName: payload,
                        role: 'BRANCH_ADMIN',
                        organizationId: 1,
                    })
            );
        });

        it('should sanitize XSS in user email', async () => {
            for (const payload of XSS_PAYLOADS) {
                const response = await request(API_BASE)
                    .post('/api/v1/users')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        email: payload,
                        password: 'Test123!',
                        firstName: 'Test',
                        lastName: 'User',
                        role: 'BRANCH_ADMIN',
                        organizationId: 1,
                    });

                // Should reject or sanitize
                expect(response.status).not.toBe(500);

                if (response.status === 200) {
                    // Email should not contain script tags
                    expect(response.body.user?.email || '').not.toMatch(/<script/i);
                }
            }
        });
    });

    describe('Order Fields', () => {
        it('should prevent XSS in order notes', async () => {
            await testXSS((payload) =>
                request(API_BASE)
                    .post('/api/v1/orders')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        items: [{ organizationInventoryId: 1, quantity: 1 }],
                        notes: payload,
                        branchId: 1,
                        organizationId: 1,
                    })
            );
        });
    });

    describe('Product Fields', () => {
        it('should prevent XSS in product name', async () => {
            await testXSS((payload) =>
                request(API_BASE)
                    .post('/api/v1/inventory/global-products')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        name: payload,
                        productCode: `PRD${Date.now()}`,
                        description: 'Test',
                        categoryId: 1,
                        basePrice: 1000,
                        unit: 'piece',
                    })
            );
        });

        it('should prevent XSS in product description', async () => {
            await testXSS((payload) =>
                request(API_BASE)
                    .post('/api/v1/inventory/global-products')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        name: 'Test Product',
                        productCode: `PRD${Date.now()}`,
                        description: payload,
                        categoryId: 1,
                        basePrice: 1000,
                        unit: 'piece',
                    })
            );
        });
    });

    describe('Organization Fields', () => {
        it('should prevent XSS in organization name', async () => {
            await testXSS((payload) =>
                request(API_BASE)
                    .post('/api/v1/organizations')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        name: payload,
                        code: `ORG${Date.now()}`,
                    })
            );
        });
    });

    describe('Response Encoding', () => {
        it('should properly encode data in JSON responses', async () => {
            const xssPayload = '<script>alert("XSS")</script>';

            // Create a user with XSS payload (if allowed)
            const createResponse = await request(API_BASE)
                .post('/api/v1/users')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    email: `test${Date.now()}@test.com`,
                    password: 'Test123!',
                    firstName: xssPayload,
                    lastName: 'Test',
                    role: 'BRANCH_ADMIN',
                    organizationId: 1,
                });

            if (createResponse.status === 200) {
                // Fetch the user
                const getResponse = await request(API_BASE)
                    .get('/api/v1/users')
                    .set('Authorization', `Bearer ${authToken}`);

                // Response should be properly JSON encoded
                const responseText = JSON.stringify(getResponse.body);

                // Script tags should be escaped or removed
                expect(responseText).not.toMatch(/<script[^>]*>.*<\/script>/i);
            }
        });
    });

    describe('DOM-based XSS Prevention', () => {
        it('should not include executable code in API responses', async () => {
            const jsPayloads = [
                'javascript:alert(1)',
                'data:text/html,<script>alert(1)</script>',
                'vbscript:msgbox(1)',
            ];

            for (const payload of jsPayloads) {
                const response = await request(API_BASE)
                    .post('/api/v1/organizations')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        name: 'Test Org',
                        code: payload,
                    });

                expect(response.status).not.toBe(500);

                if (response.status === 200) {
                    const responseText = JSON.stringify(response.body);
                    expect(responseText).not.toContain('javascript:');
                    expect(responseText).not.toContain('vbscript:');
                    expect(responseText).not.toContain('data:text/html');
                }
            }
        });
    });
});
