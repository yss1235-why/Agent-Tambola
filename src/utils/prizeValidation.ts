// src/utils/prizeValidation.ts - DEBUG VERSION to find the exact bug
// This version has extensive logging to track down where the logic fails

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

// FIXED: Proper type for prize keys that exist on both interfaces
type PrizeKey = keyof Game.Winners & keyof Game.Settings['prizes'];

// FIXED: Type guard to ensure key exists on both interfaces
function isPrizeKey(key: string): key is PrizeKey {
  const validKeys: PrizeKey[] = [
    'quickFive', 'topLine', 'middleLine', 'bottomLine', 'corners',
    'starCorners', 'halfSheet', 'fullSheet', 'fullHouse', 'secondFullHouse'
  ];
  return validKeys.includes(key as PrizeKey);
}

// 🔍 DEBUG: Prize name to key mapping function with logging
function prizeNameToKey(prizeName: string): PrizeKey | null {
  console.log(`🔍 DEBUG: Mapping prize name "${prizeName}"`);
  
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
  
  const result = nameToKeyMap[prizeName] || null;
  console.log(`🔍 DEBUG: Prize "${prizeName}" maps to "${result}"`);
  
  return result;
}

// FIXED: Safe array access with proper type guards
function safeArrayAccess<T>(arr: T[] | undefined | null): T[] {
  return Array.isArray(arr) ? arr : [];
}

// FIXED: Safe winners access with proper typing
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

// FIXED: Safe prize settings access with proper default
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

// FIXED: Safe ticket numbers access with proper typing
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

// FIXED: Type-safe helper function to check if a prize is enabled
function isPrizeEnabled(activePrizes: Game.Settings['prizes'], prizeKey: PrizeKey): boolean {
  return Boolean(activePrizes[prizeKey]);
}

// Performance-optimized lookup maps
class ValidationLookupMaps {
  private numberToTickets: Map<number, string[]> = new Map();
  private playerToTickets: Map<string, string[]> = new Map();

  constructor(tickets: Record<string, Game.Ticket>, bookings: Record<string, Game.Booking>) {
    this.buildLookupMaps(tickets, bookings);
  }

