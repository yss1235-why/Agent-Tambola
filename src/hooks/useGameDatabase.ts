// src/hooks/useGameDatabase.ts - Updated to use centralized service
import { useCallback, useRef } from 'react';
import { GameDatabaseService } from '../services/GameDatabaseService';
import type { Game } from '../types/game';
import type { DatabaseHookReturn } from '../types/hooks';

interface UseGameDatabaseProps {
  hostId: string;
  onError?: (error: string) => void;
}

export function useGameDatabase({ hostId, onError }: UseGameDatabaseProps): DatabaseHookReturn {
  const databaseService = useRef(GameDatabaseService.getInstance());
  
  const updateGameState = useCallback(async (updates: Partial<Game.GameState>) => {
    if (!hostId) {
      onError?.('Host ID not available');
      return;
    }
    
    try {
      await databaseService.current.updateGameState(hostId, updates);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update game state';
      onError?.(message);
      throw error;
    }
  }, [hostId, onError]);

  const updateNumberSystem = useCallback(async (updates: Partial<Game.NumberSystem>) => {
    if (!hostId) {
      onError?.('Host ID not available');
      return;
    }
    
    try {
      await databaseService.current.updateNumberSystem(hostId, updates);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update number system';
      onError?.(message);
      throw error;
    }
  }, [hostId, onError]);

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

  const saveGameToHistory = useCallback(async (game: Game.CurrentGame) => {
    if (!hostId) {
      onError?.('Host ID not available');
      return;
    }
    
    try {
      await databaseService.current.saveGameToHistory(hostId, game);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save game to history';
      onError?.(message);
      throw error;
    }
  }, [hostId, onError]);

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
    updateGameState,
    updateNumberSystem,
    getGameData,
    saveGameToHistory,
    subscribeToGame
  };
}
