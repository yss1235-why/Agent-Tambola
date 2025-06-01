// src/services/CommandProcessor.ts - FIXED TypeScript compilation errors
// Command processor that executes all commands and handles Firebase writes
// This is the ONLY place where Firebase writes should happen

import { GameCommand, CommandResult, CommandContext, CommandValidationResult } from '../types/commands';
import { GameDatabaseService } from './GameDatabaseService';
import { validateAllPrizes, ValidationContext } from '../utils/prizeValidation';
import { AudioManager } from '../utils/audioManager';
import { loadTicketData, validateTicketData } from '../utils/ticketLoader';
import type { Game } from '../types/game';

export class CommandProcessor {
  private static instance: CommandProcessor;
  private databaseService: GameDatabaseService;
  private audioManager: AudioManager;
  
  // Cache for frequently accessed data
  private gameStateCache = new Map<string, { game: Game.CurrentGame; timestamp: number }>();
  private readonly CACHE_TTL = 5000; // 5 seconds
  
  private constructor() {
    this.databaseService = GameDatabaseService.getInstance();
    this.audioManager = AudioManager.getInstance();
  }
  
  public static getInstance(): CommandProcessor {
    if (!CommandProcessor.instance) {
      CommandProcessor.instance = new CommandProcessor();
    }
    return CommandProcessor.instance;
  }
  
