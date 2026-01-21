/**
 * Security Tests - SQL Injection Prevention
 * Tests all API endpoints for SQL injection vulnerabilities
 */

import request from 'supertest';
import {
    SQL_INJECTION_PAYLOADS,
    expectError,
    testSQLInjection,
} from '@/tests/utils/api-helper';
import { getTokenForRole } from '@/tests/utils/auth-helper';
import { cleanupTestDatabase, seedTestData, closeTestDb } from '@/tests/utils/db-helper';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

describe('Security - SQL Injection Prevention', () => {
    let authToken: string;

    beforeAll(async () => {
        await cleanupTestDatabase();
        await seedTestData();
        authToken = getTokenForRole('SUPER_ADMIN');
    });

    afterAll(async () => {
        await closeTestDb();
    });

    describe('User Endpoints', () => {
        it('should prevent SQL injection in GET /api/v1/users (query params)', async () => {
            await testSQLInjection((payload) =>
                request(API_BASE)
                    .get(`/api/v1/users?email=${encodeURIComponent(payload)}`)
                    .set('Authorization', `Bearer ${authToken}`)
            );
        });

        it('should prevent SQL injection in GET /api/v1/users (search)', async () => {
            await testSQLInjection((payload) =>
                request(API_BASE)
                    .get(`/api/v1/users?search=${encodeURIComponent(payload)}`)
                    .set('Authorization', `Bearer ${authToken}`)
            );
        });

        it('should prevent SQL injection in POST /api/v1/users (body)', async () => {
            for (const payload of SQL_INJECTION_PAYLOADS) {
                const response = await request(API_BASE)
                    .post('/api/v1/users')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        email: payload,
                        password: 'Test123!',
                        firstName: payload,
                        lastName: payload,
                        role: 'BRANCH_ADMIN',
                    });

                // Should not crash or expose SQL errors
                expect(response.status).not.toBe(500);

                const body = JSON.stringify(response.body).toLowerCase();
                expect(body).not.toContain('sql');
                expect(body).not.toContain('query');
                expect(body).not.toContain('syntax');
            }
        });
    });

    describe('Order Endpoints', () => {
        it('should prevent SQL injection in GET /api/v1/orders (query params)', async () => {
            await testSQLInjection((payload) =>
                request(API_BASE)
                    .get(`/api/v1/orders?status=${encodeURIComponent(payload)}`)
                    .set('Authorization', `Bearer ${authToken}`)
            );
        });

        it('should prevent SQL injection in GET /api/v1/orders (search)', async () => {
            await testSQLInjection((payload) =>
                request(API_BASE)
                    .get(`/api/v1/orders?q=${encodeURIComponent(payload)}`)
                    .set('Authorization', `Bearer ${authToken}`)
            );
        });

        it('should prevent SQL injection in order notes', async () => {
            for (const payload of SQL_INJECTION_PAYLOADS) {
                const response = await request(API_BASE)
                    .post('/api/v1/orders')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        items: [{ organizationInventoryId: 1, quantity: 1 }],
                        notes: payload,
                        branchId: 1,
                        organizationId: 1,
                    });

                expect(response.status).not.toBe(500);
                const body = JSON.stringify(response.body).toLowerCase();
                expect(body).not.toContain('sql');
            }
        });
    });

    describe('Analytics Endpoints', () => {
        it('should prevent SQL injection in date filters', async () => {
            await testSQLInjection((payload) =>
                request(API_BASE)
                    .get(`/api/v1/analytics/weekly-sales?startDate=${encodeURIComponent(payload)}`)
                    .set('Authorization', `Bearer ${authToken}`)
            );
        });

        it('should prevent SQL injection in organization filters', async () => {
            await testSQLInjection((payload) =>
                request(API_BASE)
                    .get(`/api/v1/analytics/dashboard?organizationId=${encodeURIComponent(payload)}`)
                    .set('Authorization', `Bearer ${authToken}`)
            );
        });
    });

    describe('Inventory Endpoints', () => {
        it('should prevent SQL injection in product search', async () => {
            await testSQLInjection((payload) =>
                request(API_BASE)
                    .get(`/api/v1/inventory/global-products?search=${encodeURIComponent(payload)}`)
                    .set('Authorization', `Bearer ${authToken}`)
            );
        });

        it('should prevent SQL injection in product creation', async () => {
            for (const payload of SQL_INJECTION_PAYLOADS) {
                const response = await request(API_BASE)
                    .post('/api/v1/inventory/global-products')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        name: payload,
                        productCode: payload,
                        description: payload,
                        categoryId: 1,
                        basePrice: 1000,
                        unit: 'piece',
                    });

                expect(response.status).not.toBe(500);
            }
        });
    });

    describe('Organization Endpoints', () => {
        it('should prevent SQL injection in organization name', async () => {
            for (const payload of SQL_INJECTION_PAYLOADS) {
                const response = await request(API_BASE)
                    .post('/api/v1/organizations')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        name: payload,
                        code: `ORG_${Date.now()}`,
                    });

                expect(response.status).not.toBe(500);
                const body = JSON.stringify(response.body).toLowerCase();
                expect(body).not.toContain('sql');
                expect(body).not.toContain('syntax');
            }
        });
    });

    describe('UNION-based SQL Injection', () => {
        it('should prevent UNION SELECT attacks in all text fields', async () => {
            const unionPayloads = [
                "' UNION SELECT * FROM users--",
                "1' UNION SELECT null, username, password FROM users--",
                "' UNION SELECT table_name FROM information_schema.tables WHERE '1'='1",
            ];

            for (const payload of unionPayloads) {
                // Test in user email
                const response1 = await request(API_BASE)
                    .get(`/api/v1/users?email=${encodeURIComponent(payload)}`)
                    .set('Authorization', `Bearer ${authToken}`);

                expect(response1.status).not.toBe(500);
                expect(JSON.stringify(response1.body)).not.toContain('password');
                expect(JSON.stringify(response1.body)).not.toContain('passwordHash');

                // Test in order search
                const response2 = await request(API_BASE)
                    .get(`/api/v1/orders?q=${encodeURIComponent(payload)}`)
                    .set('Authorization', `Bearer ${authToken}`);

                expect(response2.status).not.toBe(500);
            }
        });
    });

    describe('Boolean-based SQL Injection', () => {
        it('should prevent boolean condition manipulation', async () => {
            const booleanPayloads = [
                "' OR '1'='1",
                "' OR 1=1--",
                "admin' OR '1'='1",
            ];

            for (const payload of booleanPayloads) {
                const response = await request(API_BASE)
                    .get(`/api/v1/users?email=${encodeURIComponent(payload)}`)
                    .set('Authorization', `Bearer ${authToken}`);

                // Should not return all users (which would happen if injection works)
                expect(response.status).not.toBe(500);
                expectError(response, 400);
            }
        });
    });

    describe('Time-based SQL Injection', () => {
        it('should not allow time-based blind SQL injection', async () => {
            const timePayloads = [
                "'; WAITFOR DELAY '00:00:05'--",
                "' OR SLEEP(5)--",
                "'; SELECT pg_sleep(5)--",
            ];

            for (const payload of timePayloads) {
                const start = Date.now();

                await request(API_BASE)
                    .get(`/api/v1/users?email=${encodeURIComponent(payload)}`)
                    .set('Authorization', `Bearer ${authToken}`);

                const duration = Date.now() - start;

                // Should not sleep (which would indicate successful injection)
                expect(duration).toBeLessThan(2000); // Less than 2 seconds
            }
        });
    });
});
