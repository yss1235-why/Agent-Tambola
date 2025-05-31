// src/utils/prizeValidation.ts - REPLACE EXISTING FILE
import type { Game } from '../types/game';

export interface ValidationContext {
  tickets: Record<string, Game.Ticket>;
  bookings: Record<string, Game.Booking>;
  calledNumbers: number[];
  currentWinners: Game.Winners;
  activePrizes: Game.Settings['prizes'];
}

export interface PrizeValidationResult {
  isWinner: boolean;
  winningTickets: string[];
  prizeType: keyof Game.Winners;
  playerName: string;
  phoneNumber: string;
  allPrizeTypes: string[]; // New: for multiple prizes
}

// Pre-computed lookup maps for performance
class ValidationLookupMaps {
  private numberToTickets: Map<number, string[]> = new Map();
  private ticketToSheet: Map<string, number> = new Map();
  private sheetToTickets: Map<number, string[]> = new Map();
  private playerToTickets: Map<string, string[]> = new Map();

  constructor(tickets: Record<string, Game.Ticket>, bookings: Record<string, Game.Booking>) {
    this.buildLookupMaps(tickets, bookings);
  }

  private buildLookupMaps(tickets: Record<string, Game.Ticket>, bookings: Record<string, Game.Booking>) {
    // Build number-to-tickets lookup
    for (const [ticketId, ticket] of Object.entries(tickets)) {
      const ticketNum = parseInt(ticketId);
      const sheetNumber = Math.ceil(ticketNum / 6);
      
      this.ticketToSheet.set(ticketId, sheetNumber);
      
      // Group tickets by sheet
      if (!this.sheetToTickets.has(sheetNumber)) {
        this.sheetToTickets.set(sheetNumber, []);
      }
      this.sheetToTickets.get(sheetNumber)!.push(ticketId);
      
      // Build number lookup
      if (ticket.numbers) {
        ticket.numbers.flat().forEach(number => {
          if (number !== 0) {
            if (!this.numberToTickets.has(number)) {
              this.numberToTickets.set(number, []);
            }
            this.numberToTickets.get(number)!.push(ticketId);
          }
        });
      }
    }

    // Build player-to-tickets lookup
    for (const [ticketId, booking] of Object.entries(bookings)) {
      const playerKey = `${booking.playerName}-${booking.phoneNumber}`;
      if (!this.playerToTickets.has(playerKey)) {
        this.playerToTickets.set(playerKey, []);
      }
      this.playerToTickets.get(playerKey)!.push(ticketId);
    }
  }

  getTicketsWithNumber(number: number): string[] {
    return this.numberToTickets.get(number) || [];
  }

  getPlayerTickets(playerName: string, phoneNumber: string): string[] {
    const playerKey = `${playerName}-${phoneNumber}`;
    return this.playerToTickets.get(playerKey) || [];
  }

  getSheetTickets(sheetNumber: number): string[] {
    return this.sheetToTickets.get(sheetNumber) || [];
  }

  getTicketSheet(ticketId: string): number {
    return this.ticketToSheet.get(ticketId) || 0;
  }
}

// Timing-based validation rules
function shouldCheckPrize(prizeType: keyof Game.Winners, callCount: number, currentWinners: Game.Winners): boolean {
  switch (prizeType) {
    case 'quickFive':
      return callCount >= 5;
    case 'topLine':
    case 'middleLine':
    case 'bottomLine':
      return callCount >= 4;
    case 'corners':
      return callCount >= 4;
    case 'starCorners':
      return callCount >= 5 && currentWinners.corners.length === 0;
    case 'halfSheet':
      return callCount >= 6;
    case 'fullSheet':
      return callCount >= 12;
    case 'fullHouse':
      return callCount >= 15;
    case 'secondFullHouse':
      return currentWinners.fullHouse.length > 0;
    default:
      return true;
  }
}

// Fast individual prize validation functions
export function validateQuickFive(ticket: Game.Ticket, calledNumbers: number[]): boolean {
  const ticketNumbers = ticket.numbers.flat().filter(n => n !== 0);
  const matchCount = ticketNumbers.filter(n => calledNumbers.includes(n)).length;
  return matchCount >= 5;
}

