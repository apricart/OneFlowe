import dotenv from 'dotenv';
import path from 'path';
import { resolve } from 'path';
import { existsSync } from 'fs';

// 1. Force load env first
const envPath = existsSync(resolve(process.cwd(), ".env.local"))
    ? resolve(process.cwd(), ".env.local")
    : resolve(process.cwd(), ".env");
dotenv.config({ path: envPath });

// 2. Now dynamically import db and schema
async function createAdmin() {
    const { db } = await import("../lib/db");
    const { users, roles, rolePermissions } = await import("../db/schema");
    const { eq } = await import("drizzle-orm");
    const bcrypt = (await import("bcryptjs")).default;
    const { ROLE_TEMPLATES } = await import("../lib/permissions");
    console.log("🚀 Starting Admin Creation...");

    try {
        const email = "admin@example.com";
        const password = "admin123";
        const roleName = "SUPER_ADMIN";

        // 1. Ensure Role exists
        console.log(`🔍 Checking role: ${roleName}`);
        let [superAdminRole] = await db.select().from(roles).where(eq(roles.name, roleName)).limit(1);

        if (!superAdminRole) {
            console.log(`➕ Creating role: ${roleName}`);
            [superAdminRole] = await db.insert(roles).values({
                name: roleName,
                description: ROLE_TEMPLATES.SUPER_ADMIN.description,
                permissions: ROLE_TEMPLATES.SUPER_ADMIN.permissions.reduce((acc: any, key: string) => {
                    acc[key] = true;
                    return acc;
                }, {}),
            }).returning();
        }

        // 2. Ensure Permissions exist
        console.log("🔍 Syncing permissions...");
        await db.delete(rolePermissions).where(eq(rolePermissions.roleId, superAdminRole.id));
        const permissionValues = ROLE_TEMPLATES.SUPER_ADMIN.permissions.map((key) => ({
            roleId: superAdminRole.id,
            permissionKey: key as string,
            allowed: true,
        }));
        await db.insert(rolePermissions).values(permissionValues);

        // 3. Create User
        console.log(`🔍 Checking user: ${email}`);
        const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);

        if (existingUser) {
            console.log("♻️  User already exists, updating password...");
            const passwordHash = await bcrypt.hash(password, 10);
            await db.update(users)
                .set({ passwordHash, roleId: superAdminRole.id, isActive: true })
                .where(eq(users.id, existingUser.id));
        } else {
            console.log("➕ Creating new user...");
            const passwordHash = await bcrypt.hash(password, 10);
            await db.insert(users).values({
                email,
                passwordHash,
                roleId: superAdminRole.id,
                fullName: "Super Admin",
                isActive: true,
            });
        }

        console.log("\n✅ Admin user created successfully!");
        console.log(`📧 Email: ${email}`);
        console.log(`🔑 Password: ${password}`);

    } catch (error) {
        console.error("❌ Failed to create admin:", error);
        process.exit(1);
    }

    process.exit(0);
}

createAdmin();
