/**
 * Database Test Utilities
 * Helpers for setting up, seeding, and cleaning test database
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { hashPassword } from '@/lib/password';

let testPool: Pool | null = null;
let testDb: ReturnType<typeof drizzle> | null = null;

/**
 * Get or create test database connection
 */
export function getTestDb() {
    if (!testDb) {
        const connectionString = process.env.DATABASE_URL || process.env.DATABASE_URL_TEST;

        if (!connectionString) {
            throw new Error('DATABASE_URL or DATABASE_URL_TEST must be set for tests');
        }

        testPool = new Pool({ connectionString });
        testDb = drizzle(testPool, { schema });
    }

    return testDb;
}

/**
 * Close test database connection
 */
export async function closeTestDb() {
    if (testPool) {
        await testPool.end();
        testPool = null;
        testDb = null;
    }
}

/**
 * Clean all tables in test database
 * DANGEROUS: Only use in test environment!
 */
export async function cleanupTestDatabase() {
    if (process.env.NODE_ENV !== 'test') {
        throw new Error('cleanupTestDatabase can only be run in test environment');
    }

    const db = getTestDb();

    // Truncate all tables in correct order. 
    // Using CASCADE handles foreign key relations without manual order.
    const tables = [
        'system_logs',
        'audit_logs',
        'product_import_batches',
        'inventory_sync_logs',
        'restock_requests',
        'product_assignments',
        'product_modifiers',
        'modifiers',
        'branch_inventory',
        'organization_inventory',
        'branch_products',
        'organization_products',
        'order_items',
        'refunds',
        'orders',
        'notifications',
        'budgets',
        'suppliers',
        'inventory',
        'global_products',
        'skus',
        'products',
        'categories',
        'employee_credentials',
        'mfa_codes',
        'sessions',
        'users',
        'role_permissions',
        'roles',
        'branches',
        'head_offices',
        'organization_settings',
        'org_metrics',
        'organizations',
    ];

    for (const table of tables) {
        try {
            await db.execute(sql.raw(`TRUNCATE TABLE "${table}" CASCADE`));
        } catch (error) {
            // Silently continue if table doesn't exist yet
            console.warn(`Could not truncate table ${table}:`, (error as any).message);
        }
    }
}

/**
 * Seed test database with essential data
 */
export async function seedTestData() {
    const db = getTestDb();

    // Create roles
    const [superAdminRole] = await db.insert(schema.roles).values({
        name: 'SUPER_ADMIN',
        description: 'Super Administrator',
    }).returning();

    const [headOfficeRole] = await db.insert(schema.roles).values({
        name: 'HEAD_OFFICE',
        description: 'Head Office',
    }).returning();

    const [branchAdminRole] = await db.insert(schema.roles).values({
        name: 'BRANCH_ADMIN',
        description: 'Branch Administrator',
    }).returning();

    const [orderPortalRole] = await db.insert(schema.roles).values({
        name: 'ORDER_PORTAL',
        description: 'Order Portal User',
    }).returning();

    // Create test organization
    const [testOrg] = await db.insert(schema.organizations).values({
        name: 'Test Organization',
        code: 'TEST_ORG',
        status: 'active',
    }).returning();

    // Create test branch
    const [testBranch] = await db.insert(schema.branches).values({
        organizationId: testOrg.id,
        name: 'Test Branch',
        code: 'TEST_BRANCH',
        status: 'active',
    }).returning();

    // Create test users
    const passwordHash = await hashPassword('TestPassword123!');

    const [superAdmin] = await db.insert(schema.users).values({
        email: 'superadmin@test.com',
        passwordHash,
        roleId: superAdminRole.id,
        fullName: 'Super Admin',
        isActive: true,
    }).returning();

    const [headOfficeUser] = await db.insert(schema.users).values({
        email: 'headoffice@test.com',
        passwordHash,
        roleId: headOfficeRole.id,
        organizationId: testOrg.id,
        fullName: 'Head Office User',
        isActive: true,
    }).returning();

    const [branchAdmin] = await db.insert(schema.users).values({
        email: 'branchadmin@test.com',
        passwordHash,
        roleId: branchAdminRole.id,
        organizationId: testOrg.id,
        branchId: testBranch.id,
        fullName: 'Branch Admin',
        isActive: true,
    }).returning();

    // Create test category
    const [testCategory] = await db.insert(schema.categories).values({
        organizationId: testOrg.id,
        name: 'Test Category',
    }).returning();

    // Create test global products
    const [testProduct] = await db.insert(schema.globalProducts).values({
        productCode: 'TEST-001',
        name: 'Test Product',
        description: 'Test product description',
        categoryId: testCategory.id,
        basePrice: 10000, // 100.00 PKR in cents
        unit: 'piece',
        status: 'active',
        stockQuantity: 1000,
    }).returning();

    // Create budget for current month
    const currentMonth = new Date().toISOString().slice(0, 7);
    await db.insert(schema.budgets).values({
        organizationId: testOrg.id,
        branchId: testBranch.id,
        period: currentMonth,
        amountAllocatedCents: 100000000, // 1,000,000 PKR
        amountSpentCents: 0,
        amountHeldCents: 0,
        amountCreditedCents: 0,
    });

    return {
        roles: {
            superAdmin: superAdminRole,
            headOffice: headOfficeRole,
            branchAdmin: branchAdminRole,
            orderPortal: orderPortalRole,
        },
        organization: testOrg,
        branch: testBranch,
        users: {
            superAdmin,
            headOffice: headOfficeUser,
            branchAdmin,
        },
        category: testCategory,
        product: testProduct,
    };
}