export function validateTopLine(ticket: Game.Ticket, calledNumbers: number[]): boolean {
  if (!ticket.numbers[0]) return false;
  const lineNumbers = ticket.numbers[0].filter(n => n !== 0);
  return lineNumbers.every(n => calledNumbers.includes(n));
}

export function validateMiddleLine(ticket: Game.Ticket, calledNumbers: number[]): boolean {
  if (!ticket.numbers[1]) return false;
  const lineNumbers = ticket.numbers[1].filter(n => n !== 0);
  return lineNumbers.every(n => calledNumbers.includes(n));
}

export function validateBottomLine(ticket: Game.Ticket, calledNumbers: number[]): boolean {
  if (!ticket.numbers[2]) return false;
  const lineNumbers = ticket.numbers[2].filter(n => n !== 0);
  return lineNumbers.every(n => calledNumbers.includes(n));
}

export function validateCorners(ticket: Game.Ticket, calledNumbers: number[]): boolean {
  const topRow = ticket.numbers[0].filter(n => n !== 0);
  const bottomRow = ticket.numbers[2].filter(n => n !== 0);
  
  if (topRow.length < 2 || bottomRow.length < 2) return false;
  
  const corners = [
    topRow[0], // Top left
    topRow[topRow.length - 1], // Top right
    bottomRow[0], // Bottom left
    bottomRow[bottomRow.length - 1] // Bottom right
  ];
  
  return corners.every(n => calledNumbers.includes(n));
}

export function validateStarCorners(ticket: Game.Ticket, calledNumbers: number[]): boolean {
  if (!validateCorners(ticket, calledNumbers)) return false;
  
  const middleRow = ticket.numbers[1].filter(n => n !== 0);
  if (middleRow.length === 0) return false;
  
  const centerIndex = Math.floor(middleRow.length / 2);
  const centerNumber = middleRow[centerIndex];
  
  return calledNumbers.includes(centerNumber);
}

export function validateFullHouse(ticket: Game.Ticket, calledNumbers: number[]): boolean {
  const allNumbers = ticket.numbers.flat().filter(n => n !== 0);
  return allNumbers.every(n => calledNumbers.includes(n));
}

// Sheet validation functions
function validateHalfSheet(
  playerTickets: string[], 
  lookupMaps: ValidationLookupMaps, 
  tickets: Record<string, Game.Ticket>, 
  calledNumbers: number[]
): string[] {
  const sheetGroups = new Map<number, string[]>();
  
  for (const ticketId of playerTickets) {
    const sheetNumber = lookupMaps.getTicketSheet(ticketId);
    if (!sheetGroups.has(sheetNumber)) {
      sheetGroups.set(sheetNumber, []);
    }
    sheetGroups.get(sheetNumber)!.push(ticketId);
  }
  
  for (const [sheetNumber, sheetTickets] of sheetGroups) {
    if (sheetTickets.length < 3) continue;
    
    const ticketNumbers = sheetTickets.map(id => parseInt(id)).sort();
    const sheetStart = (sheetNumber - 1) * 6 + 1;
    
    // Check first half: [1,2,3], [7,8,9], etc.
    const firstHalf = [sheetStart, sheetStart + 1, sheetStart + 2];
    const hasFirstHalf = firstHalf.every(num => ticketNumbers.includes(num));
    
    // Check second half: [4,5,6], [10,11,12], etc.
    const secondHalf = [sheetStart + 3, sheetStart + 4, sheetStart + 5];
    const hasSecondHalf = secondHalf.every(num => ticketNumbers.includes(num));
    
    if (hasFirstHalf || hasSecondHalf) {
      const winningTickets = hasFirstHalf ? firstHalf : secondHalf;
      
      // Verify minimum numbers called on each ticket
      const validTickets = winningTickets.filter(ticketNum => {
        const ticketId = ticketNum.toString();
        const ticket = tickets[ticketId];
        if (!ticket) return false;
        
        const ticketNumbers = ticket.numbers.flat().filter(n => n !== 0);
        const matchCount = ticketNumbers.filter(n => calledNumbers.includes(n)).length;
        return matchCount >= 2;
      });
      
      if (validTickets.length === 3) {
        return validTickets.map(num => num.toString());
      }
    }
  }
  
  return [];
}

