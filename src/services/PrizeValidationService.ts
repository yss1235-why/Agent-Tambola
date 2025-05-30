// src/services/PrizeValidationService.ts - Dramatically simplified version

import { ref, get, update, onValue } from 'firebase/database';
import { database } from '../lib/firebase';
import { Game } from '../types/game';
import { AudioManager } from '../utils/audioManager';

interface ValidationResult {
  isValid: boolean;
  winners: string[];
  error?: string;
}

export class PrizeValidationService {
  private static instance: PrizeValidationService;
  private hostId: string | null = null;
  private audioManager: AudioManager;
  private validatedTickets: Map<string, Set<string>> = new Map();
  private lastValidationTime: number = 0;

  private constructor() {
    this.audioManager = AudioManager.getInstance();
  }

  public static getInstance(): PrizeValidationService {
    if (!PrizeValidationService.instance) {
      PrizeValidationService.instance = new PrizeValidationService();
    }
    return PrizeValidationService.instance;
  }

  public initialize(hostId: string): void {
    this.hostId = hostId;
    this.validatedTickets.clear();
    this.lastValidationTime = 0;
  }

  public async validateAllPrizes(
    tickets: Record<string, Game.Ticket>,
    calledNumbers: number[],
    currentWinners: Game.Winners,
    activePrizes: Game.Settings['prizes'],
    bookings: Record<string, Game.Booking> = {}
  ): Promise<Record<keyof Game.Winners, ValidationResult>> {
    // Throttle validations
    const now = Date.now();
    if (now - this.lastValidationTime < 500) {
      return {} as Record<keyof Game.Winners, ValidationResult>;
    }
    this.lastValidationTime = now;

    const results: Record<string, ValidationResult> = {};
    const prizeTypes: Array<keyof Game.Winners> = [
      'quickFive', 'topLine', 'middleLine', 'bottomLine', 'corners',
      'starCorners', 'halfSheet', 'fullSheet', 'fullHouse', 'secondFullHouse',
    ];

    // Initialize results
    prizeTypes.forEach((prizeType) => {
      results[prizeType] = { isValid: false, winners: [] };
    });

    const newWinners: Partial<Game.Winners> = {};
    let hasNewWinners = false;

    for (const prizeType of prizeTypes) {
      try {
        if (!activePrizes[prizeType] || currentWinners?.[prizeType]?.length > 0) {
          continue;
        }

        // Special validations
        if (prizeType === 'secondFullHouse' && (!currentWinners?.fullHouse || currentWinners.fullHouse.length === 0)) {
          continue;
        }
        if (prizeType === 'fullSheet' && (!currentWinners?.halfSheet || currentWinners.halfSheet.length === 0)) {
          continue;
        }

        // Handle sheet prizes specially
        if (prizeType === 'fullSheet') {
          const sheetWinners = this.validateFullSheet(tickets, calledNumbers, bookings);
          if (sheetWinners.length > 0) {
            results[prizeType] = { isValid: true, winners: sheetWinners };
            newWinners[prizeType] = [...(currentWinners[prizeType] || []), ...sheetWinners];
            hasNewWinners = true;
          }
        } else if (prizeType === 'halfSheet') {
          const sheetWinners = this.validateHalfSheet(tickets, calledNumbers, bookings);
          if (sheetWinners.length > 0) {
            results[prizeType] = { isValid: true, winners: sheetWinners };
            newWinners[prizeType] = [...(currentWinners[prizeType] || []), ...sheetWinners];
            hasNewWinners = true;
          }
        } else {
          // Standard ticket validation
          for (const [ticketId, ticket] of Object.entries(tickets)) {
            if (!bookings[ticketId]) continue;

            if (prizeType === 'secondFullHouse') {
              const firstFullHouseTickets = currentWinners.fullHouse || [];
              if (firstFullHouseTickets.includes(ticketId)) continue;
            }

            if (this.validateTicket(ticket, calledNumbers, prizeType)) {
              results[prizeType] = { isValid: true, winners: [ticketId] };
              newWinners[prizeType] = [...(currentWinners[prizeType] || []), ticketId];
              hasNewWinners = true;
              break;
            }
          }
        }
      } catch (error) {
        console.error(`Error validating ${prizeType}:`, error);
        results[prizeType] = { isValid: false, winners: [], error: 'Validation error' };
      }
    }

    // Update database if new winners found
    if (hasNewWinners && this.hostId) {
      try {
        await update(ref(database, `hosts/${this.hostId}/currentGame/gameState/winners`), newWinners);
        this.handlePrizeAnnouncements(newWinners, bookings);
        this.checkAllPrizesWon(activePrizes, { ...currentWinners, ...newWinners } as Game.Winners);
      } catch (error) {
        console.error('Error updating winners:', error);
      }
    }

    return results as Record<keyof Game.Winners, ValidationResult>;
  }

