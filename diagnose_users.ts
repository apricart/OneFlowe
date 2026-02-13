import { db } from './lib/db';
import { users } from './db/schema';
import { eq } from 'drizzle-orm';

async function diagnose() {
    const allUsers = await db.select({
        id: users.id,
        email: users.email,
        role: users.role,
        organizationId: users.organizationId,
        branchId: users.branchId
    }).from(users).limit(20);

    console.log('Sample Users with Roles and Contexts:');
    console.table(allUsers);
}

diagnose().catch(console.error);
