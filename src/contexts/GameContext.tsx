// src/contexts/GameContext.tsx - Updated without deleted services

import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import { useGameController } from '../hooks/useGameController';
import type { Game } from '../types/game';

type GameContextType = ReturnType<typeof useGameController> & {
  hostId: string | null;
};

const GameContext = createContext<GameContextType | undefined>(undefined);

interface GameProviderProps {
  children: ReactNode;
  hostId: string | null;
}

export function GameProvider({ children, hostId }: GameProviderProps) {
  const [callbackHandlers] = useState({
    onNumberCalled: (number: number) => {
      console.log(`Number called: ${number}`);
    },
    onPrizeWon: (prizeType: keyof Game.Winners, ticketIds: string[]) => {
      console.log(`Prize won: ${prizeType}`, ticketIds);
    },
    onQueueChanged: (queue: number[]) => {
      console.log(`Queue updated: ${queue.length} numbers`);
    },
    onGameComplete: () => {
      console.log('Game completed');
    },
    onError: (error: string) => {
      console.error('Game error:', error);
    }
  });
  
  const gameController = useGameController({
    hostId: hostId || '',
    ...callbackHandlers
  });
  
  const contextValue = useMemo(() => ({
    ...gameController,
    hostId
  }), [gameController, hostId]);
  
  return (
    <GameContext.Provider value={contextValue}>
      {children}
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
