// src/hooks/useGameDatabase.ts - SIMPLIFIED for Command Queue Pattern
// This hook now only handles READING game state - all writes go through CommandQueue

import { useCallback, useRef } from 'react';
import { GameDatabaseService } from '../services/GameDatabaseService';
import type { Game } from '../types/game';

interface UseGameDatabaseProps {
  hostId: string;
  onError?: (error: string) => void;
}

interface DatabaseHookReturn {
  // READ-ONLY operations
  getGameData: () => Promise<Game.CurrentGame | null>;
  subscribeToGame: (callback: (game: Game.CurrentGame | null) => void) => () => void;
  
  // For backward compatibility - these now just read data
  gameState: Game.CurrentGame | null; // This will be managed by the component using this hook
}

export function useGameDatabase({ hostId, onError }: UseGameDatabaseProps): DatabaseHookReturn {
  const databaseService = useRef(GameDatabaseService.getInstance());
  
  /**
   * Get current game data (read-only)
   */
  const getGameData = useCallback(async (): Promise<Game.CurrentGame | null> => {
    if (!hostId) {
      onError?.('Host ID not available');
      return null;
    }
    
    try {
      return await databaseService.current.getCurrentGame(hostId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get game data';
      onError?.(message);
      return null;
    }
  }, [hostId, onError]);

  /**
   * Subscribe to game state changes (read-only)
   */
  const subscribeToGame = useCallback((callback: (game: Game.CurrentGame | null) => void) => {
    if (!hostId) {
      onError?.('Host ID not available');
      return () => {};
    }
    
    return databaseService.current.subscribeToCurrentGame(hostId, (game, error) => {
      if (error) {
        onError?.(error);
        callback(null);
      } else {
        callback(game);
      }
    });
  }, [hostId, onError]);

  return {
    getGameData,
    subscribeToGame,
    gameState: null // This should be managed by the component using this hook
  };
}

// DEPRECATED FUNCTIONS - These have been moved to CommandQueue system
// 
// The following functions have been removed because all database writes
// now go through the CommandQueue system:
//
// ❌ updateGameState() - Use updateGameStatus() command instead
// ❌ updateNumberSystem() - Use callNumber() command instead  
// ❌ saveGameToHistory() - Handled automatically by CompleteGame command
// ❌ Complex batch operations - Use specific commands instead
//
// Migration examples:
//
// BEFORE:
// const { updateGameState } = useGameDatabase();
// await updateGameState({ status: 'active', isAutoCalling: true });
//
// AFTER:
// const { updateGameStatus } = useGame();
// updateGameStatus('active', true);
//
// BEFORE:
// const { updateNumberSystem } = useGameDatabase();
// await updateNumberSystem({ currentNumber: 42, calledNumbers: [...prev, 42] });
//
// AFTER:
// const { callNumber } = useGame();
// callNumber(42);

/**
 * Legacy hook for backward compatibility
 * @deprecated Use useGame() context instead for command operations
 */
export function useGameDatabaseLegacy({ hostId, onError }: UseGameDatabaseProps) {
  console.warn('useGameDatabaseLegacy is deprecated. Use useGame() context for command operations.');
  
  const { getGameData, subscribeToGame } = useGameDatabase({ hostId, onError });
  
  // Provide deprecated methods that log warnings
  const deprecatedUpdateGameState = () => {
    throw new Error('updateGameState is deprecated. Use updateGameStatus() command from useGame() instead.');
  };
  
  const deprecatedUpdateNumberSystem = () => {
    throw new Error('updateNumberSystem is deprecated. Use callNumber() command from useGame() instead.');
  };
  
  const deprecatedSaveGameToHistory = () => {
    throw new Error('saveGameToHistory is deprecated. Use completeGame() command from useGame() instead.');
  };

  return {
    getGameData,
    subscribeToGame,
    gameState: null,
    // Deprecated methods that throw errors to help with migration
    updateGameState: deprecatedUpdateGameState,
    updateNumberSystem: deprecatedUpdateNumberSystem,
    saveGameToHistory: deprecatedSaveGameToHistory
  };
}

/**
 * Simple hook for reading game data only
 */
export function useGameDataReader(hostId: string) {
  const { getGameData, subscribeToGame } = useGameDatabase({ 
    hostId,
    onError: (error) => console.error('Game data reader error:', error)
  });
  
  return {
    getGameData,
    subscribeToGame
  };
}

/**
 * Hook for monitoring game state changes
 */
export function useGameStateMonitor(hostId: string, onStateChange?: (game: Game.CurrentGame | null) => void) {
  const { subscribeToGame } = useGameDatabase({
    hostId,
    onError: (error) => console.error('Game state monitor error:', error)
  });
  
  const startMonitoring = useCallback(() => {
    return subscribeToGame((game) => {
      console.log('🔍 Game state changed:', {
        phase: game?.gameState?.phase,
        status: game?.gameState?.status,
        calledNumbers: game?.numberSystem?.calledNumbers?.length || 0,
        activeBookings: Object.keys(game?.activeTickets?.bookings || {}).length
      });
      
      onStateChange?.(game);
    });
  }, [subscribeToGame, onStateChange]);
  
  return {
    startMonitoring
  };
}
