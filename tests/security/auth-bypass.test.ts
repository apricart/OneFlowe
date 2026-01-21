/**
 * Security Tests - Authentication & Authorization
 * Tests for authentication bypass and authorization escalation attempts
 */

import request from 'supertest';
import {
    generateTestToken,
    getTokenForRole,
    createInvalidToken,
    TestUser,
} from '@/tests/utils/auth-helper';
import {
    expectUnauthorized,
    expectForbidden,
    expectSuccess,
} from '@/tests/utils/api-helper';
import { cleanupTestDatabase, seedTestData, closeTestDb } from '@/tests/utils/db-helper';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

describe('Security - Authentication Bypass Prevention', () => {
    beforeAll(async () => {
        await cleanupTestDatabase();
        await seedTestData();
    });

    afterAll(async () => {
        await closeTestDb();
    });

    describe('No Authentication Token', () => {
        it('should deny access to protected routes without token', async () => {
            const protectedEndpoints = [
                '/api/v1/users',
                '/api/v1/orders',
                '/api/v1/organizations',
                '/api/v1/branches',
                '/api/v1/inventory/global-products',
                '/api/v1/analytics/dashboard',
            ];

            for (const endpoint of protectedEndpoints) {
                const response = await request(API_BASE).get(endpoint);

                // Should be unauthorized (401) or redirect
                expect(response.status).toBeGreaterThanOrEqual(401);
            }
        });
    });

    describe('Invalid Token Attacks', () => {
        it('should reject expired tokens', async () => {
            const expiredToken = createInvalidToken('expired');

            const response = await request(API_BASE)
                .get('/api/v1/users')
                .set('Authorization', `Bearer ${expiredToken}`);

            expectUnauthorized(response);
        });

        it('should reject tokens with invalid signature', async () => {
            const tamperedToken = createInvalidToken('invalid-signature');

            const response = await request(API_BASE)
                .get('/api/v1/users')
                .set('Authorization', `Bearer ${tamperedToken}`);

            expectUnauthorized(response);
        });

        it('should reject malformed tokens', async () => {
            const malformedToken = createInvalidToken('malformed');

            const response = await request(API_BASE)
                .get('/api/v1/users')
                .set('Authorization', `Bearer ${malformedToken}`);

            expectUnauthorized(response);
        });

        it('should reject none algorithm tokens', async () => {
            const noneAlgToken = createInvalidToken('wrong-algorithm');

            const response = await request(API_BASE)
                .get('/api/v1/users')
                .set('Authorization', `Bearer ${noneAlgToken}`);

            expectUnauthorized(response);
        });
    });

    describe('Token Claim Manipulation', () => {
        it('should not allow role escalation via token manipulation', async () => {
            // Try to create a token with SUPER_ADMIN role but wrong signature
            const fakeToken = generateTestToken({
                id: 'malicious-user',
                email: 'hacker@test.com',
                role: 'SUPER_ADMIN', // Attempting to escalate
                organizationId: 1,
            });

            // This should work if token is valid, but let's try to access super admin endpoint
            const response = await request(API_BASE)
                .get('/api/v1/organizations')
                .set('Authorization', `Bearer ${fakeToken}`);

            // Should either be unauthorized or forbidden
            expect(response.status).toBeGreaterThanOrEqual(401);
        });

        it('should validate all token claims', async () => {
            const tokenWithMissingClaims = generateTestToken({
                id: 'test-user',
                email: '', // Missing email
                role: 'BRANCH_ADMIN',
            } as TestUser);

            const response = await request(API_BASE)
                .get('/api/v1/users')
                .set('Authorization', `Bearer ${tokenWithMissingClaims}`);

            expect(response.status).toBeGreaterThanOrEqual(400);
        });
    });
});

