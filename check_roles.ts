import { db } from './lib/db';
import { users } from './db/schema';

async function check() {
    const items = await db.select({ roleId: users.roleId }).from(users);
    const roles = [...new Set(items.map(i => i.roleId))];
    console.log('Unique role IDs in DB:', roles);
}

check().catch(console.error);
