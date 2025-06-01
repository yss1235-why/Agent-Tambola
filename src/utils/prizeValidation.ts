// src/utils/prizeValidation.ts - COMPLETELY FIXED: All TypeScript compilation errors
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
  allPrizeTypes: string[];
}

// Default prize settings to ensure all properties exist
const DEFAULT_PRIZE_SETTINGS: Game.Settings['prizes'] = {
  quickFive: false,
  topLine: false,
  middleLine: false,
  bottomLine: false,
  corners: false,
  starCorners: false,
  halfSheet: false,
  fullSheet: false,
  fullHouse: false,
  secondFullHouse: false
};

// FIXED: Safe array access helper
function safeArrayAccess<T>(arr: T[] | undefined | null): T[] {
  return Array.isArray(arr) ? arr : [];
}

// FIXED: Safe winners access helper
function safeWinnersAccess(winners: Game.Winners | undefined | null): Game.Winners {
  if (!winners || typeof winners !== 'object') {
    return {
      quickFive: [],
      topLine: [],
      middleLine: [],
      bottomLine: [],
      corners: [],
      starCorners: [],
      halfSheet: [],
      fullSheet: [],
      fullHouse: [],
      secondFullHouse: []
    };
  }
  
  // Ensure all arrays exist and are arrays
  return {
    quickFive: safeArrayAccess(winners.quickFive),
    topLine: safeArrayAccess(winners.topLine),
    middleLine: safeArrayAccess(winners.middleLine),
    bottomLine: safeArrayAccess(winners.bottomLine),
    corners: safeArrayAccess(winners.corners),
    starCorners: safeArrayAccess(winners.starCorners),
    halfSheet: safeArrayAccess(winners.halfSheet),
    fullSheet: safeArrayAccess(winners.fullSheet),
    fullHouse: safeArrayAccess(winners.fullHouse),
    secondFullHouse: safeArrayAccess(winners.secondFullHouse)
  };
}

// FIXED: Completely safe prize settings access with explicit boolean conversion
function safePrizeSettingsAccess(prizes: any): Game.Settings['prizes'] {
  if (!prizes || typeof prizes !== 'object') {
    return { ...DEFAULT_PRIZE_SETTINGS };
  }
  
  // FIXED: Explicitly type the return object and convert each property to boolean
  const result: Game.Settings['prizes'] = {
    quickFive: Boolean(prizes.quickFive),
    topLine: Boolean(prizes.topLine),
    middleLine: Boolean(prizes.middleLine),
    bottomLine: Boolean(prizes.bottomLine),
    corners: Boolean(prizes.corners),
    starCorners: Boolean(prizes.starCorners),
    halfSheet: Boolean(prizes.halfSheet),
    fullSheet: Boolean(prizes.fullSheet),
    fullHouse: Boolean(prizes.fullHouse),
    secondFullHouse: Boolean(prizes.secondFullHouse)
  };
  
  return result;
}

// FIXED: Safe ticket numbers access
function safeTicketNumbers(ticket: Game.Ticket): number[][] {
  if (!ticket || !ticket.numbers || !Array.isArray(ticket.numbers)) {
    console.warn('Invalid ticket structure, using empty grid');
    return [[], [], []];
  }
  
  // Ensure we have 3 rows
  const numbers = [...ticket.numbers];
  while (numbers.length < 3) {
    numbers.push([]);
  }
  
  // Ensure each row is an array
  return numbers.map(row => Array.isArray(row) ? row : []);
}

// FIXED: Helper function to safely check if a prize is enabled
function isPrizeEnabled(activePrizes: Game.Settings['prizes'], prizeType: keyof Game.Settings['prizes']): boolean {
  return Boolean(activePrizes[prizeType]);
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
      
      // Build number lookup - FIXED: Safe access to ticket numbers
      const ticketNumbers = safeTicketNumbers(ticket);
      ticketNumbers.flat().forEach(number => {
        if (number && number !== 0) {
          if (!this.numberToTickets.has(number)) {
            this.numberToTickets.set(number, []);
          }
          this.numberToTickets.get(number)!.push(ticketId);
        }
      });
    }

    // Build player-to-tickets lookup
    for (const [ticketId, booking] of Object.entries(bookings)) {
      if (booking && booking.playerName && booking.phoneNumber) {
        const playerKey = `${booking.playerName}-${booking.phoneNumber}`;
        if (!this.playerToTickets.has(playerKey)) {
          this.playerToTickets.set(playerKey, []);
        }
        this.playerToTickets.get(playerKey)!.push(ticketId);
      }
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
  const safeWinners = safeWinnersAccess(currentWinners);
  
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
      return callCount >= 5 && safeWinners.corners.length === 0;
    case 'halfSheet':
      return callCount >= 6;
    case 'fullSheet':
      return callCount >= 12;
    case 'fullHouse':
      return callCount >= 15;
    case 'secondFullHouse':
      return safeWinners.fullHouse.length > 0;
    default:
      return true;
  }
}

