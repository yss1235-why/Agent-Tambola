// src/types/hooks.ts
import type { Game } from './game';

// Shared callback interface for all game hooks
export interface GameHookCallbacks {
  onNumberCalled?: (number: number) => void;
  onPrizeWon?: (prizeType: keyof Game.Winners, ticketIds: string[]) => void;
  onQueueChanged?: (queue: number[]) => void;
  onGameComplete?: () => void;
  onError?: (error: string) => void;
}

// Game state interface
export interface GameControllerState {
  isProcessing: boolean;
  isPaused: boolean;
  queueNumbers: number[];
  calledNumbers: number[];
  currentNumber: number | null;
  gameState: Game.CurrentGame | null;
  error: string | null;
  allPrizesWon: boolean;
  isGameEnded: boolean;
}

// Database hook interface
export interface DatabaseHookReturn {
  updateGameState: (updates: Partial<Game.GameState>) => Promise<void>;
  updateNumberSystem: (updates: Partial<Game.NumberSystem>) => Promise<void>;
  getGameData: () => Promise<Game.CurrentGame | null>;
  saveGameToHistory: (game: Game.CurrentGame) => Promise<void>;
  subscribeToGame: (callback: (game: Game.CurrentGame | null) => void) => () => void;
}

// Number calling hook interface
export interface NumberCallingHookReturn {
  generateNumber: () => Promise<number | null>;
  scheduleNext: () => void;
  clearSchedule: () => void;
  setDelay: (seconds: number) => void;
  callDelay: number;
}

// Game state hook interface
export interface GameStateHookReturn {
  pauseGame: () => Promise<void>;
  resumeGame: () => Promise<void>;
  completeGame: () => Promise<void>;
  resetError: () => void;
  gameState: Game.CurrentGame | null;
  isGameEnded: boolean;
  allPrizesWon: boolean;
  error: string | null;
}

// Audio hook interface
export interface AudioHookReturn {
  announceNumber: (number: number) => Promise<void>;
  playPrizeWinSound: (prizeType: keyof Game.Winners) => Promise<void>;
  setVolume: (volume: number) => void;
  setEnabled: (enabled: boolean) => void;
  isEnabled: boolean;
}

// Prize validation hook interface
export interface PrizeValidationHookReturn {
  validatePrizes: (calledNumbers: number[]) => Promise<void>;
  isValidating: boolean;
}
