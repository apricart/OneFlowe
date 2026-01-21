/**
 * Unit Tests for RBAC System
 */

import { requireRole, Role } from '@/lib/rbac';

describe('RBAC System - requireRole', () => {
    it('should allow access when role matches', () => {
        expect(() => {
            requireRole('SUPER_ADMIN', ['SUPER_ADMIN']);
        }).not.toThrow();

        expect(() => {
            requireRole('HEAD_OFFICE', ['HEAD_OFFICE', 'SUPER_ADMIN']);
        }).not.toThrow();
    });

    it('should deny access when role does not match', () => {
        expect(() => {
            requireRole('BRANCH_ADMIN', ['SUPER_ADMIN']);
        }).toThrow('Forbidden');

        expect(() => {
            requireRole('ORDER_PORTAL', ['SUPER_ADMIN', 'HEAD_OFFICE']);
        }).toThrow('Forbidden');
    });

    it('should throw error with 403 status code', () => {
        try {
            requireRole('EMPLOYEE', ['SUPER_ADMIN']);
            fail('Should have thrown an error');
        } catch (error: any) {
            expect(error.message).toBe('Forbidden');
            expect(error.status).toBe(403);
        }
    });

    it('should handle all valid roles', () => {
        const validRoles: Role[] = ['SUPER_ADMIN', 'HEAD_OFFICE', 'BRANCH_ADMIN', 'ORDER_PORTAL', 'EMPLOYEE'];

        validRoles.forEach(role => {
            expect(() => {
                requireRole(role, [role]);
            }).not.toThrow();
        });
    });

    it('should allow multiple valid roles', () => {
        expect(() => {
            requireRole('HEAD_OFFICE', ['SUPER_ADMIN', 'HEAD_OFFICE', 'BRANCH_ADMIN']);
        }).not.toThrow();
    });
});
