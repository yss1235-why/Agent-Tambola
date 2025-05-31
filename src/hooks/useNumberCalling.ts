// src/hooks/useNumberCalling.ts - SIMPLIFIED VERSION
import { useState, useCallback, useRef, useEffect } from 'react';
import type { NumberCallingHookReturn } from '../types/hooks';

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
  const [callDelay, setCallDelay] = useState(5);
  
  // Single timer ref for simplicity
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(false);
  
  // Clear any existing timer
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    isActiveRef.current = false;
  }, []);

  // Generate a random number
  const generateNumber = useCallback(async (): Promise<number | null> => {
    try {
      // Check if we should generate a number
      if (isPaused || isGameEnded || allPrizesWon) {
        console.log('❌ Cannot generate number - game stopped');
        return null;
      }

      // Check if all numbers have been called
      if (calledNumbers.length >= 90) {
        console.log('❌ All numbers have been called');
        return null;
      }

      // Generate available numbers
      const availableNumbers = Array.from({ length: 90 }, (_, i) => i + 1)
        .filter(n => !calledNumbers.includes(n));

      if (availableNumbers.length === 0) {
        console.log('❌ No available numbers left');
        return null;
      }

      // Select random number
      const randomIndex = Math.floor(Math.random() * availableNumbers.length);
      const selectedNumber = availableNumbers[randomIndex];

      console.log(`✅ Generated number: ${selectedNumber}`);
      
      // Trigger callback
      onNumberGenerated?.(selectedNumber);
      return selectedNumber;
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate number';
      console.error('❌ Number generation error:', error);
      onError?.(message);
      return null;
    }
  }, [calledNumbers, isPaused, isGameEnded, allPrizesWon, onNumberGenerated, onError]);

  // Schedule the next number call
  const scheduleNext = useCallback(() => {
    // Clear any existing timer first
    clearTimer();
    
    // Don't schedule if game should be stopped
    if (isPaused || isGameEnded || allPrizesWon) {
      console.log('❌ Not scheduling - game is stopped');
      return;
    }

    console.log(`⏰ Scheduling next number in ${callDelay} seconds`);
    isActiveRef.current = true;
    
    timerRef.current = setTimeout(async () => {
      // Double-check conditions before generating
      if (isActiveRef.current && !isPaused && !isGameEnded && !allPrizesWon) {
        console.log('⏰ Timer triggered - generating number');
        
        const number = await generateNumber();
        
        // Schedule next only if number was successfully generated and we're still active
        if (number !== null && isActiveRef.current) {
          scheduleNext();
        } else {
          console.log('❌ Stopping schedule - no number generated or game stopped');
          clearTimer();
        }
      } else {
        console.log('❌ Timer triggered but conditions changed - stopping');
        clearTimer();
      }
    }, callDelay * 1000);
  }, [callDelay, isPaused, isGameEnded, allPrizesWon, generateNumber, clearTimer]);

  // Update call delay
  const setDelay = useCallback((seconds: number) => {
    const validDelay = Math.min(Math.max(3, seconds), 20);
    console.log(`⏱️ Setting delay to ${validDelay} seconds`);
    setCallDelay(validDelay);
    
    // If we're currently running, reschedule with new delay
    if (isActiveRef.current) {
      console.log('🔄 Rescheduling with new delay');
      scheduleNext();
    }
  }, [scheduleNext]);

  // Clear schedule
  const clearSchedule = useCallback(() => {
    console.log('🛑 Clearing schedule');
    clearTimer();
  }, [clearTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  return {
    generateNumber,
    scheduleNext,
    clearSchedule,
    setDelay,
    callDelay
  };
}
