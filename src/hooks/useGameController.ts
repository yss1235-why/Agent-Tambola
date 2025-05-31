// src/hooks/useGameController.ts - Fixed auto-calling issue
import { useState, useCallback, useEffect, useRef } from 'react';
import { useGameDatabase } from './useGameDatabase';
import { useNumberCalling } from './useNumberCalling';
import { useGameState } from './useGameState';
import { useGameAudio } from './useGameAudio';
import { validateAllPrizes, ValidationContext, PrizeValidationResult } from '../utils/prizeValidation';
import type { GameHookCallbacks, GameControllerState } from '../types/hooks';
import type { Game } from '../types/game';

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

  // Refs to track the latest state for number calling
  const gameStateRef = useRef<Game.CurrentGame | null>(null);
  const isActiveRef = useRef(false);

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

  // Update refs when state changes
  useEffect(() => {
    gameStateRef.current = gameState;
    isActiveRef.current = !isPaused && !isGameEnded && !allPrizesWon;
    
    console.log('🎮 Game Controller State Update:', {
      isPaused,
      isGameEnded,
      allPrizesWon,
      status: gameState?.gameState?.status,
      isAutoCalling: gameState?.gameState?.isAutoCalling,
      isActiveRef: isActiveRef.current
    });
  }, [gameState, isPaused, isGameEnded, allPrizesWon]);

  // Initialize audio hook
  const audio = useGameAudio({
    gameState,
    onError
  });

  // Simplified prize validation function
  const validatePrizesForCurrentState = useCallback(async (newCalledNumbers: number[]): Promise<void> => {
    if (!gameState || isGameEnded || allPrizesWon) {
      return;
    }

    const context: ValidationContext = {
      tickets: gameState.activeTickets?.tickets || {},
      bookings: gameState.activeTickets?.bookings || {},
      calledNumbers: newCalledNumbers,
      currentWinners: gameState.gameState?.winners || {
        quickFive: [],
        topLine: [],
        middleLine: [],
        bottomLine: [],
        corners: [],
        starCorners: [],
        halfSheet: [],
        fullSheet: [],
        fullHouse: [],
        secondFullHouse: []
      },
      activePrizes: gameState.settings?.prizes || {}
    };

    // Only validate if there are booked tickets and active prizes
    const hasBookedTickets = Object.keys(context.bookings).length > 0;
    const hasActivePrizes = Object.values(context.activePrizes).some(isActive => isActive);

    if (!hasBookedTickets || !hasActivePrizes) {
      return;
    }

    try {
      const validationResults = validateAllPrizes(context);
      
      if (validationResults.length > 0) {
        // Process each winning result
        const winnersUpdate: Partial<Game.Winners> = {};
        let hasNewWinners = false;

        for (const result of validationResults) {
          if (result.isWinner && result.winningTickets.length > 0) {
            const existingWinners = context.currentWinners[result.prizeType] || [];
            
            // Add new winners to existing list
            winnersUpdate[result.prizeType] = [
              ...existingWinners,
              ...result.winningTickets
            ];
            
            hasNewWinners = true;
            
            // Play prize win sound
            await audio.playPrizeWinSound(result.prizeType);
            
            // Trigger callback with winner information
            onPrizeWon?.(result.prizeType, result.winningTickets);
            
            console.log(`🏆 Prize won: ${result.prizeType} by tickets ${result.winningTickets.join(', ')}`);
          }
        }

        // Update database with new winners
        if (hasNewWinners) {
          await database.updateGameState({
            winners: {
              ...context.currentWinners,
              ...winnersUpdate
            }
          });

          // Check if all active prizes have been won
          const updatedWinners = { ...context.currentWinners, ...winnersUpdate };
          const allActivePrizesWon = Object.entries(context.activePrizes)
            .filter(([_, isActive]) => isActive)
            .every(([prizeType]) => {
              const winners = updatedWinners[prizeType as keyof Game.Winners];
              return winners && winners.length > 0;
            });

          if (allActivePrizesWon) {
            await database.updateGameState({
              allPrizesWon: true,
              isAutoCalling: false,
              status: 'ended',
              phase: 4
            });
            console.log('🎉 All prizes won! Game completed.');
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Prize validation failed';
      console.error('Prize validation error:', error);
      onError?.(message);
    }
  }, [gameState, isGameEnded, allPrizesWon, database, audio, onPrizeWon, onError]);

  // Initialize number calling hook with prize validation
  const numberCalling = useNumberCalling({
    calledNumbers,
    isPaused,
    isGameEnded,
    allPrizesWon,
    onNumberGenerated: useCallback(async (number: number) => {
      console.log(`🎲 Generating number: ${number}`);
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
        
        // Announce number
        await audio.announceNumber(number);
        
        // Validate prizes with new called numbers
        await validatePrizesForCurrentState(newCalledNumbers);
        
        // Check if all numbers have been called
        if (newCalledNumbers.length >= 90) {
          await completeGame();
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to process number';
        onError?.(message);
      } finally {
        setIsProcessing(false);
      }
    }, [calledNumbers, database, onNumberCalled, audio, validatePrizesForCurrentState, completeGame, onError]),
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
    console.log('🛑 Pausing game and clearing schedule');
    numberCalling.clearSchedule();
    await pauseGame();
  }, [numberCalling, pauseGame]);

  const handleResumeGame = useCallback(async () => {
    console.log('▶️ Resuming game...');
    
    try {
      await resumeGame();
      
      // Wait a bit for the state to update, then start number calling
      setTimeout(() => {
        if (!allPrizesWon && !isGameEnded) {
          console.log('🚀 Starting number calling after resume');
          numberCalling.scheduleNext();
        } else {
          console.log('❌ Cannot start calling - game ended or all prizes won', {
            allPrizesWon,
            isGameEnded
          });
        }
      }, 100);
      
    } catch (error) {
      console.error('Failed to resume game:', error);
      onError?.('Failed to resume game');
    }
  }, [resumeGame, numberCalling, allPrizesWon, isGameEnded, onError]);

  const handleCompleteGame = useCallback(async () => {
    console.log('🏁 Completing game and clearing schedule');
    numberCalling.clearSchedule();
    await completeGame();
  }, [numberCalling, completeGame]);

  const setCallDelay = useCallback(async (delay: number) => {
    console.log(`⏱️ Setting call delay to ${delay} seconds`);
    // Update number calling hook
    numberCalling.setDelay(delay);
    
    // Update database
    await database.updateNumberSystem({ callDelay: delay });
  }, [numberCalling, database]);

  // Enhanced auto-start logic with better state tracking
  useEffect(() => {
    const shouldStart = !isPaused && !isGameEnded && !allPrizesWon && !isProcessing;
    const hasCalledNumbers = calledNumbers.length > 0;
    const isStatusActive = gameState?.gameState?.status === 'active';
    
    console.log('🔄 Auto-start check:', {
      shouldStart,
      isPaused,
      isGameEnded,
      allPrizesWon,
      isProcessing,
      hasCalledNumbers,
      isStatusActive,
      gameStatus: gameState?.gameState?.status,
      isAutoCalling: gameState?.gameState?.isAutoCalling
    });

    if (shouldStart && isStatusActive) {
      // Start number calling immediately when conditions are met
      console.log('🎯 Conditions met - starting number calling');
      
      // Small delay to ensure state is properly updated
      const timer = setTimeout(() => {
        if (isActiveRef.current && !isProcessing) {
          console.log('🎲 Actually starting number generation');
          numberCalling.scheduleNext();
        }
      }, 200);
      
      return () => clearTimeout(timer);
    }
  }, [isPaused, isGameEnded, allPrizesWon, isProcessing, gameState?.gameState?.status, 
      gameState?.gameState?.isAutoCalling, numberCalling]);

  // Manual prize validation trigger (for debugging or manual checks)
  const triggerPrizeValidation = useCallback(async () => {
    if (calledNumbers.length > 0) {
      await validatePrizesForCurrentState(calledNumbers);
    }
  }, [calledNumbers, validatePrizesForCurrentState]);

  // Manual number generation for testing
  const generateAndCallNumber = useCallback(async (): Promise<number | null> => {
    if (isProcessing || isPaused || isGameEnded || allPrizesWon) {
      console.log('Cannot generate number - invalid state:', {
        isProcessing,
        isPaused,
        isGameEnded,
        allPrizesWon
      });
      return null;
    }

    console.log('🎲 Manual number generation triggered');
    return await numberCalling.generateNumber();
  }, [numberCalling, isProcessing, isPaused, isGameEnded, allPrizesWon]);

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
    generateAndCallNumber,
    setCallDelay,
    triggerPrizeValidation, // New method for manual validation
    
    // Audio controls
    setSoundEnabled: audio.setEnabled,
    setVolume: audio.setVolume,
    
    // Utility
    resetError
  };
}