function validateFullSheet(
  playerTickets: string[], 
  lookupMaps: ValidationLookupMaps, 
  tickets: Record<string, Game.Ticket>, 
  calledNumbers: number[]
): string[] {
  const sheetGroups = new Map<number, string[]>();
  
  for (const ticketId of playerTickets) {
    const sheetNumber = lookupMaps.getTicketSheet(ticketId);
    if (!sheetGroups.has(sheetNumber)) {
      sheetGroups.set(sheetNumber, []);
    }
    sheetGroups.get(sheetNumber)!.push(ticketId);
  }
  
  for (const [sheetNumber, sheetTickets] of sheetGroups) {
    if (sheetTickets.length < 6) continue;
    
    const ticketNumbers = sheetTickets.map(id => parseInt(id)).sort();
    const sheetStart = (sheetNumber - 1) * 6 + 1;
    const expectedTickets = Array.from({ length: 6 }, (_, i) => sheetStart + i);
    
    const isCompleteSheet = expectedTickets.every(num => ticketNumbers.includes(num));
    
    if (isCompleteSheet) {
      const validTickets = expectedTickets.filter(ticketNum => {
        const ticketId = ticketNum.toString();
        const ticket = tickets[ticketId];
        if (!ticket) return false;
        
        const ticketNumbers = ticket.numbers.flat().filter(n => n !== 0);
        const matchCount = ticketNumbers.filter(n => calledNumbers.includes(n)).length;
        return matchCount >= 2;
      });
      
      if (validTickets.length === 6) {
        return validTickets.map(num => num.toString());
      }
    }
  }
  
  return [];
}

