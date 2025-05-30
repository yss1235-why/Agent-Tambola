// src/hooks/useGameController.ts
import { useState, useCallback, useEffect } from 'react';
import { useGameDatabase } from './useGameDatabase';
import { useNumberCalling } from './useNumberCalling';
import { useGameState } from './useGameState';
import { useGameAudio } from './useGameAudio';
import { usePrizeValidation } from './usePrizeValidation';
import type { GameHookCallbacks, GameControllerState } from '../types/hooks';

interface UseGameControllerProps extends GameHookCallbacks {
  hostId: string;
}

export function useGameController({
  hostId,
  onNumberCalled,
  onPrizeWon,
  onQueueChanged,
  onGameComplete,
  onError
}: UseGameControllerProps) {
  // Local state
  const [isProcessing, setIsProcessing] = useState(false);
  const [queueNumbers, setQueueNumbers] = useState<number[]>([]);
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);

  // Initialize database hook
  const database = useGameDatabase({
    hostId,
    onError
  });

  // Initialize game state hook
  const {
    pauseGame,
    resumeGame,
    completeGame,
    resetError,
    gameState,
    isGameEnded,
    allPrizesWon,
    error
  } = useGameState({
    hostId,
    database,
    onGameComplete,
    onError
  });

  // Get derived state for other hooks
  const isPaused = gameState?.gameState?.status === 'paused' || !gameState?.gameState?.isAutoCalling;

  // Initialize number calling hook
  const numberCalling = useNumberCalling({
    calledNumbers,
    isPaused,
    isGameEnded,
    allPrizesWon,
    onNumberGenerated: useCallback(async (number: number) => {
      setIsProcessing(true);
      try {
        // Update database with new number
        const newCalledNumbers = [...calledNumbers, number];
        await database.updateNumberSystem({
          currentNumber: number,
          calledNumbers: newCalledNumbers
        });

        // Update local state
        setCurrentNumber(number);
        setCalledNumbers(newCalledNumbers);
        
        // Trigger callbacks
        onNumberCalled?.(number);
        
        // Validate prizes after number is called
        await prizeValidation.validatePrizes(newCalledNumbers);
        
        // Announce number
        await audio.announceNumber(number);
        
        // Check if game should end (all numbers called)
        if (newCalledNumbers.length >= 90) {
          await completeGame();
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to process number';
        onError?.(message);
      } finally {
        setIsProcessing(false);
      }
    }, [calledNumbers, database, onNumberCalled, completeGame, onError]),
    onError
  });

  // Initialize audio hook
  const audio = useGameAudio({
    gameState,
    onError
  });

  // Initialize prize validation hook
  const prizeValidation = usePrizeValidation({
    hostId,
    gameState,
    onPrizeWon: useCallback(async (prizeType, ticketIds) => {
      // Play prize win sound
      await audio.playPrizeWinSound(prizeType);
      
      // Trigger callback
      onPrizeWon?.(prizeType, ticketIds);
    }, [audio, onPrizeWon]),
    onError
  });

  // Sync local state with game state
  useEffect(() => {
    if (gameState) {
      setCalledNumbers(gameState.numberSystem?.calledNumbers || []);
      setQueueNumbers(gameState.numberSystem?.queue || []);
      setCurrentNumber(gameState.numberSystem?.currentNumber || null);
      
      // Notify about queue changes
      onQueueChanged?.(gameState.numberSystem?.queue || []);
    }
  }, [gameState, onQueueChanged]);

  // Game control functions with coordination
  const handlePauseGame = useCallback(async () => {
    numberCalling.clearSchedule();
    await pauseGame();
  }, [numberCalling, pauseGame]);

  const handleResumeGame = useCallback(async () => {
    await resumeGame();
    // Start number calling after successful resume
    if (!allPrizesWon && !isGameEnded) {
      numberCalling.scheduleNext();
    }
  }, [resumeGame, numberCalling, allPrizesWon, isGameEnded]);

  const handleCompleteGame = useCallback(async () => {
    numberCalling.clearSchedule();
    await completeGame();
  }, [numberCalling, completeGame]);

  const setCallDelay = useCallback(async (delay: number) => {
    // Update number calling hook
    numberCalling.setDelay(delay);
    
    // Update database
    await database.updateNumberSystem({ callDelay: delay });
  }, [numberCalling, database]);

  // Auto-start number generation when game becomes active
  useEffect(() => {
    if (!isPaused && !isGameEnded && !allPrizesWon && !isProcessing) {
      // Only start if we haven't started yet, or if explicitly resumed
      const shouldStart = calledNumbers.length === 0 || 
                         gameState?.gameState?.status === 'active';
      
      if (shouldStart) {
        numberCalling.scheduleNext();
      }
    }
  }, [isPaused, isGameEnded, allPrizesWon, isProcessing, calledNumbers.length, 
      gameState?.gameState?.status, numberCalling]);

  // Return simplified interface
  return {
    // State
    isProcessing,
    isPaused,
    queueNumbers,
    calledNumbers,
    currentNumber,
    gameState,
    error,
    allPrizesWon,
    isGameEnded,
    
    // Actions
    pauseGame: handlePauseGame,
    resumeGame: handleResumeGame,
    completeGame: handleCompleteGame,
    generateAndCallNumber: numberCalling.generateNumber,
    setCallDelay,
    
    // Audio controls
    setSoundEnabled: audio.setEnabled,
    setVolume: audio.setVolume,
    
    // Utility
    resetError
  };
}