// FIXED: Fast individual prize validation functions with safe array access
export function validateQuickFive(ticket: Game.Ticket, calledNumbers: number[]): boolean {
  const safeCalledNumbers = safeArrayAccess(calledNumbers);
  const ticketNumbers = safeTicketNumbers(ticket).flat().filter(n => n !== 0);
  const matchCount = ticketNumbers.filter(n => safeCalledNumbers.includes(n)).length;
  return matchCount >= 5;
}

export function validateTopLine(ticket: Game.Ticket, calledNumbers: number[]): boolean {
  const safeCalledNumbers = safeArrayAccess(calledNumbers);
  const ticketNumbers = safeTicketNumbers(ticket);
  if (!ticketNumbers[0]) return false;
  const lineNumbers = ticketNumbers[0].filter(n => n !== 0);
  return lineNumbers.every(n => safeCalledNumbers.includes(n));
}

export function validateMiddleLine(ticket: Game.Ticket, calledNumbers: number[]): boolean {
  const safeCalledNumbers = safeArrayAccess(calledNumbers);
  const ticketNumbers = safeTicketNumbers(ticket);
  if (!ticketNumbers[1]) return false;
  const lineNumbers = ticketNumbers[1].filter(n => n !== 0);
  return lineNumbers.every(n => safeCalledNumbers.includes(n));
}

export function validateBottomLine(ticket: Game.Ticket, calledNumbers: number[]): boolean {
  const safeCalledNumbers = safeArrayAccess(calledNumbers);
  const ticketNumbers = safeTicketNumbers(ticket);
  if (!ticketNumbers[2]) return false;
  const lineNumbers = ticketNumbers[2].filter(n => n !== 0);
  return lineNumbers.every(n => safeCalledNumbers.includes(n));
}

export function validateCorners(ticket: Game.Ticket, calledNumbers: number[]): boolean {
  const safeCalledNumbers = safeArrayAccess(calledNumbers);
  const ticketNumbers = safeTicketNumbers(ticket);
  
  const topRow = ticketNumbers[0] ? ticketNumbers[0].filter(n => n !== 0) : [];
  const bottomRow = ticketNumbers[2] ? ticketNumbers[2].filter(n => n !== 0) : [];
  
  if (topRow.length < 2 || bottomRow.length < 2) return false;
  
  const corners = [
    topRow[0], // Top left
    topRow[topRow.length - 1], // Top right
    bottomRow[0], // Bottom left
    bottomRow[bottomRow.length - 1] // Bottom right
  ];
  
  return corners.every(n => n && safeCalledNumbers.includes(n));
}

export function validateStarCorners(ticket: Game.Ticket, calledNumbers: number[]): boolean {
  const safeCalledNumbers = safeArrayAccess(calledNumbers);
  
  if (!validateCorners(ticket, calledNumbers)) return false;
  
  const ticketNumbers = safeTicketNumbers(ticket);
  const middleRow = ticketNumbers[1] ? ticketNumbers[1].filter(n => n !== 0) : [];
  if (middleRow.length === 0) return false;
  
  const centerIndex = Math.floor(middleRow.length / 2);
  const centerNumber = middleRow[centerIndex];
  
  return centerNumber && safeCalledNumbers.includes(centerNumber);
}

export function validateFullHouse(ticket: Game.Ticket, calledNumbers: number[]): boolean {
  const safeCalledNumbers = safeArrayAccess(calledNumbers);
  const allNumbers = safeTicketNumbers(ticket).flat().filter(n => n !== 0);
  return allNumbers.every(n => safeCalledNumbers.includes(n));
}

// Sheet validation functions - FIXED with safe array access
function validateHalfSheet(
  playerTickets: string[], 
  lookupMaps: ValidationLookupMaps, 
  tickets: Record<string, Game.Ticket>, 
  calledNumbers: number[]
): string[] {
  const safeCalledNumbers = safeArrayAccess(calledNumbers);
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
        
        const ticketNumbers = safeTicketNumbers(ticket).flat().filter(n => n !== 0);
        const matchCount = ticketNumbers.filter(n => safeCalledNumbers.includes(n)).length;
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
  const safeCalledNumbers = safeArrayAccess(calledNumbers);
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
        
        const ticketNumbers = safeTicketNumbers(ticket).flat().filter(n => n !== 0);
        const matchCount = ticketNumbers.filter(n => safeCalledNumbers.includes(n)).length;
        return matchCount >= 2;
      });
      
      if (validTickets.length === 6) {
        return validTickets.map(num => num.toString());
      }
    }
  }
  
  return [];
}