  private validateFullSheet(
    tickets: Record<string, Game.Ticket>,
    calledNumbers: number[],
    bookings: Record<string, Game.Booking>
  ): string[] {
    const sheetMap = new Map<number, Game.Ticket[]>();

    // Group tickets by sheet
    Object.values(tickets).forEach(ticket => {
      if (!ticket.sheetNumber) return;
      if (!sheetMap.has(ticket.sheetNumber)) {
        sheetMap.set(ticket.sheetNumber, []);
      }
      sheetMap.get(ticket.sheetNumber)?.push(ticket);
    });

    // Check each sheet
    for (const [sheetNum, ticketsInSheet] of sheetMap) {
      if (ticketsInSheet.length !== 6) continue;

      const ticketIds = ticketsInSheet.map(t => t.id);
      const allBooked = ticketIds.every(id => bookings[id]);
      if (!allBooked) continue;

      // Check same player
      const players = new Set(ticketIds.map(id => bookings[id]?.playerName));
      if (players.size !== 1) continue;

      // Check at least 2 numbers called per ticket
      const validTickets = ticketsInSheet.every(ticket => {
        const numbers = ticket.numbers.flat().filter(n => n !== 0);
        const calledCount = numbers.filter(n => calledNumbers.includes(n)).length;
        return calledCount >= 2;
      });

      if (validTickets) {
        return ticketIds;
      }
    }
    return [];
  }

  private validateHalfSheet(
    tickets: Record<string, Game.Ticket>,
    calledNumbers: number[],
    bookings: Record<string, Game.Booking>
  ): string[] {
    const sheetMap = new Map<number, Game.Ticket[]>();

    // Group tickets by sheet
    Object.values(tickets).forEach(ticket => {
      if (!ticket.sheetNumber) return;
      if (!sheetMap.has(ticket.sheetNumber)) {
        sheetMap.set(ticket.sheetNumber, []);
      }
      sheetMap.get(ticket.sheetNumber)?.push(ticket);
    });

    // Check combinations of 3 tickets
    for (const [sheetNum, ticketsInSheet] of sheetMap) {
      if (ticketsInSheet.length < 3) continue;

      // Generate combinations of 3
      for (let i = 0; i < ticketsInSheet.length - 2; i++) {
        for (let j = i + 1; j < ticketsInSheet.length - 1; j++) {
          for (let k = j + 1; k < ticketsInSheet.length; k++) {
            const combination = [ticketsInSheet[i], ticketsInSheet[j], ticketsInSheet[k]];
            const ticketIds = combination.map(t => t.id);

            const allBooked = ticketIds.every(id => bookings[id]);
            if (!allBooked) continue;

            // Check same player
            const players = new Set(ticketIds.map(id => bookings[id]?.playerName));
            if (players.size !== 1) continue;

            // Check at least 2 numbers called per ticket
            const validTickets = combination.every(ticket => {
              const numbers = ticket.numbers.flat().filter(n => n !== 0);
              const calledCount = numbers.filter(n => calledNumbers.includes(n)).length;
              return calledCount >= 2;
            });

            if (validTickets) {
              return ticketIds;
            }
          }
        }
      }
    }
    return [];
  }

