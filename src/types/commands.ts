// src/types/commands.ts - UPDATED with Regenerate Tickets Command
// Command type definitions for the Command Queue Pattern

import type { Game } from './game';

// Base command interface with proper structure
export interface BaseCommand {
  id: string;
  type: string;
  timestamp: number;
  hostId: string;
}

// Individual command interfaces with proper inheritance
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
    allPrizeTypes: string[];
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
  payload: Record<string, never>; // Empty object type
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

export interface ReturnToSetupCommand extends BaseCommand {
  type: 'RETURN_TO_SETUP';
  payload: {
    clearBookings?: boolean;
  };
}

// NEW: Regenerate Tickets Command
export interface RegenerateTicketsCommand extends BaseCommand {
  type: 'REGENERATE_TICKETS';
  payload: {
    selectedTicketSet: number;
    maxTickets: number;
  };
}

// Union type of all possible commands with proper discrimination
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
  | CancelBookingCommand
  | ReturnToSetupCommand
  | RegenerateTicketsCommand; // NEW: Added to union type

// Command result interface
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

// Priority command interface
export interface PriorityCommand {
  command: GameCommand;
  priority: CommandPriority;
  timestamp: number;
  retryCount: number;
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

// Helper type for creating commands without id, timestamp, and hostId
export type CreateCommand<T extends GameCommand> = Omit<T, 'id' | 'timestamp' | 'hostId'>;

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
  returnToSetup: (hostId: string, clearBookings?: boolean) => ReturnToSetupCommand;
  regenerateTickets: (hostId: string, selectedTicketSet: number, maxTickets: number) => RegenerateTicketsCommand; // NEW
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

// Type guards for command discrimination
export function isCallNumberCommand(command: GameCommand): command is CallNumberCommand {
  return command.type === 'CALL_NUMBER';
}

export function isUpdateGameStatusCommand(command: GameCommand): command is UpdateGameStatusCommand {
  return command.type === 'UPDATE_GAME_STATUS';
}

export function isCreateBookingCommand(command: GameCommand): command is CreateBookingCommand {
  return command.type === 'CREATE_BOOKING';
}

export function isUpdateBookingCommand(command: GameCommand): command is UpdateBookingCommand {
  return command.type === 'UPDATE_BOOKING';
}

export function isUpdatePrizeWinnersCommand(command: GameCommand): command is UpdatePrizeWinnersCommand {
  return command.type === 'UPDATE_PRIZE_WINNERS';
}

export function isUpdateGameSettingsCommand(command: GameCommand): command is UpdateGameSettingsCommand {
  return command.type === 'UPDATE_GAME_SETTINGS';
}

export function isInitializeGameCommand(command: GameCommand): command is InitializeGameCommand {
  return command.type === 'INITIALIZE_GAME';
}

export function isStartBookingPhaseCommand(command: GameCommand): command is StartBookingPhaseCommand {
  return command.type === 'START_BOOKING_PHASE';
}

export function isStartPlayingPhaseCommand(command: GameCommand): command is StartPlayingPhaseCommand {
  return command.type === 'START_PLAYING_PHASE';
}

export function isCompleteGameCommand(command: GameCommand): command is CompleteGameCommand {
  return command.type === 'COMPLETE_GAME';
}

export function isUpdateCallDelayCommand(command: GameCommand): command is UpdateCallDelayCommand {
  return command.type === 'UPDATE_CALL_DELAY';
}

export function isUpdateSoundSettingsCommand(command: GameCommand): command is UpdateSoundSettingsCommand {
  return command.type === 'UPDATE_SOUND_SETTINGS';
}

export function isCancelBookingCommand(command: GameCommand): command is CancelBookingCommand {
  return command.type === 'CANCEL_BOOKING';
}

export function isReturnToSetupCommand(command: GameCommand): command is ReturnToSetupCommand {
  return command.type === 'RETURN_TO_SETUP';
}

// NEW: Type guard for regenerate tickets command
export function isRegenerateTicketsCommand(command: GameCommand): command is RegenerateTicketsCommand {
  return command.type === 'REGENERATE_TICKETS';
}

// Command factory implementation
export const createCommandFactory = (generateId: () => string): CommandFactory => ({
  callNumber: (hostId: string, number: number): CallNumberCommand => ({
    id: generateId(),
    type: 'CALL_NUMBER',
    timestamp: Date.now(),
    hostId,
    payload: { number }
  }),

  updateGameStatus: (hostId: string, status: 'active' | 'paused' | 'ended', isAutoCalling?: boolean): UpdateGameStatusCommand => ({
    id: generateId(),
    type: 'UPDATE_GAME_STATUS',
    timestamp: Date.now(),
    hostId,
    payload: { status, isAutoCalling }
  }),

  createBooking: (hostId: string, playerName: string, phoneNumber: string, tickets: string[]): CreateBookingCommand => ({
    id: generateId(),
    type: 'CREATE_BOOKING',
    timestamp: Date.now(),
    hostId,
    payload: { playerName, phoneNumber, tickets }
  }),

  updatePrizeWinners: (hostId: string, prizeType: keyof Game.Winners, ticketIds: string[], playerName: string, phoneNumber: string, allPrizeTypes: string[]): UpdatePrizeWinnersCommand => ({
    id: generateId(),
    type: 'UPDATE_PRIZE_WINNERS',
    timestamp: Date.now(),
    hostId,
    payload: { prizeType, ticketIds, playerName, phoneNumber, allPrizeTypes }
  }),

  updateGameSettings: (hostId: string, settings: Partial<Game.Settings>): UpdateGameSettingsCommand => ({
    id: generateId(),
    type: 'UPDATE_GAME_SETTINGS',
    timestamp: Date.now(),
    hostId,
    payload: settings
  }),

  completeGame: (hostId: string, reason?: string): CompleteGameCommand => ({
    id: generateId(),
    type: 'COMPLETE_GAME',
    timestamp: Date.now(),
    hostId,
    payload: { reason }
  }),

  returnToSetup: (hostId: string, clearBookings?: boolean): ReturnToSetupCommand => ({
    id: generateId(),
    type: 'RETURN_TO_SETUP',
    timestamp: Date.now(),
    hostId,
    payload: { clearBookings: clearBookings ?? true }
  }),

  // NEW: Regenerate tickets factory method
  regenerateTickets: (hostId: string, selectedTicketSet: number, maxTickets: number): RegenerateTicketsCommand => ({
    id: generateId(),
    type: 'REGENERATE_TICKETS',
    timestamp: Date.now(),
    hostId,
    payload: { selectedTicketSet, maxTickets }
  })
});

// Utility function to get command priority
export function getCommandPriority(command: GameCommand): CommandPriority {
  switch (command.type) {
    case 'UPDATE_GAME_STATUS':
    case 'COMPLETE_GAME':
      return CommandPriority.CRITICAL;
    
    case 'CALL_NUMBER':
    case 'CREATE_BOOKING':
    case 'UPDATE_PRIZE_WINNERS':
    case 'INITIALIZE_GAME':
    case 'START_BOOKING_PHASE':
    case 'START_PLAYING_PHASE':
    case 'CANCEL_BOOKING':
    case 'RETURN_TO_SETUP':
    case 'REGENERATE_TICKETS': // NEW: High priority for ticket regeneration
      return CommandPriority.HIGH;
    
    case 'UPDATE_BOOKING':
    case 'UPDATE_GAME_SETTINGS':
    case 'UPDATE_CALL_DELAY':
    case 'UPDATE_SOUND_SETTINGS':
      return CommandPriority.NORMAL;
    
    default:
      return CommandPriority.LOW;
  }
}

// Utility function to validate command structure
export function validateCommandStructure(command: any): command is GameCommand {
  return (
    typeof command === 'object' &&
    command !== null &&
    typeof command.id === 'string' &&
    typeof command.type === 'string' &&
    typeof command.timestamp === 'number' &&
    typeof command.hostId === 'string' &&
    typeof command.payload === 'object'
  );
}
