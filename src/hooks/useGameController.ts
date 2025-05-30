// src/hooks/useGameController.ts - Simplified version without deleted services

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

export function useGameController({
  hostId,
  onNumberCalled,
  onPrizeWon,
  onQueueChanged,
  onGameComplete,
  onError
}: UseGameControllerProps) {
  // State
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [queueNumbers, setQueueNumbers] = useState<number[]>([]);
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [callDelay, setCallDelay] = useState(appConfig.gameDefaults.callDelay);
  const [gameState, setGameState] = useState<Game.CurrentGame | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [allPrizesWon, setAllPrizesWon] = useState(false);
  const [isGameEnded, setIsGameEnded] = useState(false);
  
  // Refs
  const processingRef = useRef(isProcessing);
  const pausedRef = useRef(isPaused);
  const callDelayRef = useRef(callDelay);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const allPrizesWonRef = useRef(allPrizesWon);
  const isGameEndedRef = useRef(isGameEnded);
  
  const audioManager = AudioManager.getInstance();
  const prizeValidationService = PrizeValidationService.getInstance();

  // Update refs when state changes
  useEffect(() => {
    processingRef.current = isProcessing;
    pausedRef.current = isPaused;
    callDelayRef.current = callDelay;
    allPrizesWonRef.current = allPrizesWon;
    isGameEndedRef.current = isGameEnded;
  }, [isProcessing, isPaused, callDelay, allPrizesWon, isGameEnded]);

  // Initialize services
  useEffect(() => {
    if (hostId) {
      prizeValidationService.initialize(hostId);
      audioManager.initialize();
    }
  }, [hostId]);

  // Load game state
  useEffect(() => {
    if (!hostId) return;
    
    const gameRef = ref(database, `hosts/${hostId}/currentGame`);
    const unsubscribe = onValue(gameRef, (snapshot) => {
      if (snapshot.exists()) {
        const gameData = snapshot.val() as Game.CurrentGame;
        
        setGameState(gameData);
        setIsGameEnded(gameData.gameState?.status === 'ended' || gameData.gameState?.phase === 4);
        setAllPrizesWon(gameData.gameState?.allPrizesWon || false);
        setIsPaused(gameData.gameState?.status === 'paused');
        setCallDelay(gameData.numberSystem?.callDelay || appConfig.gameDefaults.callDelay);
        setCalledNumbers(gameData.numberSystem?.calledNumbers || []);
        setQueueNumbers(gameData.numberSystem?.queue || []);
        setCurrentNumber(gameData.numberSystem?.currentNumber);
        
        onQueueChanged?.(gameData.numberSystem?.queue || []);

        // Stop processing if game ended or all prizes won
        if (gameData.gameState?.allPrizesWon || gameData.gameState?.status === 'ended') {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          setIsPaused(true);
          if (gameData.gameState?.allPrizesWon && onGameComplete) {
            onGameComplete();
          }
        }
      }
    });
    
    return () => unsubscribe();
  }, [hostId, onQueueChanged, onGameComplete]);

  // Prize validation
  const validatePrizes = useCallback(async (newCalledNumbers: number[]) => {
    if (!hostId || !gameState) return;
    
    try {
      const game = gameState;
      const tickets = game.activeTickets?.tickets || {};
      const bookings = game.activeTickets?.bookings || {};
      const currentWinners = game.gameState?.winners || {};
      const activePrizes = game.settings?.prizes || {};
      
      const validationResults = await prizeValidationService.validateAllPrizes(
        tickets,
        newCalledNumbers,
        currentWinners,
        activePrizes,
        bookings
      );
      
      // Process results
      Object.entries(validationResults).forEach(([prizeType, result]) => {
        if (result.isValid && result.winners.length > 0) {
          onPrizeWon?.(prizeType as keyof Game.Winners, result.winners);
        }
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Prize validation error';
      setError(errorMsg);
      onError?.(errorMsg);
    }
  }, [hostId, gameState, onPrizeWon, onError]);

  // Number generation
  const generateAndCallNumber = useCallback(async () => {
    if (!hostId || processingRef.current || pausedRef.current || allPrizesWonRef.current || isGameEndedRef.current) {
      return;
    }
    
    setIsProcessing(true);
    processingRef.current = true;
    
    try {
      const gameRef = ref(database, `hosts/${hostId}/currentGame`);
      const snapshot = await get(gameRef);
      
      if (!snapshot.exists()) {
        throw new Error('No active game found');
      }
      
      const game = snapshot.val() as Game.CurrentGame;
      
      if (game.gameState?.allPrizesWon || game.gameState?.status === 'ended' || game.gameState?.status !== 'active') {
        setIsProcessing(false);
        processingRef.current = false;
        return;
      }
      
      const calledNumsArray = game.numberSystem?.calledNumbers || [];
      
      if (calledNumsArray.length >= 90) {
        await completeGame();
        return;
      }
      
      // Generate random number
      const availableNumbers = Array.from({ length: 90 }, (_, i) => i + 1)
        .filter(n => !calledNumsArray.includes(n));
      
      if (availableNumbers.length === 0) {
        await completeGame();
        return;
      }
      
      const randomIndex = Math.floor(Math.random() * availableNumbers.length);
      const nextNumber = availableNumbers[randomIndex];
      
      // Update database
      await update(ref(database, `hosts/${hostId}/currentGame/numberSystem`), {
        currentNumber: nextNumber,
        calledNumbers: [...calledNumsArray, nextNumber]
      });
      
      // Update local state
      setCurrentNumber(nextNumber);
      setCalledNumbers([...calledNumsArray, nextNumber]);
      
      // Announce number
      if (game.gameState.soundEnabled) {
        audioManager.announceNumber(nextNumber);
      }
      
      onNumberCalled?.(nextNumber);
      
      // Validate prizes
      validatePrizes([...calledNumsArray, nextNumber]);
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate number';
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsProcessing(false);
      processingRef.current = false;
      
      // Schedule next number
      if (!pausedRef.current && !allPrizesWonRef.current && !isGameEndedRef.current) {
        scheduleNextNumber();
      }
    }
  }, [hostId, onNumberCalled, onError, validatePrizes]);

  // Schedule next number
  const scheduleNextNumber = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    if (!pausedRef.current && !allPrizesWonRef.current && !isGameEndedRef.current) {
      timeoutRef.current = setTimeout(() => {
        if (!pausedRef.current && !allPrizesWonRef.current && !isGameEndedRef.current) {
          generateAndCallNumber();
        }
      }, callDelayRef.current * 1000);
    }
  }, [generateAndCallNumber]);

  // Game control functions
  const pauseGame = useCallback(async () => {
    if (!hostId) return;
    
    try {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      setIsPaused(true);
      pausedRef.current = true;
      
      await update(ref(database, `hosts/${hostId}/currentGame/gameState`), {
        status: 'paused',
        isAutoCalling: false
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to pause game';
      setError(errorMsg);
      onError?.(errorMsg);
    }
  }, [hostId, onError]);

  const resumeGame = useCallback(async () => {
    if (!hostId || allPrizesWonRef.current || isGameEndedRef.current) return;
    
    try {
      await update(ref(database, `hosts/${hostId}/currentGame/gameState`), {
        status: 'active',
        isAutoCalling: true
      });
      
      setIsPaused(false);
      pausedRef.current = false;
      
      // Start number generation
      await generateAndCallNumber();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to resume game';
      setError(errorMsg);
      onError?.(errorMsg);
    }
  }, [hostId, onError, generateAndCallNumber]);

  const completeGame = useCallback(async () => {
    if (!hostId) return;
    
    try {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      const gameRef = ref(database, `hosts/${hostId}/currentGame`);
      const snapshot = await get(gameRef);
      
      if (!snapshot.exists()) return;
      
      const game = snapshot.val() as Game.CurrentGame;
      const timestamp = Date.now();
      
      // Update game state
      await update(ref(database, `hosts/${hostId}/currentGame/gameState`), {
        phase: 4,
        status: 'ended',
        isAutoCalling: false
      });
      
      // Save to history
      await update(ref(database, `hosts/${hostId}/sessions/${timestamp}`), {
        ...game,
        endTime: timestamp,
        endReason: 'Game completed'
      });
      
      setIsGameEnded(true);
      isGameEndedRef.current = true;
      
      onGameComplete?.();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to complete game';
      setError(errorMsg);
      onError?.(errorMsg);
    }
  }, [hostId, onGameComplete, onError]);

  const setGameCallDelay = useCallback(async (delay: number) => {
    const validDelay = Math.min(Math.max(3, delay), 10);
    setCallDelay(validDelay);
    callDelayRef.current = validDelay;
    
    if (hostId) {
      try {
        await update(ref(database, `hosts/${hostId}/currentGame/numberSystem`), {
          callDelay: validDelay
        });
        
        if (!pausedRef.current && timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          scheduleNextNumber();
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to update call delay';
        setError(errorMsg);
        onError?.(errorMsg);
      }
    }
  }, [hostId, scheduleNextNumber, onError]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      prizeValidationService.cleanup();
    };
  }, []);

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
    pauseGame,
    resumeGame,
    completeGame,
    generateAndCallNumber,
    setCallDelay: setGameCallDelay
  };
}
