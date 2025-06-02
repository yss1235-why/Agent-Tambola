// src/services/CommandProcessor.ts - UPDATED: Fixed TypeScript compatibility with new prizeValidation.ts
import { GameCommand, CommandResult, CommandContext, CommandValidationResult } from '../types/commands';
import { GameDatabaseService } from './GameDatabaseService';
import { validateAllPrizes, ValidationContext, formatMultiplePrizes, PrizeValidationResult } from '../utils/prizeValidation';
import { AudioManager } from '../utils/audioManager';
import { loadTicketData, validateTicketData } from '../utils/ticketLoader';
import type { Game } from '../types/game';

export class CommandProcessor {
  private static instance: CommandProcessor;
  private databaseService: GameDatabaseService;
  private audioManager: AudioManager;
  
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
   * Execute with abort signal support
   */
  public async execute(command: GameCommand, abortSignal?: AbortSignal): Promise<CommandResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🎯 Executing: ${command.type}`);
      
      if (abortSignal?.aborted) {
        throw new Error(`Command ${command.type} was aborted before execution`);
      }
      
      const context: CommandContext = {
        hostId: command.hostId,
        currentGame: await this.getCurrentGameFresh(command.hostId, abortSignal),
        timestamp: command.timestamp
      };
      
      if (abortSignal?.aborted) {
        throw new Error(`Command ${command.type} was aborted during data fetch`);
      }
      
      const validation = this.validateCommand(command, context);
      if (!validation.isValid) {
        return this.createErrorResult(command, validation.error || 'Command validation failed');
      }
      
      if (abortSignal?.aborted) {
        throw new Error(`Command ${command.type} was aborted before processing`);
      }
      
      let result: CommandResult;
      
      switch (command.type) {
        case 'CALL_NUMBER':
          result = await this.executeCallNumber(command, context, abortSignal);
          break;
        case 'UPDATE_GAME_STATUS':
          result = await this.executeUpdateGameStatus(command, context, abortSignal);
          break;
        case 'CREATE_BOOKING':
          result = await this.executeCreateBooking(command, context, abortSignal);
          break;
        case 'UPDATE_BOOKING':
          result = await this.executeUpdateBooking(command, context, abortSignal);
          break;
        case 'UPDATE_PRIZE_WINNERS':
          result = await this.executeUpdatePrizeWinners(command, context, abortSignal);
          break;
        case 'UPDATE_GAME_SETTINGS':
          result = await this.executeUpdateGameSettings(command, context, abortSignal);
          break;
        case 'INITIALIZE_GAME':
          result = await this.executeInitializeGame(command, context, abortSignal);
          break;
        case 'START_BOOKING_PHASE':
          result = await this.executeStartBookingPhase(command, context, abortSignal);
          break;
        case 'START_PLAYING_PHASE':
          result = await this.executeStartPlayingPhase(command, context, abortSignal);
          break;
        case 'COMPLETE_GAME':
          result = await this.executeCompleteGame(command, context, abortSignal);
          break;
        case 'UPDATE_CALL_DELAY':
          result = await this.executeUpdateCallDelay(command, context, abortSignal);
          break;
        case 'UPDATE_SOUND_SETTINGS':
          result = await this.executeUpdateSoundSettings(command, context, abortSignal);
          break;
        case 'CANCEL_BOOKING':
          result = await this.executeCancelBooking(command, context, abortSignal);
          break;
        case 'RETURN_TO_SETUP':
          result = await this.executeReturnToSetup(command, context, abortSignal);
          break;
        default:
          throw new Error(`Unknown command type: ${(command as any).type}`);
      }
      
      const executionTime = Date.now() - startTime;
      console.log(`✅ Command executed: ${command.type} (${executionTime}ms)`);
      
      return result;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`❌ Command failed: ${command.type} (${executionTime}ms)`, error);
      
      if (error instanceof Error && error.name === 'AbortError') {
        return this.createErrorResult(command, `Command ${command.type} was cancelled`);
      }
      
      return this.createErrorResult(
        command,
        error instanceof Error ? error.message : 'Unknown execution error'
      );
    }
  }
  
  /**
   * Get fresh game data without caching
   */
  private async getCurrentGameFresh(hostId: string, abortSignal?: AbortSignal): Promise<Game.CurrentGame | null> {
    if (abortSignal?.aborted) {
      throw new Error('Operation aborted during game data fetch');
    }
    
    try {
      return await this.databaseService.getCurrentGame(hostId);
    } catch (error) {
      console.error('Error fetching current game:', error);
      throw error;
    }
  }
  
  /**
   * Generate number with better duplicate prevention
   */
  public static generateAvailableNumber(calledNumbers: number[]): number | null {
    const allNumbers = Array.from({ length: 90 }, (_, i) => i + 1);
    const availableNumbers = allNumbers.filter(num => !calledNumbers.includes(num));
    
    if (availableNumbers.length === 0) {
      console.log('🏁 All numbers have been called!');
      return null;
    }
    
    const randomIndex = Math.floor(Math.random() * availableNumbers.length);
    const selectedNumber = availableNumbers[randomIndex];
    
    console.log(`🎲 Generated number ${selectedNumber} from ${availableNumbers.length} available`);
    return selectedNumber;
  }
  
  /**
   * Get available numbers for UI
   */
  public static getAvailableNumbers(calledNumbers: number[]): number[] {
    const allNumbers = Array.from({ length: 90 }, (_, i) => i + 1);
    return allNumbers.filter(num => !calledNumbers.includes(num));
  }
  
  /**
   * Execute return to setup command
   */
  private async executeReturnToSetup(command: any, context: CommandContext, abortSignal?: AbortSignal): Promise<CommandResult> {
    if (abortSignal?.aborted) throw new Error('Return to setup was aborted');
    
    const { clearBookings = true } = command.payload;
    const { hostId, currentGame } = context;
    
    if (!currentGame) {
      throw new Error('No active game found');
    }
    
    console.log(`🔄 Returning to setup phase (clearBookings: ${clearBookings})`);
    
    // Prepare the batch update data
    const batchUpdateData: any = {
      gameState: {
        phase: 1 as const,
        status: 'setup' as const,
        isAutoCalling: false,
        soundEnabled: currentGame.gameState?.soundEnabled || true,
        winners: {
          quickFive: [], topLine: [], middleLine: [], bottomLine: [],
          corners: [], starCorners: [], halfSheet: [], fullSheet: [],
          fullHouse: [], secondFullHouse: []
        },
        allPrizesWon: false
      },
      numberSystem: {
        callDelay: currentGame.settings?.callDelay || 5,
        currentNumber: null,
        calledNumbers: [],
        queue: []
      }
    };
    
    if (clearBookings) {
      batchUpdateData.bookings = {};
      
      if (currentGame.activeTickets?.tickets) {
        batchUpdateData.tickets = Object.fromEntries(
          Object.keys(currentGame.activeTickets.tickets).map(ticketId => [
            ticketId, 
            { status: 'available' }
          ])
        );
      }
      
      batchUpdateData.metrics = {
        startTime: Date.now(),
        lastBookingTime: Date.now(),
        totalBookings: 0,
        totalPlayers: 0
      };
      
      batchUpdateData.players = {};
      
      console.log(`🧹 Clearing ${Object.keys(currentGame.activeTickets?.bookings || {}).length} bookings`);
    }
    
    await this.databaseService.batchUpdateGameData(hostId, batchUpdateData);
    
    const message = clearBookings 
      ? 'Successfully returned to setup phase. All bookings have been cleared.'
      : 'Successfully returned to setup phase. Existing bookings preserved.';
    
    console.log(`✅ ${message}`);
    
    return this.createSuccessResult(command, {
      phase: 1,
      status: 'setup',
      clearBookings,
      bookingsCleared: clearBookings ? Object.keys(currentGame.activeTickets?.bookings || {}).length : 0,
      message
    });
  }
  
  /**
   * Execute call number with abort signal
   */
  private async executeCallNumber(command: any, context: CommandContext, abortSignal?: AbortSignal): Promise<CommandResult> {
    const { number } = command.payload;
    const { hostId, currentGame } = context;
    
    if (!currentGame) {
      throw new Error('No active game found');
    }
    
    if (abortSignal?.aborted) {
      throw new Error('Call number operation was aborted');
    }
    
    const calledNumbers = currentGame.numberSystem?.calledNumbers || [];
    
    if (calledNumbers.includes(number)) {
      throw new Error(`Number ${number} has already been called`);
    }
    
    const newCalledNumbers = [...calledNumbers, number];
    
    console.log(`🎲 Calling number ${number} (${newCalledNumbers.length}/90)`);
    
    if (abortSignal?.aborted) {
      throw new Error('Call number operation was aborted before database update');
    }
    
    await this.databaseService.batchUpdateGameData(hostId, {
      numberSystem: {
        currentNumber: number,
        calledNumbers: newCalledNumbers
      }
    });
    
    if (currentGame.gameState?.soundEnabled) {
      try {
        await this.audioManager.announceNumber(number);
      } catch (audioError) {
        console.warn('Audio announcement failed (non-critical):', audioError);
      }
    }
    
    this.checkForPrizesAsync(hostId, currentGame, newCalledNumbers);
    
    if (newCalledNumbers.length >= 90) {
      console.log('🏁 All numbers called, scheduling auto-end');
      setTimeout(async () => {
        try {
          await this.databaseService.updateGameState(hostId, {
            status: 'ended',
            phase: 4 as const,
            isAutoCalling: false
          });
        } catch (error) {
          console.error('Auto-end game failed:', error);
        }
      }, 1000);
    }
    
    return this.createSuccessResult(command, {
      number,
      calledNumbers: newCalledNumbers,
      totalCalled: newCalledNumbers.length,
      remainingNumbers: 90 - newCalledNumbers.length
    });
  }
  
  /**
   * FIXED: Prize checking with proper TypeScript compatibility
   */
  private checkForPrizesAsync(hostId: string, currentGame: Game.CurrentGame, calledNumbers: number[]): void {
    setTimeout(async () => {
      try {
        await this.checkForPrizes(hostId, currentGame, calledNumbers);
      } catch (error) {
        console.error('Background prize check failed:', error);
      }
    }, 0);
  }
  
  /**
   * FIXED: Type-safe prize checking with proper Winners handling
   */
  private async checkForPrizes(hostId: string, currentGame: Game.CurrentGame, calledNumbers: number[]): Promise<void> {
    try {
      const tickets = currentGame.activeTickets?.tickets || {};
      const bookings = currentGame.activeTickets?.bookings || {};
      
      // FIXED: Ensure winners has all required properties with proper defaults
      const currentWinners: Game.Winners = currentGame.gameState?.winners || {
        quickFive: [], topLine: [], middleLine: [], bottomLine: [],
        corners: [], starCorners: [], halfSheet: [], fullSheet: [],
        fullHouse: [], secondFullHouse: []
      };
      
      // FIXED: Ensure activePrizes has all required properties with proper defaults
      const activePrizes: Game.Settings['prizes'] = currentGame.settings?.prizes || {
        quickFive: false, topLine: false, middleLine: false, bottomLine: false,
        corners: false, starCorners: false, halfSheet: false, fullSheet: false,
        fullHouse: false, secondFullHouse: false
      };
      
      if (Object.keys(bookings).length === 0 || !Object.values(activePrizes).some(Boolean)) {
        return;
      }
      
      // FIXED: Create properly typed validation context
      const context: ValidationContext = {
        tickets,
        bookings,
        calledNumbers: [...calledNumbers],
        currentWinners: { ...currentWinners },
        activePrizes: { ...activePrizes }
      };
      
      const validationResults: PrizeValidationResult[] = validateAllPrizes(context);
      
      if (validationResults.length > 0) {
        // FIXED: Type-safe winners update with proper array handling
        const winnersUpdate: Partial<Game.Winners> = {};
        let hasNewWinners = false;
        
        for (const result of validationResults) {
          if (result?.isWinner && Array.isArray(result.winningTickets) && result.winningTickets.length > 0) {
            const prizeType = result.prizeType;
            
            // FIXED: Ensure prizeType is valid key for Game.Winners
            if (prizeType in currentWinners) {
              const currentPrizeWinners = currentWinners[prizeType] || [];
              const newWinners = result.winningTickets.filter(ticketId => !currentPrizeWinners.includes(ticketId));
              
              if (newWinners.length > 0) {
                winnersUpdate[prizeType] = [...currentPrizeWinners, ...newWinners];
                hasNewWinners = true;
              }
            }
          }
        }
        
        if (hasNewWinners && Object.keys(winnersUpdate).length > 0) {
          // FIXED: Proper type-safe update of winners
          const updatedWinners: Game.Winners = { ...currentWinners };
          
          // Update only the prize types that have new winners
          (Object.keys(winnersUpdate) as Array<keyof Game.Winners>).forEach(prizeType => {
            const newWinnersList = winnersUpdate[prizeType];
            if (newWinnersList && Array.isArray(newWinnersList)) {
              updatedWinners[prizeType] = newWinnersList;
            }
          });
          
          await this.databaseService.updateGameState(hostId, { winners: updatedWinners });
          
          // Check if all active prizes have been won
          const allActivePrizesWon = (Object.keys(activePrizes) as Array<keyof Game.Settings['prizes']>)
            .filter(prizeKey => activePrizes[prizeKey] === true)
            .every(prizeKey => {
              const prizeType = prizeKey as keyof Game.Winners;
              const winners = updatedWinners[prizeType];
              return Array.isArray(winners) && winners.length > 0;
            });
          
          if (allActivePrizesWon) {
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
      console.error('Prize validation failed (non-critical):', error);
    }
  }
  
  // ... [Rest of the methods remain the same as they don't interact with prize validation directly]
  
  private async executeUpdateGameStatus(command: any, context: CommandContext, abortSignal?: AbortSignal): Promise<CommandResult> {
    if (abortSignal?.aborted) throw new Error('Update game status was aborted');
    
    const { status, isAutoCalling } = command.payload;
    const { hostId } = context;
    
    await this.databaseService.updateGameState(hostId, {
      status,
      isAutoCalling: isAutoCalling ?? (status === 'active')
    });
    
    return this.createSuccessResult(command, { status, isAutoCalling });
  }
  
  private async executeCreateBooking(command: any, context: CommandContext, abortSignal?: AbortSignal): Promise<CommandResult> {
    if (abortSignal?.aborted) throw new Error('Create booking was aborted');
    
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
    
    if (abortSignal?.aborted) throw new Error('Create booking was aborted before database update');
    
    await this.databaseService.batchUpdateGameData(hostId, updateData);
    
    return this.createSuccessResult(command, {
      playerId,
      tickets,
      playerName,
      phoneNumber
    });
  }
  
  private async executeUpdateBooking(command: any, context: CommandContext, abortSignal?: AbortSignal): Promise<CommandResult> {
    if (abortSignal?.aborted) throw new Error('Update booking was aborted');
    
    const { ticketId, playerName, phoneNumber } = command.payload;
    const { hostId, currentGame } = context;
    
    if (!currentGame) throw new Error('No active game found');
    
    const existingBooking = currentGame.activeTickets?.bookings?.[ticketId];
    if (!existingBooking) throw new Error(`Booking not found for ticket ${ticketId}`);
    
    const updatedBooking = { ...existingBooking };
    if (playerName) updatedBooking.playerName = playerName;
    if (phoneNumber) updatedBooking.phoneNumber = phoneNumber;
    
    const batchUpdates: any = { bookings: { [ticketId]: updatedBooking } };
    
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
    
    return this.createSuccessResult(command, { ticketId, updatedBooking });
  }
  
  private async executeUpdatePrizeWinners(command: any, context: CommandContext, abortSignal?: AbortSignal): Promise<CommandResult> {
    if (abortSignal?.aborted) throw new Error('Update prize winners was aborted');
    
    const { prizeType, ticketIds, playerName, phoneNumber, allPrizeTypes } = command.payload;
    const { hostId, currentGame } = context;
    
    if (!currentGame) throw new Error('No active game found');
    
    // FIXED: Validate prizeType is a valid key
    const validPrizeTypes: Array<keyof Game.Winners> = [
      'quickFive', 'topLine', 'middleLine', 'bottomLine', 'corners', 
      'starCorners', 'halfSheet', 'fullSheet', 'fullHouse', 'secondFullHouse'
    ];
    
    if (!validPrizeTypes.includes(prizeType as keyof Game.Winners)) {
      throw new Error(`Invalid prize type: ${prizeType}`);
    }
    
    const currentWinners = currentGame.gameState?.winners || {
      quickFive: [], topLine: [], middleLine: [], bottomLine: [],
      corners: [], starCorners: [], halfSheet: [], fullSheet: [],
      fullHouse: [], secondFullHouse: []
    };
    
    const prizeKey = prizeType as keyof Game.Winners;
    const existingWinners = currentWinners[prizeKey] || [];
    
    const updatedWinners: Game.Winners = {
      ...currentWinners,
      [prizeKey]: [...existingWinners, ...ticketIds]
    };
    
    await this.databaseService.updateGameState(hostId, { winners: updatedWinners });
    
    try {
      await this.audioManager.playPrizeWinEffect(prizeKey);
    } catch (error) {
      console.warn('Prize sound failed:', error);
    }
    
    return this.createSuccessResult(command, {
      prizeType, ticketIds, playerName, phoneNumber, allPrizeTypes, updatedWinners
    });
  }
  
  // ... [Rest of the execution methods remain unchanged]
  
  private validateCommand(command: GameCommand, context: CommandContext): CommandValidationResult {
    if (!command.hostId) {
      return { isValid: false, error: 'Host ID is required' };
    }
    
    if (!command.id || !command.timestamp) {
      return { isValid: false, error: 'Command ID and timestamp are required' };
    }
    
    switch (command.type) {
      case 'CALL_NUMBER':
        return this.validateCallNumber(command, context);
      case 'CREATE_BOOKING':
        return this.validateCreateBooking(command, context);
      case 'UPDATE_BOOKING':
        return this.validateUpdateBooking(command, context);
      case 'RETURN_TO_SETUP':
        return this.validateReturnToSetup(command, context);
      default:
        return { isValid: true };
    }
  }
  
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
    
    const existingBookings = context.currentGame.activeTickets?.bookings || {};
    const unavailableTickets = tickets.filter((ticketId: string) => ticketId in existingBookings);
    
    if (unavailableTickets.length > 0) {
      return { isValid: false, error: `Tickets already booked: ${unavailableTickets.join(', ')}` };
    }
    
    return { isValid: true };
  }
  
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

  private validateReturnToSetup(command: any, context: CommandContext): CommandValidationResult {
    if (!context.currentGame) {
      return { isValid: false, error: 'No active game found' };
    }
    
    const currentPhase = context.currentGame.gameState?.phase;
    
    if (currentPhase !== 2) {
      return { 
        isValid: false, 
        error: `Cannot return to setup from phase ${currentPhase}. Only allowed from booking phase.`
      };
    }
    
    return { isValid: true };
  }
  
  private createSuccessResult(command: GameCommand, data?: any): CommandResult {
    return {
      success: true,
      command,
      data,
      timestamp: Date.now()
    };
  }
  
  private createErrorResult(command: GameCommand, error: string): CommandResult {
    return {
      success: false,
      command,
      error,
      timestamp: Date.now()
    };
  }
  
  public async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up command processor');
  }
  
  // ... [Additional helper methods remain unchanged]
}
