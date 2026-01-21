/**
 * Authentication Test Utilities
 * Helpers for creating authenticated requests and mock sessions
 */

import { sign } from 'jsonwebtoken';
import { Session } from 'next-auth';
import { Request } from 'supertest';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'test-secret-key-minimum-32-characters-long-for-testing';

export interface TestUser {
    id: string;
    email: string;
    role: string;
    organizationId?: number;
    branchId?: number;
    fullName?: string;
    isEmployee?: boolean;
    employeeId?: number;
}

/**
 * Generate a valid JWT token for testing
 */
export function generateTestToken(user: TestUser): string {
    const payload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        branchId: user.branchId,
        fullName: user.fullName,
        isEmployee: user.isEmployee || false,
        employeeId: user.employeeId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // 24 hours
    };

    return sign(payload, JWT_SECRET);
}

/**
 * Create a mock NextAuth session for testing
 */
export function mockSession(user: TestUser): Session {
    return {
        user: {
            id: user.id,
            email: user.email,
            name: user.fullName,
            role: user.role,
            organizationId: user.organizationId,
            branchId: user.branchId,
            fullName: user.fullName,
            isEmployee: user.isEmployee || false,
            employeeId: user.employeeId,
        } as any,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
}

/**
 * Get a token for a specific role with default test data
 */
export function getTokenForRole(
    role: 'SUPER_ADMIN' | 'HEAD_OFFICE' | 'BRANCH_ADMIN' | 'ORDER_PORTAL' | 'EMPLOYEE',
    options: Partial<TestUser> = {}
): string {
    const defaults: Record<string, Partial<TestUser>> = {
        SUPER_ADMIN: {
            id: 'test-super-admin-id',
            email: 'superadmin@test.com',
            role: 'SUPER_ADMIN',
            fullName: 'Super Admin',
        },
        HEAD_OFFICE: {
            id: 'test-head-office-id',
            email: 'headoffice@test.com',
            role: 'HEAD_OFFICE',
            organizationId: 1,
            fullName: 'Head Office User',
        },
        BRANCH_ADMIN: {
            id: 'test-branch-admin-id',
            email: 'branchadmin@test.com',
            role: 'BRANCH_ADMIN',
            organizationId: 1,
            branchId: 1,
            fullName: 'Branch Admin',
        },
        ORDER_PORTAL: {
            id: 'test-order-portal-id',
            email: 'orderportal@test.com',
            role: 'ORDER_PORTAL',
            organizationId: 1,
            branchId: 1,
            fullName: 'Order Portal User',
        },
        EMPLOYEE: {
            id: 'emp_1',
            email: 'employee@test.com',
            role: 'EMPLOYEE',
            organizationId: 1,
            branchId: 1,
            fullName: 'Test Employee',
            isEmployee: true,
            employeeId: 1,
        },
    };

    const user = { ...defaults[role], ...options } as TestUser;
    return generateTestToken(user);
}

/**
 * Add authentication header to supertest request
 */
export function addAuthHeader(request: Request, token: string): Request {
    // NextAuth uses cookies, but we'll also support Bearer tokens for testing
    return request.set('Authorization', `Bearer ${token}`);
}

/**
 * Create an authenticated request helper
 */
export function authenticatedRequest(
    role: 'SUPER_ADMIN' | 'HEAD_OFFICE' | 'BRANCH_ADMIN' | 'ORDER_PORTAL' | 'EMPLOYEE',
    options: Partial<TestUser> = {}
) {
    const token = getTokenForRole(role, options);
    return { token, addAuth: (req: Request) => addAuthHeader(req, token) };
}

/**
 * Generate a test MFA code (6 digits)
 */
export function generateTestMFACode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generate a test approval token
 */
export function generateTestApprovalToken(length: number = 10): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous characters
    let token = '';
    for (let i = 0; i < length; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
}

/**
 * Create invalid/tampered JWT token for security testing
 */
export function createInvalidToken(type: 'expired' | 'invalid-signature' | 'malformed' | 'wrong-algorithm'): string {
    switch (type) {
        case 'expired':
            const expiredPayload = {
                sub: 'test-user-id',
                email: 'test@test.com',
                role: 'BRANCH_ADMIN',
                iat: Math.floor(Date.now() / 1000) - 7200,
                exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
            };
            return sign(expiredPayload, JWT_SECRET);

        case 'invalid-signature':
            const validToken = sign({ sub: 'test', role: 'SUPER_ADMIN' }, JWT_SECRET);
            // Tamper with the signature
            const parts = validToken.split('.');
            parts[2] = parts[2].split('').reverse().join('');
            return parts.join('.');

        case 'malformed':
            return 'this.is.not.a.valid.jwt.token';

        case 'wrong-algorithm':
            // Use none algorithm (security vulnerability test)
            return sign({ sub: 'test', role: 'SUPER_ADMIN' }, '', { algorithm: 'none' as any });

        default:
            throw new Error(`Unknown invalid token type: ${type}`);
    }
}

/**
 * Mock getServerSession for Next.js API routes
 */
export function mockGetServerSession(user: TestUser | null) {
    return user ? mockSession(user) : null;
}
