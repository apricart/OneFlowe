/**
 * Secure Approval Token Utilities
 * 
 * Generates and verifies approval tokens for order fulfillment.
 * Tokens are hashed using bcrypt - never stored in plaintext.
 */

import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'

// Characters used for token generation (no confusing chars like 0/O, 1/I/L)
const TOKEN_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const DEFAULT_TOKEN_LENGTH = 10
const BCRYPT_ROUNDS = 10

/**
 * Generate a cryptographically secure approval token
 * @param length Token length (default: 10)
 * @returns Uppercase alphanumeric token
 */
export function generateApprovalToken(length: number = DEFAULT_TOKEN_LENGTH): string {
    const bytes = randomBytes(length)
    let token = ''
    for (let i = 0; i < length; i++) {
        token += TOKEN_CHARS[bytes[i] % TOKEN_CHARS.length]
    }
    return token
}

/**
 * Hash an approval token for secure storage
 * @param token Plain text token
 * @returns Bcrypt hash
 */
export async function hashApprovalToken(token: string): Promise<string> {
    return bcrypt.hash(token.toUpperCase().trim(), BCRYPT_ROUNDS)
}

/**
 * Verify an approval token against a stored hash
 * @param token Plain text token provided by user
 * @param hash Stored bcrypt hash
 * @returns True if token matches hash
 */
export async function verifyApprovalToken(token: string, hash: string): Promise<boolean> {
    if (!token || !hash) return false
    return bcrypt.compare(token.toUpperCase().trim(), hash)
}
