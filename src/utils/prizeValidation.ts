// src/utils/prizeValidation.ts - FINAL FIXED VERSION
// Production-ready code with proper prize winning logic and fixed mapping

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

// Proper type for prize keys that exist on both interfaces
type PrizeKey = keyof Game.Winners & keyof Game.Settings['prizes'];

// Type guard to ensure key exists on both interfaces
function isPrizeKey(key: string): key is PrizeKey {
  const validKeys: PrizeKey[] = [
    'quickFive', 'topLine', 'middleLine', 'bottomLine', 'corners',
    'starCorners', 'halfSheet', 'fullSheet', 'fullHouse', 'secondFullHouse'
  ];
  return validKeys.includes(key as PrizeKey);
}

// 🔥 FIXED: Prize name to key mapping function - SOLVES THE MAIN BUG
function prizeNameToKey(prizeName: string): PrizeKey | null {
  const nameToKeyMap: Record<string, PrizeKey> = {
    'Quick Five': 'quickFive',
    'Top Line': 'topLine', 
    'Middle Line': 'middleLine',
    'Bottom Line': 'bottomLine',
    'Corners': 'corners',
    'Star Corners': 'starCorners',
    'Half Sheet': 'halfSheet',
    'Full Sheet': 'fullSheet',
    'Full House': 'fullHouse',
    'Second Full House': 'secondFullHouse'
  };
  
  return nameToKeyMap[prizeName] || null;
}

// Key to display name mapping function
function keyToPrizeName(key: PrizeKey): string {
  const keyToNameMap: Record<PrizeKey, string> = {
    'quickFive': 'Quick Five',
    'topLine': 'Top Line',
    'middleLine': 'Middle Line', 
    'bottomLine': 'Bottom Line',
    'corners': 'Corners',
    'starCorners': 'Star Corners',
    'halfSheet': 'Half Sheet',
    'fullSheet': 'Full Sheet',
    'fullHouse': 'Full House',
    'secondFullHouse': 'Second Full House'
  };
  
  return keyToNameMap[key] || key;
}

// Safe array access with proper type guards
function safeArrayAccess<T>(arr: T[] | undefined | null): T[] {
  return Array.isArray(arr) ? arr : [];
}

// Safe winners access with proper typing
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
  
  const safeWinners: Game.Winners = {} as Game.Winners;
  const prizeKeys: PrizeKey[] = [
    'quickFive', 'topLine', 'middleLine', 'bottomLine', 'corners',
    'starCorners', 'halfSheet', 'fullSheet', 'fullHouse', 'secondFullHouse'
  ];
  
  prizeKeys.forEach(key => {
    safeWinners[key] = safeArrayAccess(winners[key]);
  });
  
  return safeWinners;
}

