/**
 * Update Super Admin Email
 * Run this script to update the super admin email in the database
 */

import { db } from '../lib/db'
import { users } from '../db/schema'
import { eq } from 'drizzle-orm'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function updateSuperAdminEmail() {
    try {
        const newEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@example.com'

        console.log(`Updating super admin email to: ${newEmail}`)

        // Update the SUPER_ADMIN user
        const result = await db
            .update(users)
            .set({ email: newEmail.toLowerCase() })
            .where(eq(users.role, 'SUPER_ADMIN'))

        console.log('✅ Super admin email updated successfully!')
        console.log('You can now use this email for MFA testing')

    } catch (error) {
        console.error('❌ Error updating super admin email:', error)
        process.exit(1)
    }

    process.exit(0)
}

updateSuperAdminEmail()
