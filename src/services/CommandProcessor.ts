// src/services/CommandProcessor.ts - COMPLETE FILE with all fixes
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
   * FIXED: Generate a random number that hasn't been called yet
   */
  public static generateAvailableNumber(calledNumbers: number[]): number | null {
    // Create array of all possible numbers (1-90)
    const allNumbers = Array.from({ length: 90 }, (_, i) => i + 1);
    
    // Filter out already called numbers
    const availableNumbers = allNumbers.filter(num => !calledNumbers.includes(num));
    
    // Return null if no numbers available
    if (availableNumbers.length === 0) {
      console.log('🏁 All numbers have been called!');
      return null;
    }
    
    // Generate random index and return the number
    const randomIndex = Math.floor(Math.random() * availableNumbers.length);
    const selectedNumber = availableNumbers[randomIndex];
    
    console.log(`🎲 Generated number ${selectedNumber} from ${availableNumbers.length} available numbers`);
    return selectedNumber;
  }

  /**
   * Get available numbers for UI display
   */
  public static getAvailableNumbers(calledNumbers: number[]): number[] {
    const allNumbers = Array.from({ length: 90 }, (_, i) => i + 1);
    return allNumbers.filter(num => !calledNumbers.includes(num));
  }

  /**
   * Type guard to ensure safe access to Winners properties
   */
  private isValidPrizeType(prizeType: string): prizeType is keyof Game.Winners {
    const validPrizeTypes: (keyof Game.Winners)[] = [
      'quickFive', 'topLine', 'middleLine', 'bottomLine',
      'corners', 'starCorners', 'halfSheet', 'fullSheet',
      'fullHouse', 'secondFullHouse'
    ];
    return validPrizeTypes.includes(prizeType as keyof Game.Winners);
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
   * FIXED: Validate call number command with duplicate prevention
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
    
    // Check if this is the last possible number
    if (calledNumbers.length >= 89) {
      console.log('🏁 This is the last number that can be called!');
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
   * FIXED: Execute call number command with enhanced validation
   */
  private async executeCallNumber(command: any, context: CommandContext): Promise<CommandResult> {
    const { number } = command.payload;
    const { hostId, currentGame } = context;
    
    if (!currentGame) {
      throw new Error('No active game found');
    }
    
    const calledNumbers = currentGame.numberSystem?.calledNumbers || [];
    
    // Double-check that number hasn't been called (race condition protection)
    if (calledNumbers.includes(number)) {
      throw new Error(`Number ${number} has already been called`);
    }
    
    const newCalledNumbers = [...calledNumbers, number];
    
    console.log(`🎲 Calling number ${number} (${newCalledNumbers.length}/90 called)`);
    
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
    
    // Check if all numbers have been called
    if (newCalledNumbers.length >= 90) {
      console.log('🏁 All 90 numbers have been called! Game should end.');
      // Optionally auto-end the game
      setTimeout(async () => {
        try {
          await this.databaseService.updateGameState(hostId, {
            status: 'ended',
            phase: 4 as const,
            isAutoCalling: false
          });
          console.log('✅ Game automatically ended - all numbers called');
        } catch (error) {
          console.error('❌ Failed to auto-end game:', error);
        }
      }, 1000);
    }
    
    return this.createSuccessResult(command, {
      number,
      calledNumbers: newCalledNumbers,
      totalCalled: newCalledNumbers.length,
      remainingNumbers: 90 - newCalledNumbers.length,
      gameComplete: newCalledNumbers.length >= 90
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
   * Execute update prize winners command - FIXED: All unsafe Winners access
   */
  private async executeUpdatePrizeWinners(command: any, context: CommandContext): Promise<CommandResult> {
    const { prizeType, ticketIds, playerName, phoneNumber, allPrizeTypes } = command.payload;
    const { hostId, currentGame } = context;
    
    if (!currentGame) {
      throw new Error('No active game found');
    }
    
    // FIXED: Use type guard before accessing Winners object
    if (!this.isValidPrizeType(prizeType)) {
      throw new Error(`Invalid prize type: ${prizeType}`);
    }
    
    const currentWinners = currentGame.gameState?.winners || {};
    const safeCurrentWinners = currentWinners[prizeType] || [];
    
    const updatedWinners = {
      ...currentWinners,
      [prizeType]: [
        ...safeCurrentWinners,
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
   * FULLY FIXED: Check for prizes after a number is called - NO MORE TypeError issues
   */
  private async checkForPrizes(hostId: string, currentGame: Game.CurrentGame, calledNumbers: number[]): Promise<void> {
    try {
      console.log('🎯 Prize check starting...', {
        hostId,
        calledNumbersLength: calledNumbers?.length || 0,
        lastNumber: calledNumbers?.[calledNumbers.length - 1],
        gamePhase: currentGame?.gameState?.phase
      });

      // FIXED: Validate all inputs before proceeding
      if (!hostId) {
        console.warn('❌ No hostId provided for prize check');
        return;
      }

      if (!currentGame) {
        console.warn('❌ No current game provided for prize check');
        return;
      }

      if (!Array.isArray(calledNumbers) || calledNumbers.length === 0) {
        console.warn('❌ Invalid or empty calledNumbers array for prize check');
        return;
      }

      // FIXED: Ensure all required game data exists before validation
      const tickets = currentGame.activeTickets?.tickets || {};
      const bookings = currentGame.activeTickets?.bookings || {};
      const currentWinners = currentGame.gameState?.winners || {
        quickFive: [], topLine: [], middleLine: [], bottomLine: [],
        corners: [], starCorners: [], halfSheet: [], fullSheet: [],
        fullHouse: [], secondFullHouse: []
      };
      const activePrizes = currentGame.settings?.prizes || {
        quickFive: false, topLine: false, middleLine: false, bottomLine: false,
        corners: false, starCorners: false, halfSheet: false, fullSheet: false,
        fullHouse: false, secondFullHouse: false
      };

      // FIXED: Validate that we have the minimum required data
      const hasBookedTickets = Object.keys(bookings).length > 0;
      const hasActivePrizes = Object.values(activePrizes).some(isActive => isActive);
      const hasValidTickets = Object.keys(tickets).length > 0;

      console.log('📊 Prize check validation:', {
        hasBookedTickets,
        hasActivePrizes,
        hasValidTickets,
        bookingsCount: Object.keys(bookings).length,
        ticketsCount: Object.keys(tickets).length,
        activePrizesCount: Object.values(activePrizes).filter(Boolean).length
      });

      if (!hasBookedTickets) {
        console.log('⏭️ No booked tickets, skipping prize validation');
        return;
      }

      if (!hasActivePrizes) {
        console.log('⏭️ No active prizes configured, skipping prize validation');
        return;
      }

      if (!hasValidTickets) {
        console.log('⏭️ No valid tickets found, skipping prize validation');
        return;
      }

      // FIXED: Create safe validation context with guaranteed valid data
      const context: ValidationContext = {
        tickets: tickets,
        bookings: bookings,
        calledNumbers: [...calledNumbers], // Create copy to prevent mutations
        currentWinners: {
          quickFive: Array.isArray(currentWinners.quickFive) ? [...currentWinners.quickFive] : [],
          topLine: Array.isArray(currentWinners.topLine) ? [...currentWinners.topLine] : [],
          middleLine: Array.isArray(currentWinners.middleLine) ? [...currentWinners.middleLine] : [],
          bottomLine: Array.isArray(currentWinners.bottomLine) ? [...currentWinners.bottomLine] : [],
          corners: Array.isArray(currentWinners.corners) ? [...currentWinners.corners] : [],
          starCorners: Array.isArray(currentWinners.starCorners) ? [...currentWinners.starCorners] : [],
          halfSheet: Array.isArray(currentWinners.halfSheet) ? [...currentWinners.halfSheet] : [],
          fullSheet: Array.isArray(currentWinners.fullSheet) ? [...currentWinners.fullSheet] : [],
          fullHouse: Array.isArray(currentWinners.fullHouse) ? [...currentWinners.fullHouse] : [],
          secondFullHouse: Array.isArray(currentWinners.secondFullHouse) ? [...currentWinners.secondFullHouse] : []
        },
        activePrizes: { ...activePrizes }
      };

      console.log('🔍 Starting prize validation with safe context');
      
      // FIXED: Call validation with try-catch for individual error handling
      let validationResults: any[] = [];
      try {
        validationResults = validateAllPrizes(context);
      } catch (validationError) {
        console.error('❌ Prize validation function failed:', validationError);
        console.error('Context data:', {
          ticketsCount: Object.keys(context.tickets).length,
          bookingsCount: Object.keys(context.bookings).length,
          calledNumbersLength: context.calledNumbers.length,
          winnersStructure: Object.keys(context.currentWinners)
        });
        
        // Don't throw - just log and return to prevent breaking the game
        return;
      }

      console.log(`🎯 Prize validation completed, found ${validationResults.length} potential winners`);

      if (validationResults.length > 0) {
        console.log(`🏆 Processing ${validationResults.length} prize winner(s)`);
        
        // FIXED: Safe processing of validation results
        const winnersUpdate: Partial<Game.Winners> = {};
        let hasNewWinners = false;
        
        for (const result of validationResults) {
          try {
            if (!result || !result.isWinner || !Array.isArray(result.winningTickets) || result.winningTickets.length === 0) {
              console.warn('⚠️ Invalid validation result structure:', result);
              continue;
            }
            
            // FIXED: Use type guard for complete type safety
            if (this.isValidPrizeType(result.prizeType)) {
              const prizeKey = result.prizeType;
              const currentPrizeWinners = context.currentWinners[prizeKey] || [];
              
              // Only add new winners (prevent duplicates)
              const newWinners = result.winningTickets.filter(ticketId => !currentPrizeWinners.includes(ticketId));
              
              if (newWinners.length > 0) {
                winnersUpdate[prizeKey] = [
                  ...currentPrizeWinners,
                  ...newWinners
                ];
                hasNewWinners = true;
                
                console.log(`🏆 New ${result.prizeType} winner: ${result.playerName} with tickets ${newWinners.join(', ')}`);
              } else {
                console.log(`ℹ️ ${result.prizeType} already won by ${result.playerName}, skipping duplicate`);
              }
            } else {
              console.warn(`⚠️ Invalid prize type detected: ${result.prizeType}`);
            }
          } catch (resultError) {
            console.error('❌ Error processing validation result:', resultError, result);
            // Continue with other results
          }
        }
        
        // FIXED: Only update database if we have new winners
        if (hasNewWinners && Object.keys(winnersUpdate).length > 0) {
          try {
            console.log(`💾 Updating database with ${Object.keys(winnersUpdate).length} new prize winners`);
            
            const updatedWinners = {
              ...context.currentWinners,
              ...winnersUpdate
            };
            
            await this.databaseService.updateGameState(hostId, {
              winners: updatedWinners
            });
            
            console.log('✅ Prize winners updated in database');
            
            // FIXED: Check if all active prizes have been won with safe type checking
            const allActivePrizesWon = Object.entries(activePrizes)
              .filter(([_, isActive]) => isActive)
              .every(([prizeType]) => {
                // Use type guard for completely safe indexing
                if (this.isValidPrizeType(prizeType)) {
                  const winners = updatedWinners[prizeType];
                  return Array.isArray(winners) && winners.length > 0;
                }
                console.warn(`⚠️ Skipping invalid prize type in all-prizes check: ${prizeType}`);
                return false;
              });
            
            if (allActivePrizesWon) {
              console.log('🎉 All active prizes won! Ending game...');
              try {
                await this.databaseService.updateGameState(hostId, {
                  allPrizesWon: true,
                  isAutoCalling: false,
                  status: 'ended',
                  phase: 4 as const
                });
                console.log('✅ Game ended due to all prizes being won');
              } catch (endGameError) {
                console.error('❌ Failed to end game after all prizes won:', endGameError);
              }
            }
            
          } catch (updateError) {
            console.error('❌ Failed to update prize winners in database:', updateError);
            // Don't throw - this shouldn't break the number call
          }
        } else {
          console.log('ℹ️ No new winners to update');
        }
      } else {
        console.log('ℹ️ No prize winners found this round');
      }
      
    } catch (error) {
      console.error('💥 Prize validation error - full catch:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('Input parameters:', {
        hostId,
        calledNumbersType: typeof calledNumbers,
        calledNumbersIsArray: Array.isArray(calledNumbers),
        calledNumbersLength: calledNumbers?.length,
        currentGameExists: !!currentGame,
        currentGameType: typeof currentGame
      });
      
      // FIXED: Don't throw errors from prize validation - just log them
      // Prize validation errors should not break the core game functionality
      console.warn('⚠️ Prize validation failed but game will continue normally');
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
