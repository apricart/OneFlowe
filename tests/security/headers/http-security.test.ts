/**
 * Infrastructure Security Tests - HTTP Security Headers
 * Validates that all security-critical HTTP headers are present and correctly configured
 * 
 * Attack Surface: Missing or misconfigured headers enable:
 * - Clickjacking (missing X-Frame-Options)
 * - MIME-sniffing attacks (missing X-Content-Type-Options)
 * - XSS via inline scripts (weak CSP)
 * - SSL stripping (missing HSTS)
 * 
 * @see https://owasp.org/www-project-secure-headers/
 */

import request from 'supertest';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

describe('Security Headers - HTTP Hardening', () => {
    describe('Content-Security-Policy', () => {
        it('should enforce strict CSP on all routes', async () => {
            const routes = ['/', '/api/v1/health', '/dashboard'];

            for (const route of routes) {
                const response = await request(API_BASE).get(route);

                const csp = response.headers['content-security-policy'];
                expect(csp).toBeDefined();

                // Must disallow unsafe-inline and unsafe-eval
                expect(csp).not.toContain('unsafe-inline');
                expect(csp).not.toContain('unsafe-eval');

                // Must define default-src
                expect(csp).toMatch(/default-src\s+[^;]+/);
            }
        });

        it('should prevent inline script execution', async () => {
            const response = await request(API_BASE).get('/');
            const csp = response.headers['content-security-policy'];

            // Verify script-src directive exists and is restrictive
            expect(csp).toMatch(/script-src\s+[^;]*'self'/);
            expect(csp).not.toMatch(/script-src\s+[^;]*\*/);
        });
    });

    describe('Strict-Transport-Security (HSTS)', () => {
        it('should enforce HSTS with minimum 1 year max-age', async () => {
            const response = await request(API_BASE).get('/');

            const hsts = response.headers['strict-transport-security'];
            expect(hsts).toBeDefined();

            // Extract max-age value
            const maxAgeMatch = hsts.match(/max-age=(\d+)/);
            expect(maxAgeMatch).not.toBeNull();

            const maxAge = parseInt(maxAgeMatch![1]);
            const oneYear = 31536000; // seconds

            expect(maxAge).toBeGreaterThanOrEqual(oneYear);
        });

        it('should include includeSubDomains directive', async () => {
            const response = await request(API_BASE).get('/');
            const hsts = response.headers['strict-transport-security'];

            expect(hsts).toContain('includeSubDomains');
        });

        it('should include preload directive', async () => {
            const response = await request(API_BASE).get('/');
            const hsts = response.headers['strict-transport-security'];

            expect(hsts).toContain('preload');
        });
    });

    describe('X-Frame-Options', () => {
        it('should prevent clickjacking with DENY or SAMEORIGIN', async () => {
            const response = await request(API_BASE).get('/');

            const xfo = response.headers['x-frame-options'];
            expect(xfo).toBeDefined();
            expect(['DENY', 'SAMEORIGIN']).toContain(xfo);
        });

        it('should apply to all routes including API', async () => {
            const routes = ['/api/v1/health', '/api/v1/users', '/dashboard'];

            for (const route of routes) {
                const response = await request(API_BASE).get(route);
                expect(response.headers['x-frame-options']).toBeDefined();
            }
        });
    });

    describe('X-Content-Type-Options', () => {
        it('should prevent MIME-sniffing attacks', async () => {
            const response = await request(API_BASE).get('/');

            const xcto = response.headers['x-content-type-options'];
            expect(xcto).toBe('nosniff');
        });

        it('should apply to JSON API responses', async () => {
            const response = await request(API_BASE).get('/api/v1/health');

            expect(response.headers['x-content-type-options']).toBe('nosniff');
            expect(response.headers['content-type']).toMatch(/application\/json/);
        });
    });

    describe('Referrer-Policy', () => {
        it('should limit referrer information leakage', async () => {
            const response = await request(API_BASE).get('/');

            const referrer = response.headers['referrer-policy'];
            expect(referrer).toBeDefined();

            // Must be one of the secure policies
            const securePolicies = [
                'no-referrer',
                'strict-origin',
                'strict-origin-when-cross-origin',
                'same-origin',
            ];

            expect(securePolicies).toContain(referrer);
        });
    });

    describe('Permissions-Policy', () => {
        it('should restrict dangerous browser features', async () => {
            const response = await request(API_BASE).get('/');

            const permissions = response.headers['permissions-policy'];
            expect(permissions).toBeDefined();

            // Must deny geolocation, microphone, camera by default
            expect(permissions).toMatch(/geolocation=\(\)/);
            expect(permissions).toMatch(/microphone=\(\)/);
            expect(permissions).toMatch(/camera=\(\)/);
        });
    });

    describe('X-Powered-By Header Removal', () => {
        it('should not leak server/framework information', async () => {
            const response = await request(API_BASE).get('/');

            expect(response.headers['x-powered-by']).toBeUndefined();
            expect(response.headers['server']).not.toContain('Express');
            expect(response.headers['server']).not.toContain('Next.js');
        });
    });

    describe('Cache-Control for Sensitive Routes', () => {
        it('should prevent caching of authenticated routes', async () => {
            const sensitiveRoutes = ['/dashboard', '/api/v1/users'];

            for (const route of sensitiveRoutes) {
                const response = await request(API_BASE).get(route);

                const cacheControl = response.headers['cache-control'];
                if (cacheControl) {
                    expect(cacheControl).toMatch(/no-store|no-cache|private/);
                }
            }
        });
    });

    describe('Cross-Origin Headers', () => {
        it('should not allow unrestricted CORS', async () => {
            const response = await request(API_BASE)
                .get('/api/v1/health')
                .set('Origin', 'https://malicious-site.com');

            const allowOrigin = response.headers['access-control-allow-origin'];

            // Should not be wildcard for authenticated endpoints
            if (allowOrigin) {
                expect(allowOrigin).not.toBe('*');
            }
        });
    });
});