  private validateTicket(ticket: Game.Ticket, calledNumbers: number[], prizeType: keyof Game.Winners): boolean {
    if (!ticket?.numbers) return false;

    switch (prizeType) {
      case 'quickFive':
        const flatNumbers = ticket.numbers.flat().filter(n => n !== 0);
        return flatNumbers.filter(n => calledNumbers.includes(n)).length >= 5;
      
      case 'topLine':
        return this.validateLine(ticket, calledNumbers, 0);
      case 'middleLine':
        return this.validateLine(ticket, calledNumbers, 1);
      case 'bottomLine':
        return this.validateLine(ticket, calledNumbers, 2);
      
      case 'corners':
        return this.validateCorners(ticket, calledNumbers);
      case 'starCorners':
        return this.validateStarCorners(ticket, calledNumbers);
      
      case 'fullHouse':
      case 'secondFullHouse':
        const allNumbers = ticket.numbers.flat().filter(n => n !== 0);
        return allNumbers.every(n => calledNumbers.includes(n));
      
      default:
        return false;
    }
  }

  private validateLine(ticket: Game.Ticket, calledNumbers: number[], rowIndex: number): boolean {
    const numbersInRow = ticket.numbers[rowIndex].filter(n => n !== 0);
    return numbersInRow.every(n => calledNumbers.includes(n));
  }

  private validateCorners(ticket: Game.Ticket, calledNumbers: number[]): boolean {
    const topRow = ticket.numbers[0].filter(n => n !== 0);
    const bottomRow = ticket.numbers[2].filter(n => n !== 0);
    
    if (topRow.length < 2 || bottomRow.length < 2) return false;
    
    const corners = [topRow[0], topRow[topRow.length - 1], bottomRow[0], bottomRow[bottomRow.length - 1]];
    return corners.every(n => calledNumbers.includes(n));
  }

  private validateStarCorners(ticket: Game.Ticket, calledNumbers: number[]): boolean {
    const topRow = ticket.numbers[0].filter(n => n !== 0);
    const middleRow = ticket.numbers[1].filter(n => n !== 0);
    const bottomRow = ticket.numbers[2].filter(n => n !== 0);
    
    if (topRow.length < 2 || bottomRow.length < 2 || middleRow.length === 0) return false;
    
    const middleIndex = Math.floor(middleRow.length / 2);
    const starCorners = [
      topRow[0], topRow[topRow.length - 1],
      middleRow[middleIndex],
      bottomRow[0], bottomRow[bottomRow.length - 1]
    ];
    return starCorners.every(n => calledNumbers.includes(n));
  }

  private handlePrizeAnnouncements(newWinners: Partial<Game.Winners>, bookings: Record<string, Game.Booking>): void {
    Object.entries(newWinners).forEach(([prizeType, ticketIds]) => {
      if (Array.isArray(ticketIds) && ticketIds.length > 0) {
        this.audioManager.playPrizeWinEffect(prizeType as keyof Game.Winners);
        
        const ticketId = ticketIds[0];
        const booking = bookings[ticketId];
        if (booking) {
          console.log(`🏆 ${booking.playerName} won ${prizeType} with ticket #${ticketId}!`);
        }
      }
    });
  }

  private async checkAllPrizesWon(activePrizes: Game.Settings['prizes'], winners: Game.Winners): Promise<void> {
    if (!this.hostId) return;

    const allPrizesWon = Object.entries(activePrizes)
      .filter(([_, isActive]) => isActive)
      .every(([prizeType]) => winners[prizeType as keyof Game.Winners]?.length > 0);

    if (allPrizesWon) {
      try {
        await update(ref(database, `hosts/${this.hostId}/currentGame/gameState`), {
          allPrizesWon: true,
          isAutoCalling: false,
          status: 'ended',
          phase: 4
        });
        console.log('🎉 All prizes won! Game completed.');
      } catch (error) {
        console.error('Error updating game completion:', error);
      }
    }
  }

  public cleanup(): void {
    this.hostId = null;
    this.validatedTickets.clear();
    this.lastValidationTime = 0;
  }
}

export default PrizeValidationService;