// Main optimized validation function - REPLACES the old validateAllPrizes
export function validateAllPrizes(context: ValidationContext): PrizeValidationResult[] {
  const { tickets, bookings, calledNumbers, currentWinners, activePrizes } = context;
  const results: PrizeValidationResult[] = [];
  
  // Build lookup maps
  const lookupMaps = new ValidationLookupMaps(tickets, bookings);
  
  // Get the most recently called number for optimization
  const lastCalledNumber = calledNumbers[calledNumbers.length - 1];
  if (!lastCalledNumber) return results;
  
  // Only check tickets that contain the last called number
  const affectedTickets = lookupMaps.getTicketsWithNumber(lastCalledNumber);
  
  if (affectedTickets.length === 0) return results;
  
  // Group affected tickets by player
  const playerGroups = new Map<string, { tickets: string[], booking: Game.Booking }>();
  
  for (const ticketId of affectedTickets) {
    const booking = bookings[ticketId];
    if (!booking) continue;
    
    const playerKey = `${booking.playerName}-${booking.phoneNumber}`;
    if (!playerGroups.has(playerKey)) {
      playerGroups.set(playerKey, { tickets: [], booking });
    }
    playerGroups.get(playerKey)!.tickets.push(ticketId);
  }
  
  // Validate prizes for each affected player
  for (const [playerKey, { tickets: playerAffectedTickets, booking }] of playerGroups) {
    const allPlayerTickets = lookupMaps.getPlayerTickets(booking.playerName, booking.phoneNumber);
    const wonPrizes: string[] = [];
    let mainTicketId = playerAffectedTickets[0];
    
    // Check individual ticket prizes for affected tickets only
    for (const ticketId of playerAffectedTickets) {
      const ticket = tickets[ticketId];
      if (!ticket) continue;
      
      const callCount = calledNumbers.length;
      
      // Quick Five
      if (activePrizes.quickFive && 
          shouldCheckPrize('quickFive', callCount, currentWinners) &&
          !currentWinners.quickFive.includes(ticketId) &&
          validateQuickFive(ticket, calledNumbers)) {
        wonPrizes.push('Quick Five');
        mainTicketId = ticketId;
      }
      
      // Lines
      if (activePrizes.topLine && 
          shouldCheckPrize('topLine', callCount, currentWinners) &&
          !currentWinners.topLine.includes(ticketId) &&
          validateTopLine(ticket, calledNumbers)) {
        wonPrizes.push('Top Line');
        mainTicketId = ticketId;
      }
      
      if (activePrizes.middleLine && 
          shouldCheckPrize('middleLine', callCount, currentWinners) &&
          !currentWinners.middleLine.includes(ticketId) &&
          validateMiddleLine(ticket, calledNumbers)) {
        wonPrizes.push('Middle Line');
        mainTicketId = ticketId;
      }
      
      if (activePrizes.bottomLine && 
          shouldCheckPrize('bottomLine', callCount, currentWinners) &&
          !currentWinners.bottomLine.includes(ticketId) &&
          validateBottomLine(ticket, calledNumbers)) {
        wonPrizes.push('Bottom Line');
        mainTicketId = ticketId;
      }
      
      // Corners
      if (activePrizes.corners && 
          shouldCheckPrize('corners', callCount, currentWinners) &&
          !currentWinners.corners.includes(ticketId) &&
          validateCorners(ticket, calledNumbers)) {
        wonPrizes.push('Corners');
        mainTicketId = ticketId;
      }
      
      // Star Corners
      if (activePrizes.starCorners && 
          shouldCheckPrize('starCorners', callCount, currentWinners) &&
          !currentWinners.starCorners.includes(ticketId) &&
          validateStarCorners(ticket, calledNumbers)) {
        wonPrizes.push('Star Corners');
        mainTicketId = ticketId;
      }
      
      // Full House
      if (activePrizes.fullHouse && 
          shouldCheckPrize('fullHouse', callCount, currentWinners) &&
          !currentWinners.fullHouse.includes(ticketId) &&
          validateFullHouse(ticket, calledNumbers)) {
        wonPrizes.push('Full House');
        mainTicketId = ticketId;
      }
      
      // Second Full House
      if (activePrizes.secondFullHouse && 
          shouldCheckPrize('secondFullHouse', callCount, currentWinners) &&
          !currentWinners.secondFullHouse.includes(ticketId) &&
          validateFullHouse(ticket, calledNumbers)) {
        
        const firstFullHouseWinner = currentWinners.fullHouse[0];
        const firstWinnerBooking = firstFullHouseWinner ? bookings[firstFullHouseWinner] : null;
        
        if (!firstWinnerBooking || 
            firstWinnerBooking.playerName !== booking.playerName ||
            firstWinnerBooking.phoneNumber !== booking.phoneNumber) {
          wonPrizes.push('Second Full House');
          mainTicketId = ticketId;
        }
      }
    }
    
    // Check sheet prizes
    const callCount = calledNumbers.length;
    
    // Half Sheet
    if (activePrizes.halfSheet && 
        shouldCheckPrize('halfSheet', callCount, currentWinners) &&
        currentWinners.halfSheet.length === 0) {
      
      const halfSheetWinners = validateHalfSheet(allPlayerTickets, lookupMaps, tickets, calledNumbers);
      if (halfSheetWinners.length > 0) {
        wonPrizes.push('Half Sheet');
        mainTicketId = halfSheetWinners[0];
      }
    }
    
    // Full Sheet
    if (activePrizes.fullSheet && 
        shouldCheckPrize('fullSheet', callCount, currentWinners) &&
        currentWinners.fullSheet.length === 0) {
      
      const shouldCheckFullSheet = !activePrizes.halfSheet || currentWinners.halfSheet.length > 0;
      
      if (shouldCheckFullSheet) {
        const fullSheetWinners = validateFullSheet(allPlayerTickets, lookupMaps, tickets, calledNumbers);
        if (fullSheetWinners.length > 0) {
          wonPrizes.push('Full Sheet');
          mainTicketId = fullSheetWinners[0];
        }
      }
    }
    
    // If player won any prizes, add to results
    if (wonPrizes.length > 0) {
      results.push({
        isWinner: true,
        winningTickets: [mainTicketId],
        prizeType: wonPrizes[0].toLowerCase().replace(' ', '') as keyof Game.Winners,
        playerName: booking.playerName,
        phoneNumber: booking.phoneNumber,
        allPrizeTypes: wonPrizes
      });
    }
  }
  
  return results;
}

// Helper function to format multiple prizes
export function formatMultiplePrizes(prizeTypes: string[]): string {
  if (prizeTypes.length === 1) {
    return prizeTypes[0];
  } else if (prizeTypes.length === 2) {
    return `${prizeTypes[0]} + ${prizeTypes[1]}`;
  } else {
    return `${prizeTypes.slice(0, -1).join(' + ')} + ${prizeTypes[prizeTypes.length - 1]}`;
  }
}
