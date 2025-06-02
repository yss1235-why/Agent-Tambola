// src/contexts/GameContext.tsx - PROPER FIX: Immediate state sync and proper error handling
import React, { createContext, useContext, useState, useMemo, ReactNode, useEffect, useCallback } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { useCommandQueue } from '../hooks/useCommandQueue';
import { database } from '../lib/firebase';
import { formatMultiplePrizes } from '../utils/prizeValidation';
import type { CommandResult, CommandError } from '../types/commands';
import type { Game } from '../types/game';

// PROPER FIX: Simplified context type with immediate state tracking
type GameContextType = {
  // Game state (read-only)
  currentGame: Game.CurrentGame | null;
  isLoading: boolean;
  error: string | null;
  
  // PROPER FIX: Real-time command queue state
  isProcessing: boolean;
  queueLength: number;
  currentCommand: string | null;
  
  // Command methods (simplified interface)
  callNumber: (number: number) => string;
  updateGameStatus: (status: 'active' | 'paused' | 'ended', isAutoCalling?: boolean) => string;
  createBooking: (playerName: string, phoneNumber: string, tickets: string[]) => string;
  updateBooking: (ticketId: string, playerName?: string, phoneNumber?: string) => string;
  updateGameSettings: (settings: Partial<Game.Settings>) => string;
  initializeGame: (settings: Game.Settings, tickets?: Record<string, Game.Ticket>) => string;
  startBookingPhase: (settings: Game.Settings, tickets: Record<string, Game.Ticket>) => string;
  startPlayingPhase: () => string;
  completeGame: (reason?: string) => string;
  updateCallDelay: (callDelay: number) => string;
  updateSoundSettings: (soundEnabled: boolean) => string;
  cancelBooking: (ticketIds: string[]) => string;
  
  // Utilities
  hostId: string | null;
  clearError: () => void;
  
  // PROPER FIX: System health monitoring
  systemHealth: { healthy: boolean; issues: string[] };
};

const GameContext = createContext<GameContextType | undefined>(undefined);

interface GameProviderProps {
  children: ReactNode;
  hostId: string | null;
}

