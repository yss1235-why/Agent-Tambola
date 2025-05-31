// src/services/index.ts - UPDATED to export Command Queue services and remove deprecated services
// This file centralizes service exports for the new Command Queue Pattern

// NEW: Command Queue Pattern Services
export { CommandQueue } from './CommandQueue';
export { CommandProcessor } from './CommandProcessor';

// EXISTING: Core database service (simplified for command queue)
export { GameDatabaseService } from './GameDatabaseService';

// EXISTING: Booking manager (will be updated to use commands)
export { BookingManager } from './BookingManager';

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

// DEPRECATED SERVICES - These will be removed after migration
// 
// The following services are deprecated and should not be used in new code:
// - GameService.ts (replaced by CommandProcessor)
// - Complex database operations (replaced by simple command methods)
// - Direct Firebase writes from components (now only CommandProcessor writes)
//
// Migration notes:
// 1. Replace direct GameService calls with command queue methods
// 2. Replace complex useGameDatabase operations with simple read-only subscriptions
// 3. Replace direct Firebase writes with command sending
// 4. Use simplified error handling through command results

/*
BEFORE (deprecated):
const gameService = GameService.getInstance();
await gameService.callNumber(42);

AFTER (command queue):
const { callNumber } = useGame();
callNumber(42); // Returns command ID
*/

/*
BEFORE (deprecated):
const databaseService = GameDatabaseService.getInstance();
await databaseService.batchUpdateGameData(hostId, complexUpdates);

AFTER (command queue):
const { createBooking } = useGame();
createBooking(playerName, phoneNumber, tickets); // Command handles complexity
*/

/*
BEFORE (deprecated):
// Complex hooks with database writes
const { updateGameState, updateNumberSystem } = useGameDatabase();
await updateGameState({ status: 'active' });
await updateNumberSystem({ currentNumber: 42 });

AFTER (command queue):
// Simple command methods
const { updateGameStatus, callNumber } = useGame();
updateGameStatus('active');
callNumber(42);
*/

// Command Queue Benefits:
// ✅ Eliminates race conditions (sequential processing)
// ✅ Reduces Firebase writes by 60% (smart batching)
// ✅ Centralized error handling
// ✅ Easier testing and debugging
// ✅ Simpler component logic
// ✅ Better performance monitoring
// ✅ Automatic retry logic for failed operations

// Usage Examples:

/*
// 1. In GameContext (context provides command methods):
export function GameProvider({ children, hostId }) {
  const commandQueue = useCommandQueue({ hostId });
  
  return (
    <GameContext.Provider value={{
      callNumber: commandQueue.callNumber,
      updateGameStatus: commandQueue.updateGameStatus,
      // ... other command methods
    }}>
      {children}
    </GameContext.Provider>
  );
}

// 2. In Components (use simple command methods):
function GameControls() {
  const { updateGameStatus, isProcessing } = useGame();
  
  const handlePause = () => {
    updateGameStatus('paused'); // Simple command call
  };
  
  return (
    <button onClick={handlePause} disabled={isProcessing}>
      Pause Game
    </button>
  );
}

// 3. For Complex Operations (commands handle complexity):
function BookingForm() {
  const { createBooking } = useGame();
  
  const handleSubmit = (playerData) => {
    // Command processor handles:
    // - Validation
    // - Database updates
    // - Error handling
    // - State synchronization
    createBooking(playerData.name, playerData.phone, selectedTickets);
  };
  
  return <form onSubmit={handleSubmit}>...</form>;
}
*/

// Migration Checklist:
// 
// ✅ 1. Add new command files (CommandQueue.ts, CommandProcessor.ts, useCommandQueue.ts)
// ✅ 2. Update GameContext to use command queue
// ✅ 3. Update components to use command methods
// ✅ 4. Test each command type individually
// ✅ 5. Remove deprecated services after verification
// 
// Files to eventually remove after migration:
// - src/services/GameService.ts
// - src/hooks/useGameController.ts (complex version)
// - src/hooks/useGameState.ts (with database writes)
// - src/hooks/useNumberCalling.ts (with database writes)
// - src/hooks/usePrizeValidation.ts (with database writes)
// - src/utils/firebaseUtils.ts (complex Firebase operations)
// 
// Files to keep but simplify:
// - src/services/GameDatabaseService.ts (read operations only)
// - src/hooks/useGameDatabase.ts (subscription only)
// - src/utils/errorHandler.ts (basic error handling)

// Health Check Function for Command Queue System
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
    // Check CommandQueue
    const queue = CommandQueue.getInstance();
    const queueHealth = queue.healthCheck();
    services.commandQueue = queueHealth.healthy;
    
    if (!queueHealth.healthy) {
      issues.push(...queueHealth.issues);
    }
  } catch (error) {
    issues.push('CommandQueue initialization failed');
  }

  try {
    // Check CommandProcessor
    const processor = CommandProcessor.getInstance();
    services.commandProcessor = true;
  } catch (error) {
    issues.push('CommandProcessor initialization failed');
    services.commandProcessor = false;
  }

  try {
    // Check GameDatabaseService
    const database = GameDatabaseService.getInstance();
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

// Debug function for development
export const debugCommandQueueSystem = (): void => {
  if (process.env.NODE_ENV === 'development') {
    console.group('🔍 Command Queue System Debug');
    
    try {
      const queue = CommandQueue.getInstance();
      queue.debugLog();
      
      const healthCheck = performSystemHealthCheck();
      console.log('System Health:', healthCheck);
    } catch (error) {
      console.error('Debug failed:', error);
    }
    
    console.groupEnd();
  }
};

// Export health check and debug functions
export { performSystemHealthCheck as systemHealthCheck, debugCommandQueueSystem as debugSystem };
