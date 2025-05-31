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

  // Initialize audio hook
  const audio = useGameAudio({
    gameState,
    onError
  });

  // FIXED: Optimized prize validation using new system
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
              ticketId: result.winningTickets[0],
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

          // REMOVED: Auto-completion logic that was causing the calling to stop
          // Let the host manually end the game when they want to
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Prize validation failed';
      console.error('❌ Prize validation error:', error);
      // Don't pause the game or stop calling on validation errors
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
      console.log(`🎲 Calling number: ${number}`);
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
        
        // Validate prizes (but don't let it stop the game)
        try {
          await validatePrizesForCurrentState(newCalledNumbers);
        } catch (validationError) {
          console.warn('⚠️ Prize validation failed, but continuing game:', validationError);
        }
        
        // Check if all numbers have been called
        if (newCalledNumbers.length >= 90) {
          console.log('🎉 All 90 numbers called - completing game');
          await completeGame();
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to process number';
        console.error('❌ Number processing error:', err);
        onError?.(message);
        // Don't pause the game on errors - just continue
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

  // FIXED: Enhanced auto-start logic - only check when status changes
  useEffect(() => {
    // Only check when game status becomes active
    if (gameState?.gameState?.status === 'active' && !isPaused && !isGameEnded && !allPrizesWon && !isProcessing) {
      console.log('🎯 Game activated - starting number calling');
      
      // Small delay to ensure state is properly updated
      const timer = setTimeout(() => {
        if (!isPaused && !isGameEnded && !allPrizesWon && !isProcessing) {
          console.log('🎲 Actually starting number generation');
          numberCalling.scheduleNext();
        }
      }, 200);
      
      return () => clearTimeout(timer);
    }
  }, [gameState?.gameState?.status]); // FIXED: Only depend on status changes, not all state

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
    
    // Audio controls
    setSoundEnabled: audio.setEnabled,
    setVolume: audio.setVolume,
    
    // Utility
    resetError
  };
}

// ===== COMPLETE FILE 2: src/hooks/useNumberCalling.ts =====

import { useState, useCallback, useRef, useEffect } from 'react';
import type { NumberCallingHookReturn } from '../types/hooks';
import appConfig from '../config/appConfig';

interface UseNumberCallingProps {
  calledNumbers: number[];
  isPaused: boolean;
  isGameEnded: boolean;
  allPrizesWon: boolean;
  onNumberGenerated?: (number: number) => void;
  onError?: (error: string) => void;
}

export function useNumberCalling({
  calledNumbers = [],
  isPaused,
  isGameEnded,
  allPrizesWon,
  onNumberGenerated,
  onError
}: UseNumberCallingProps): NumberCallingHookReturn {
  const [callDelay, setCallDelayState] = useState(appConfig.gameDefaults.callDelay);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callDelayRef = useRef(callDelay);
  const isPausedRef = useRef(isPaused);
  const isGameEndedRef = useRef(isGameEnded);
  const allPrizesWonRef = useRef(allPrizesWon);
  const isSchedulingRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => {
    callDelayRef.current = callDelay;
    isPausedRef.current = isPaused;
    isGameEndedRef.current = isGameEnded;
    allPrizesWonRef.current = allPrizesWon;
  }, [callDelay, isPaused, isGameEnded, allPrizesWon]);

  const generateNumber = useCallback(async (): Promise<number | null> => {
    try {
      // Check if game should continue
      if (isPausedRef.current || isGameEndedRef.current || allPrizesWonRef.current) {
        console.log('❌ Cannot generate number - game stopped');
        return null;
      }

      // Check if all numbers have been called
      if (calledNumbers.length >= 90) {
        console.log('❌ Cannot generate number - all numbers called');
        return null;
      }

      // Generate available numbers
      const availableNumbers = Array.from({ length: 90 }, (_, i) => i + 1)
        .filter(n => !calledNumbers.includes(n));

      if (availableNumbers.length === 0) {
        console.log('❌ No available numbers left');
        return null;
      }

      // FIXED: Use crypto.getRandomValues for secure random generation
      let selectedNumber: number;
      try {
        const randomArray = new Uint32Array(1);
        crypto.getRandomValues(randomArray);
        const randomIndex = randomArray[0] % availableNumbers.length;
        selectedNumber = availableNumbers[randomIndex];
      } catch (cryptoError) {
        // Fallback to Math.random if crypto is not available
        console.warn('⚠️ Crypto not available, falling back to Math.random');
        const randomIndex = Math.floor(Math.random() * availableNumbers.length);
        selectedNumber = availableNumbers[randomIndex];
      }

      console.log(`✅ Generated number: ${selectedNumber} (${availableNumbers.length} available)`);
      
      onNumberGenerated?.(selectedNumber);
      return selectedNumber;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate number';
      console.error('❌ Number generation error:', error);
      onError?.(message);
      return null;
    }
  }, [calledNumbers, onNumberGenerated, onError]);

  const scheduleNext = useCallback(() => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Don't schedule if game should be stopped
    if (isPausedRef.current || isGameEndedRef.current || allPrizesWonRef.current) {
      console.log('❌ Not scheduling - game is stopped');
      isSchedulingRef.current = false;
      return;
    }

    // Prevent multiple scheduling
    if (isSchedulingRef.current) {
      console.log('⚠️ Already scheduling - skipping');
      return;
    }

    isSchedulingRef.current = true;
    
    console.log(`⏰ Scheduling next number in ${callDelayRef.current} seconds`);

    // Schedule next number
    timeoutRef.current = setTimeout(() => {
      if (!isPausedRef.current && !isGameEndedRef.current && !allPrizesWonRef.current) {
        console.log('🎯 Conditions still valid - generating number');
        
        generateNumber().then((number) => {
          if (number !== null) {
            // Schedule the next one after successful generation
            console.log('✅ Number generated successfully, scheduling next');
            isSchedulingRef.current = false;
            scheduleNext();
          } else {
            console.log('❌ Number generation failed, stopping schedule');
            isSchedulingRef.current = false;
          }
        }).catch((error) => {
          console.error('❌ Error in scheduled generation:', error);
          isSchedulingRef.current = false;
        });
      } else {
        console.log('❌ Conditions changed - stopping schedule');
        isSchedulingRef.current = false;
      }
    }, callDelayRef.current * 1000);
  }, [generateNumber]);

  const clearSchedule = useCallback(() => {
    console.log('🛑 Clear schedule called');
    
    if (timeoutRef.current) {
      console.log('🧹 Clearing timeout');
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    isSchedulingRef.current = false;
    console.log('✅ Schedule cleared');
  }, []);

  const setDelay = useCallback((seconds: number) => {
    const validDelay = Math.min(Math.max(3, seconds), 10);
    console.log(`⏱️ Setting delay to ${validDelay} seconds (was ${callDelay})`);
    
    setCallDelayState(validDelay);
    callDelayRef.current = validDelay;
    
    // Reschedule if currently running
    if (timeoutRef.current && !isPausedRef.current) {
      console.log('🔄 Rescheduling with new delay');
      clearSchedule();
      scheduleNext();
    }
  }, [callDelay, clearSchedule, scheduleNext]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('🧹 Number calling hook cleanup');
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      isSchedulingRef.current = false;
    };
  }, []);

  return {
    generateNumber,
    scheduleNext,
    clearSchedule,
    setDelay,
    callDelay
  };
}