export function GameProvider({ children, hostId }: GameProviderProps) {
  // PROPER FIX: Local state with immediate updates
  const [currentGame, setCurrentGame] = useState<Game.CurrentGame | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // PROPER FIX: Direct Firebase subscription with immediate updates
  useEffect(() => {
    if (!hostId) {
      setCurrentGame(null);
      setIsLoading(false);
      return;
    }

    console.log(`🔌 Subscribing to game data for host: ${hostId}`);
    setIsLoading(true);
    
    const gameRef = ref(database, `hosts/${hostId}/currentGame`);
    
    const unsubscribe = onValue(
      gameRef,
      (snapshot) => {
        try {
          const data = snapshot.exists() ? snapshot.val() as Game.CurrentGame : null;
          
          console.log(`📊 Game data updated:`, {
            hasData: !!data,
            phase: data?.gameState?.phase,
            status: data?.gameState?.status,
            calledNumbers: data?.numberSystem?.calledNumbers?.length || 0
          });
          
          setCurrentGame(data);
          setIsLoading(false);
          setError(null);
        } catch (error) {
          console.error('Error processing game data:', error);
          setError(error instanceof Error ? error.message : 'Data processing error');
          setIsLoading(false);
        }
      },
      (error) => {
        console.error('Firebase subscription error:', error);
        setError(error instanceof Error ? error.message : 'Subscription error');
        setIsLoading(false);
      }
    );

    return () => {
      console.log(`🔌 Unsubscribing from game data for host: ${hostId}`);
      off(gameRef, 'value', unsubscribe);
    };
  }, [hostId]);

  // PROPER FIX: Command queue with immediate result handling
  const commandQueue = useCommandQueue({
    hostId: hostId || '',
    onResult: useCallback((result: CommandResult) => {
      console.log(`✅ Command result: ${result.command.type}`, result);
      
      // PROPER FIX: Clear error on successful command
      if (result.success) {
        setError(null);
        
        // PROPER FIX: Handle specific successful commands
        switch (result.command.type) {
          case 'CALL_NUMBER':
            console.log(`🎲 Number ${result.data?.number} called successfully`);
            break;
          case 'CREATE_BOOKING':
            console.log(`🎫 Booking created for ${result.data?.playerName}`);
            break;
          case 'UPDATE_PRIZE_WINNERS':
            const prizeText = formatMultiplePrizes(result.data?.allPrizeTypes || [result.data?.prizeType]);
            console.log(`🎉 Prize won: ${result.data?.playerName} - ${prizeText}`);
            break;
          case 'COMPLETE_GAME':
            console.log(`🏁 Game completed successfully`);
            break;
        }
      } else {
        // PROPER FIX: Set error for failed commands
        console.error(`❌ Command failed: ${result.command.type}`, result.error);
        setError(result.error || 'Command failed');
      }
    }, []),
    onError: useCallback((error: CommandError) => {
      console.error(`🚨 Command error: ${error.command.type}`, error);
      
      // PROPER FIX: Immediately update error state
      setError(error.message);
      
      // PROPER FIX: Auto-clear non-critical errors
      if (error.message.includes('timeout') || error.message.includes('network')) {
        setTimeout(() => {
          setError(null);
        }, 5000);
      }
    }, [])
  });

  // PROPER FIX: Clear error function
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // PROPER FIX: Context value with real-time state
  const contextValue = useMemo(() => ({
    // Game state (read-only)
    currentGame,
    isLoading,
    error,
    
    // PROPER FIX: Real-time command queue state
    isProcessing: commandQueue.isProcessing,
    queueLength: commandQueue.queueLength,
    currentCommand: commandQueue.currentCommand,
    
    // Command methods (direct pass-through)
    callNumber: commandQueue.callNumber,
    updateGameStatus: commandQueue.updateGameStatus,
    createBooking: commandQueue.createBooking,
    updateBooking: commandQueue.updateBooking,
    updateGameSettings: commandQueue.updateGameSettings,
    initializeGame: commandQueue.initializeGame,
    startBookingPhase: commandQueue.startBookingPhase,
    startPlayingPhase: commandQueue.startPlayingPhase,
    completeGame: commandQueue.completeGame,
    updateCallDelay: commandQueue.updateCallDelay,
    updateSoundSettings: commandQueue.updateSoundSettings,
    cancelBooking: commandQueue.cancelBooking,
    
    // Utilities
    hostId,
    clearError,
    
    // PROPER FIX: System health
    systemHealth: commandQueue.systemHealth
  }), [
    currentGame, isLoading, error,
    commandQueue.isProcessing, commandQueue.queueLength, commandQueue.currentCommand,
    commandQueue.callNumber, commandQueue.updateGameStatus, commandQueue.createBooking,
    commandQueue.updateBooking, commandQueue.updateGameSettings, commandQueue.initializeGame,
    commandQueue.startBookingPhase, commandQueue.startPlayingPhase, commandQueue.completeGame,
    commandQueue.updateCallDelay, commandQueue.updateSoundSettings, commandQueue.cancelBooking,
    hostId, clearError, commandQueue.systemHealth
  ]);
  
  return (
    <GameContext.Provider value={contextValue}>
      {children}
      
      {/* PROPER FIX: Simple status indicator (no intrusive UI) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 left-4 bg-black bg-opacity-75 text-white text-xs p-2 rounded z-50">
          <div>Queue: {commandQueue.queueLength}</div>
          <div>Processing: {commandQueue.isProcessing ? 'Yes' : 'No'}</div>
          {commandQueue.currentCommand && (
            <div>Current: {commandQueue.currentCommand}</div>
          )}
          {!commandQueue.systemHealth.healthy && (
            <div className="text-red-300">Health: {commandQueue.systemHealth.issues.length} issues</div>
          )}
        </div>
      )}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}

export default GameContext;
