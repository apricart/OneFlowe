/**
 * Centralized error handling utilities for consistent error responses
 */

export type ErrorType =
  | 'VALIDATION_ERROR'
  | 'PERMISSION_ERROR'
  | 'NOT_FOUND_ERROR'
  | 'DUPLICATE_ERROR'
  | 'NETWORK_ERROR'
  | 'SERVER_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'MFA_ERROR'

export interface ErrorDetails {
  type: ErrorType
  message: string
  field?: string
  code?: string
  statusCode: number
}

/**
 * Standard error messages for common scenarios
 */
export const ERROR_MESSAGES = {
  // Validation errors
  REQUIRED_FIELD: (field: string) => `${field} is required`,
  INVALID_EMAIL: 'Please enter a valid email address',
  INVALID_PASSWORD: 'Password must be at least 6 characters long',
  INVALID_ROLE: 'Please select a valid role',

  // Permission errors
  ORGANIZATION_SCOPE: 'You can only manage users within your own organization',
  BRANCH_SCOPE: 'You can only manage users within your own branch',
  INSUFFICIENT_PERMISSIONS: 'You don\'t have permission to perform this action',

  // Duplicate errors
  DUPLICATE_EMAIL: 'This email address is already registered. Please use a different email',

  // Not found errors
  USER_NOT_FOUND: 'User not found. It may have been deleted by another user',
  ORGANIZATION_NOT_FOUND: 'Organization not found',
  BRANCH_NOT_FOUND: 'Branch not found',

  // Network errors
  REQUEST_TIMEOUT: 'Request timed out. Please check your connection and try again',
  NETWORK_ERROR: 'Network error. Please check your connection and try again',

  // Server errors
  UNABLE_TO_VERIFY_PERMISSIONS: 'Unable to verify permissions',
  DATABASE_ERROR: 'Database error. Please try again',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again',

  // MFA errors
  DAILY_LIMIT_EXCEEDED: 'Daily OTP request limit exceeded. Please try again tomorrow.',
  COOLDOWN_ACTIVE: 'Please wait before requesting another OTP.',
  INVALID_OTP: 'Invalid OTP code. Please try again.',
  OTP_EXPIRED: 'OTP has expired. Please request a new one.'
} as const

/**
 * Parse error message to determine error type and details
 */
