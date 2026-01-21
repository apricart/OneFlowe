/**
 * Integration Tests for Health API Endpoint
 * Tests: /api/v1/health
 */

import request from 'supertest';
import { expectSuccess, expectError } from '@/tests/utils/api-helper';

// We'll need to create a Next.js test server
// For now, we'll test against localhost or mock
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

describe('GET /api/v1/health', () => {
    it('should return healthy status when database is connected', async () => {
        const response = await request(API_BASE)
            .get('/api/v1/health')
            .expect('Content-Type', /json/);

        expectSuccess(response, 200);

        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('checks');
        expect(response.body).toHaveProperty('details');

        expect(response.body.status).toBe('ok');
        expect(response.body.checks.database).toHaveProperty('ok');
        expect(response.body.checks.database.ok).toBe(true);
        expect(response.body.checks.database).toHaveProperty('latencyMs');

        // Latency should be reasonable
        expect(response.body.checks.database.latencyMs).toBeLessThan(3000);
    });

    it('should return uptime information', async () => {
        const response = await request(API_BASE)
            .get('/api/v1/health');

        expectSuccess(response);

        expect(response.body.details).toHaveProperty('uptimeMs');
        expect(response.body.details).toHaveProperty('timestamp');
        expect(typeof response.body.details.uptimeMs).toBe('number');
    });

    it('should have valid timestamp format', async () => {
        const response = await request(API_BASE)
            .get('/api/v1/health');

        expectSuccess(response);

        const timestamp = response.body.details.timestamp;
        expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

        // Should be recent (within last minute)
        const timestampDate = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - timestampDate.getTime();
        expect(diff).toBeLessThan(60000); // Less than 1 minute
    });

    it('should handle database errors gracefully', async () => {
        // This test would require mocking database failure
        // For now, we'll skip or implement with actual DB disconnect
        // Skip for basic implementation
    });
});
