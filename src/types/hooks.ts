// src/types/hooks.ts - FIXED: Updated interface compatibility with new prizeValidation.ts
import type { Game } from './game';

// FIXED: Prize win result interface - updated to match PrizeValidationResult from prizeValidation.ts
export interface PrizeWinResult {
  playerId: string;
  playerName: string;
  phoneNumber: string;
  ticketId: string;
  prizeTypes: string[]; // Multiple prizes
  isWinner: boolean; // Added for compatibility
  winningTickets: string[]; // Added for compatibility  
  prizeType: keyof Game.Winners; // Added for compatibility
  allPrizeTypes: string[]; // Added for compatibility
}

// Shared callback interface for all game hooks - UPDATED with proper typing
export interface GameHookCallbacks {
  onNumberCalled?: (number: number) => void;
  onPrizeWon?: (result: PrizeWinResult) => void;
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

// FIXED: Prize validation result interface for utility functions - updated for compatibility
export interface PrizeValidationResult {
  isWinner: boolean;
  winningTickets: string[];
  prizeType: keyof Game.Winners;
  playerName: string;
  phoneNumber: string;
  allPrizeTypes: string[];
}

// FIXED: Validation context interface for pure validation functions
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

// FIXED: Type helper to convert PrizeValidationResult to PrizeWinResult for compatibility
export function convertPrizeValidationToPrizeWin(
  validationResult: PrizeValidationResult,
  ticketId?: string
): PrizeWinResult {
  return {
    playerId: `player_${Date.now()}`, // Generate a placeholder player ID
    playerName: validationResult.playerName,
    phoneNumber: validationResult.phoneNumber,
    ticketId: ticketId || validationResult.winningTickets[0] || '',
    prizeTypes: validationResult.allPrizeTypes,
    isWinner: validationResult.isWinner,
    winningTickets: validationResult.winningTickets,
    prizeType: validationResult.prizeType,
    allPrizeTypes: validationResult.allPrizeTypes
  };
}

// FIXED: Type guard to check if result is a valid PrizeValidationResult
export function isPrizeValidationResult(result: any): result is PrizeValidationResult {
  return result && 
         typeof result === 'object' &&
         typeof result.isWinner === 'boolean' &&
         Array.isArray(result.winningTickets) &&
         typeof result.prizeType === 'string' &&
         typeof result.playerName === 'string' &&
         typeof result.phoneNumber === 'string' &&
         Array.isArray(result.allPrizeTypes);
}

// FIXED: Type guard to check if result is a valid PrizeWinResult
export function isPrizeWinResult(result: any): result is PrizeWinResult {
  return result && 
         typeof result === 'object' &&
         typeof result.playerId === 'string' &&
         typeof result.playerName === 'string' &&
         typeof result.phoneNumber === 'string' &&
         typeof result.ticketId === 'string' &&
         Array.isArray(result.prizeTypes);
}
