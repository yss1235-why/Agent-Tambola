// src/contexts/GameContext.tsx - UPDATED to use Command Queue Pattern
// This replaces the complex game controller with a simple command-based system

import React, { createContext, useContext, useState, useMemo, ReactNode, useEffect } from 'react';
import { useCommandQueue } from '../hooks/useCommandQueue';
import { useGameDatabase } from '../hooks/useGameDatabase';
import { formatMultiplePrizes } from '../utils/prizeValidation';
import type { CommandResult, CommandError } from '../types/commands';
import type { Game } from '../types/game';

// Simplified context type - commands replace complex methods
type GameContextType = {
  // Game state (read-only)
  currentGame: Game.CurrentGame | null;
  isLoading: boolean;
  error: string | null;
  
  // Command queue state
  isProcessing: boolean;
  queueLength: number;
  
  // Simple command methods (replace complex game controller)
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
  
  // Notifications for UI
  toastNotifications: Array<{
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
  }>;
  announceWinner: (winner: { 
    playerName: string; 
    prizeTypes: string[]; 
    ticketId: string;
    playerId: string;
    phoneNumber: string;
  }) => void;
};

const GameContext = createContext<GameContextType | undefined>(undefined);

interface GameProviderProps {
  children: ReactNode;
  hostId: string | null;
}

export function GameProvider({ children, hostId }: GameProviderProps) {
  // Local state for UI
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastNotifications, setToastNotifications] = useState<Array<{
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
  }>>([]);

  // Use database hook for reading game state only
  const { gameState: currentGame, subscribeToGame } = useGameDatabase({
    hostId: hostId || '',
    onError: (err) => setError(err)
  });

  // Use command queue for all actions
  const commandQueue = useCommandQueue({
    hostId: hostId || '',
    onResult: (result: CommandResult) => {
      console.log(`✅ Command completed: ${result.command.type}`, result);
      
      // Handle specific command results for UI feedback
      if (result.success) {
        switch (result.command.type) {
          case 'CALL_NUMBER':
            addToast(`Number ${result.data?.number} called`, 'info');
            break;
          case 'CREATE_BOOKING':
            addToast(`Booking created for ${result.data?.playerName}`, 'success');
            break;
          case 'UPDATE_PRIZE_WINNERS':
            const prizeText = formatMultiplePrizes(result.data?.allPrizeTypes || [result.data?.prizeType]);
            addToast(`🎉 ${result.data?.playerName} won ${prizeText}!`, 'success');
            break;
          case 'COMPLETE_GAME':
            addToast('🎉 Game completed successfully!', 'success');
            break;
        }
      }
    },
    onError: (error: CommandError) => {
      console.error(`❌ Command failed: ${error.command.type}`, error);
      addToast(`Error: ${error.message}`, 'error');
    }
  });

  // Subscribe to game state changes
  useEffect(() => {
    if (!hostId) return;

    setIsLoading(true);
    
    const unsubscribe = subscribeToGame((game) => {
      setIsLoading(false);
      // Game state is automatically updated via useGameDatabase
    });

    return unsubscribe;
  }, [hostId, subscribeToGame]);

  // Toast notification helpers
  const addToast = (message: string, type: 'success' | 'error' | 'info') => {
    const id = Date.now().toString();
    setToastNotifications(prev => [...prev, { id, message, type }]);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setToastNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const announceWinner = (winner: { 
    playerName: string; 
    prizeTypes: string[]; 
    ticketId: string;
    playerId: string;
    phoneNumber: string;
  }) => {
    const prizeText = formatMultiplePrizes(winner.prizeTypes);
    const message = `🎉 ${winner.playerName} won ${prizeText} with ticket ${winner.ticketId}!`;
    
    console.log(message);
    addToast(message, 'success');
  };

  const clearError = () => {
    setError(null);
  };

  // Context value with simplified interface
  const contextValue = useMemo(() => ({
    // Game state (read-only)
    currentGame,
    isLoading,
    error,
    
    // Command queue state
    isProcessing: commandQueue.isProcessing,
    queueLength: commandQueue.queueLength,
    
    // Simple command methods
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
    toastNotifications,
    announceWinner
  }), [
    currentGame, isLoading, error,
    commandQueue.isProcessing, commandQueue.queueLength,
    commandQueue.callNumber, commandQueue.updateGameStatus, commandQueue.createBooking,
    commandQueue.updateBooking, commandQueue.updateGameSettings, commandQueue.initializeGame,
    commandQueue.startBookingPhase, commandQueue.startPlayingPhase, commandQueue.completeGame,
    commandQueue.updateCallDelay, commandQueue.updateSoundSettings, commandQueue.cancelBooking,
    hostId, toastNotifications
  ]);
  
  return (
    <GameContext.Provider value={contextValue}>
      {children}
      
      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {toastNotifications.map((notification) => (
          <div
            key={notification.id}
            className={`max-w-sm px-4 py-3 rounded-lg shadow-lg transform transition-all duration-300 ${
              notification.type === 'success' 
                ? 'bg-green-500 text-white' 
                : notification.type === 'error'
                ? 'bg-red-500 text-white'
                : 'bg-blue-500 text-white'
            }`}
          >
            <div className="flex items-start">
              <div className="flex-1">
                <p className="text-sm font-medium">{notification.message}</p>
              </div>
              <button
                onClick={() => {
                  setToastNotifications(prev => 
                    prev.filter(n => n.id !== notification.id)
                  );
                }}
                className="ml-2 flex-shrink-0 text-white hover:text-gray-200"
              >
                <span className="sr-only">Close</span>
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
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