// Safe prize settings access with proper default
function safePrizeSettingsAccess(prizes: Game.Settings['prizes'] | undefined | null): Game.Settings['prizes'] {
  const defaultPrizes: Game.Settings['prizes'] = {
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
  
  if (!prizes || typeof prizes !== 'object') {
    return defaultPrizes;
  }
  
  const safePrizes: Game.Settings['prizes'] = {} as Game.Settings['prizes'];
  const prizeKeys: PrizeKey[] = [
    'quickFive', 'topLine', 'middleLine', 'bottomLine', 'corners',
    'starCorners', 'halfSheet', 'fullSheet', 'fullHouse', 'secondFullHouse'
  ];
  
  prizeKeys.forEach(key => {
    safePrizes[key] = Boolean(prizes[key]);
  });
  
  return safePrizes;
}

// Safe ticket numbers access with proper typing
function safeTicketNumbers(ticket: Game.Ticket | undefined | null): number[][] {
  if (!ticket || !ticket.numbers || !Array.isArray(ticket.numbers)) {
    console.warn('Invalid ticket structure, using empty grid');
    return [[], [], []];
  }
  
  const numbers = [...ticket.numbers];
  while (numbers.length < 3) {
    numbers.push([]);
  }
  
  return numbers.slice(0, 3).map(row => Array.isArray(row) ? row : []);
}

// Type-safe helper function to check if a prize is enabled
function isPrizeEnabled(activePrizes: Game.Settings['prizes'], prizeKey: PrizeKey): boolean {
  return Boolean(activePrizes[prizeKey]);
}

// Performance-optimized lookup maps
class ValidationLookupMaps {
  private numberToTickets: Map<number, string[]> = new Map();
  private ticketToSheet: Map<string, number> = new Map();
  private sheetToTickets: Map<number, string[]> = new Map();
  private playerToTickets: Map<string, string[]> = new Map();

  constructor(tickets: Record<string, Game.Ticket>, bookings: Record<string, Game.Booking>) {
    this.buildLookupMaps(tickets, bookings);
  }

  private buildLookupMaps(tickets: Record<string, Game.Ticket>, bookings: Record<string, Game.Booking>): void {
    // Build number-to-tickets lookup
    Object.entries(tickets).forEach(([ticketId, ticket]) => {
      const ticketNum = parseInt(ticketId, 10);
      const sheetNumber = Math.ceil(ticketNum / 6);
      
      this.ticketToSheet.set(ticketId, sheetNumber);
      
      // Group tickets by sheet
      if (!this.sheetToTickets.has(sheetNumber)) {
        this.sheetToTickets.set(sheetNumber, []);
      }
      this.sheetToTickets.get(sheetNumber)!.push(ticketId);
      
      const ticketNumbers = safeTicketNumbers(ticket);
      ticketNumbers.flat().forEach(number => {
        if (number && number !== 0) {
          if (!this.numberToTickets.has(number)) {
            this.numberToTickets.set(number, []);
          }
          this.numberToTickets.get(number)!.push(ticketId);
        }
      });
    });

    // Build player-to-tickets lookup
    Object.entries(bookings).forEach(([ticketId, booking]) => {
      if (booking && booking.playerName && booking.phoneNumber) {
        const playerKey = `${booking.playerName}-${booking.phoneNumber}`;
        if (!this.playerToTickets.has(playerKey)) {
          this.playerToTickets.set(playerKey, []);
        }
        this.playerToTickets.get(playerKey)!.push(ticketId);
      }
    });
  }

  getTicketsWithNumber(number: number): string[] {
    return this.numberToTickets.get(number) ?? [];
  }

  getPlayerTickets(playerName: string, phoneNumber: string): string[] {
    const playerKey = `${playerName}-${phoneNumber}`;
    return this.playerToTickets.get(playerKey) ?? [];
  }

  getSheetTickets(sheetNumber: number): string[] {
    return this.sheetToTickets.get(sheetNumber) ?? [];
  }

  getTicketSheet(ticketId: string): number {
    return this.ticketToSheet.get(ticketId) ?? 0;
  }
}

// Timing-based validation rules
function shouldCheckPrize(prizeKey: PrizeKey, callCount: number, currentWinners: Game.Winners): boolean {
  const safeWinners = safeWinnersAccess(currentWinners);
  
  switch (prizeKey) {
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

// Individual prize validation functions
export function validateQuickFive(ticket: Game.Ticket, calledNumbers: number[]): boolean {
  const safeCalledNumbers = safeArrayAccess(calledNumbers);
  const ticketNumbers = safeTicketNumbers(ticket).flat().filter(n => n !== 0);
  const matchCount = ticketNumbers.filter(n => safeCalledNumbers.includes(n)).length;
  return matchCount >= 5;
}

export function validateTopLine(ticket: Game.Ticket, calledNumbers: number[]): boolean {
  const safeCalledNumbers = safeArrayAccess(calledNumbers);
  const ticketNumbers = safeTicketNumbers(ticket);
  const topRow = ticketNumbers[0];
  if (!Array.isArray(topRow)) return false;
  const lineNumbers = topRow.filter(n => n !== 0);
  return lineNumbers.length > 0 && lineNumbers.every(n => safeCalledNumbers.includes(n));
}

export function validateMiddleLine(ticket: Game.Ticket, calledNumbers: number[]): boolean {
  const safeCalledNumbers = safeArrayAccess(calledNumbers);
  const ticketNumbers = safeTicketNumbers(ticket);
  const middleRow = ticketNumbers[1];
  if (!Array.isArray(middleRow)) return false;
  const lineNumbers = middleRow.filter(n => n !== 0);
  return lineNumbers.length > 0 && lineNumbers.every(n => safeCalledNumbers.includes(n));
}

export function validateBottomLine(ticket: Game.Ticket, calledNumbers: number[]): boolean {
  const safeCalledNumbers = safeArrayAccess(calledNumbers);
  const ticketNumbers = safeTicketNumbers(ticket);
  const bottomRow = ticketNumbers[2];
  if (!Array.isArray(bottomRow)) return false;
  const lineNumbers = bottomRow.filter(n => n !== 0);
  return lineNumbers.length > 0 && lineNumbers.every(n => safeCalledNumbers.includes(n));
}

export function validateCorners(ticket: Game.Ticket, calledNumbers: number[]): boolean {
  const safeCalledNumbers = safeArrayAccess(calledNumbers);
  const ticketNumbers = safeTicketNumbers(ticket);
  
  const topRow = ticketNumbers[0]?.filter(n => n !== 0) ?? [];
  const bottomRow = ticketNumbers[2]?.filter(n => n !== 0) ?? [];
  
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
  const middleRow = ticketNumbers[1]?.filter(n => n !== 0) ?? [];
  if (middleRow.length === 0) return false;
  
  const centerIndex = Math.floor(middleRow.length / 2);
  const centerNumber = middleRow[centerIndex];
  
  return centerNumber !== undefined && safeCalledNumbers.includes(centerNumber);
}

export function validateFullHouse(ticket: Game.Ticket, calledNumbers: number[]): boolean {
  const safeCalledNumbers = safeArrayAccess(calledNumbers);
  const allNumbers = safeTicketNumbers(ticket).flat().filter(n => n !== 0);
  return allNumbers.length > 0 && allNumbers.every(n => safeCalledNumbers.includes(n));
}

// Sheet validation functions
function validateHalfSheet(
  playerTickets: string[], 
  lookupMaps: ValidationLookupMaps, 
  tickets: Record<string, Game.Ticket>, 
  calledNumbers: number[]
): string[] {
  const safeCalledNumbers = safeArrayAccess(calledNumbers);
  const sheetGroups = new Map<number, string[]>();
  
  // Group tickets by sheet
  playerTickets.forEach(ticketId => {
    const sheetNumber = lookupMaps.getTicketSheet(ticketId);
    if (!sheetGroups.has(sheetNumber)) {
      sheetGroups.set(sheetNumber, []);
    }
    sheetGroups.get(sheetNumber)!.push(ticketId);
  });
  
  // Check each sheet for half-sheet wins
  for (const [sheetNumber, sheetTickets] of sheetGroups) {
    if (sheetTickets.length < 3) continue;
    
    const ticketNumbers = sheetTickets.map(id => parseInt(id, 10)).sort((a, b) => a - b);
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
  
  // Group tickets by sheet
  playerTickets.forEach(ticketId => {
    const sheetNumber = lookupMaps.getTicketSheet(ticketId);
    if (!sheetGroups.has(sheetNumber)) {
      sheetGroups.set(sheetNumber, []);
    }
    sheetGroups.get(sheetNumber)!.push(ticketId);
  });
  
  // Check each sheet for full-sheet wins
  for (const [sheetNumber, sheetTickets] of sheetGroups) {
    if (sheetTickets.length < 6) continue;
    
    const ticketNumbers = sheetTickets.map(id => parseInt(id, 10)).sort((a, b) => a - b);
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

// 🔥 MAIN FIXED FUNCTION: Complete TypeScript compliance with FIXED prize name mapping
export function validateAllPrizes(context: ValidationContext): PrizeValidationResult[] {
  try {
    const tickets = context.tickets ?? {};
    const bookings = context.bookings ?? {};
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
    
    const lastCalledNumber = calledNumbers[calledNumbers.length - 1];
    if (!lastCalledNumber) {
      console.log('❌ No numbers called yet, skipping validation');
      return results;
    }
    
    const lookupMaps = new ValidationLookupMaps(tickets, bookings);
    const affectedTickets = lookupMaps.getTicketsWithNumber(lastCalledNumber);
    
    if (affectedTickets.length === 0) {
      console.log(`❌ No tickets contain number ${lastCalledNumber}, skipping validation`);
      return results;
    }
    
    console.log(`🎯 Checking ${affectedTickets.length} tickets affected by number ${lastCalledNumber}`);
    
    // Group affected tickets by player
    const playerGroups = new Map<string, { tickets: string[], booking: Game.Booking }>();
    
    affectedTickets.forEach(ticketId => {
      const booking = bookings[ticketId];
      if (!booking?.playerName || !booking?.phoneNumber) return;
      
      const playerKey = `${booking.playerName}-${booking.phoneNumber}`;
      if (!playerGroups.has(playerKey)) {
        playerGroups.set(playerKey, { tickets: [], booking });
      }
      playerGroups.get(playerKey)!.tickets.push(ticketId);
    });
    
    console.log(`👥 Checking ${playerGroups.size} players for prizes`);
    
    // Validate prizes for each affected player
    for (const [playerKey, { tickets: playerAffectedTickets, booking }] of playerGroups) {
      const allPlayerTickets = lookupMaps.getPlayerTickets(booking.playerName, booking.phoneNumber);
      const wonPrizes: string[] = [];
      let mainTicketId = playerAffectedTickets[0];
      
      console.log(`🎯 Checking player ${booking.playerName} with ${playerAffectedTickets.length} affected tickets`);
      
      const callCount = calledNumbers.length;
      
      // Check individual ticket prizes for affected tickets only
      for (const ticketId of playerAffectedTickets) {
        const ticket = tickets[ticketId];
        if (!ticket) continue;
        
        // Prize checks with proper display names
        const prizeChecks: Array<{ key: PrizeKey; validator: (ticket: Game.Ticket, numbers: number[]) => boolean; name: string }> = [
          { key: 'quickFive', validator: validateQuickFive, name: 'Quick Five' },
          { key: 'topLine', validator: validateTopLine, name: 'Top Line' },
          { key: 'middleLine', validator: validateMiddleLine, name: 'Middle Line' },
          { key: 'bottomLine', validator: validateBottomLine, name: 'Bottom Line' },
          { key: 'corners', validator: validateCorners, name: 'Corners' },
          { key: 'starCorners', validator: validateStarCorners, name: 'Star Corners' },
          { key: 'fullHouse', validator: validateFullHouse, name: 'Full House' }
        ];
        
        prizeChecks.forEach(({ key, validator, name }) => {
          if (isPrizeEnabled(activePrizes, key) && 
              shouldCheckPrize(key, callCount, currentWinners) &&
              !currentWinners[key].includes(ticketId) &&
              validator(ticket, calledNumbers)) {
            wonPrizes.push(name);
            mainTicketId = ticketId;
            console.log(`🏆 ${name} won by ${booking.playerName} with ticket ${ticketId}`);
          }
        });
        
        // Special case for second full house
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
      
      if (isPrizeEnabled(activePrizes, 'fullSheet') && 
          shouldCheckPrize('fullSheet', callCount, currentWinners) &&
          currentWinners.fullSheet.length === 0) {
        
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
      
      // 🔥 CRITICAL FIX: Create results with proper key mapping
      if (wonPrizes.length > 0) {
        const firstPrizeName = wonPrizes[0];
        const prizeKey = prizeNameToKey(firstPrizeName);
        
        if (prizeKey) {
          const result: PrizeValidationResult = {
            isWinner: true,
            winningTickets: [mainTicketId],
            prizeType: prizeKey,
            playerName: booking.playerName,
            phoneNumber: booking.phoneNumber,
            allPrizeTypes: wonPrizes
          };
          
          results.push(result);
          console.log(`✅ Prize validation complete for ${booking.playerName}: ${wonPrizes.join(', ')}`);
        } else {
          console.error(`❌ Failed to map prize name "${firstPrizeName}" to valid key`);
        }
      }
    }
    
    console.log(`🎉 Prize validation completed. Found ${results.length} winners.`);
    return results;
    
  } catch (error) {
    console.error('❌ Prize validation error:', error);
    return [];
  }
}

// Helper function to format multiple prizes
export function formatMultiplePrizes(prizeTypes: string[]): string {
  if (prizeTypes.length === 0) return '';
  if (prizeTypes.length === 1) return prizeTypes[0];
  if (prizeTypes.length === 2) return `${prizeTypes[0]} + ${prizeTypes[1]}`;
  return `${prizeTypes.slice(0, -1).join(' + ')} + ${prizeTypes[prizeTypes.length - 1]}`;
}
