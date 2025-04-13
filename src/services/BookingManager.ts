// src/services/BookingManager.ts

import { ref, get, set, update, remove } from 'firebase/database';
import { database } from '../lib/firebase';
import { Game } from '../types/game';

interface BookingCreateData {
  playerName: string;
  phoneNumber: string;
  tickets: string[];
}

export class BookingManager {
  private static instance: BookingManager;
  private hostId: string | null = null;
  
  private constructor() {}
  
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
      const playersRef = ref(database, `hosts/${this.hostId}/currentGame/players`);
      const snapshot = await get(playersRef);
      
      if (!snapshot.exists()) {
        return [];
      }
      
      const playersData = snapshot.val();
      return Object.values(playersData) as Game.Player[];
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
      const updates: Record<string, any> = {};
      
      // Create player record
      updates[`hosts/${this.hostId}/currentGame/players/${playerId}`] = {
        id: playerId,
        name: data.playerName,
        phoneNumber: data.phoneNumber,
        tickets: data.tickets,
        bookingTime: timestamp,
        totalTickets: data.tickets.length
      };
      
      // Update ticket bookings
      data.tickets.forEach(ticketId => {
        updates[`hosts/${this.hostId}/currentGame/activeTickets/bookings/${ticketId}`] = {
          number: parseInt(ticketId),
          playerName: data.playerName,
          phoneNumber: data.phoneNumber,
          playerId,
          status: 'booked',
          timestamp
        };
        
        updates[`hosts/${this.hostId}/currentGame/activeTickets/tickets/${ticketId}/status`] = 'booked';
      });
      
      // Update booking metrics
      const metricsRef = ref(database, `hosts/${this.hostId}/currentGame/bookingMetrics`);
      const metricsSnapshot = await get(metricsRef);
      const currentMetrics = metricsSnapshot.exists() ? metricsSnapshot.val() : {
        totalBookings: 0,
        totalPlayers: 0,
        lastBookingTime: 0
      };
      
      updates[`hosts/${this.hostId}/currentGame/bookingMetrics`] = {
        lastBookingTime: timestamp,
        totalBookings: currentMetrics.totalBookings + data.tickets.length,
        totalPlayers: currentMetrics.totalPlayers + 1
      };
      
      // Apply all updates atomically
      await update(ref(database), updates);
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
      const bookingRef = ref(database, `hosts/${this.hostId}/currentGame/activeTickets/bookings/${ticketId}`);
      const snapshot = await get(bookingRef);
      
      if (!snapshot.exists()) {
        throw new Error(`Booking not found for ticket ${ticketId}`);
      }
      
      const booking = snapshot.val();
      const updatedBooking = { ...booking };
      
      if (updates.playerName) {
        updatedBooking.playerName = updates.playerName;
      }
      
      if (updates.phoneNumber) {
        updatedBooking.phoneNumber = updates.phoneNumber;
      }
      
      // Update the booking
      await set(bookingRef, updatedBooking);
      
      // If player info changed, update the player record too
      if (booking.playerId && (updates.playerName || updates.phoneNumber)) {
        const playerRef = ref(database, `hosts/${this.hostId}/currentGame/players/${booking.playerId}`);
        const playerSnapshot = await get(playerRef);
        
        if (playerSnapshot.exists()) {
          const player = playerSnapshot.val();
          const playerUpdates: Record<string, any> = {};
          
          if (updates.playerName) {
            playerUpdates.name = updates.playerName;
          }
          
          if (updates.phoneNumber) {
            playerUpdates.phoneNumber = updates.phoneNumber;
          }
          
          if (Object.keys(playerUpdates).length > 0) {
            await update(playerRef, playerUpdates);
          }
        }
      }
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
      const updates: Record<string, any> = {};
      const playerIds = new Set<string>();
      
      // First, get all the bookings to find player IDs
      for (const ticketId of ticketIds) {
        const bookingRef = ref(database, `hosts/${this.hostId}/currentGame/activeTickets/bookings/${ticketId}`);
        const snapshot = await get(bookingRef);
        
        if (snapshot.exists()) {
          const booking = snapshot.val();
          if (booking.playerId) {
            playerIds.add(booking.playerId);
          }
          
          // Remove booking
          updates[`hosts/${this.hostId}/currentGame/activeTickets/bookings/${ticketId}`] = null;
          
          // Reset ticket status
          updates[`hosts/${this.hostId}/currentGame/activeTickets/tickets/${ticketId}/status`] = 'available';
        }
      }
      
      // Update player records
      for (const playerId of playerIds) {
        const playerRef = ref(database, `hosts/${this.hostId}/currentGame/players/${playerId}`);
        const snapshot = await get(playerRef);
        
        if (snapshot.exists()) {
          const player = snapshot.val();
          const updatedTickets = player.tickets.filter((t: string) => !ticketIds.includes(t));
          
          if (updatedTickets.length === 0) {
            // Remove player if they have no more tickets
            updates[`hosts/${this.hostId}/currentGame/players/${playerId}`] = null;
          } else {
            // Update player's tickets
            updates[`hosts/${this.hostId}/currentGame/players/${playerId}/tickets`] = updatedTickets;
            updates[`hosts/${this.hostId}/currentGame/players/${playerId}/totalTickets`] = updatedTickets.length;
          }
        }
      }
      
      // Update booking metrics
      const metricsRef = ref(database, `hosts/${this.hostId}/currentGame/bookingMetrics`);
      const metricsSnapshot = await get(metricsRef);
      
      if (metricsSnapshot.exists()) {
        const metrics = metricsSnapshot.val();
        updates[`hosts/${this.hostId}/currentGame/bookingMetrics/totalBookings`] = 
          Math.max(0, metrics.totalBookings - ticketIds.length);
          
        // We don't decrement totalPlayers because we don't know if all players were removed
      }
      
      // Apply all updates atomically
      await update(ref(database), updates);
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
      const playersRef = ref(database, `hosts/${this.hostId}/currentGame/players`);
      const snapshot = await get(playersRef);
      
      if (!snapshot.exists()) {
        return [];
      }
      
      const players = snapshot.val();
      let matchingTickets: string[] = [];
      
      // Find players with matching name and phone
      Object.values(players).forEach((player: any) => {
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
      const ticketsRef = ref(database, `hosts/${this.hostId}/currentGame/activeTickets/tickets`);
      const snapshot = await get(ticketsRef);
      
      if (!snapshot.exists()) {
        return [];
      }
      
      const tickets = snapshot.val();
      const availableTickets: string[] = [];
      
      Object.entries(tickets).forEach(([ticketId, ticket]: [string, any]) => {
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