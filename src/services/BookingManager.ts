// src/services/BookingManager.ts - Updated to use centralized database service
import { GameDatabaseService } from './GameDatabaseService';
import { Game } from '../types/game';

interface BookingCreateData {
  playerName: string;
  phoneNumber: string;
  tickets: string[];
}

export class BookingManager {
  private static instance: BookingManager;
  private hostId: string | null = null;
  private databaseService: GameDatabaseService;
  
  private constructor() {
    this.databaseService = GameDatabaseService.getInstance();
  }
  
  public static getInstance(): BookingManager {
    if (!BookingManager.instance) {
      BookingManager.instance = new BookingManager();
    }
    return BookingManager.instance;
  }
  
  public initialize(hostId: string): void {
    this.hostId = hostId;
  }
  
  public async getAllBookings(): Promise<Game.Player[]> {
    if (!this.hostId) {
      throw new Error('BookingManager not initialized with host ID');
    }
    
    try {
      const currentGame = await this.databaseService.getCurrentGame(this.hostId);
      if (!currentGame || !currentGame.players) {
        return [];
      }
      
      return Object.values(currentGame.players);
    } catch (error) {
      console.error('Error getting all bookings:', error);
      throw new Error('Failed to retrieve bookings');
    }
  }
  
  public async createBooking(data: BookingCreateData): Promise<void> {
    if (!this.hostId || !data.tickets.length) {
      throw new Error('Invalid booking data or BookingManager not initialized');
    }
    
    try {
      const timestamp = Date.now();
      const playerId = `player_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
      
      const currentGame = await this.databaseService.getCurrentGame(this.hostId);
      if (!currentGame) {
        throw new Error('No active game found');
      }

      const currentMetrics = currentGame.bookingMetrics || {
        totalBookings: 0,
        totalPlayers: 0,
        lastBookingTime: 0
      };

      const newPlayer: Game.Player = {
        id: playerId,
        name: data.playerName,
        phoneNumber: data.phoneNumber,
        tickets: data.tickets,
        bookingTime: timestamp,
        totalTickets: data.tickets.length
      };

      const newBookings: Record<string, Game.Booking> = {};
      const ticketUpdates: Record<string, Partial<Game.Ticket>> = {};

      data.tickets.forEach(ticketId => {
        newBookings[ticketId] = {
          number: parseInt(ticketId),
          playerName: data.playerName,
          phoneNumber: data.phoneNumber,
          playerId,
          status: 'booked',
          timestamp
        };
        
        ticketUpdates[ticketId] = { status: 'booked' };
      });

      const updatedMetrics: Game.BookingMetrics = {
        lastBookingTime: timestamp,
        totalBookings: currentMetrics.totalBookings + data.tickets.length,
        totalPlayers: currentMetrics.totalPlayers + 1
      };

      await this.databaseService.batchUpdateGameData(this.hostId, {
        players: { [playerId]: newPlayer },
        bookings: newBookings,
        tickets: ticketUpdates,
        metrics: updatedMetrics
      });

    } catch (error) {
      console.error('Error creating booking:', error);
      throw new Error('Failed to create booking');
    }
  }
  
  public async updateBooking(
    ticketId: string, 
    updates: { playerName?: string; phoneNumber?: string }
  ): Promise<void> {
    if (!this.hostId) {
      throw new Error('BookingManager not initialized with host ID');
    }
    
    try {
      const currentGame = await this.databaseService.getCurrentGame(this.hostId);
      if (!currentGame || !currentGame.activeTickets?.bookings?.[ticketId]) {
        throw new Error(`Booking not found for ticket ${ticketId}`);
      }

      const booking = currentGame.activeTickets.bookings[ticketId];
      const updatedBooking = { ...booking };
      
      if (updates.playerName) {
        updatedBooking.playerName = updates.playerName;
      }
      
      if (updates.phoneNumber) {
        updatedBooking.phoneNumber = updates.phoneNumber;
      }

      const batchUpdates: any = {
        bookings: { [ticketId]: updatedBooking }
      };

      if (booking.playerId && (updates.playerName || updates.phoneNumber)) {
        const players = currentGame.players || {};
        const player = players[booking.playerId];
        
        if (player) {
          const updatedPlayer = { ...player };
          
          if (updates.playerName) {
            updatedPlayer.name = updates.playerName;
          }
          
          if (updates.phoneNumber) {
            updatedPlayer.phoneNumber = updates.phoneNumber;
          }
          
          batchUpdates.players = { [booking.playerId]: updatedPlayer };
        }
      }

      await this.databaseService.batchUpdateGameData(this.hostId, batchUpdates);

    } catch (error) {
      console.error('Error updating booking:', error);
      throw new Error('Failed to update booking');
    }
  }
  
  public async cancelBooking(ticketIds: string[]): Promise<void> {
    if (!this.hostId || !ticketIds.length) {
      throw new Error('Invalid ticket IDs or BookingManager not initialized');
    }
    
    try {
      const currentGame = await this.databaseService.getCurrentGame(this.hostId);
      if (!currentGame) {
        throw new Error('No active game found');
      }

      const playerIds = new Set<string>();
      const bookingUpdates: Record<string, null> = {};
      const ticketUpdates: Record<string, Partial<Game.Ticket>> = {};

      ticketIds.forEach(ticketId => {
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

      const currentMetrics = currentGame.bookingMetrics;
      if (currentMetrics) {
        batchUpdates.metrics = {
          ...currentMetrics,
          totalBookings: Math.max(0, currentMetrics.totalBookings - ticketIds.length)
        };
      }

      await this.databaseService.batchUpdateGameData(this.hostId, batchUpdates);

    } catch (error) {
      console.error('Error canceling booking:', error);
      throw new Error('Failed to cancel booking');
    }
  }
  
  public async getBookingsByPlayer(playerName: string, phoneNumber: string): Promise<string[]> {
    if (!this.hostId) {
      throw new Error('BookingManager not initialized with host ID');
    }
    
    try {
      const currentGame = await this.databaseService.getCurrentGame(this.hostId);
      if (!currentGame || !currentGame.players) {
        return [];
      }

      const players = currentGame.players;
      let matchingTickets: string[] = [];
      
      Object.values(players).forEach((player: Game.Player) => {
        if (
          player.name.toLowerCase() === playerName.toLowerCase() &&
          player.phoneNumber === phoneNumber
        ) {
          matchingTickets = [...matchingTickets, ...(player.tickets || [])];
        }
      });
      
      return matchingTickets;
    } catch (error) {
      console.error('Error getting bookings by player:', error);
      throw new Error('Failed to retrieve bookings by player');
    }
  }
  
  public async getAvailableTickets(): Promise<string[]> {
    if (!this.hostId) {
      throw new Error('BookingManager not initialized with host ID');
    }
    
    try {
      const currentGame = await this.databaseService.getCurrentGame(this.hostId);
      if (!currentGame || !currentGame.activeTickets?.tickets) {
        return [];
      }

      const tickets = currentGame.activeTickets.tickets;
      const availableTickets: string[] = [];
      
      Object.entries(tickets).forEach(([ticketId, ticket]) => {
        if (ticket.status === 'available') {
          availableTickets.push(ticketId);
        }
      });
      
      return availableTickets;
    } catch (error) {
      console.error('Error getting available tickets:', error);
      throw new Error('Failed to retrieve available tickets');
    }
  }
}

export default BookingManager;
