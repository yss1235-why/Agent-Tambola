// src/types/commands.ts
// Command type definitions for the Command Queue Pattern
// This file defines all possible commands that can be sent through the queue

import type { Game } from './game';

export interface BaseCommand {
  id: string;
  type: string;
  timestamp: number;
  hostId: string;
}

export interface CallNumberCommand extends BaseCommand {
  type: 'CALL_NUMBER';
  payload: {
    number: number;
  };
}

export interface UpdateGameStatusCommand extends BaseCommand {
  type: 'UPDATE_GAME_STATUS';
  payload: {
    status: 'active' | 'paused' | 'ended';
    isAutoCalling?: boolean;
  };
}

export interface CreateBookingCommand extends BaseCommand {
  type: 'CREATE_BOOKING';
  payload: {
    playerName: string;
    phoneNumber: string;
    tickets: string[];
  };
}

export interface UpdateBookingCommand extends BaseCommand {
  type: 'UPDATE_BOOKING';
  payload: {
    ticketId: string;
    playerName?: string;
    phoneNumber?: string;
  };
}

export interface UpdatePrizeWinnersCommand extends BaseCommand {
  type: 'UPDATE_PRIZE_WINNERS';
  payload: {
    prizeType: keyof Game.Winners;
    ticketIds: string[];
    playerName: string;
    phoneNumber: string;
    allPrizeTypes: string[]; // For multiple prizes
  };
}

export interface UpdateGameSettingsCommand extends BaseCommand {
  type: 'UPDATE_GAME_SETTINGS';
  payload: Partial<Game.Settings>;
}

export interface InitializeGameCommand extends BaseCommand {
  type: 'INITIALIZE_GAME';
  payload: {
    settings: Game.Settings;
    tickets: Record<string, Game.Ticket>;
  };
}

export interface StartBookingPhaseCommand extends BaseCommand {
  type: 'START_BOOKING_PHASE';
  payload: {
    settings: Game.Settings;
    tickets: Record<string, Game.Ticket>;
  };
}

export interface StartPlayingPhaseCommand extends BaseCommand {
  type: 'START_PLAYING_PHASE';
  payload: {};
}

export interface CompleteGameCommand extends BaseCommand {
  type: 'COMPLETE_GAME';
  payload: {
    reason?: string;
  };
}

export interface UpdateCallDelayCommand extends BaseCommand {
  type: 'UPDATE_CALL_DELAY';
  payload: {
    callDelay: number;
  };
}

export interface UpdateSoundSettingsCommand extends BaseCommand {
  type: 'UPDATE_SOUND_SETTINGS';
  payload: {
    soundEnabled: boolean;
  };
}

export interface CancelBookingCommand extends BaseCommand {
  type: 'CANCEL_BOOKING';
  payload: {
    ticketIds: string[];
  };
}

// Union type of all possible commands
export type GameCommand = 
  | CallNumberCommand
  | UpdateGameStatusCommand
  | CreateBookingCommand
  | UpdateBookingCommand
  | UpdatePrizeWinnersCommand
  | UpdateGameSettingsCommand
  | InitializeGameCommand
  | StartBookingPhaseCommand
  | StartPlayingPhaseCommand
  | CompleteGameCommand
  | UpdateCallDelayCommand
  | UpdateSoundSettingsCommand
  | CancelBookingCommand;

export interface CommandResult {
  success: boolean;
  command: GameCommand;
  error?: string;
  data?: any;
  timestamp: number;
}

// Command execution context
export interface CommandContext {
  hostId: string;
  currentGame?: Game.CurrentGame | null;
  timestamp: number;
}

// Command validation result
export interface CommandValidationResult {
  isValid: boolean;
  error?: string;
}

// Command execution priority levels
export enum CommandPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

// Extended command interface with priority
export interface PriorityCommand extends GameCommand {
  priority?: CommandPriority;
}

// Command execution statistics
export interface CommandStats {
  totalExecuted: number;
  totalFailed: number;
  averageExecutionTime: number;
  lastExecutionTime: number;
}

// Command error types
export enum CommandErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  EXECUTION_ERROR = 'EXECUTION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR'
}

export interface CommandError {
  type: CommandErrorType;
  message: string;
  command: GameCommand;
  timestamp: number;
  stack?: string;
}

// Command retry configuration
export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  exponentialBackoff: boolean;
}

// Command execution options
export interface CommandExecutionOptions {
  timeout?: number;
  retryConfig?: RetryConfig;
  priority?: CommandPriority;
  skipValidation?: boolean;
}

// Helper type for creating commands without id and timestamp
export type CreateCommand<T extends GameCommand> = Omit<T, 'id' | 'timestamp'>;

// Helper type for command payloads
export type CommandPayload<T extends GameCommand> = T['payload'];

// Command factory helper types
export interface CommandFactory {
  callNumber: (hostId: string, number: number) => CallNumberCommand;
  updateGameStatus: (hostId: string, status: 'active' | 'paused' | 'ended', isAutoCalling?: boolean) => UpdateGameStatusCommand;
  createBooking: (hostId: string, playerName: string, phoneNumber: string, tickets: string[]) => CreateBookingCommand;
  updatePrizeWinners: (hostId: string, prizeType: keyof Game.Winners, ticketIds: string[], playerName: string, phoneNumber: string, allPrizeTypes: string[]) => UpdatePrizeWinnersCommand;
  updateGameSettings: (hostId: string, settings: Partial<Game.Settings>) => UpdateGameSettingsCommand;
  completeGame: (hostId: string, reason?: string) => CompleteGameCommand;
}

// Command validation functions type
export type CommandValidator<T extends GameCommand> = (command: T, context: CommandContext) => CommandValidationResult;

// Command execution functions type
export type CommandExecutor<T extends GameCommand> = (command: T, context: CommandContext) => Promise<CommandResult>;

// Export helper function types
export interface CommandHelpers {
  generateCommandId: () => string;
  validateCommand: (command: GameCommand, context: CommandContext) => CommandValidationResult;
  createCommandResult: (command: GameCommand, success: boolean, data?: any, error?: string) => CommandResult;
}
