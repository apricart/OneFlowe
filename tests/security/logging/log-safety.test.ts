/**
 * Observability Security Tests - Log Safety & PII Protection
 * 
 * Logs are a common source of:
 * - PII leakage (GDPR violations)
 * - Credential exposure
 * - Log injection attacks
 * - Missing audit trails
 * 
 * @see https://owasp.org/www-project-top-ten/2017/A10_2017-Insufficient_Logging%2526Monitoring
 */

import request from 'supertest';
import { getTokenForRole, createInvalidToken } from '@/tests/utils/auth-helper';
import { cleanupTestDatabase, seedTestData, closeTestDb } from '@/tests/utils/db-helper';
import fs from 'fs';
import path from 'path';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const LOG_DIR = path.resolve(process.cwd(), 'logs');

describe('Log Safety - PII & Injection Protection', () => {
    let authToken: string;
    let logContent: string;

    beforeAll(async () => {
        await cleanupTestDatabase();
        await seedTestData();
        authToken = getTokenForRole('SUPER_ADMIN');
    });

    afterAll(async () => {
        await closeTestDb();
    });

    describe('PII Redaction', () => {
        it('should never log raw email addresses', async () => {
            const testEmail = 'sensitive-user-12345@example.com';

            // Trigger a log event
            await request(API_BASE)
                .post('/api/v1/users')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    email: testEmail,
                    password: 'Test123!',
                    firstName: 'Test',
                    lastName: 'User',
                    role: 'BRANCH_ADMIN',
                    organizationId: 1,
                });

            // Read logs
            const logs = getRecentLogs();

            // Email should be redacted or hashed
            expect(logs).not.toContain(testEmail);

            // May contain hashed or partial version
            if (logs.includes('@example.com')) {
                expect(logs).toMatch(/\*\*\*\*@example\.com/);
            }
        });

        it('should never log passwords or password hashes', async () => {
            const testPassword = 'SuperSecret123!';

            await request(API_BASE)
                .post('/api/auth/signin')
                .send({
                    email: 'test@example.com',
                    password: testPassword,
                });

            const logs = getRecentLogs();

            expect(logs).not.toContain(testPassword);
            expect(logs).not.toContain('$2b$'); // bcrypt prefix
        });

        it('should never log JWT tokens', async () => {
            const token = getTokenForRole('BRANCH_ADMIN');

            await request(API_BASE)
                .get('/api/v1/users')
                .set('Authorization', `Bearer ${token}`);

            const logs = getRecentLogs();

            expect(logs).not.toContain(token);
            expect(logs).not.toMatch(/ey[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/); // JWT pattern
        });

        it('should never log MFA codes', async () => {
            const mfaCode = '123456';

            await request(API_BASE)
                .post('/api/auth/signin')
                .send({
                    email: 'mfa-user@example.com',
                    password: 'Test123!',
                    mfaCode,
                });

            const logs = getRecentLogs();

            // Should not contain exact 6-digit MFA code
            expect(logs).not.toContain(mfaCode);
        });
    });

    describe('Log Injection Prevention', () => {
        it('should sanitize newlines in user input', async () => {
            const maliciousInput = 'Admin\nERROR: System compromised\nWARNING: Fake alert';

            await request(API_BASE)
                .post('/api/v1/users')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    email: 'test@example.com',
                    password: 'Test123!',
                    firstName: maliciousInput,
                    lastName: 'User',
                    role: 'BRANCH_ADMIN',
                    organizationId: 1,
                });

            const logs = getRecentLogs();

            // Newlines should be escaped or removed
            if (logs.includes('Admin')) {
                expect(logs).not.toMatch(/Admin\nERROR/);
                expect(logs).toMatch(/Admin\\nERROR/); // Escaped
            }
        });

        it('should sanitize control characters', async () => {
            const maliciousInput = 'Test\u0000\u0001\u001b[31mRED TEXT\u001b[0m';

            await request(API_BASE)
                .post('/api/v1/organizations')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: maliciousInput,
                    code: `ORG_${Date.now()}`,
                });

            const logs = getRecentLogs();

            // ANSI escape sequences should be stripped
            expect(logs).not.toContain('\u001b[31m');
            expect(logs).not.toContain('\u0000');
        });
    });

    describe('Correlation ID Propagation', () => {
        it('should generate correlation ID for each request', async () => {
            const response = await request(API_BASE)
                .get('/api/v1/health')
                .set('Authorization', `Bearer ${authToken}`);

            // Should return correlation ID in header
            const correlationId = response.headers['x-correlation-id'] ||
                response.headers['x-request-id'];

            expect(correlationId).toBeDefined();
            expect(correlationId).toMatch(/^[a-f0-9-]{36}$/); // UUID format
        });

        it('should preserve client-provided correlation ID', async () => {
            const clientCorrelationId = 'client-request-12345';

            const response = await request(API_BASE)
                .get('/api/v1/health')
                .set('X-Correlation-ID', clientCorrelationId)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.headers['x-correlation-id']).toBe(clientCorrelationId);
        });

        it('should log correlation ID for traceability', async () => {
            const correlationId = `test-correlation-${Date.now()}`;

            await request(API_BASE)
                .get('/api/v1/users')
                .set('X-Correlation-ID', correlationId)
                .set('Authorization', `Bearer ${authToken}`);

            const logs = getRecentLogs();

            expect(logs).toContain(correlationId);
        });
    });

    describe('Audit Logging Completeness', () => {
        it('should log authentication failures', async () => {
            const invalidToken = createInvalidToken('expired');

            await request(API_BASE)
                .get('/api/v1/users')
                .set('Authorization', `Bearer ${invalidToken}`);

            const logs = getRecentLogs();

            expect(logs).toMatch(/auth(entication)?\s+(failed|error)/i);
        });

        it('should log authorization failures', async () => {
            const orderPortalToken = getTokenForRole('ORDER_PORTAL');

            await request(API_BASE)
                .get('/api/v1/organizations')
                .set('Authorization', `Bearer ${orderPortalToken}`);

            const logs = getRecentLogs();

            expect(logs).toMatch(/forbidden|unauthorized|access denied/i);
        });

        it('should log privileged operations', async () => {
            await request(API_BASE)
                .post('/api/v1/users')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    email: `audit-test-${Date.now()}@example.com`,
                    password: 'Test123!',
                    firstName: 'Audit',
                    lastName: 'Test',
                    role: 'SUPER_ADMIN',
                    organizationId: 1,
                });

            const logs = getRecentLogs();

            // Should log user creation with role
            expect(logs).toMatch(/user\s+creat(ed|ion)/i);
        });
    });

    describe('Error Context Without Exposure', () => {
        it('should log error details without stack traces in response', async () => {
            // Trigger an error
            const response = await request(API_BASE)
                .post('/api/v1/orders')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ invalid: 'data' });

            // Response body should NOT contain file paths or stack traces
            const body = JSON.stringify(response.body);
            expect(body).not.toMatch(/at\s+[A-Za-z]+\s+\([^)]+:\d+:\d+\)/); // Stack trace pattern
            expect(body).not.toMatch(/\.ts:\d+:\d+/); // File line numbers
        });
    });

    describe('Sensitive Query Parameter Filtering', () => {
        it('should redact tokens in URLs', async () => {
            await request(API_BASE)
                .get('/api/v1/verify?token=secret-verification-token-12345')
                .set('Authorization', `Bearer ${authToken}`);

            const logs = getRecentLogs();

            // Token should be redacted
            if (logs.includes('verify')) {
                expect(logs).not.toContain('secret-verification-token-12345');
                expect(logs).toMatch(/token=[*]+/);
            }
        });
    });
});

/**
 * Helper function to read recent log files
 */
function getRecentLogs(): string {
    try {
        if (!fs.existsSync(LOG_DIR)) {
            return '';
        }

        const files = fs.readdirSync(LOG_DIR)
            .filter(f => f.endsWith('.log'))
            .map(f => ({
                name: f,
                time: fs.statSync(path.join(LOG_DIR, f)).mtime.getTime(),
            }))
            .sort((a, b) => b.time - a.time);

        if (files.length === 0) {
            return '';
        }

        // Read most recent log file
        const latestLog = path.join(LOG_DIR, files[0].name);
        return fs.readFileSync(latestLog, 'utf-8');
    } catch (error) {
        console.warn('Could not read logs for testing:', error);
        return '';
    }
}
