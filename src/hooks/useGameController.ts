// ===== COMPLETE FILE 1: src/hooks/useGameController.ts =====

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

// ===== COMPLETE FILE 3: src/components/Dashboard/GamePhases/PlayingPhase/PlayingPhase.tsx =====

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import { useGame } from '../../../../contexts/GameContext';
import { LoadingSpinner } from '@components';
import PlayingPhaseView from './PlayingPhaseView';
import { Game } from '../../../../types/game';

const PlayingPhase: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  // Use game controller from context
  const {
    currentGame,
    isProcessing,
    isPaused,
    currentNumber,
    calledNumbers,
    error: gameError,
    allPrizesWon,
    isGameEnded,
    pauseGame,
    resumeGame,
    completeGame,
    setCallDelay,
    setSoundEnabled,
    resetError
  } = useGame();
  
  // Local state - simplified
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGameComplete, setIsGameComplete] = useState(false);
  const [soundEnabled, setSoundEnabledLocal] = useState(true);
  const [callDelay, setCallDelayLocal] = useState(5);

  // FIXED: Initialize component without constant logging
  useEffect(() => {
    if (!currentUser?.uid) {
      navigate('/login');
      return;
    }
    
    if (currentGame) {
      console.log("PlayingPhase initialized with game:", {
        status: currentGame.gameState?.status,
        phase: currentGame.gameState?.phase,
        calledNumbers: currentGame.numberSystem?.calledNumbers?.length || 0,
        allPrizesWon: currentGame.gameState?.allPrizesWon
      });
      
      const isComplete = currentGame.gameState?.status === 'ended' || 
                        currentGame.gameState?.phase === 4 ||
                        isGameEnded;
      
      setIsLoading(false);
      setIsGameComplete(isComplete);
      setCallDelayLocal(currentGame.numberSystem?.callDelay || 5);
      setSoundEnabledLocal(currentGame.gameState?.soundEnabled !== false);
    }
  }, [currentUser, currentGame, navigate, isGameEnded]);

  // Sync with game completion states
  useEffect(() => {
    if (allPrizesWon || isGameEnded) {
      setIsGameComplete(true);
    }
  }, [allPrizesWon, isGameEnded]);

  // Sync with game error
  useEffect(() => {
    if (gameError) {
      setError(gameError);
    }
  }, [gameError]);

  // Handle delay change
  const handleDelayChange = useCallback(async (newDelay: number) => {
    setCallDelayLocal(newDelay);
    console.log(`Changing call delay to ${newDelay} seconds`);
    
    try {
      await setCallDelay(newDelay);
    } catch (err) {
      console.error('Failed to update call delay:', err);
      setError('Failed to update call delay');
    }
  }, [setCallDelay]);

  // Handle sound toggle
  const handleSoundToggle = useCallback(async () => {
    const newSoundEnabled = !soundEnabled;
    setSoundEnabledLocal(newSoundEnabled);
    console.log(`Sound toggled to ${newSoundEnabled ? 'on' : 'off'}`);
    
    try {
      await setSoundEnabled(newSoundEnabled);
    } catch (err) {
      console.error('Failed to toggle sound:', err);
      setError('Failed to toggle sound');
    }
  }, [soundEnabled, setSoundEnabled]);

  // Handle status change (pause/resume)
  const handleStatusChange = useCallback(async (status: 'active' | 'paused') => {
    if (allPrizesWon && status === 'active') {
      setError('Cannot resume game: All prizes have been won');
      return;
    }
    
    if (isGameComplete && status === 'active') {
      setError('Cannot resume game: Game is already completed');
      return;
    }
    
    console.log(`Changing game status to: ${status}`);
    
    try {
      if (status === 'paused') {
        await pauseGame();
      } else {
        await resumeGame();
      }
    } catch (err) {
      console.error("Error changing game status:", err);
      setError('Failed to change game status');
    }
  }, [allPrizesWon, isGameComplete, pauseGame, resumeGame]);

  // Handle game end
  const handleGameEnd = useCallback(async () => {
    try {
      console.log('Ending game...');
      setIsGameComplete(true);
      
      await completeGame();
      
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (err) {
      console.error('Failed to end game:', err);
      setError('Failed to end game');
    }
  }, [completeGame, navigate]);

  // Handle start new game
  const handleStartNewGame = useCallback(async () => {
    navigate('/dashboard', { replace: true });
  }, [navigate]);

  // Handle error dismissal
  const handleErrorDismiss = useCallback(() => {
    setError(null);
    resetError();
  }, [resetError]);

  // Render loading state
  if (isLoading || !currentGame) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  // Safely extract winners and settings
  const winners = currentGame.gameState?.winners || {
    quickFive: [], topLine: [], middleLine: [], bottomLine: [],
    corners: [], starCorners: [], halfSheet: [], fullSheet: [],
    fullHouse: [], secondFullHouse: []
  };

  const settings = currentGame.settings || {
    maxTickets: 0,
    selectedTicketSet: 1,
    callDelay: 5,
    hostPhone: '',
    prizes: {
      quickFive: false, topLine: false, middleLine: false, bottomLine: false,
      corners: false, starCorners: false, halfSheet: false, fullSheet: false,
      fullHouse: false, secondFullHouse: false
    }
  };

  return (
    <div className="space-y-4">
      <PlayingPhaseView
        currentGame={currentGame}
        winners={winners}
        soundEnabled={soundEnabled}
        callDelay={callDelay}
        error={error}
        isGameComplete={isGameComplete}
        isProcessing={isProcessing}
        queueNumbers={[]}
        allPrizesWon={allPrizesWon}
        onSoundToggle={handleSoundToggle}
        onDelayChange={handleDelayChange}
        onGameEnd={handleGameEnd}
        onStartNewGame={handleStartNewGame}
        onErrorDismiss={handleErrorDismiss}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
};

export default PlayingPhase;

// ===== COMPLETE FILE 4: src/components/GameControls.tsx =====

import React, { useState, useCallback, useEffect } from 'react';
import { Play, Pause, StopCircle, Volume2, VolumeX } from 'lucide-react';
import appConfig from '../config/appConfig';

interface GameControlsProps {
  gameStatus: 'active' | 'paused';
  soundEnabled: boolean;
  delaySeconds: number;
  onStatusChange: (status: 'active' | 'paused') => void;
  onSoundToggle: () => void;
  onDelayChange: (seconds: number) => void;
  onGameEnd: () => void;
  disableControls?: boolean;
}

function GameControls({
  gameStatus,
  soundEnabled,
  delaySeconds,
  onStatusChange,
  onSoundToggle,
  onDelayChange,
  onGameEnd,
  disableControls = false
}: GameControlsProps) {
  const [showEndGameConfirm, setShowEndGameConfirm] = useState(false);
  const [isEditingDelay, setIsEditingDelay] = useState(false);
  const [tempDelay, setTempDelay] = useState<number | string>(delaySeconds);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  
  // Update tempDelay when delaySeconds props changes
  useEffect(() => {
    setTempDelay(delaySeconds);
  }, [delaySeconds]);

  // Handle delay input and save it
  const handleDelaySubmit = useCallback(() => {
    const delayValue = typeof tempDelay === 'string' ? 
      (tempDelay === '' ? 3 : parseInt(tempDelay)) : tempDelay;
    
    const validDelay = Math.max(3, Math.min(20, delayValue));
    console.log(`⏱️ Submitting delay change to ${validDelay} seconds`);
    onDelayChange(validDelay);
    setIsEditingDelay(false);
  }, [tempDelay, onDelayChange]);

  // Handle the confirmation and actually end the game
  const handleEndGame = useCallback(() => {
    console.log('🏁 Confirming game end');
    onGameEnd();
    setShowEndGameConfirm(false);
  }, [onGameEnd]);

  // Handler for status change with loading state
  const handleStatusChange = useCallback(async () => {
    const newStatus = gameStatus === 'active' ? 'paused' : 'active';
    console.log(`🔄 Changing game status from ${gameStatus} to ${newStatus}`);
    
    setIsChangingStatus(true);
    
    try {
      await onStatusChange(newStatus);
      
      setTimeout(() => {
        setIsChangingStatus(false);
      }, 500);
    } catch (error) {
      console.error('❌ Error changing status:', error);
      setIsChangingStatus(false);
    }
  }, [gameStatus, onStatusChange]);

  // Determine if this is the initial start (not a resume)
  const isInitialStart = gameStatus === 'paused' && 
                         appConfig.gameDefaults.startInPausedState;

  const getStatusButtonText = () => {
    if (isChangingStatus) {
      return gameStatus === 'active' ? 'Pausing...' : 'Starting...';
    }
    
    if (gameStatus === 'active') {
      return 'Pause';
    }
    
    return isInitialStart ? 'Start' : 'Resume';
  };

  const getStatusButtonIcon = () => {
    if (gameStatus === 'active') {
      return <Pause className="w-4 h-4 mr-2" />;
    }
    return <Play className="w-4 h-4 mr-2" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-center justify-between bg-gray-50 p-3 sm:p-4 rounded-lg">
        <div className="flex items-center space-x-4 mb-3 sm:mb-0 w-full sm:w-auto">
          <span className="text-sm font-medium text-gray-500">Phase: Playing</span>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              gameStatus === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
            }`}
          >
            {gameStatus === 'active' ? 'Active' : 'Paused'}
          </span>
          {disableControls && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
              Controls Disabled
            </span>
          )}
          {isChangingStatus && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Updating...
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 w-full sm:w-auto">
          {/* Sound toggle button */}
          <button
            onClick={onSoundToggle}
            disabled={disableControls}
            className={`p-1.5 rounded-md bg-white border border-gray-300 hover:bg-gray-50
              ${disableControls ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={disableControls ? "Controls disabled - all prizes won or game completed" : "Toggle sound"}
          >
            {soundEnabled ? (
              <Volume2 className="w-5 h-5 text-gray-600" />
            ) : (
              <VolumeX className="w-5 h-5 text-gray-600" />
            )}
          </button>

          {/* Delay control */}
          {isEditingDelay ? (
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="3"
                max="20"
                value={tempDelay}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    setTempDelay('');
                  } else {
                    const parsedValue = parseInt(value);
                    if (!isNaN(parsedValue)) {
                      setTempDelay(parsedValue);
                    }
                  }
                }}
                className="w-16 px-2 py-1 border rounded text-sm"
                autoFocus
              />
              <button
                onClick={handleDelaySubmit}
                className="px-2 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setTempDelay(delaySeconds);
                  setIsEditingDelay(false);
                }}
                className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditingDelay(true)}
              disabled={disableControls}
              className={`px-2 py-1 text-sm border rounded hover:bg-gray-50
                ${disableControls ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={disableControls ? "Controls disabled - all prizes won or game completed" : "Change delay"}
            >
              {delaySeconds}s
            </button>
          )}

          {/* Play/Pause button */}
          <button
            onClick={handleStatusChange}
            disabled={disableControls || isChangingStatus}
            className={`px-4 py-2 rounded-md text-sm font-medium min-w-[100px] flex items-center justify-center
              ${gameStatus === 'active' 
                ? 'bg-yellow-500 text-white hover:bg-yellow-600' 
                : 'bg-green-500 text-white hover:bg-green-600'
              }
              ${(disableControls || isChangingStatus) ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={disableControls 
              ? "Controls disabled - all prizes won or game completed" 
              : (gameStatus === 'active' ? "Pause game" : "Start/Resume game")
            }
          >
            {isChangingStatus ? (
              <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              getStatusButtonIcon()
            )}
            {getStatusButtonText()}
          </button>

          {/* End Game button */}
          <button
            onClick={() => setShowEndGameConfirm(true)}
            disabled={isChangingStatus}
            className={`px-4 py-2 rounded-md text-sm font-medium bg-red-500 text-white hover:bg-red-600 min-w-[100px] flex items-center justify-center
              ${isChangingStatus ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <StopCircle className="w-4 h-4 mr-2" />
            End Game
          </button>
        </div>
      </div>

      {showEndGameConfirm && (
        <div className="mt-4 p-4 border border-red-200 bg-red-50 rounded-lg">
          <p className="text-red-700">
            Are you sure you want to end the game? This action cannot be undone.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={handleEndGame}
              className="px-4 py-2 rounded-md text-sm font-medium bg-red-500 text-white hover:bg-red-600 min-w-[120px] flex items-center justify-center"
            >
              <StopCircle className="w-4 h-4 mr-2" />
              Yes, End Game
            </button>
            <button
              onClick={() => setShowEndGameConfirm(false)}
              className="px-4 py-2 rounded-md text-sm font-medium bg-white border border-gray-300 hover:bg-gray-50 min-w-[100px]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Display info about auto calling */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-800 text-sm">
        <p className="font-medium">
          Auto Number Calling {gameStatus === 'active' ? 'is Active' : 'is Paused'}
          {isChangingStatus && ' (updating...)'}
        </p>
        <p className="mt-1">
          Numbers will be called automatically every {delaySeconds} seconds when the game is active.
          {gameStatus === 'paused' ? ' Click Start to begin calling numbers.' : ''}
        </p>
        <p className="mt-1">
          Press the {gameStatus === 'active' ? 'Pause' : 'Start'} button to {gameStatus === 'active' ? 'pause' : 'start'} the game.
        </p>
      </div>
    </div>
  );
}

export default GameControls;
