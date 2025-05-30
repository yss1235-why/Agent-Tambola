// src/hooks/useNumberCalling.ts
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
        return null;
      }

      // Check if all numbers have been called
      if (calledNumbers.length >= 90) {
        return null;
      }

      // Generate available numbers
      const availableNumbers = Array.from({ length: 90 }, (_, i) => i + 1)
        .filter(n => !calledNumbers.includes(n));

      if (availableNumbers.length === 0) {
        return null;
      }

      // Select random number
      const randomIndex = Math.floor(Math.random() * availableNumbers.length);
      const selectedNumber = availableNumbers[randomIndex];

      onNumberGenerated?.(selectedNumber);
      return selectedNumber;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate number';
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
      return;
    }

    // Schedule next number
    timeoutRef.current = setTimeout(() => {
      if (!isPausedRef.current && !isGameEndedRef.current && !allPrizesWonRef.current) {
        generateNumber();
        scheduleNext(); // Schedule the next one after this
      }
    }, callDelayRef.current * 1000);
  }, [generateNumber]);

  const clearSchedule = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const setDelay = useCallback((seconds: number) => {
    const validDelay = Math.min(Math.max(3, seconds), 10);
    setCallDelayState(validDelay);
    callDelayRef.current = validDelay;
    
    // Reschedule if currently running
    if (timeoutRef.current && !isPausedRef.current) {
      clearSchedule();
      scheduleNext();
    }
  }, [clearSchedule, scheduleNext]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
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