  /**
   * Execute a command and return the result
   */
  public async execute(command: GameCommand): Promise<CommandResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🎯 Executing command: ${command.type} (${command.id})`);
      
      // Create execution context
      const context: CommandContext = {
        hostId: command.hostId,
        currentGame: await this.getCurrentGame(command.hostId),
        timestamp: command.timestamp
      };
      
      // Validate command
      const validation = this.validateCommand(command, context);
      if (!validation.isValid) {
        return this.createErrorResult(command, validation.error || 'Command validation failed');
      }
      
      // Route to appropriate executor
      let result: CommandResult;
      
      switch (command.type) {
        case 'CALL_NUMBER':
          result = await this.executeCallNumber(command, context);
          break;
        case 'UPDATE_GAME_STATUS':
          result = await this.executeUpdateGameStatus(command, context);
          break;
        case 'CREATE_BOOKING':
          result = await this.executeCreateBooking(command, context);
          break;
        case 'UPDATE_BOOKING':
          result = await this.executeUpdateBooking(command, context);
          break;
        case 'UPDATE_PRIZE_WINNERS':
          result = await this.executeUpdatePrizeWinners(command, context);
          break;
        case 'UPDATE_GAME_SETTINGS':
          result = await this.executeUpdateGameSettings(command, context);
          break;
        case 'INITIALIZE_GAME':
          result = await this.executeInitializeGame(command, context);
          break;
        case 'START_BOOKING_PHASE':
          result = await this.executeStartBookingPhase(command, context);
          break;
        case 'START_PLAYING_PHASE':
          result = await this.executeStartPlayingPhase(command, context);
          break;
        case 'COMPLETE_GAME':
          result = await this.executeCompleteGame(command, context);
          break;
        case 'UPDATE_CALL_DELAY':
          result = await this.executeUpdateCallDelay(command, context);
          break;
        case 'UPDATE_SOUND_SETTINGS':
          result = await this.executeUpdateSoundSettings(command, context);
          break;
        case 'CANCEL_BOOKING':
          result = await this.executeCancelBooking(command, context);
          break;
        default:
          throw new Error(`Unknown command type: ${(command as any).type}`);
      }
      
      const executionTime = Date.now() - startTime;
      console.log(`✅ Command executed successfully: ${command.type} (${executionTime}ms)`);
      
      // Invalidate cache after successful write operations
      if (result.success) {
        this.invalidateCache(command.hostId);
      }
      
      return result;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`❌ Command execution failed: ${command.type} (${executionTime}ms)`, error);
      
      return this.createErrorResult(
        command,
        error instanceof Error ? error.message : 'Unknown execution error'
      );
    }
  }
  
  /**
   * Get current game with caching
   */
  private async getCurrentGame(hostId: string): Promise<Game.CurrentGame | null> {
    const cached = this.gameStateCache.get(hostId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.game;
    }
    
    const game = await this.databaseService.getCurrentGame(hostId);
    if (game) {
      this.gameStateCache.set(hostId, { game, timestamp: Date.now() });
    }
    
    return game;
  }
  
  /**
   * Invalidate cache for a host
   */
  private invalidateCache(hostId: string): void {
    this.gameStateCache.delete(hostId);
  }
  
  /**
   * Validate a command before execution
   */
  private validateCommand(command: GameCommand, context: CommandContext): CommandValidationResult {
    // Basic validation
    if (!command.hostId) {
      return { isValid: false, error: 'Host ID is required' };
    }
    
    if (!command.id || !command.timestamp) {
      return { isValid: false, error: 'Command ID and timestamp are required' };
    }
    
    // Command-specific validation
    switch (command.type) {
      case 'CALL_NUMBER':
        return this.validateCallNumber(command, context);
      case 'CREATE_BOOKING':
        return this.validateCreateBooking(command, context);
      case 'UPDATE_BOOKING':
        return this.validateUpdateBooking(command, context);
      default:
        return { isValid: true };
    }
  }
  
  /**
   * Validate call number command
   */
  private validateCallNumber(command: any, context: CommandContext): CommandValidationResult {
    const { number } = command.payload;
    
    if (typeof number !== 'number' || number < 1 || number > 90) {
      return { isValid: false, error: `Invalid number: ${number}. Must be between 1 and 90.` };
    }
    
    if (!context.currentGame) {
      return { isValid: false, error: 'No active game found' };
    }
    
    const calledNumbers = context.currentGame.numberSystem?.calledNumbers || [];
    if (calledNumbers.includes(number)) {
      return { isValid: false, error: `Number ${number} has already been called` };
    }
    
    return { isValid: true };
  }
  
  /**
   * Validate create booking command
   */
  private validateCreateBooking(command: any, context: CommandContext): CommandValidationResult {
    const { playerName, phoneNumber, tickets } = command.payload;
    
    if (!playerName || playerName.trim().length === 0) {
      return { isValid: false, error: 'Player name is required' };
    }
    
    if (!phoneNumber || !/^[0-9]{10}$/.test(phoneNumber)) {
      return { isValid: false, error: 'Valid 10-digit phone number is required' };
    }
    
    if (!Array.isArray(tickets) || tickets.length === 0) {
      return { isValid: false, error: 'At least one ticket must be selected' };
    }
    
    if (!context.currentGame) {
      return { isValid: false, error: 'No active game found' };
    }
    
    // Check if tickets are available
    const existingBookings = context.currentGame.activeTickets?.bookings || {};
    const unavailableTickets = tickets.filter(ticketId => ticketId in existingBookings);
    
    if (unavailableTickets.length > 0) {
      return { isValid: false, error: `Tickets already booked: ${unavailableTickets.join(', ')}` };
    }
    
    return { isValid: true };
  }
  
  /**
   * Validate update booking command
   */
  private validateUpdateBooking(command: any, context: CommandContext): CommandValidationResult {
    const { ticketId, playerName, phoneNumber } = command.payload;
    
    if (!ticketId) {
      return { isValid: false, error: 'Ticket ID is required' };
    }
    
    if (!context.currentGame) {
      return { isValid: false, error: 'No active game found' };
    }
    
    const booking = context.currentGame.activeTickets?.bookings?.[ticketId];
    if (!booking) {
      return { isValid: false, error: `Booking not found for ticket ${ticketId}` };
    }
    
    if (playerName && playerName.trim().length === 0) {
      return { isValid: false, error: 'Player name cannot be empty' };
    }
    
    if (phoneNumber && !/^[0-9]{10}$/.test(phoneNumber)) {
      return { isValid: false, error: 'Valid 10-digit phone number is required' };
    }
    
    return { isValid: true };
  }
  
  /**
   * Execute call number command
   */
  private async executeCallNumber(command: any, context: CommandContext): Promise<CommandResult> {
    const { number } = command.payload;
    const { hostId, currentGame } = context;
    
    if (!currentGame) {
      throw new Error('No active game found');
    }
    
    const calledNumbers = currentGame.numberSystem?.calledNumbers || [];
    const newCalledNumbers = [...calledNumbers, number];
    
    // Update database
    await this.databaseService.batchUpdateGameData(hostId, {
      numberSystem: {
        currentNumber: number,
        calledNumbers: newCalledNumbers
      }
    });
    
    // Play audio announcement
    if (currentGame.gameState?.soundEnabled) {
      try {
        await this.audioManager.announceNumber(number);
      } catch (error) {
        console.warn('Audio announcement failed:', error);
        // Don't fail the command for audio errors
      }
    }
    
    // Check for prizes asynchronously
    this.checkForPrizes(hostId, currentGame, newCalledNumbers).catch(error => {
      console.error('Prize validation failed:', error);
    });
    
    return this.createSuccessResult(command, {
      number,
      calledNumbers: newCalledNumbers,
      totalCalled: newCalledNumbers.length
    });
  }
  
  /**
   * Execute update game status command
   */
  private async executeUpdateGameStatus(command: any, context: CommandContext): Promise<CommandResult> {
    const { status, isAutoCalling } = command.payload;
    const { hostId } = context;
    
    await this.databaseService.updateGameState(hostId, {
      status,
      isAutoCalling: isAutoCalling ?? (status === 'active')
    });
    
    return this.createSuccessResult(command, { status, isAutoCalling });
  }
  
  /**
   * Execute create booking command
   */
  private async executeCreateBooking(command: any, context: CommandContext): Promise<CommandResult> {
    const { playerName, phoneNumber, tickets } = command.payload;
    const { hostId, currentGame } = context;
    
    if (!currentGame) {
      throw new Error('No active game found');
    }
    
    const timestamp = Date.now();
    const playerId = `player_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
    
