// src/services/index.ts - FIXED import/export issues and proper type safety
// This file centralizes service exports for the new Command Queue Pattern

// Import all services first to ensure they exist
import { CommandQueue as CmdQueue } from './CommandQueue';
import { CommandProcessor as CmdProcessor } from './CommandProcessor';
import { GameDatabaseService as DbService } from './GameDatabaseService';

// NEW: Command Queue Pattern Services - Re-export with explicit names
export { CommandQueue } from './CommandQueue';
export { CommandProcessor } from './CommandProcessor';

// EXISTING: Core database service (simplified for command queue)
export { GameDatabaseService } from './GameDatabaseService';

// UTILITY: Simple export function to replace complex ExportManager
export const exportToCSV = (data: any[], filename: string): void => {
  if (data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',') 
          ? `"${value}"` 
          : value;
      }).join(',')
    )
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// UTILITY: Simple toast notification function
export const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info'): void => {
  console.log(`${type.toUpperCase()}: ${message}`);
  // This could be enhanced to integrate with a toast library
};

// Health Check Function for Command Queue System - FIXED with proper imports
export const performSystemHealthCheck = (): {
  healthy: boolean;
  issues: string[];
  services: {
    commandQueue: boolean;
    commandProcessor: boolean;
    databaseService: boolean;
  };
} => {
  const issues: string[] = [];
  const services = {
    commandQueue: false,
    commandProcessor: false,
    databaseService: false
  };

  try {
    // Check CommandQueue - use imported class
    const queue = CmdQueue.getInstance();
    const queueHealth = queue.healthCheck();
    services.commandQueue = queueHealth.healthy;
    
    if (!queueHealth.healthy) {
      issues.push(...queueHealth.issues);
    }
  } catch (error) {
    issues.push('CommandQueue initialization failed');
  }

  try {
    // Check CommandProcessor - use imported class
    const processor = CmdProcessor.getInstance();
    services.commandProcessor = true;
  } catch (error) {
    issues.push('CommandProcessor initialization failed');
    services.commandProcessor = false;
  }

  try {
    // Check GameDatabaseService - use imported class
    const database = DbService.getInstance();
    services.databaseService = true;
  } catch (error) {
    issues.push('GameDatabaseService initialization failed');
    services.databaseService = false;
  }

  const healthy = issues.length === 0;

  return {
    healthy,
    issues,
    services
  };
};

// Debug function for development - FIXED with proper imports
export const debugCommandQueueSystem = (): void => {
  if (process.env.NODE_ENV === 'development') {
    console.group('🔍 Command Queue System Debug');
    
    try {
      const queue = CmdQueue.getInstance();
      queue.debugLog();
      
      const healthCheck = performSystemHealthCheck();
      console.log('System Health:', healthCheck);
    } catch (error) {
      console.error('Debug failed:', error);
    }
    
    console.groupEnd();
  }
};

// Service factory for getting instances safely - FIXED with proper type checking
export const getServiceInstance = (serviceName: string): any => {
  const validServices = ['CommandQueue', 'CommandProcessor', 'GameDatabaseService'];
  
  if (!validServices.includes(serviceName)) {
    console.error(`❌ Service '${serviceName}' does not exist or has been removed`);
    console.log('Available services:', validServices);
    throw new Error(`Service '${serviceName}' is not available`);
  }
  
  switch (serviceName) {
    case 'CommandQueue':
      return CmdQueue.getInstance();
    case 'CommandProcessor':
      return CmdProcessor.getInstance();
    case 'GameDatabaseService':
      return DbService.getInstance();
    default:
      throw new Error(`Service '${serviceName}' is not available`);
  }
};

// Type guard for ensuring services exist
export const ensureServiceExists = (serviceName: string): boolean => {
  const validServices = ['CommandQueue', 'CommandProcessor', 'GameDatabaseService'];
  
  if (!validServices.includes(serviceName)) {
    console.error(`❌ Service '${serviceName}' does not exist or has been removed`);
    console.log('Available services:', validServices);
    return false;
  }
  
  return true;
};

// Export health check and debug functions with fixed names
export { performSystemHealthCheck as systemHealthCheck, debugCommandQueueSystem as debugSystem };


// Replace BookingManager functionality
export const createBookingViaCommand = (
  hostId: string, 
  playerName: string, 
  phoneNumber: string, 
  tickets: string[]
): string => {
  console.warn('⚠️ Use createBooking() from useGame() context instead');
  throw new Error('BookingManager has been removed. Use createBooking() from useGame() context.');
};

// Replace GameService functionality  
export const gameServiceReplacement = (): void => {
  console.warn('⚠️ GameService has been removed. Use command methods from useGame() context instead');
  throw new Error('GameService has been removed. Use command methods from useGame() context.');
};

// Replace ExportManager functionality - simplified export is provided above
export const exportManagerReplacement = (): void => {
  console.warn('⚠️ ExportManager has been removed. Use exportToCSV() function instead');
  console.log('Use exportToCSV(data, filename) for simple CSV exports');
};
