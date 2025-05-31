// src/hooks/useNumberCalling.ts - Fixed with better scheduling
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
    
    console.log('📱 Number Calling State Update:', {
      callDelay,
      isPaused,
      isGameEnded,
      allPrizesWon,
      isScheduling: isSchedulingRef.current,
      hasTimeout: !!timeoutRef.current
    });
  }, [callDelay, isPaused, isGameEnded, allPrizesWon]);

  const generateNumber = useCallback(async (): Promise<number | null> => {
    try {
      console.log('🎲 Generate number called - checking conditions:', {
        isPaused: isPausedRef.current,
        isGameEnded: isGameEndedRef.current,
        allPrizesWon: allPrizesWonRef.current,
        calledCount: calledNumbers.length
      });

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

      // Select random number
      const randomIndex = Math.floor(Math.random() * availableNumbers.length);
      const selectedNumber = availableNumbers[randomIndex];

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
    console.log('⏰ Schedule next called - checking conditions:', {
      isPaused: isPausedRef.current,
      isGameEnded: isGameEndedRef.current,
      allPrizesWon: allPrizesWonRef.current,
      isScheduling: isSchedulingRef.current,
      hasExistingTimeout: !!timeoutRef.current,
      callDelay: callDelayRef.current
    });

    // Clear existing timeout
    if (timeoutRef.current) {
      console.log('🧹 Clearing existing timeout');
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
      console.log('⏰ Timeout triggered - checking conditions again:', {
        isPaused: isPausedRef.current,
        isGameEnded: isGameEndedRef.current,
        allPrizesWon: allPrizesWonRef.current
      });

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