    const updateData = {
      players: {
        [playerId]: {
          id: playerId,
          name: playerName,
          phoneNumber,
          tickets,
          bookingTime: timestamp,
          totalTickets: tickets.length
        }
      },
      bookings: {} as Record<string, Game.Booking>,
      tickets: {} as Record<string, Partial<Game.Ticket>>,
      metrics: {
        startTime: currentGame.bookingMetrics?.startTime || timestamp,
        lastBookingTime: timestamp,
        totalBookings: (currentGame.bookingMetrics?.totalBookings || 0) + tickets.length,
        totalPlayers: (currentGame.bookingMetrics?.totalPlayers || 0) + 1
      }
    };
    
    // Create bookings and update ticket statuses
    tickets.forEach((ticketId: string) => {
      updateData.bookings[ticketId] = {
        number: parseInt(ticketId),
        playerName,
        phoneNumber,
        playerId,
        status: 'booked',
        timestamp
      };
      
      updateData.tickets[ticketId] = {
        status: 'booked'
      };
    });
    
    await this.databaseService.batchUpdateGameData(hostId, updateData);
    
    return this.createSuccessResult(command, {
      playerId,
      tickets,
      playerName,
      phoneNumber
    });
  }
  
  /**
   * Execute update booking command
   */
  private async executeUpdateBooking(command: any, context: CommandContext): Promise<CommandResult> {
    const { ticketId, playerName, phoneNumber } = command.payload;
    const { hostId, currentGame } = context;
    
    if (!currentGame) {
      throw new Error('No active game found');
    }
    
    const existingBooking = currentGame.activeTickets?.bookings?.[ticketId];
    if (!existingBooking) {
      throw new Error(`Booking not found for ticket ${ticketId}`);
    }
    
    const updatedBooking = { ...existingBooking };
    if (playerName) updatedBooking.playerName = playerName;
    if (phoneNumber) updatedBooking.phoneNumber = phoneNumber;
    
    const batchUpdates: any = {
      bookings: { [ticketId]: updatedBooking }
    };
    
    // Update player if exists
    if (existingBooking.playerId && (playerName || phoneNumber)) {
      const players = currentGame.players || {};
      const player = players[existingBooking.playerId];
      
      if (player) {
        const updatedPlayer = { ...player };
        if (playerName) updatedPlayer.name = playerName;
        if (phoneNumber) updatedPlayer.phoneNumber = phoneNumber;
        batchUpdates.players = { [existingBooking.playerId]: updatedPlayer };
      }
    }
    
    await this.databaseService.batchUpdateGameData(hostId, batchUpdates);
    
    return this.createSuccessResult(command, {
      ticketId,
      updatedBooking
    });
  }
  
  /**
   * Execute update prize winners command
   */
  private async executeUpdatePrizeWinners(command: any, context: CommandContext): Promise<CommandResult> {
    const { prizeType, ticketIds, playerName, phoneNumber, allPrizeTypes } = command.payload;
    const { hostId, currentGame } = context;
    
    if (!currentGame) {
      throw new Error('No active game found');
    }
    
    const currentWinners = currentGame.gameState?.winners || {};
    const updatedWinners = {
      ...currentWinners,
      [prizeType]: [
        ...(currentWinners[prizeType] || []),
        ...ticketIds
      ]
    };
    
    await this.databaseService.updateGameState(hostId, {
      winners: updatedWinners
    });
    
    // Play prize win sound
    try {
      await this.audioManager.playPrizeWinEffect(prizeType);
    } catch (error) {
      console.warn('Prize win sound failed:', error);
    }
    
    return this.createSuccessResult(command, {
      prizeType,
      ticketIds,
      playerName,
      phoneNumber,
      allPrizeTypes,
      updatedWinners
    });
  }
  
  /**
   * Execute update game settings command
   */
  private async executeUpdateGameSettings(command: any, context: CommandContext): Promise<CommandResult> {
    const { hostId } = context;
    const settings = command.payload;
    
    await this.databaseService.updateGameSettings(hostId, settings);
    
    return this.createSuccessResult(command, settings);
  }
  
  /**
   * Execute initialize game command
   */
  private async executeInitializeGame(command: any, context: CommandContext): Promise<CommandResult> {
    const { settings, tickets } = command.payload;
    const { hostId } = context;
    
    const newGame: Game.CurrentGame = {
      settings,
      gameState: {
        phase: 1 as const,
        status: 'setup',
        isAutoCalling: false,
        soundEnabled: true,
        winners: {
          quickFive: [], topLine: [], middleLine: [], bottomLine: [],
          corners: [], starCorners: [], halfSheet: [], fullSheet: [],
          fullHouse: [], secondFullHouse: []
        }
      },
      numberSystem: {
        callDelay: settings.callDelay || 5,
        currentNumber: null,
        calledNumbers: [],
        queue: []
      },
      activeTickets: {
        tickets: tickets || {},
        bookings: {}
      },
      startTime: Date.now()
    };
    
    await this.databaseService.setCurrentGame(hostId, newGame);
    
    return this.createSuccessResult(command, { game: newGame });
  }
  
  /**
   * Execute start booking phase command
   */
  private async executeStartBookingPhase(command: any, context: CommandContext): Promise<CommandResult> {
    const { settings, tickets } = command.payload;
    const { hostId } = context;
    
    const gameStateUpdates = {
      phase: 2 as const,
      status: 'booking' as const
    };
    
    const numberSystemUpdates = {
      callDelay: settings.callDelay || 5,
      currentNumber: null,
      calledNumbers: [],
      queue: []
    };
    
    const metricsData = {
      startTime: Date.now(),
      lastBookingTime: Date.now(),
      totalBookings: 0,
      totalPlayers: 0
    };
    
    await this.databaseService.batchUpdateGameData(hostId, {
      gameState: gameStateUpdates,
      numberSystem: numberSystemUpdates,
      tickets,
      metrics: metricsData
    });
    
    return this.createSuccessResult(command, {
      phase: 2,
      ticketCount: Object.keys(tickets).length
    });
  }
  
  /**
   * Execute start playing phase command
   */
  private async executeStartPlayingPhase(command: any, context: CommandContext): Promise<CommandResult> {
    const { hostId, currentGame } = context;
    
    if (!currentGame) {
      throw new Error('No active game found');
    }
    
    const gameStateUpdates = {
      phase: 3 as const,
      status: 'paused' as const,
      isAutoCalling: false,
      soundEnabled: true,
      winners: currentGame.gameState?.winners || {
        quickFive: [], topLine: [], middleLine: [], bottomLine: [],
        corners: [], starCorners: [], halfSheet: [], fullSheet: [],
        fullHouse: [], secondFullHouse: []
      },
      allPrizesWon: false
    };
    
    const numberSystemUpdates = {
      callDelay: currentGame.settings.callDelay || 5,
      currentNumber: null,
      calledNumbers: [],
      queue: []
    };
    
    await this.databaseService.batchUpdateGameData(hostId, {
      gameState: gameStateUpdates,
      numberSystem: numberSystemUpdates
    });
    
    return this.createSuccessResult(command, { phase: 3 });
  }
  
  /**
   * Execute complete game command
   */
  private async executeCompleteGame(command: any, context: CommandContext): Promise<CommandResult> {
    const { reason } = command.payload;
    const { hostId, currentGame } = context;
    
    if (!currentGame) {
      throw new Error('No active game found');
    }
    
    // Update game state to completed
    await this.databaseService.updateGameState(hostId, {
      phase: 4 as const,
      status: 'ended',
      isAutoCalling: false
    });
    
    // Save to history
    await this.databaseService.saveGameToHistory(hostId, currentGame);
    
    return this.createSuccessResult(command, {
      reason: reason || 'Game completed',
      endTime: Date.now()
    });
  }
  
  /**
   * Execute update call delay command
   */
  private async executeUpdateCallDelay(command: any, context: CommandContext): Promise<CommandResult> {
    const { callDelay } = command.payload;
    const { hostId } = context;
    
    const validDelay = Math.max(3, Math.min(20, callDelay));
    
    await this.databaseService.updateNumberSystem(hostId, { callDelay: validDelay });
    
    return this.createSuccessResult(command, { callDelay: validDelay });
  }
  
  /**
   * Execute update sound settings command
   */
  private async executeUpdateSoundSettings(command: any, context: CommandContext): Promise<CommandResult> {
    const { soundEnabled } = command.payload;
    const { hostId } = context;
    
    await this.databaseService.updateGameState(hostId, { soundEnabled });
    
    return this.createSuccessResult(command, { soundEnabled });
  }
  
  /**
   * Execute cancel booking command
   */
  private async executeCancelBooking(command: any, context: CommandContext): Promise<CommandResult> {
    const { ticketIds } = command.payload;
    const { hostId, currentGame } = context;
    
    if (!currentGame) {
      throw new Error('No active game found');
    }
    
    const playerIds = new Set<string>();
    const bookingUpdates: Record<string, null> = {};
    const ticketUpdates: Record<string, Partial<Game.Ticket>> = {};
    
    // Process each ticket
    ticketIds.forEach((ticketId: string) => {
      const booking = currentGame.activeTickets?.bookings?.[ticketId];
      if (booking?.playerId) {
        playerIds.add(booking.playerId);
      }
      
      bookingUpdates[ticketId] = null;
      ticketUpdates[ticketId] = { status: 'available' };
    });
    
    const batchUpdates: any = {
      bookings: bookingUpdates,
      tickets: ticketUpdates
    };
    
    // Update or remove players
    if (playerIds.size > 0) {
      const playerUpdates: Record<string, Game.Player | null> = {};
      const players = currentGame.players || {};
      
      for (const playerId of playerIds) {
        const player = players[playerId];
        if (player) {
          const updatedTickets = player.tickets.filter(t => !ticketIds.includes(t));
          
          if (updatedTickets.length === 0) {
            playerUpdates[playerId] = null;
          } else {
            playerUpdates[playerId] = {
              ...player,
              tickets: updatedTickets,
              totalTickets: updatedTickets.length
            };
          }
        }
      }
      
      if (Object.keys(playerUpdates).length > 0) {
        batchUpdates.players = playerUpdates;
      }
    }
    
    await this.databaseService.batchUpdateGameData(hostId, batchUpdates);
    
    return this.createSuccessResult(command, {
      cancelledTickets: ticketIds,
      affectedPlayers: Array.from(playerIds)
    });
  }
  
  /**
   * Check for prizes after a number is called - FIXED: Complete type safety
   */
  private async checkForPrizes(hostId: string, currentGame: Game.CurrentGame, calledNumbers: number[]): Promise<void> {
    try {
      const context: ValidationContext = {
        tickets: currentGame.activeTickets?.tickets || {},
        bookings: currentGame.activeTickets?.bookings || {},
        calledNumbers,
        currentWinners: currentGame.gameState?.winners || {},
        activePrizes: currentGame.settings?.prizes || {}
      };
      
      const hasBookedTickets = Object.keys(context.bookings).length > 0;
      const hasActivePrizes = Object.values(context.activePrizes).some(isActive => isActive);
      
      if (!hasBookedTickets || !hasActivePrizes) {
        return;
      }
      
      const validationResults = validateAllPrizes(context);
      
      if (validationResults.length > 0) {
        console.log(`🏆 Found ${validationResults.length} prize winner(s)`);
        
        const winnersUpdate: Partial<Game.Winners> = {};
        let hasNewWinners = false;
        
        for (const result of validationResults) {
          if (result.isWinner && result.winningTickets.length > 0) {
            // FIXED: Use proper type safety with key validation
            const prizeKey = result.prizeType as keyof Game.Winners;
            
            // Ensure the key is valid before using it
            if (prizeKey in context.currentWinners) {
              winnersUpdate[prizeKey] = [
                ...(context.currentWinners[prizeKey] || []),
                ...result.winningTickets
              ];
              hasNewWinners = true;
            
              console.log(`🏆 Prize won: ${result.prizeType} by ${result.playerName} with tickets ${result.winningTickets.join(', ')}`);
            }
          }
        }
        
        if (hasNewWinners) {
          await this.databaseService.updateGameState(hostId, {
            winners: {
              ...context.currentWinners,
              ...winnersUpdate
            }
          });
          
          // Check if all active prizes have been won - FIXED: Proper type safety
          const updatedWinners = { ...context.currentWinners, ...winnersUpdate };
          
          const allActivePrizesWon = Object.entries(context.activePrizes)
            .filter(([_, isActive]) => isActive)
            .every(([prizeType]) => {
              // FIXED: Use type guard for safe indexing
              if (prizeType in updatedWinners) {
                const prizeKey = prizeType as keyof Game.Winners;
                const winners = updatedWinners[prizeKey];
                return winners && winners.length > 0;
              }
              return false;
            });
          
          if (allActivePrizesWon) {
            console.log('🎉 All active prizes won! Ending game...');
            await this.databaseService.updateGameState(hostId, {
              allPrizesWon: true,
              isAutoCalling: false,
              status: 'ended',
              phase: 4 as const
            });
          }
        }
      }
    } catch (error) {
      console.error('Prize validation error:', error);
      // Don't throw - prize validation errors shouldn't fail the number call
    }
  }
  
  /**
   * Create a successful command result
   */
  private createSuccessResult(command: GameCommand, data?: any): CommandResult {
    return {
      success: true,
      command,
      data,
      timestamp: Date.now()
    };
  }
  
  /**
   * Create an error command result
   */
  private createErrorResult(command: GameCommand, error: string): CommandResult {
    return {
      success: false,
      command,
      error,
      timestamp: Date.now()
    };
  }
  
  /**
   * Cleanup method
   */
  public async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up command processor');
    this.gameStateCache.clear();
  }
}
