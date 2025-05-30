// src/hooks/useGameState.ts
import { useState, useCallback, useEffect } from 'react';
import type { Game } from '../types/game';
import type { GameStateHookReturn, DatabaseHookReturn } from '../types/hooks';

interface UseGameStateProps {
  hostId: string;
  database: DatabaseHookReturn;
  onGameComplete?: () => void;
  onError?: (error: string) => void;
}

export function useGameState({
  hostId,
  database,
  onGameComplete,
  onError
}: UseGameStateProps): GameStateHookReturn {
  const [gameState, setGameState] = useState<Game.CurrentGame | null>(null);
  const [isGameEnded, setIsGameEnded] = useState(false);
  const [allPrizesWon, setAllPrizesWon] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to game data changes
  useEffect(() => {
    const unsubscribe = database.subscribeToGame((game) => {
      if (game) {
        setGameState(game);
        setIsGameEnded(game.gameState?.status === 'ended' || game.gameState?.phase === 4);
        setAllPrizesWon(game.gameState?.allPrizesWon || false);
        
        // Trigger completion callback if game ended
        if ((game.gameState?.allPrizesWon || game.gameState?.status === 'ended') && onGameComplete) {
          onGameComplete();
        }
      } else {
        setGameState(null);
        setIsGameEnded(false);
        setAllPrizesWon(false);
      }
    });

    return unsubscribe;
  }, [database, onGameComplete]);

  const pauseGame = useCallback(async () => {
    if (!hostId || !gameState) {
      const errorMsg = 'Cannot pause game: Game state not available';
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    try {
      await database.updateGameState({
        status: 'paused',
        isAutoCalling: false
      });
      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to pause game';
      setError(errorMsg);
      onError?.(errorMsg);
      throw err;
    }
  }, [hostId, gameState, database, onError]);

  const resumeGame = useCallback(async () => {
    if (!hostId || !gameState) {
      const errorMsg = 'Cannot resume game: Game state not available';
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    if (allPrizesWon) {
      const errorMsg = 'Cannot resume game: All prizes have been won';
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    if (isGameEnded) {
      const errorMsg = 'Cannot resume game: Game has ended';
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    try {
      await database.updateGameState({
        status: 'active',
        isAutoCalling: true
      });
      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to resume game';
      setError(errorMsg);
      onError?.(errorMsg);
      throw err;
    }
  }, [hostId, gameState, allPrizesWon, isGameEnded, database, onError]);

  const completeGame = useCallback(async () => {
    if (!hostId || !gameState) {
      const errorMsg = 'Cannot complete game: Game state not available';
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    try {
      // Update game state to completed
      await database.updateGameState({
        phase: 4,
        status: 'ended',
        isAutoCalling: false
      });

      // Save to history
      await database.saveGameToHistory(gameState);

      setIsGameEnded(true);
      setError(null);
      
      if (onGameComplete) {
        onGameComplete();
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to complete game';
      setError(errorMsg);
      onError?.(errorMsg);
      throw err;
    }
  }, [hostId, gameState, database, onGameComplete, onError]);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  return {
    pauseGame,
    resumeGame,
    completeGame,
    resetError,
    gameState,
    isGameEnded,
    allPrizesWon,
    error
  };
}