describe('Security - Authorization Escalation Prevention', () => {
    beforeAll(async () => {
        await seedTestData();
    });

    describe('Vertical Privilege Escalation', () => {
        it('should prevent ORDER_PORTAL from accessing admin endpoints', async () => {
            const orderPortalToken = getTokenForRole('ORDER_PORTAL');

            const adminEndpoints = [
                '/api/v1/organizations',
                '/api/v1/users',
                '/api/v1/branches',
            ];

            for (const endpoint of adminEndpoints) {
                const response = await request(API_BASE)
                    .get(endpoint)
                    .set('Authorization', `Bearer ${orderPortalToken}`);

                expectForbidden(response);
            }
        });

        it('should prevent BRANCH_ADMIN from accessing organization management', async () => {
            const branchAdminToken = getTokenForRole('BRANCH_ADMIN');

            const response = await request(API_BASE)
                .get('/api/v1/organizations')
                .set('Authorization', `Bearer ${branchAdminToken}`);

            expectForbidden(response);
        });

        it('should prevent HEAD_OFFICE from accessing super admin endpoints', async () => {
            const headOfficeToken = getTokenForRole('HEAD_OFFICE');

            // Try to create an organization (super admin only)
            const response = await request(API_BASE)
                .post('/api/v1/organizations')
                .set('Authorization', `Bearer ${headOfficeToken}`)
                .send({
                    name: 'New Organization',
                    code: 'NEW_ORG',
                });

            expectForbidden(response);
        });
    });

    describe('Horizontal Privilege Escalation', () => {
        it('should prevent accessing other organization\'s data', async () => {
            const org1Token = getTokenForRole('HEAD_OFFICE', {
                organizationId: 1,
            });

            // Try to access organization 2's data
            const response = await request(API_BASE)
                .get('/api/v1/users?organizationId=2')
                .set('Authorization', `Bearer ${org1Token}`);

            // Should either be forbidden or return empty results
            if (response.status === 200) {
                expect(response.body.items || []).toHaveLength(0);
            } else {
                expectForbidden(response);
            }
        });

        it('should prevent accessing other branch\'s data', async () => {
            const branch1Token = getTokenForRole('BRANCH_ADMIN', {
                organizationId: 1,
                branchId: 1,
            });

            // Try to access branch 2's orders
            const response = await request(API_BASE)
                .get('/api/v1/orders?branchId=2')
                .set('Authorization', `Bearer ${branch1Token}`);

            // Should be forbidden or empty
            if (response.status === 200) {
                expect(response.body.items || []).toHaveLength(0);
            } else {
                expectForbidden(response);
            }
        });
    });

    describe('Mass Assignment Prevention', () => {
        it('should not allow role escalation via mass assignment', async () => {
            const branchAdminToken = getTokenForRole('BRANCH_ADMIN');

            // Try to create a user with SUPER_ADMIN role
            const response = await request(API_BASE)
                .post('/api/v1/users')
                .set('Authorization', `Bearer ${branchAdminToken}`)
                .send({
                    email: 'newuser@test.com',
                    password: 'Test123!',
                    firstName: 'Test',
                    lastName: 'User',
                    role: 'SUPER_ADMIN', // Attempting escalation
                    organizationId: 1,
                    branchId: 1,
                });

            // Should be rejected
            expectForbidden(response);
        });

        it('should not allow modifying protected fields via PUT', async () => {
            const branchAdminToken = getTokenForRole('BRANCH_ADMIN');

            // Try to change a user's role via update
            const response = await request(API_BASE)
                .put('/api/v1/users/test-user-id')
                .set('Authorization', `Bearer ${branchAdminToken}`)
                .send({
                    role: 'SUPER_ADMIN', // Attempting to change role
                });

            // Should be rejected
            expectForbidden(response);
        });
    });

    describe('Parameter Pollution', () => {
        it('should not allow duplicate parameter exploitation', async () => {
            const branchAdminToken = getTokenForRole('BRANCH_ADMIN', {
                organizationId: 1,
            });

            // Try to pass organizationId multiple times
            const response = await request(API_BASE)
                .post('/api/v1/orders?organizationId=1&organization=2')
                .set('Authorization', `Bearer ${branchAdminToken}`)
                .send({
                    items: [{ organizationInventoryId: 1, quantity: 1 }],
                    branchId: 1,
                    organizationId: 2, // Different org in body
                });

            // Should either fail or use the correct organizationId
            if (response.status === 200) {
                expect(response.body.order.organizationId).toBe(1);
            } else {
                expectForbidden(response);
            }
        });
    });

    describe('IDOR Prevention', () => {
        it('should prevent Insecure Direct Object Reference in user endpoints', async () => {
            const branch1Token = getTokenForRole('BRANCH_ADMIN', {
                organizationId: 1,
                branchId: 1,
            });

            // Try to access user from another branch directly
            const response = await request(API_BASE)
                .get('/api/v1/users/other-branch-user-id')
                .set('Authorization', `Bearer ${branch1Token}`);

            // Should be forbidden or not found
            expect([403, 404]).toContain(response.status);
        });

        it('should prevent IDOR in order endpoints', async () => {
            const branch1Token = getTokenForRole('BRANCH_ADMIN', {
                organizationId: 1,
                branchId: 1,
            });

            // Try to access order from another branch
            const response = await request(API_BASE)
                .get('/api/v1/orders/999999') // Non-existent or from another branch
                .set('Authorization', `Bearer ${branch1Token}`);

            expect([403, 404]).toContain(response.status);
        });
    });
});
