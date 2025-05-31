// src/hooks/useGameController.ts - Fixed version
import { useState, useCallback, useEffect, useRef } from 'react';
import { useGameDatabase } from './useGameDatabase';
import { useNumberCalling } from './useNumberCalling';
import { useGameState } from './useGameState';
import { useGameAudio } from './useGameAudio';
import { validateAllPrizes, ValidationContext, formatMultiplePrizes } from '../utils/prizeValidation';
import type { GameHookCallbacks, PrizeWinResult } from '../types/hooks';
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

  // Refs to track the latest state for number calling and prevent excessive updates
  const gameStateRef = useRef<Game.CurrentGame | null>(null);
  const isActiveRef = useRef(false);
  const lastLoggedStateRef = useRef<string>('');
  const lastSyncedStateRef = useRef<{
    calledNumbersLength: number;
    queueLength: number;
    currentNumber: number | null;
  }>({ calledNumbersLength: 0, queueLength: 0, currentNumber: null });
  const autoStartLogRef = useRef<string>('');

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

  // Update refs when state changes - FIXED to prevent excessive logging
  useEffect(() => {
    gameStateRef.current = gameState;
    isActiveRef.current = !isPaused && !isGameEnded && !allPrizesWon;
    
    // Only log when the state actually changes AND in development mode
    const currentStateKey = `${isPaused}-${isGameEnded}-${allPrizesWon}-${gameState?.gameState?.status}-${gameState?.gameState?.isAutoCalling}`;
    
    if (lastLoggedStateRef.current !== currentStateKey) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🎮 Game Controller State Update:', {
          isPaused,
          isGameEnded,
          allPrizesWon,
          status: gameState?.gameState?.status,
          isAutoCalling: gameState?.gameState?.isAutoCalling,
          isActiveRef: isActiveRef.current
        });
      }
      lastLoggedStateRef.current = currentStateKey;
    }
  }, [gameState?.gameState?.status, gameState?.gameState?.isAutoCalling, isPaused, isGameEnded, allPrizesWon]);

  // Initialize audio hook
  const audio = useGameAudio({
    gameState,
    onError
  });

  // Optimized prize validation using new system
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
      console.log('🔍 Running optimized prize validation...');
      const validationResults = validateAllPrizes(context);
      
      if (validationResults.length > 0) {
        console.log(`🏆 Found ${validationResults.length} prize winner(s)`);
        
        // Process each winning result
        const winnersUpdate: Partial<Game.Winners> = {};
        let hasNewWinners = false;
        const processedPlayers = new Set<string>();

        for (const result of validationResults) {
          if (result.isWinner && result.winningTickets.length > 0) {
            const playerKey = `${result.playerName}-${result.phoneNumber}`;
            
            // Avoid duplicate processing for same player
            if (processedPlayers.has(playerKey)) {
              continue;
            }
            processedPlayers.add(playerKey);

            // Handle multiple prizes for the same result
            const multiplePrizes = result.allPrizeTypes || [result.prizeType.replace(/([A-Z])/g, ' $1').trim()];
            
            // Update winners for each prize type
            for (const prizeTypeStr of multiplePrizes) {
              const prizeKey = prizeTypeStr.toLowerCase().replace(/\s+/g, '') as keyof Game.Winners;
              
              if (context.activePrizes[prizeKey]) {
                const existingWinners = context.currentWinners[prizeKey] || [];
                
                // Add new winners to existing list
                winnersUpdate[prizeKey] = [
                  ...existingWinners,
                  ...result.winningTickets
                ];
                
                hasNewWinners = true;
                console.log(`🏆 Prize won: ${prizeTypeStr} by ${result.playerName} with tickets ${result.winningTickets.join(', ')}`);
              }
            }
            
            // Play prize win sound for primary prize
            const primaryPrizeKey = result.prizeType;
            await audio.playPrizeWinSound(primaryPrizeKey);
            
            // Create combined prize win result
            const prizeWinResult: PrizeWinResult = {
              playerId: `${result.playerName}-${result.phoneNumber}`,
              playerName: result.playerName,
              phoneNumber: result.phoneNumber,
              ticketId: result.winningTickets[0], // Primary ticket
              prizeTypes: multiplePrizes
            };
            
            // Trigger callback with combined result
            onPrizeWon?.(prizeWinResult);
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
            console.log('🎉 All active prizes won! Completing game...');
            await database.updateGameState({
              allPrizesWon: true,
              isAutoCalling: false,
              status: 'ended',
              phase: 4
            });
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Prize validation failed';
      console.error('❌ Prize validation error:', error);
      onError?.(message);
    }
  }, [gameState, isGameEnded, allPrizesWon, database, audio, onPrizeWon, onError]);

  // Memoize the number generation callback to prevent infinite re-renders
  const onNumberGeneratedCallback = useCallback(async (number: number) => {
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
      
      // Use optimized validation
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
  }, [calledNumbers, database, onNumberCalled, audio, validatePrizesForCurrentState, completeGame, onError]);

  // Initialize number calling hook with stable callback
  const numberCalling = useNumberCalling({
    calledNumbers,
    isPaused,
    isGameEnded,
    allPrizesWon,
    onNumberGenerated: onNumberGeneratedCallback,
    onError
  });

  // Sync local state with game state - OPTIMIZED to prevent excessive updates
  useEffect(() => {
    if (gameState) {
      const newCalledNumbers = gameState.numberSystem?.calledNumbers || [];
      const newQueueNumbers = gameState.numberSystem?.queue || [];
      const newCurrentNumber = gameState.numberSystem?.currentNumber || null;
      
      const lastSynced = lastSyncedStateRef.current;
      
      // Only update if actually different to prevent loops
      if (newCalledNumbers.length !== lastSynced.calledNumbersLength || 
          newCalledNumbers[newCalledNumbers.length - 1] !== calledNumbers[calledNumbers.length - 1]) {
        setCalledNumbers(newCalledNumbers);
        lastSynced.calledNumbersLength = newCalledNumbers.length;
      }
      
      if (newQueueNumbers.length !== lastSynced.queueLength) {
        setQueueNumbers(newQueueNumbers);
        onQueueChanged?.(newQueueNumbers);
        lastSynced.queueLength = newQueueNumbers.length;
      }
      
      if (newCurrentNumber !== lastSynced.currentNumber) {
        setCurrentNumber(newCurrentNumber);
        lastSynced.currentNumber = newCurrentNumber;
      }
    }
  }, [gameState?.numberSystem?.calledNumbers?.length, gameState?.numberSystem?.queue?.length, gameState?.numberSystem?.currentNumber]);

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

  // Enhanced auto-start logic with better state tracking - FIXED to prevent loops
  useEffect(() => {
    // Only run this effect when critical state actually changes
    const shouldStart = !isPaused && !isGameEnded && !allPrizesWon && !isProcessing;
    const isStatusActive = gameState?.gameState?.status === 'active';
    
    // Prevent excessive logging by only logging when state actually changes
    const stateKey = `${isPaused}-${isGameEnded}-${allPrizesWon}-${isProcessing}-${isStatusActive}`;
    
    if (autoStartLogRef.current !== stateKey) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Auto-start check:', {
          shouldStart,
          isPaused,
          isGameEnded,
          allPrizesWon,
          isProcessing,
          isStatusActive,
          gameStatus: gameState?.gameState?.status,
          isAutoCalling: gameState?.gameState?.isAutoCalling
        });
      }
      autoStartLogRef.current = stateKey;
    }

    if (shouldStart && isStatusActive) {
      // Start number calling immediately when conditions are met
      if (process.env.NODE_ENV === 'development') {
        console.log('🎯 Conditions met - starting number calling');
      }
      
      // Small delay to ensure state is properly updated
      const timer = setTimeout(() => {
        if (isActiveRef.current && !isProcessing) {
          if (process.env.NODE_ENV === 'development') {
            console.log('🎲 Actually starting number generation');
          }
          numberCalling.scheduleNext();
        }
      }, 200);
      
      return () => clearTimeout(timer);
    }
  }, [isPaused, isGameEnded, allPrizesWon, isProcessing, gameState?.gameState?.status, gameState?.gameState?.isAutoCalling, numberCalling.scheduleNext]);

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
    triggerPrizeValidation,
    
    // Audio controls
    setSoundEnabled: audio.setEnabled,
    setVolume: audio.setVolume,
    
    // Utility
    resetError
  };
}
