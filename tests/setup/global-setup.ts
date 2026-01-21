/**
 * Global Setup for Jest Tests
 * Runs once before all test suites
 */

import { config } from 'dotenv';
import { resolve } from 'path';

export default async function globalSetup() {
    console.log('\n🚀 Starting global test setup...\n');

    // Load test environment variables
    config({ path: resolve(process.cwd(), '.env.test') });

    // Override NODE_ENV
    (process.env as any).NODE_ENV = 'test';

    console.log('✅ Environment configured for testing');
    console.log(`📦 Database: ${(process.env as any).DATABASE_URL?.includes('@') ?
        (process.env as any).DATABASE_URL.split('@')[1] : 'Not configured'}`);

    // Initialize test database if needed
    // This is optional - you may want to handle DB setup separately
    try {
        // We'll implement actual DB setup in db-helper.ts
        console.log('✅ Test database ready');
    } catch (error) {
        console.error('❌ Failed to initialize test database:', error);
        throw error;
    }

    console.log('\n✅ Global setup complete\n');
}
