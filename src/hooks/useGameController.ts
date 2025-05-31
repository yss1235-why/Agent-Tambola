// src/hooks/useGameController.ts - FIXED and DEPRECATED
// This hook is deprecated in favor of the Command Queue Pattern
// Only kept for backward compatibility - use useGame() from GameContext instead

import { useState, useCallback, useEffect, useRef } from 'react';
import { validateAllPrizes, ValidationContext, formatMultiplePrizes } from '../utils/prizeValidation';
import type { Game } from '../types/game';

// DEPRECATED: This interface is replaced by the simplified command methods in GameContext
interface PrizeWinResult {
  playerId: string;
  playerName: string;
  phoneNumber: string;
  ticketId: string;
  prizeTypes: string[]; // Multiple prizes
}

interface GameHookCallbacks {
  onNumberCalled?: (number: number) => void;
  onPrizeWon?: (result: PrizeWinResult) => void;
  onQueueChanged?: (queue: number[]) => void;
  onGameComplete?: () => void;
  onError?: (error: string) => void;
}

interface UseGameControllerProps extends GameHookCallbacks {
  hostId: string;
}

/**
 * @deprecated This hook is deprecated in favor of the Command Queue Pattern.
 * Use useGame() from GameContext instead, which provides simple command methods.
 * 
 * Migration:
 * 
 * OLD: const { pauseGame, resumeGame } = useGameController({ hostId });
 * NEW: const { updateGameStatus } = useGame();
 *      updateGameStatus('paused'); // or 'active'
 * 
 * OLD: const { generateAndCallNumber } = useGameController({ hostId });
 * NEW: const { callNumber } = useGame();
 *      callNumber(42);
 */
export function useGameController({
  hostId,
  onNumberCalled,
  onPrizeWon,
  onQueueChanged,
  onGameComplete,
  onError
}: UseGameControllerProps) {
  // DEPRECATED: This implementation is kept only for backward compatibility
  console.warn('⚠️ useGameController is deprecated. Use useGame() from GameContext instead.');
  
  // Simplified state for compatibility
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [queueNumbers, setQueueNumbers] = useState<number[]>([]);
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [gameState, setGameState] = useState<Game.CurrentGame | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [allPrizesWon, setAllPrizesWon] = useState(false);
  const [isGameEnded, setIsGameEnded] = useState(false);

  // Deprecated methods - these should be replaced with command queue calls
  const pauseGame = useCallback(async () => {
    console.warn('⚠️ pauseGame is deprecated. Use updateGameStatus("paused") from useGame() instead.');
    onError?.('This method is deprecated. Please use the new command system.');
  }, [onError]);

  const resumeGame = useCallback(async () => {
    console.warn('⚠️ resumeGame is deprecated. Use updateGameStatus("active") from useGame() instead.');
    onError?.('This method is deprecated. Please use the new command system.');
  }, [onError]);

  const completeGame = useCallback(async () => {
    console.warn('⚠️ completeGame is deprecated. Use completeGame() from useGame() instead.');
    onError?.('This method is deprecated. Please use the new command system.');
  }, [onError]);

  const generateAndCallNumber = useCallback(async (): Promise<number | null> => {
    console.warn('⚠️ generateAndCallNumber is deprecated. Use callNumber(number) from useGame() instead.');
    onError?.('This method is deprecated. Please use the new command system.');
    return null;
  }, [onError]);

  const setCallDelay = useCallback(async (delay: number) => {
    console.warn('⚠️ setCallDelay is deprecated. Use updateCallDelay(delay) from useGame() instead.');
    onError?.('This method is deprecated. Please use the new command system.');
  }, [onError]);

  const triggerPrizeValidation = useCallback(async () => {
    console.warn('⚠️ triggerPrizeValidation is deprecated. Prize validation is now automatic.');
    onError?.('This method is deprecated. Prize validation is now automatic.');
  }, [onError]);

  const setSoundEnabled = useCallback((enabled: boolean) => {
    console.warn('⚠️ setSoundEnabled is deprecated. Use updateSoundSettings(enabled) from useGame() instead.');
    onError?.('This method is deprecated. Please use the new command system.');
  }, [onError]);

  const setVolume = useCallback((volume: number) => {
    console.warn('⚠️ setVolume is deprecated. Audio controls are handled automatically.');
    onError?.('This method is deprecated. Audio controls are handled automatically.');
  }, [onError]);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  // Log deprecation warning on mount
  useEffect(() => {
    console.group('🚨 DEPRECATED HOOK WARNING');
    console.warn('useGameController is deprecated and will be removed in a future version.');
    console.warn('Please migrate to the new Command Queue Pattern:');
    console.warn('');
    console.warn('// OLD:');
    console.warn('const { pauseGame, resumeGame } = useGameController({ hostId });');
    console.warn('');
    console.warn('// NEW:');
    console.warn('const { updateGameStatus } = useGame();');
    console.warn('updateGameStatus("paused"); // or "active"');
    console.warn('');
    console.warn('Benefits of the new system:');
    console.warn('✅ Eliminates race conditions');
    console.warn('✅ Better error handling');
    console.warn('✅ Simpler component logic');
    console.warn('✅ Centralized state management');
    console.groupEnd();
  }, []);

  // Return simplified interface for compatibility
  return {
    // State (read-only compatibility)
    isProcessing,
    isPaused,
    queueNumbers,
    calledNumbers,
    currentNumber,
    gameState,
    error,
    allPrizesWon,
    isGameEnded,
    
    // Deprecated actions (will show warnings)
    pauseGame,
    resumeGame,
    completeGame,
    generateAndCallNumber,
    setCallDelay,
    triggerPrizeValidation,
    
    // Deprecated audio controls
    setSoundEnabled,
    setVolume,
    
    // Utility functions
    resetError
  };
}

// Export migration guide as a comment for developers
export const MIGRATION_GUIDE = `
MIGRATION FROM useGameController TO Command Queue Pattern:

1. Replace useGameController with useGame:
   
   // OLD:
   const controller = useGameController({ hostId, onError });
   
   // NEW:
   const { updateGameStatus, callNumber, error } = useGame();

2. Update method calls:
   
   // OLD:
   controller.pauseGame();
   controller.resumeGame();
   controller.generateAndCallNumber();
   
   // NEW:
   updateGameStatus('paused');
   updateGameStatus('active');
   callNumber(randomNumber);

3. Replace complex state management with simple commands:
   
   // OLD:
   useEffect(() => {
     if (shouldAutoCalling) {
       controller.resumeGame();
     } else {
       controller.pauseGame();
     }
   }, [shouldAutoCalling]);
   
   // NEW:
   const handleToggle = () => {
     updateGameStatus(isActive ? 'paused' : 'active');
   };

4. Error handling is now centralized:
   
   // OLD:
   controller.resetError();
   
   // NEW:
   clearError(); // from useGame()

5. Prize validation is now automatic - no manual triggers needed.

6. Audio controls are handled automatically by the command processor.

For more details, see the Command Queue Pattern documentation.
`;

export default useGameController;
