import { db } from './lib/db';
import { users } from './db/schema';

async function check() {
    const items = await db.select({ role: users.role }).from(users);
    const roles = [...new Set(items.map(i => i.role))];
    console.log('Unique roles in DB:', roles);
}

check().catch(console.error);
