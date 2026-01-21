/**
 * Unit Tests for Error Handler
 */

import {
    parseError,
    createUserFriendlyError,
    handleError,
    ERROR_MESSAGES,
    ErrorType,
} from '@/lib/error-handler';

describe('Error Handler - parseError', () => {
    describe('Validation Errors', () => {
        it('should parse required field errors', () => {
            const error = new Error('firstName is required');
            const result = parseError(error);

            expect(result.type).toBe('VALIDATION_ERROR');
            expect(result.field).toBe('firstName');
            expect(result.message).toContain('First name');
            expect(result.statusCode).toBe(400);
        });

        it('should parse email validation errors', () => {
            const error = new Error('Invalid email');
            const result = parseError(error);

            expect(result.type).toBe('VALIDATION_ERROR');
            expect(result.field).toBe('email');
            expect(result.message).toBe(ERROR_MESSAGES.INVALID_EMAIL);
        });

        it('should parse password validation errors', () => {
            const error = new Error('password must be at least 6 characters');
            const result = parseError(error);

            expect(result.type).toBe('VALIDATION_ERROR');
            expect(result.field).toBe('password');
            expect(result.message).toBe(ERROR_MESSAGES.INVALID_PASSWORD);
        });
    });

    describe('Duplicate Errors', () => {
        it('should parse duplicate email errors', () => {
            const error = new Error('Email address already exists');
            const result = parseError(error);

            expect(result.type).toBe('DUPLICATE_ERROR');
            expect(result.field).toBe('email');
            expect(result.message).toBe(ERROR_MESSAGES.DUPLICATE_EMAIL);
        });
    });

    describe('Permission Errors', () => {
        it('should parse organization scope errors', () => {
            const error = new Error('organization permissions required');
            const result = parseError(error);

            expect(result.type).toBe('PERMISSION_ERROR');
            expect(result.message).toBe(ERROR_MESSAGES.ORGANIZATION_SCOPE);
            expect(result.statusCode).toBe(403);
        });

        it('should parse general permission errors', () => {
            const error = new Error('unauthorized permission access');
            const result = parseError(error);

            expect(result.type).toBe('PERMISSION_ERROR');
            expect(result.message).toBe(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS);
        });
    });

    describe('Not Found Errors', () => {
        it('should parse not found errors', () => {
            const error = new Error('User not found');
            const result = parseError(error);

            expect(result.type).toBe('NOT_FOUND_ERROR');
            expect(result.message).toBe(ERROR_MESSAGES.USER_NOT_FOUND);
            expect(result.statusCode).toBe(404);
        });
    });

    describe('Network Errors', () => {
        it('should parse timeout errors', () => {
            const error = new Error('Request timed out');
            const result = parseError(error);

            expect(result.type).toBe('NETWORK_ERROR');
            expect(result.message).toBe(ERROR_MESSAGES.REQUEST_TIMEOUT);
            expect(result.statusCode).toBe(408);
        });

        it('should parse network errors', () => {
            const error = new Error('network connection failed');
            const result = parseError(error);

            expect(result.type).toBe('NETWORK_ERROR');
            expect(result.message).toBe(ERROR_MESSAGES.NETWORK_ERROR);
        });
    });

    describe('MFA Errors', () => {
        it('should parse daily limit exceeded errors', () => {
            const error = new Error('Daily OTP request limit exceeded');
            const result = parseError(error);

            expect(result.type).toBe('MFA_ERROR');
            expect(result.message).toBe(ERROR_MESSAGES.DAILY_LIMIT_EXCEEDED);
        });

        it('should parse cooldown errors', () => {
            const error = new Error('Please wait before requesting another OTP');
            const result = parseError(error);

            expect(result.type).toBe('MFA_ERROR');
            expect(result.message).toBe(ERROR_MESSAGES.COOLDOWN_ACTIVE);
        });

        it('should parse invalid OTP errors', () => {
            const error = new Error('Invalid OTP code');
            const result = parseError(error);

            expect(result.type).toBe('MFA_ERROR');
            expect(result.message).toBe(ERROR_MESSAGES.INVALID_OTP);
        });

        it('should parse expired OTP errors', () => {
            const error = new Error('OTP has expired');
            const result = parseError(error);

            expect(result.type).toBe('MFA_ERROR');
            expect(result.message).toBe(ERROR_MESSAGES.OTP_EXPIRED);
        });
    });

    describe('Unknown Errors', () => {
        it('should handle unknown errors gracefully', () => {
            const error = new Error('Some random error');
            const result = parseError(error);

            expect(result.type).toBe('SERVER_ERROR');
            expect(result.message).toBe('Some random error');
            expect(result.statusCode).toBe(500);
        });

        it('should handle null/undefined errors', () => {
            const result1 = parseError(null);
            const result2 = parseError(undefined);

            expect(result1.type).toBe('SERVER_ERROR');
            expect(result2.type).toBe('SERVER_ERROR');
        });
    });
});

describe('Error Handler - createUserFriendlyError', () => {
    it('should create user-friendly error messages', () => {
        const error = new Error('email is required');
        const result = createUserFriendlyError(error);

        expect(result.message).toBeDefined();
        expect(result.type).toBeDefined();
        expect(result.field).toBe('email');
    });

    it('should omit field for non-validation errors', () => {
        const error = new Error('Server crashed');
        const result = createUserFriendlyError(error);

        expect(result.field).toBeUndefined();
    });
});

describe('Error Handler - handleError', () => {
    it('should log error and return user-friendly message', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

        const error = new Error('Database connection failed');
        const result = handleError(error, 'UserService');

        expect(consoleSpy).toHaveBeenCalledWith('Error in UserService:', error);
        expect(result.message).toBeDefined();
        expect(result.type).toBeDefined();

        consoleSpy.mockRestore();
    });
});
