// src/types/hooks.ts - Updated for simplified validation system
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

// Simplified prize validation hook interface
export interface PrizeValidationHookReturn {
  validatePrizes: (calledNumbers: number[]) => Promise<void>;
  isValidating: boolean;
}

// Prize validation result interface for utility functions - UPDATED
export interface PrizeValidationResult {
  isWinner: boolean;
  winningTickets: string[];
  prizeType: keyof Game.Winners;
  playerName: string;
  phoneNumber: string;
  allPrizeTypes: string[]; // New: for multiple prizes
}

// Validation context interface for pure validation functions
export interface ValidationContext {
  tickets: Record<string, Game.Ticket>;
  bookings: Record<string, Game.Booking>;
  calledNumbers: number[];
  currentWinners: Game.Winners;
  activePrizes: Game.Settings['prizes'];
}

// Game controller interface for the main useGameController hook
export interface GameControllerReturn extends GameControllerState {
  // Game control actions
  pauseGame: () => Promise<void>;
  resumeGame: () => Promise<void>;
  completeGame: () => Promise<void>;
  generateAndCallNumber: () => Promise<number | null>;
  setCallDelay: (delay: number) => Promise<void>;
  
  // Manual validation trigger for debugging
  triggerPrizeValidation?: () => Promise<void>;
  
  // Audio controls
  setSoundEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
  
  // Utility functions
  resetError: () => void;
}

// Booking management interface
export interface BookingHookReturn {
  createBooking: (playerData: { name: string; phone: string; tickets: string[] }) => Promise<void>;
  updateBooking: (ticketId: string, updates: { name?: string; phone?: string }) => Promise<void>;
  cancelBooking: (ticketIds: string[]) => Promise<void>;
  getPlayerBookings: (playerName: string, phoneNumber: string) => Promise<string[]>;
  getAvailableTickets: () => Promise<string[]>;
  isProcessing: boolean;
}

// Settings management interface
export interface SettingsHookReturn {
  updateSettings: (settings: Partial<Game.Settings>) => Promise<void>;
  saveDefaultSettings: (settings: Game.Settings) => Promise<void>;
  getDefaultSettings: () => Promise<Game.Settings | null>;
  isLoading: boolean;
  error: string | null;
}

// History management interface
export interface HistoryHookReturn {
  getGameHistory: () => Promise<Game.GameSession[]>;
  saveGameToHistory: (game: Game.CurrentGame) => Promise<void>;
  exportGameSession: (sessionId: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

// Ticket management interface
export interface TicketHookReturn {
  loadTicketSet: (setId: number, maxTickets: number) => Promise<Record<string, Game.Ticket>>;
  validateTicketData: (tickets: Record<string, Game.Ticket>) => boolean;
  isLoading: boolean;
  error: string | null;
}