/**
 * Create a test user with specific role
 */
export async function createTestUser(options: {
    email: string;
    role: 'SUPER_ADMIN' | 'HEAD_OFFICE' | 'BRANCH_ADMIN' | 'ORDER_PORTAL';
    organizationId?: number;
    branchId?: number;
    mfaEnabled?: boolean;
}) {
    const db = getTestDb();

    const [role] = await db.select().from(schema.roles)
        .where(sql`${schema.roles.name} = ${options.role}`)
        .limit(1);

    if (!role) {
        throw new Error(`Role ${options.role} not found`);
    }

    const passwordHash = await hashPassword('TestPassword123!');

    const [user] = await db.insert(schema.users).values({
        email: options.email,
        passwordHash,
        roleId: role.id,
        organizationId: options.organizationId,
        branchId: options.branchId,
        mfaEnabled: options.mfaEnabled || false,
        fullName: `Test ${options.role}`,
        isActive: true,
    }).returning();

    return user;
}

/**
 * Create a test organization
 */
export async function createTestOrganization(name: string = 'Test Org') {
    const db = getTestDb();

    const [org] = await db.insert(schema.organizations).values({
        name,
        code: `ORG_${Date.now()}`,
        status: 'active',
    }).returning();

    return org;
}

/**
 * Create a test branch
 */
export async function createTestBranch(organizationId: number, name: string = 'Test Branch') {
    const db = getTestDb();

    const [branch] = await db.insert(schema.branches).values({
        organizationId,
        name,
        code: `BRANCH_${Date.now()}`,
        status: 'active',
    }).returning();

    return branch;
}

/**
 * Create a test order
 */
export async function createTestOrder(options: {
    branchId: number;
    organizationId: number;
    userId: string;
    status?: string;
    totalCents?: number;
}) {
    const db = getTestDb();

    const tid = `TEST_${Date.now()}`;

    const [order] = await db.insert(schema.orders).values({
        tid,
        organizationId: options.organizationId,
        branchId: options.branchId,
        createdByUserId: options.userId,
        status: options.status || 'PENDING',
        subtotalCents: options.totalCents || 10000,
        taxCents: 0,
        totalCents: options.totalCents || 10000,
    }).returning();

    return order;
}

/**
 * Helper to run code in a transaction that rolls back
 * Useful for isolation in tests without cleanup
 */
export async function runInTestTransaction<T>(
    callback: (db: ReturnType<typeof drizzle>) => Promise<T>
): Promise<T> {
    const db = getTestDb();

    return await db.transaction(async (tx) => {
        const result = await callback(tx as any);
        // Force rollback by throwing
        throw new Error('ROLLBACK_TEST_TRANSACTION');
    }).catch((err) => {
        if (err.message === 'ROLLBACK_TEST_TRANSACTION') {
            // This is expected, return undefined
            return undefined as T;
        }
        throw err;
    });
}
