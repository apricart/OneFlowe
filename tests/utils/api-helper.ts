/**
 * API Testing Utilities
 * Standardized helper functions for API endpoint testing
 */

import supertest, { Test, Response } from 'supertest';

/**
 * Standard API response interface
 */
export interface APIResponse<T = any> {
    data?: T;
    error?: string;
    message?: string;
    items?: T[];
}

/**
 * Helper to assert successful API responses
 */
export function expectSuccess(response: Response, expectedStatus: number = 200) {
    expect(response.status).toBe(expectedStatus);
    expect(response.body.error).toBeUndefined();
}

/**
 * Helper to assert error API responses
 */
export function expectError(
    response: Response,
    expectedStatus: number,
    expectedMessage?: string | RegExp
) {
    expect(response.status).toBe(expectedStatus);
    expect(response.body.error).toBeDefined();

    if (expectedMessage) {
        if (typeof expectedMessage === 'string') {
            expect(response.body.error).toContain(expectedMessage);
        } else {
            expect(response.body.error).toMatch(expectedMessage);
        }
    }
}

/**
 * Helper to expect unauthorized (401) response
 */
export function expectUnauthorized(response: Response) {
    expectError(response, 401);
}

/**
 * Helper to expect forbidden (403) response
 */
export function expectForbidden(response: Response) {
    expectError(response, 403);
}

/**
 * Helper to expect validation error (400) response
 */
export function expectValidationError(response: Response, field?: string) {
    expectError(response, 400);

    if (field) {
        const errorMsg = response.body.error.toLowerCase();
        expect(errorMsg).toContain(field.toLowerCase());
    }
}

/**
 * Helper to expect not found (404) response
 */
export function expectNotFound(response: Response) {
    expectError(response, 404);
}

/**
 * Test rate limiting on an endpoint
 * Makes multiple rapid requests and checks for 429 response
 */
export async function testRateLimit(
    request: () => Test,
    maxRequests: number = 10,
    expectedStatus: number = 429
): Promise<boolean> {
    const promises = Array.from({ length: maxRequests + 5 }, () => request());
    const responses = await Promise.all(promises);

    // At least one should be rate limited
    const rateLimited = responses.some(r => r.status === expectedStatus);
    return rateLimited;
}

/**
 * Helper to measure API response time
 */
export async function measureResponseTime(request: () => Promise<Response>): Promise<number> {
    const start = Date.now();
    await request();
    const end = Date.now();
    return end - start;
}

/**
 * Helper to test concurrent requests (race condition testing)
 */
export async function testConcurrentRequests(
    requestFn: () => Test,
    count: number = 10
): Promise<Response[]> {
    const promises = Array.from({ length: count }, () => requestFn());
    return Promise.all(promises);
}

/**
 * Helper to assert response contains specific fields
 */
export function expectResponseHasFields(response: Response, fields: string[]) {
    expectSuccess(response);

    const data = response.body.data || response.body;

    for (const field of fields) {
        expect(data).toHaveProperty(field);
    }
}

/**
 * Helper to assert array response
 */
export function expectArrayResponse(
    response: Response,
    minLength: number = 0,
    maxLength?: number
) {
    expectSuccess(response);

    const items = response.body.items || response.body.data || response.body;

    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(minLength);

    if (maxLength !== undefined) {
        expect(items.length).toBeLessThanOrEqual(maxLength);
    }
}

/**
 * SQL Injection test payloads
 */
export const SQL_INJECTION_PAYLOADS = [
    "' OR '1'='1",
    "' OR 1=1--",
    "'; DROP TABLE users; --",
    "admin'--",
    "' UNION SELECT * FROM users--",
    "1' AND 1=1 UNION SELECT null, table_name FROM information_schema.tables--",
    "' OR 'x'='x",
    "1; DELETE FROM users WHERE 'a'='a",
    "' OR '1'='1' /*",
];

/**
 * XSS test payloads
 */
export const XSS_PAYLOADS = [
    "<script>alert('XSS')</script>",
    "<img src=x onerror=alert('XSS')>",
    "javascript:alert('XSS')",
    "<svg onload=alert('XSS')>",
    "<iframe src=javascript:alert('XSS')>",
    "<body onload=alert('XSS')>",
    "'-alert('XSS')-'",
    "\"><script>alert(String.fromCharCode(88,83,83))</script>",
];

/**
 * NoSQL Injection test payloads
 */
export const NOSQL_INJECTION_PAYLOADS = [
    '{"$gt": ""}',
    '{"$ne": null}',
    '{"$nin": []}',
    '{"$exists": true}',
    '{"$regex": ".*"}',
];

/**
 * Path traversal test payloads
 */
export const PATH_TRAVERSAL_PAYLOADS = [
    '../../../etc/passwd',
    '..\\..\\..\\windows\\win.ini',
    '....//....//....//etc/passwd',
    '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
];

/**
 * Test all SQL injection payloads against a request builder
 */
export async function testSQLInjection(
    requestBuilder: (payload: string) => Test
): Promise<void> {
    for (const payload of SQL_INJECTION_PAYLOADS) {
        const response = await requestBuilder(payload);

        // Should not return 500 (which might indicate SQL error)
        // Should either reject with validation error or sanitize
        expect(response.status).not.toBe(500);

        // Should not expose SQL errors in response
        const body = JSON.stringify(response.body).toLowerCase();
        expect(body).not.toContain('sql');
        expect(body).not.toContain('syntax');
        expect(body).not.toContain('query');
        expect(body).not.toContain('postgres');
    }
}

/**
 * Test all XSS payloads against a request builder
 */
export async function testXSS(
    requestBuilder: (payload: string) => Test
): Promise<void> {
    for (const payload of XSS_PAYLOADS) {
        const response = await requestBuilder(payload);

        // Should handle gracefully (not crash)
        expect(response.status).not.toBe(500);

        // Check if payload is properly escaped in response
        if (response.body.data || response.body.items) {
            const responseStr = JSON.stringify(response.body);

            // If the payload is returned, it should be escaped
            if (responseStr.includes(payload)) {
                // Should not contain unescaped script tags
                expect(responseStr).not.toMatch(/<script[^>]*>[^<]*<\/script>/i);
            }
        }
    }
}

/**
 * Helper to validate response structure matches schema
 */
export function expectResponseMatchesSchema(
    response: Response,
    schema: Record<string, string>
) {
    expectSuccess(response);

    const data = response.body.data || response.body;

    for (const [field, type] of Object.entries(schema)) {
        expect(data).toHaveProperty(field);
        expect(typeof data[field]).toBe(type);
    }
}

/**
 * Helper to test pagination
 */
export function expectPaginatedResponse(
    response: Response,
    options: {
        hasNext?: boolean;
        hasPrev?: boolean;
        totalCount?: number;
    } = {}
) {
    expectSuccess(response);

    const body = response.body;

    expect(body).toHaveProperty('items');
    expect(Array.isArray(body.items)).toBe(true);

    if (options.hasNext !== undefined) {
        expect(body.hasNext).toBe(options.hasNext);
    }

    if (options.hasPrev !== undefined) {
        expect(body.hasPrev).toBe(options.hasPrev);
    }

    if (options.totalCount !== undefined) {
        expect(body.totalCount).toBe(options.totalCount);
    }
}
