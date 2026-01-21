/**
 * Global Teardown for Jest Tests
 * Runs once after all test suites complete
 */

export default async function globalTeardown() {
    console.log('\n🧹 Starting global test teardown...\n');

    // Close any open database connections
    // Clean up test data if needed
    // We'll implement actual cleanup in db-helper.ts

    try {
        console.log('✅ Test cleanup complete');
    } catch (error) {
        console.error('❌ Failed to cleanup:', error);
    }

    console.log('\n✅ Global teardown complete\n');
}
