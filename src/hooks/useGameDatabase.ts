// src/hooks/useGameDatabase.ts
import { useCallback, useRef } from 'react';
import { ref, update, get, onValue, off } from 'firebase/database';
import { database } from '../lib/firebase';
import type { Game } from '../types/game';
import type { DatabaseHookReturn } from '../types/hooks';

interface UseGameDatabaseProps {
  hostId: string;
  onError?: (error: string) => void;
}

export function useGameDatabase({ hostId, onError }: UseGameDatabaseProps): DatabaseHookReturn {
  const gameRef = useRef(ref(database, `hosts/${hostId}/currentGame`));
  
  const updateGameState = useCallback(async (updates: Partial<Game.GameState>) => {
    if (!hostId) {
      onError?.('Host ID not available');
      return;
    }
    
    try {
      await update(ref(database, `hosts/${hostId}/currentGame/gameState`), updates);
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
      await update(ref(database, `hosts/${hostId}/currentGame/numberSystem`), updates);
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
      const snapshot = await get(gameRef.current);
      return snapshot.exists() ? snapshot.val() as Game.CurrentGame : null;
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
      const timestamp = Date.now();
      const historyRef = ref(database, `hosts/${hostId}/sessions/${timestamp}`);
      await update(historyRef, {
        ...game,
        endTime: timestamp,
        endReason: 'Game completed'
      });
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
    
    const unsubscribe = onValue(gameRef.current, (snapshot) => {
      try {
        const gameData = snapshot.exists() ? snapshot.val() as Game.CurrentGame : null;
        callback(gameData);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error processing game data';
        onError?.(message);
        callback(null);
      }
    });
    
    return () => {
      off(gameRef.current, 'value', unsubscribe);
    };
  }, [hostId, onError]);

  return {
    updateGameState,
    updateNumberSystem,
    getGameData,
    saveGameToHistory,
    subscribeToGame
  };
}
