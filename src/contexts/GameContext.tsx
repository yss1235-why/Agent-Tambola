// src/contexts/GameContext.tsx - Updated with correct imports
import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import { useGameController, PrizeWinResult } from '../hooks/useGameController'; // Updated import
import { formatMultiplePrizes } from '../utils/prizeValidation'; // Updated import
import type { Game } from '../types/game';

type GameContextType = ReturnType<typeof useGameController> & {
  hostId: string | null;
  announceWinner: (winner: PrizeWinResult) => void;
  toastNotifications: Array<{
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
  }>;
};

const GameContext = createContext<GameContextType | undefined>(undefined);

interface GameProviderProps {
  children: ReactNode;
  hostId: string | null;
}

export function GameProvider({ children, hostId }: GameProviderProps) {
  const [toastNotifications, setToastNotifications] = useState<Array<{
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
  }>>([]);

  const announceWinner = (winner: PrizeWinResult) => {
    const prizeText = formatMultiplePrizes(winner.prizeTypes);
    const message = `🎉 ${winner.playerName} won ${prizeText} with ticket ${winner.ticketId}!`;
    
    console.log(message);
    
    // Add toast notification
    const notificationId = Date.now().toString();
    setToastNotifications(prev => [...prev, {
      id: notificationId,
      message,
      type: 'success'
    }]);

    // Remove notification after 5 seconds
    setTimeout(() => {
      setToastNotifications(prev => prev.filter(n => n.id !== notificationId));
    }, 5000);
  };

  const gameController = useGameController({
    hostId: hostId || '',
    onNumberCalled: (number: number) => {
      console.log(`📢 Number called: ${number}`);
    },
    onPrizeWon: (winner: PrizeWinResult) => {
      announceWinner(winner);
      console.log(`🏆 Prize won by ${winner.playerName}:`, winner.prizeTypes);
    },
    onGameComplete: () => {
      console.log('🎉 Game completed successfully');
      announceWinner({
        playerId: 'system',
        playerName: 'Game',
        ticketId: '',
        prizeTypes: ['Game Complete'],
        phoneNumber: ''
      });
    },
    onError: (error: string) => {
      console.error('🚨 Game error:', error);
      
      // Add error notification
      const notificationId = Date.now().toString();
      setToastNotifications(prev => [...prev, {
        id: notificationId,
        message: `Error: ${error}`,
        type: 'error'
      }]);

      setTimeout(() => {
        setToastNotifications(prev => prev.filter(n => n.id !== notificationId));
      }, 8000);
    }
  });
  
  const contextValue = useMemo(() => ({
    ...gameController,
    hostId,
    announceWinner,
    toastNotifications
  }), [gameController, hostId, toastNotifications]);
  
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