// COMPLETELY FIXED: Main validation function with all type safety issues resolved
export function validateAllPrizes(context: ValidationContext): PrizeValidationResult[] {
  try {
    // FIXED: Safe access to all context properties with proper defaults
    const tickets = context.tickets || {};
    const bookings = context.bookings || {};
    const calledNumbers = safeArrayAccess(context.calledNumbers);
    const currentWinners = safeWinnersAccess(context.currentWinners);
    const activePrizes = safePrizeSettingsAccess(context.activePrizes);
    
    console.log('🔍 Prize validation started:', {
      ticketCount: Object.keys(tickets).length,
      bookingCount: Object.keys(bookings).length,
      calledNumbersCount: calledNumbers.length,
      lastNumber: calledNumbers[calledNumbers.length - 1]
    });
    
    const results: PrizeValidationResult[] = [];
    
    // Get the most recently called number for optimization
    const lastCalledNumber = calledNumbers[calledNumbers.length - 1];
    if (!lastCalledNumber) {
      console.log('❌ No numbers called yet, skipping validation');
      return results;
    }
    
    // Build lookup maps
    const lookupMaps = new ValidationLookupMaps(tickets, bookings);
    
    // Only check tickets that contain the last called number
    const affectedTickets = lookupMaps.getTicketsWithNumber(lastCalledNumber);
    
    if (affectedTickets.length === 0) {
      console.log(`❌ No tickets contain number ${lastCalledNumber}, skipping validation`);
      return results;
    }
    
    console.log(`🎯 Checking ${affectedTickets.length} tickets affected by number ${lastCalledNumber}`);
    
    // Group affected tickets by player
    const playerGroups = new Map<string, { tickets: string[], booking: Game.Booking }>();
    
    for (const ticketId of affectedTickets) {
      const booking = bookings[ticketId];
      if (!booking || !booking.playerName || !booking.phoneNumber) continue;
      
      const playerKey = `${booking.playerName}-${booking.phoneNumber}`;
      if (!playerGroups.has(playerKey)) {
        playerGroups.set(playerKey, { tickets: [], booking });
      }
      playerGroups.get(playerKey)!.tickets.push(ticketId);
    }
    
    console.log(`👥 Checking ${playerGroups.size} players for prizes`);
    
    // Validate prizes for each affected player
    for (const [playerKey, { tickets: playerAffectedTickets, booking }] of playerGroups) {
      const allPlayerTickets = lookupMaps.getPlayerTickets(booking.playerName, booking.phoneNumber);
      const wonPrizes: string[] = [];
      let mainTicketId = playerAffectedTickets[0];
      
      console.log(`🎯 Checking player ${booking.playerName} with ${playerAffectedTickets.length} affected tickets`);
      
      // Check individual ticket prizes for affected tickets only
      for (const ticketId of playerAffectedTickets) {
        const ticket = tickets[ticketId];
        if (!ticket) continue;
        
        const callCount = calledNumbers.length;
        
        // COMPLETELY FIXED: All prize checks using safe helper function
        // Quick Five
        if (isPrizeEnabled(activePrizes, 'quickFive') && 
            shouldCheckPrize('quickFive', callCount, currentWinners) &&
            !currentWinners.quickFive.includes(ticketId) &&
            validateQuickFive(ticket, calledNumbers)) {
          wonPrizes.push('Quick Five');
          mainTicketId = ticketId;
          console.log(`🏆 Quick Five won by ${booking.playerName} with ticket ${ticketId}`);
        }
        
        // Top Line
        if (isPrizeEnabled(activePrizes, 'topLine') && 
            shouldCheckPrize('topLine', callCount, currentWinners) &&
            !currentWinners.topLine.includes(ticketId) &&
            validateTopLine(ticket, calledNumbers)) {
          wonPrizes.push('Top Line');
          mainTicketId = ticketId;
          console.log(`🏆 Top Line won by ${booking.playerName} with ticket ${ticketId}`);
        }
        
        // Middle Line
        if (isPrizeEnabled(activePrizes, 'middleLine') && 
            shouldCheckPrize('middleLine', callCount, currentWinners) &&
            !currentWinners.middleLine.includes(ticketId) &&
            validateMiddleLine(ticket, calledNumbers)) {
          wonPrizes.push('Middle Line');
          mainTicketId = ticketId;
          console.log(`🏆 Middle Line won by ${booking.playerName} with ticket ${ticketId}`);
        }
        
        // Bottom Line
        if (isPrizeEnabled(activePrizes, 'bottomLine') && 
            shouldCheckPrize('bottomLine', callCount, currentWinners) &&
            !currentWinners.bottomLine.includes(ticketId) &&
            validateBottomLine(ticket, calledNumbers)) {
          wonPrizes.push('Bottom Line');
          mainTicketId = ticketId;
          console.log(`🏆 Bottom Line won by ${booking.playerName} with ticket ${ticketId}`);
        }
        
        // Corners
        if (isPrizeEnabled(activePrizes, 'corners') && 
            shouldCheckPrize('corners', callCount, currentWinners) &&
            !currentWinners.corners.includes(ticketId) &&
            validateCorners(ticket, calledNumbers)) {
          wonPrizes.push('Corners');
          mainTicketId = ticketId;
          console.log(`🏆 Corners won by ${booking.playerName} with ticket ${ticketId}`);
        }
        
        // Star Corners
        if (isPrizeEnabled(activePrizes, 'starCorners') && 
            shouldCheckPrize('starCorners', callCount, currentWinners) &&
            !currentWinners.starCorners.includes(ticketId) &&
            validateStarCorners(ticket, calledNumbers)) {
          wonPrizes.push('Star Corners');
          mainTicketId = ticketId;
          console.log(`🏆 Star Corners won by ${booking.playerName} with ticket ${ticketId}`);
        }
        
        // Full House
        if (isPrizeEnabled(activePrizes, 'fullHouse') && 
            shouldCheckPrize('fullHouse', callCount, currentWinners) &&
            !currentWinners.fullHouse.includes(ticketId) &&
            validateFullHouse(ticket, calledNumbers)) {
          wonPrizes.push('Full House');
          mainTicketId = ticketId;
          console.log(`🏆 Full House won by ${booking.playerName} with ticket ${ticketId}`);
        }
        
        // Second Full House
        if (isPrizeEnabled(activePrizes, 'secondFullHouse') && 
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
            console.log(`🏆 Second Full House won by ${booking.playerName} with ticket ${ticketId}`);
          }
        }
      }
      
      // Check sheet prizes
      const callCount = calledNumbers.length;
      
      // Half Sheet
      if (isPrizeEnabled(activePrizes, 'halfSheet') && 
          shouldCheckPrize('halfSheet', callCount, currentWinners) &&
          currentWinners.halfSheet.length === 0) {
        
        const halfSheetWinners = validateHalfSheet(allPlayerTickets, lookupMaps, tickets, calledNumbers);
        if (halfSheetWinners.length > 0) {
          wonPrizes.push('Half Sheet');
          mainTicketId = halfSheetWinners[0];
          console.log(`🏆 Half Sheet won by ${booking.playerName} with tickets ${halfSheetWinners.join(', ')}`);
        }
      }
      
      // Full Sheet
      if (isPrizeEnabled(activePrizes, 'fullSheet') && 
          shouldCheckPrize('fullSheet', callCount, currentWinners) &&
          currentWinners.fullSheet.length === 0) {
        
        // Check if we should validate full sheet (either halfSheet is disabled or already won)
        const shouldCheckFullSheet = !isPrizeEnabled(activePrizes, 'halfSheet') || 
                                    currentWinners.halfSheet.length > 0;
        
        if (shouldCheckFullSheet) {
          const fullSheetWinners = validateFullSheet(allPlayerTickets, lookupMaps, tickets, calledNumbers);
          if (fullSheetWinners.length > 0) {
            wonPrizes.push('Full Sheet');
            mainTicketId = fullSheetWinners[0];
            console.log(`🏆 Full Sheet won by ${booking.playerName} with tickets ${fullSheetWinners.join(', ')}`);
          }
        }
      }
      
      // If player won any prizes, add to results
      if (wonPrizes.length > 0) {
        results.push({
          isWinner: true,
          winningTickets: [mainTicketId],
          prizeType: wonPrizes[0].toLowerCase().replace(/\s+/g, '') as keyof Game.Winners,
          playerName: booking.playerName,
          phoneNumber: booking.phoneNumber,
          allPrizeTypes: wonPrizes
        });
        
        console.log(`✅ Prize validation complete for ${booking.playerName}: ${wonPrizes.join(', ')}`);
      }
    }
    
    console.log(`🎉 Prize validation completed. Found ${results.length} winners.`);
    return results;
    
  } catch (error) {
    console.error('❌ Prize validation error:', error);
    // Return empty array instead of throwing to prevent breaking the game
    return [];
  }
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
