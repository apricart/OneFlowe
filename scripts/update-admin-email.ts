/**
 * Update Super Admin Email
 * Run this script to update the super admin email in the database
 */

import { db } from '../lib/db'
import { users, roles } from '../db/schema'
import { eq } from 'drizzle-orm'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function updateSuperAdminEmail() {
    try {
        const newEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@example.com'

        console.log(`Updating super admin email to: ${newEmail}`)

        // Find the SUPER_ADMIN role ID first
        const [superAdminRole] = await db
            .select({ id: roles.id })
            .from(roles)
            .where(eq(roles.name, 'SUPER_ADMIN'))
            .limit(1)

        if (!superAdminRole) {
            console.error('❌ SUPER_ADMIN role not found in roles table')
            process.exit(1)
        }

        // Update users with that roleId
        const result = await db
            .update(users)
            .set({ email: newEmail.toLowerCase() })
            .where(eq(users.roleId, superAdminRole.id))

        console.log('✅ Super admin email updated successfully!')
        console.log('You can now use this email for MFA testing')

    } catch (error) {
        console.error('❌ Error updating super admin email:', error)
        process.exit(1)
    }

    process.exit(0)
}

updateSuperAdminEmail()
