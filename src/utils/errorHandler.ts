// src/utils/errorHandler.ts - Simplified version

/**
 * Handles errors and returns user-friendly messages
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
 * Logs errors to console with context
 */
export function logError(error: unknown, context: string): void {
  console.error(`[${context}]`, error);
  
  if (error instanceof Error && error.stack) {
    console.error('Stack trace:', error.stack);
  }
}

/**
 * Handles Firebase specific errors with user-friendly messages
 */
export function handleFirebaseError(error: any): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const errorCode = error.code as string;
    
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
      case 'auth/too-many-requests':
        return 'Too many sign-in attempts. Please try again later.';
      case 'storage/unauthorized':
        return 'You do not have permission to access this resource.';
      case 'database/permission-denied':
        return 'Permission denied. You do not have access to this data.';
      default:
        return `Firebase error: ${errorCode}`;
    }
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'An error occurred. Please try again later.';
}

export default {
  handleApiError,
  logError,
  handleFirebaseError
};
