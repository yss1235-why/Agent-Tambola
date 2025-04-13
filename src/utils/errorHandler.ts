// src/utils/errorHandler.ts

/**
 * Handles API errors and returns formatted error messages
 * @param error The error object from a try/catch block
 * @param fallbackMessage Default message to show if error isn't an Error instance
 * @returns Formatted error message string
 */
export function handleApiError(error: unknown, fallbackMessage = 'An error occurred'): string {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  return fallbackMessage;
}

/**
 * Logs detailed error information to console
 * @param error Error object
 * @param context Additional context about where the error occurred
 */
export function logError(error: unknown, context: string): void {
  console.error(`Error in ${context}:`, error);
  
  if (error instanceof Error && error.stack) {
    console.error('Stack trace:', error.stack);
  }
}

/**
 * Handles Firebase specific errors
 * @param error Firebase error object
 * @returns User-friendly error message
 */
export function handleFirebaseError(error: any): string {
  // Firebase errors often have a code property
  if (error && typeof error === 'object' && 'code' in error) {
    const errorCode = error.code as string;
    
    // Map common Firebase error codes to user-friendly messages
    switch (errorCode) {
      case 'auth/user-not-found':
        return 'User account not found. Please check your email or sign up.';
      case 'auth/wrong-password':
        return 'Incorrect password. Please try again.';
      case 'auth/email-already-in-use':
        return 'This email is already registered. Please use a different email or sign in.';
      case 'auth/weak-password':
        return 'Password is too weak. Please use a stronger password.';
      case 'auth/invalid-email':
        return 'Invalid email address format.';
      case 'auth/account-exists-with-different-credential':
        return 'An account already exists with the same email but different sign-in credentials.';
      case 'auth/operation-not-allowed':
        return 'This sign-in operation is not allowed. Please contact support.';
      case 'auth/too-many-requests':
        return 'Too many sign-in attempts. Please try again later.';
      case 'storage/unauthorized':
        return 'You do not have permission to access this resource.';
      case 'storage/quota-exceeded':
        return 'Storage quota exceeded. Please contact support.';
      case 'storage/canceled':
        return 'Operation canceled.';
      case 'database/permission-denied':
        return 'Permission denied. You do not have access to this data.';
      default:
        return `Error: ${errorCode}`;
    }
  }
  
  // If it's a standard error with message
  if (error instanceof Error) {
    return error.message;
  }
  
  // Default fallback
  return 'An error occurred. Please try again later.';
}

export default {
  handleApiError,
  logError,
  handleFirebaseError
};