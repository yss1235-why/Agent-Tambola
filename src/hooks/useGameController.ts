// src/hooks/useGameController.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import { ref, update, get, onValue } from 'firebase/database';
import { database } from '../lib/firebase';
import { AudioManager } from '../utils/audioManager';
import { PrizeValidationService } from '../services/PrizeValidationService';
import type { Game } from '../types/game';
import appConfig from '../config/appConfig';

interface UseGameControllerProps {
  hostId: string;
  onNumberCalled?: (number: number) => void;
  onPrizeWon?: (prizeType: keyof Game.Winners, ticketIds: string[]) => void;
  onQueueChanged?: (queue: number[]) => void;
  onGameComplete?: () => void;
  onError?: (error: string) => void;
}

// Define the interface for validation results
interface ValidationResult {
  isValid: boolean;
  winners: string[];
  error?: string;
}

export function useGameController({
  hostId,
  onNumberCalled,
  onPrizeWon,
  onQueueChanged,
  onGameComplete,
  onError
}: UseGameControllerProps) {
  // State management
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(true); // Start in paused state by default
  const [queueNumbers, setQueueNumbers] = useState<number[]>([]);
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [callDelay, setCallDelay] = useState(appConfig.gameDefaults.callDelay);
  const [gameState, setGameState] = useState<Game.CurrentGame | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [allPrizesWon, setAllPrizesWon] = useState(false);
  
  // Refs for mutable state
  const processingRef = useRef(isProcessing);
  const pausedRef = useRef(isPaused);
  const callDelayRef = useRef(callDelay);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioManager = AudioManager.getInstance();
  
  // Update refs when state changes
  useEffect(() => {
    processingRef.current = isProcessing;
    pausedRef.current = isPaused;
    callDelayRef.current = callDelay;
  }, [isProcessing, isPaused, callDelay]);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);
  
  // Load initial game state
  useEffect(() => {
    if (!hostId) return;
    
    console.log('Setting up game state listener for host:', hostId);
    
    const gameRef = ref(database, `hosts/${hostId}/currentGame`);
    const unsubscribe = onValue(gameRef, (snapshot) => {
      if (snapshot.exists()) {
        const gameData = snapshot.val() as Game.CurrentGame;
        
        console.log('Game state updated:', 
          gameData.gameState.status, 
          'Phase:', gameData.gameState.phase,
          'Numbers called:', gameData.numberSystem?.calledNumbers?.length || 0);
        
        setGameState(gameData);
        
        // Update local pause state based on game state
        const isPausedState = gameData.gameState?.status === 'paused';
        
        setIsPaused(isPausedState);
        pausedRef.current = isPausedState;
        
        setCallDelay(gameData.numberSystem?.callDelay || appConfig.gameDefaults.callDelay);
        callDelayRef.current = gameData.numberSystem?.callDelay || appConfig.gameDefaults.callDelay;
        
        setCalledNumbers(gameData.numberSystem?.calledNumbers || []);
        setQueueNumbers(gameData.numberSystem?.queue || []);
        setCurrentNumber(gameData.numberSystem?.currentNumber);
        setAllPrizesWon(gameData.gameState?.allPrizesWon || false);
        onQueueChanged?.(gameData.numberSystem?.queue || []);
      }
    });
    
    return () => {
      console.log('Cleaning up game state listener');
      unsubscribe();
    };
  }, [hostId, onQueueChanged]);
  
  // Prize validation functionality
  const validatePrizes = useCallback(async (newCalledNumbers: number[]) => {
    if (!hostId || !gameState) return;
    
    try {
      console.log('Validating prizes for newly called numbers:', newCalledNumbers);
      
      const game = gameState;
      const tickets = game.activeTickets?.tickets || {};
      const bookings = game.activeTickets?.bookings || {};
      const currentWinners = game.gameState?.winners || {};
      const activePrizes = game.settings?.prizes || {};
      
      // Use PrizeValidationService to validate all prizes
      const prizeValidationService = PrizeValidationService.getInstance();
      prizeValidationService.initialize(hostId);
      
      const validationResults = await prizeValidationService.validateAllPrizes(
        tickets,
        newCalledNumbers,
        currentWinners,
        activePrizes,
        bookings
      );
      
      // Process validation results
      Object.entries(validationResults).forEach(([prizeType, result]) => {
        const typedResult = result as ValidationResult;
        
        if (typedResult.isValid && typedResult.winners.length > 0) {
          const prizeTypeKey = prizeType as keyof Game.Winners;
          
          // Call the onPrizeWon callback if provided
          onPrizeWon?.(prizeTypeKey, typedResult.winners);
        }
      });
    } catch (err) {
      console.error('Error validating prizes:', err);
      const errorMsg = err instanceof Error ? err.message : 'Prize validation error';
      setError(errorMsg);
      onError?.(errorMsg);
    }
  }, [hostId, gameState, onPrizeWon, onError]);
  
  // Game completion
  const completeGame = useCallback(async () => {
    if (!hostId) return;
    
    try {
      // Clear any timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      const gameRef = ref(database, `hosts/${hostId}/currentGame`);
      const snapshot = await get(gameRef);
      
      if (!snapshot.exists()) {
        throw new Error('No active game found');
      }
      
      const game = snapshot.val() as Game.CurrentGame;
      const timestamp = Date.now();
      
      console.log('Completing game...');
      
      // Update game state
      await update(ref(database, `hosts/${hostId}/currentGame/gameState`), {
        phase: 4, // Completed phase
        status: 'ended',
        lastUpdated: timestamp
      });
      
      // Create session record
      await update(ref(database, `hosts/${hostId}/sessions/${timestamp}`), {
        ...game,
        endTime: timestamp,
        endReason: 'Game completed'
      });
      
      console.log('Game completed successfully');
      onGameComplete?.();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to complete game';
      setError(errorMsg);
      onError?.(errorMsg);
    }
  }, [hostId, onGameComplete, onError]);
  
  // Auto-calling - now using sequential timeouts for consistent timing
  const generateAndCallNumber = useCallback(async () => {
    if (!hostId || processingRef.current || pausedRef.current || allPrizesWon) {
      if (allPrizesWon) {
        console.log("Cannot generate number: All prizes have been won");
      } else if (pausedRef.current) {
        console.log("Cannot generate number: Game is paused");
      } else if (processingRef.current) {
        console.log("Cannot generate number: Already processing");
      }
      return;
    }
    
    setIsProcessing(true);
    processingRef.current = true;
    
    try {
      console.log('Generating and calling a new number...');
      
      const gameRef = ref(database, `hosts/${hostId}/currentGame`);
      const snapshot = await get(gameRef);
      
      if (!snapshot.exists()) {
        throw new Error('No active game found');
      }
      
      const game = snapshot.val() as Game.CurrentGame;
      
      // Check if all prizes won
      if (game.gameState?.allPrizesWon) {
        console.log('All prizes have been won, stopping number generation');
        setAllPrizesWon(true);
        setIsProcessing(false);
        processingRef.current = false;
        return;
      }
      
      // Check game state is active
      if (game.gameState?.status !== 'active') {
        console.log('Game is not active, skipping number generation');
        setIsProcessing(false);
        processingRef.current = false;
        return;
      }
      
      const calledNumsArray = game.numberSystem?.calledNumbers || [];
      
      // Check if all numbers have been called
      if (calledNumsArray.length >= 90) {
        console.log('All 90 numbers have been called, completing game');
        await completeGame();
        return;
      }
      
      // Generate a random number that hasn't been called
      const availableNumbers = Array.from({ length: 90 }, (_, i) => i + 1)
        .filter(n => !calledNumsArray.includes(n));
      
      if (availableNumbers.length === 0) {
        console.log('No available numbers left, completing game');
        await completeGame();
        return;
      }
      
      console.log(`Available numbers: ${availableNumbers.length}, Called numbers: ${calledNumsArray.length}`);
      
      const randomIndex = Math.floor(Math.random() * availableNumbers.length);
      const nextNumber = availableNumbers[randomIndex];
      
      console.log(`Generated number: ${nextNumber}`);
      
      // Update database
      await update(ref(database, `hosts/${hostId}/currentGame/numberSystem`), {
        currentNumber: nextNumber,
        calledNumbers: [...calledNumsArray, nextNumber]
      });
      
      // Update state
      setCurrentNumber(nextNumber);
      setCalledNumbers([...calledNumsArray, nextNumber]);
      
      // Announce the number without awaiting completion
      if (game.gameState.soundEnabled) {
        audioManager.announceNumber(nextNumber);
      }
      
      onNumberCalled?.(nextNumber);
      
      // Start prize validation in the background
      validatePrizes([...calledNumsArray, nextNumber]).catch(err => {
        console.error('Background prize validation error:', err);
      });
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate number';
      console.error('Error in generateAndCallNumber:', errorMsg);
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsProcessing(false);
      processingRef.current = false;
      console.log('Number generation complete, processing state reset');
      
      // Schedule the next number only if the game is still active
      if (!pausedRef.current && !allPrizesWon) {
        scheduleNextNumber();
      }
    }
  }, [hostId, allPrizesWon, onNumberCalled, onError, completeGame, validatePrizes, audioManager]);
  
  // Sequential scheduling with proper delay
  const scheduleNextNumber = useCallback(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    // Only schedule if not paused and not all prizes won
    if (!pausedRef.current && !allPrizesWon) {
      console.log(`Scheduling next number with ${callDelayRef.current} second delay`);
      
      // Set timeout with exact configured delay
      timeoutRef.current = setTimeout(() => {
        if (!pausedRef.current && !allPrizesWon) {
          generateAndCallNumber().catch(err => {
            console.error('Error in scheduled number generation:', err);
          });
        }
      }, callDelayRef.current * 1000);
      
      return true;
    }
    
    console.log('Not scheduling next number:', 
      pausedRef.current ? 'game is paused' : 'all prizes won');
    return false;
  }, [generateAndCallNumber, allPrizesWon]);
  
  // Game control functions
  const pauseGame = useCallback(async () => {
    if (!hostId) return;
    
    try {
      console.log('Pausing game...');
      
      // Clear any scheduled number
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      // Update state first for immediate UI feedback
      setIsPaused(true);
      pausedRef.current = true;
      
      // Then update database with multiple ways to handle permission issues
      try {
        // First attempt - direct path update
        await update(ref(database, `hosts/${hostId}/currentGame/gameState`), {
          status: 'paused',
          isAutoCalling: false
        });
        console.log('Game paused successfully (Method 1)');
      } catch (writeError) {
        console.error('First pause method failed:', writeError);
        
        try {
          // Second attempt - parent node update
          const gameRef = ref(database, `hosts/${hostId}/currentGame`);
          const snapshot = await get(gameRef);
          
          if (snapshot.exists()) {
            const game = snapshot.val();
            
            // Try updating the entire gameState object
            await update(ref(database, `hosts/${hostId}/currentGame/gameState`), {
              ...game.gameState,
              status: 'paused',
              isAutoCalling: false
            });
            console.log('Game paused successfully (Method 2)');
          } else {
            throw new Error('Game data not found');
          }
        } catch (secondError) {
          console.error('Second pause method failed:', secondError);
          throw secondError; // Re-throw for outer catch
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to pause game';
      console.error('Error pausing game:', errorMsg);
      setError(errorMsg);
      onError?.(errorMsg);
      
      // Keep UI in sync even if server update fails
      setIsPaused(true);
      pausedRef.current = true;
    }
  }, [hostId, onError]);
  
  const resumeGame = useCallback(async () => {
    if (!hostId) return;
    
    try {
      console.log('Resuming game...');
      
      // First check if all prizes have been won
      const gameRef = ref(database, `hosts/${hostId}/currentGame`);
      const snapshot = await get(gameRef);
      
      if (snapshot.exists()) {
        const game = snapshot.val() as Game.CurrentGame;
        if (game.gameState?.allPrizesWon) {
          throw new Error('All prizes have been won, cannot resume game');
        }
      }
      
      // Try multiple update methods for better reliability
      try {
        // First attempt - direct path update
        await update(ref(database, `hosts/${hostId}/currentGame/gameState`), {
          status: 'active',
          isAutoCalling: true
        });
        console.log('Game resumed successfully (Method 1)');
      } catch (writeError) {
        console.error('First resume method failed:', writeError);
        
        try {
          // Second attempt - parent node update
          const gameRef = ref(database, `hosts/${hostId}/currentGame`);
          const snapshot = await get(gameRef);
          
          if (snapshot.exists()) {
            const game = snapshot.val();
            
            // Try updating the entire gameState object
            await update(ref(database, `hosts/${hostId}/currentGame/gameState`), {
              ...game.gameState,
              status: 'active',
              isAutoCalling: true
            });
            console.log('Game resumed successfully (Method 2)');
          } else {
            throw new Error('Game data not found');
          }
        } catch (secondError) {
          console.error('Second resume method failed:', secondError);
          throw secondError; // Re-throw for outer catch
        }
      }
      
      // Update local state after successful database update
      setIsPaused(false);
      pausedRef.current = false;
      
      // Generate the first number immediately when game is started
      await generateAndCallNumber();
      
      // Then schedule next numbers normally
      scheduleNextNumber();
      
      console.log('Game resumed, number generation active');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to resume game';
      console.error('Error resuming game:', errorMsg);
      setError(errorMsg);
      onError?.(errorMsg);
    }
  }, [hostId, onError, scheduleNextNumber, generateAndCallNumber]);
  
  // Update call delay
  const setGameCallDelay = useCallback(async (delay: number) => {
    // Validate delay - ensure it's between 3 and 10 seconds
    const validDelay = Math.min(Math.max(3, delay), 10);
    
    console.log(`Updating call delay to ${validDelay} seconds`);
    
    // Update local state
    setCallDelay(validDelay);
    callDelayRef.current = validDelay;
    
    if (hostId) {
      try {
        // Update callDelay in Firebase
        await update(ref(database, `hosts/${hostId}/currentGame/numberSystem`), {
          callDelay: validDelay
        });
        
        // If game is active, reschedule next number with new delay
        if (!pausedRef.current && timeoutRef.current) {
          // Clear and reschedule with new delay
          clearTimeout(timeoutRef.current);
          scheduleNextNumber();
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to update call delay';
        console.error('Error updating call delay:', errorMsg);
        setError(errorMsg);
        onError?.(errorMsg);
      }
    }
  }, [hostId, scheduleNextNumber, onError]);
  
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
    
    // Game control functions
    pauseGame,
    resumeGame,
    completeGame,
    
    // Number generation
    generateAndCallNumber,
    
    // Settings
    setCallDelay: setGameCallDelay
  };
}