export function parseError(error: any): ErrorDetails {
  const errorMsg = error?.message || error?.toString() || ''

  // Validation errors
  if (errorMsg.includes('required')) {
    if (errorMsg.includes('firstName')) {
      return {
        type: 'VALIDATION_ERROR',
        message: ERROR_MESSAGES.REQUIRED_FIELD('First name'),
        field: 'firstName',
        statusCode: 400
      }
    }
    if (errorMsg.includes('lastName')) {
      return {
        type: 'VALIDATION_ERROR',
        message: ERROR_MESSAGES.REQUIRED_FIELD('Last name'),
        field: 'lastName',
        statusCode: 400
      }
    }
    if (errorMsg.includes('email')) {
      return {
        type: 'VALIDATION_ERROR',
        message: ERROR_MESSAGES.REQUIRED_FIELD('Email'),
        field: 'email',
        statusCode: 400
      }
    }
    if (errorMsg.includes('password')) {
      return {
        type: 'VALIDATION_ERROR',
        message: ERROR_MESSAGES.REQUIRED_FIELD('Password'),
        field: 'password',
        statusCode: 400
      }
    }
    if (errorMsg.includes('role')) {
      return {
        type: 'VALIDATION_ERROR',
        message: ERROR_MESSAGES.REQUIRED_FIELD('Role'),
        field: 'role',
        statusCode: 400
      }
    }
    if (errorMsg.includes('organizationId')) {
      return {
        type: 'VALIDATION_ERROR',
        message: ERROR_MESSAGES.REQUIRED_FIELD('Organization'),
        field: 'organizationId',
        statusCode: 400
      }
    }
    if (errorMsg.includes('branchId')) {
      return {
        type: 'VALIDATION_ERROR',
        message: ERROR_MESSAGES.REQUIRED_FIELD('Branch'),
        field: 'branchId',
        statusCode: 400
      }
    }
  }

  // Duplicate errors
  if (errorMsg.includes('Email address already exists') || errorMsg.includes('email') || errorMsg.includes('already exists')) {
    if (errorMsg.includes('email')) {
      return {
        type: 'DUPLICATE_ERROR',
        message: ERROR_MESSAGES.DUPLICATE_EMAIL,
        field: 'email',
        statusCode: 400
      }
    }
  }


  // Permission errors
  if (errorMsg.includes('organization')) {
    return {
      type: 'PERMISSION_ERROR',
      message: ERROR_MESSAGES.ORGANIZATION_SCOPE,
      statusCode: 403
    }
  }

  if (errorMsg.includes('permission') || errorMsg.includes('unauthorized')) {
    return {
      type: 'PERMISSION_ERROR',
      message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
      statusCode: 403
    }
  }

  // Not found errors
  if (errorMsg.includes('not found') || errorMsg.includes('404')) {
    return {
      type: 'NOT_FOUND_ERROR',
      message: ERROR_MESSAGES.USER_NOT_FOUND,
      statusCode: 404
    }
  }

  // Network errors
  if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
    return {
      type: 'NETWORK_ERROR',
      message: ERROR_MESSAGES.REQUEST_TIMEOUT,
      statusCode: 408
    }
  }

  if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
    return {
      type: 'NETWORK_ERROR',
      message: ERROR_MESSAGES.NETWORK_ERROR,
      statusCode: 503
    }
  }

  // Invalid format errors
  if (errorMsg.includes('Invalid')) {
    if (errorMsg.includes('email')) {
      return {
        type: 'VALIDATION_ERROR',
        message: ERROR_MESSAGES.INVALID_EMAIL,
        field: 'email',
        statusCode: 400
      }
    }
    if (errorMsg.includes('role')) {
      return {
        type: 'VALIDATION_ERROR',
        message: ERROR_MESSAGES.INVALID_ROLE,
        field: 'role',
        statusCode: 400
      }
    }
  }

  if (errorMsg.includes('password')) {
    return {
      type: 'VALIDATION_ERROR',
      message: ERROR_MESSAGES.INVALID_PASSWORD,
      field: 'password',
      statusCode: 400
    }
  }

  // MFA errors
  if (errorMsg.includes('Daily OTP request limit exceeded') || errorMsg.includes('daily limit')) {
    return {
      type: 'MFA_ERROR',
      message: ERROR_MESSAGES.DAILY_LIMIT_EXCEEDED,
      statusCode: 400
    }
  }

  if (errorMsg.includes('cooldown') || errorMsg.includes('wait before requesting')) {
    return {
      type: 'MFA_ERROR',
      message: ERROR_MESSAGES.COOLDOWN_ACTIVE,
      statusCode: 400
    }
  }

  if (errorMsg.includes('Invalid OTP') || errorMsg.includes('invalid code')) {
    return {
      type: 'MFA_ERROR',
      message: ERROR_MESSAGES.INVALID_OTP,
      statusCode: 400
    }
  }

  if (errorMsg.includes('expired') || errorMsg.includes('OTP has expired')) {
    return {
      type: 'MFA_ERROR',
      message: ERROR_MESSAGES.OTP_EXPIRED,
      statusCode: 400
    }
  }

  // Default server error - NEVER expose raw error messages to users
  // Log the actual error for debugging but return generic message
  if (process.env.NODE_ENV !== 'production') {
    console.error('Unhandled error:', errorMsg)
  }
  return {
    type: 'SERVER_ERROR',
    message: ERROR_MESSAGES.UNKNOWN_ERROR,
    statusCode: 500
  }
}

/**
 * Create a user-friendly error message for frontend display
 */
export function createUserFriendlyError(error: any): { message: string; field?: string; type: ErrorType } {
  const errorDetails = parseError(error)
  return {
    message: errorDetails.message,
    field: errorDetails.field,
    type: errorDetails.type
  }
}

/**
 * Log error for debugging while returning user-friendly message
 */
export function handleError(error: any, context: string): { message: string; field?: string; type: ErrorType } {
  console.error(`Error in ${context}:`, error)
  return createUserFriendlyError(error)
}