  private buildLookupMaps(tickets: Record<string, Game.Ticket>, bookings: Record<string, Game.Booking>): void {
    // Build number-to-tickets lookup
    Object.entries(tickets).forEach(([ticketId, ticket]) => {
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
}

// Timing validation rules
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
  console.log(`🔍 DEBUG: Quick Five validation - ticket has ${ticketNumbers.length} numbers, ${matchCount} matched, need 5`);
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
    topRow[0],
    topRow[topRow.length - 1],
    bottomRow[0],
    bottomRow[bottomRow.length - 1]
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

// 🔍 MAIN DEBUG VERSION: validateAllPrizes with extensive logging
export function validateAllPrizes(context: ValidationContext): PrizeValidationResult[] {
  try {
    console.log('🔍 DEBUG: ========== STARTING validateAllPrizes ==========');
    
    const tickets = context.tickets ?? {};
    const bookings = context.bookings ?? {};
    const calledNumbers = safeArrayAccess(context.calledNumbers);
    const currentWinners = safeWinnersAccess(context.currentWinners);
    const activePrizes = safePrizeSettingsAccess(context.activePrizes);
    
    console.log('🔍 DEBUG: Context data:', {
      ticketCount: Object.keys(tickets).length,
      bookingCount: Object.keys(bookings).length,
      calledNumbersCount: calledNumbers.length,
      activePrizes: Object.entries(activePrizes).filter(([_, enabled]) => enabled).map(([name]) => name)
    });
    
    const results: PrizeValidationResult[] = [];
    
    const lastCalledNumber = calledNumbers[calledNumbers.length - 1];
    if (!lastCalledNumber) {
      console.log('🔍 DEBUG: No numbers called yet, returning empty results');
      return results;
    }
    
    console.log('🔍 DEBUG: Last called number:', lastCalledNumber);
    
    const lookupMaps = new ValidationLookupMaps(tickets, bookings);
    const affectedTickets = lookupMaps.getTicketsWithNumber(lastCalledNumber);
    
    console.log('🔍 DEBUG: Tickets affected by number', lastCalledNumber, ':', affectedTickets);
    
    if (affectedTickets.length === 0) {
      console.log('🔍 DEBUG: No affected tickets, returning empty results');
      return results;
    }
    
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
    
    console.log('🔍 DEBUG: Player groups:', Array.from(playerGroups.keys()));
    
    // Validate prizes for each affected player
    for (const [playerKey, { tickets: playerAffectedTickets, booking }] of playerGroups) {
      console.log(`🔍 DEBUG: ======= Checking player: ${booking.playerName} =======`);
      
      const allPlayerTickets = lookupMaps.getPlayerTickets(booking.playerName, booking.phoneNumber);
      const wonPrizes: string[] = [];
      let mainTicketId = playerAffectedTickets[0];
      
      console.log(`🔍 DEBUG: Player ${booking.playerName} has ${playerAffectedTickets.length} affected tickets, ${allPlayerTickets.length} total tickets`);
      
      const callCount = calledNumbers.length;
      
      // Check individual ticket prizes for affected tickets only
      for (const ticketId of playerAffectedTickets) {
        console.log(`🔍 DEBUG: Checking ticket ${ticketId} for individual prizes`);
        
        const ticket = tickets[ticketId];
        if (!ticket) {
          console.log(`🔍 DEBUG: Ticket ${ticketId} not found, skipping`);
          continue;
        }
        
        // Check Quick Five specifically since that's what's failing
        const quickFiveKey = 'quickFive';
        const quickFiveName = 'Quick Five';
        
        console.log(`🔍 DEBUG: Checking ${quickFiveName} for ticket ${ticketId}`);
        console.log(`🔍 DEBUG: - Prize enabled:`, isPrizeEnabled(activePrizes, quickFiveKey));
        console.log(`🔍 DEBUG: - Should check timing:`, shouldCheckPrize(quickFiveKey, callCount, currentWinners));
        console.log(`🔍 DEBUG: - Not already won:`, !currentWinners[quickFiveKey].includes(ticketId));
        
        if (isPrizeEnabled(activePrizes, quickFiveKey) && 
            shouldCheckPrize(quickFiveKey, callCount, currentWinners) &&
            !currentWinners[quickFiveKey].includes(ticketId)) {
          
          console.log(`🔍 DEBUG: Running ${quickFiveName} validation for ticket ${ticketId}`);
          const isWinner = validateQuickFive(ticket, calledNumbers);
          console.log(`🔍 DEBUG: ${quickFiveName} validation result:`, isWinner);
          
          if (isWinner) {
            wonPrizes.push(quickFiveName);
            mainTicketId = ticketId;
            console.log(`🔍 DEBUG: ✅ ${quickFiveName} won by ${booking.playerName} with ticket ${ticketId}`);
          }
        } else {
          console.log(`🔍 DEBUG: Skipping ${quickFiveName} validation - conditions not met`);
        }
        
        // Check other prizes too with similar debugging
        const otherPrizeChecks: Array<{ key: PrizeKey; validator: (ticket: Game.Ticket, numbers: number[]) => boolean; name: string }> = [
          { key: 'topLine', validator: validateTopLine, name: 'Top Line' },
          { key: 'middleLine', validator: validateMiddleLine, name: 'Middle Line' },
          { key: 'bottomLine', validator: validateBottomLine, name: 'Bottom Line' },
          { key: 'corners', validator: validateCorners, name: 'Corners' },
          { key: 'starCorners', validator: validateStarCorners, name: 'Star Corners' },
          { key: 'fullHouse', validator: validateFullHouse, name: 'Full House' }
        ];
        
        otherPrizeChecks.forEach(({ key, validator, name }) => {
          if (isPrizeEnabled(activePrizes, key) && 
              shouldCheckPrize(key, callCount, currentWinners) &&
              !currentWinners[key].includes(ticketId) &&
              validator(ticket, calledNumbers)) {
            wonPrizes.push(name);
            mainTicketId = ticketId;
            console.log(`🔍 DEBUG: ✅ ${name} won by ${booking.playerName} with ticket ${ticketId}`);
          }
        });
      }
      
      console.log(`🔍 DEBUG: Player ${booking.playerName} won prizes:`, wonPrizes);
      
      // 🔍 CRITICAL DEBUG: Prize result creation
      if (wonPrizes.length > 0) {
        console.log(`🔍 DEBUG: ======= CREATING RESULT for ${booking.playerName} =======`);
        
        const firstPrizeName = wonPrizes[0];
        console.log(`🔍 DEBUG: First prize name: "${firstPrizeName}"`);
        
        const prizeKey = prizeNameToKey(firstPrizeName);
        console.log(`🔍 DEBUG: Mapped prize key: "${prizeKey}"`);
        console.log(`🔍 DEBUG: Prize key is truthy:`, !!prizeKey);
        
        if (prizeKey) {
          const result: PrizeValidationResult = {
            isWinner: true,
            winningTickets: [mainTicketId],
            prizeType: prizeKey,
            playerName: booking.playerName,
            phoneNumber: booking.phoneNumber,
            allPrizeTypes: wonPrizes
          };
          
          console.log(`🔍 DEBUG: Creating result object:`, result);
          results.push(result);
          console.log(`🔍 DEBUG: ✅ Result added! Results array length:`, results.length);
        } else {
          console.log(`🔍 DEBUG: ❌ Failed to map prize name "${firstPrizeName}" to valid key`);
        }
      } else {
        console.log(`🔍 DEBUG: No prizes won for ${booking.playerName}`);
      }
    }
    
    console.log('🔍 DEBUG: ========== FINAL RESULTS ==========');
    console.log(`🔍 DEBUG: Total results found:`, results.length);
    console.log(`🔍 DEBUG: Results array:`, results);
    console.log('🔍 DEBUG: ========== END validateAllPrizes ==========');
    
    return results;
    
  } catch (error) {
    console.error('🔍 DEBUG: ❌ Prize validation error:', error);
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
