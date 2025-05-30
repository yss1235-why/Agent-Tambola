// src/utils/prizeValidation.ts
import type { Game } from '../types/game';

export interface PrizeValidationResult {
  isWinner: boolean;
  winningTickets: string[];
  prizeType: keyof Game.Winners;
}

export interface ValidationContext {
  tickets: Record<string, Game.Ticket>;
  bookings: Record<string, Game.Booking>;
  calledNumbers: number[];
  currentWinners: Game.Winners;
  activePrizes: Game.Settings['prizes'];
}

/**
 * Validates Quick Five prize - first 5 numbers on any ticket
 */
export function validateQuickFive(
  ticket: Game.Ticket,
  calledNumbers: number[]
): boolean {
  const ticketNumbers = ticket.numbers.flat().filter(n => n !== 0);
  const matchedCount = ticketNumbers.filter(n => calledNumbers.includes(n)).length;
  return matchedCount >= 5;
}

/**
 * Validates Top Line prize - all numbers in first row
 */
export function validateTopLine(
  ticket: Game.Ticket,
  calledNumbers: number[]
): boolean {
  const topRowNumbers = ticket.numbers[0].filter(n => n !== 0);
  return topRowNumbers.every(n => calledNumbers.includes(n));
}

/**
 * Validates Middle Line prize - all numbers in second row
 */
export function validateMiddleLine(
  ticket: Game.Ticket,
  calledNumbers: number[]
): boolean {
  const middleRowNumbers = ticket.numbers[1].filter(n => n !== 0);
  return middleRowNumbers.every(n => calledNumbers.includes(n));
}

/**
 * Validates Bottom Line prize - all numbers in third row
 */
export function validateBottomLine(
  ticket: Game.Ticket,
  calledNumbers: number[]
): boolean {
  const bottomRowNumbers = ticket.numbers[2].filter(n => n !== 0);
  return bottomRowNumbers.every(n => calledNumbers.includes(n));
}

/**
 * Validates Corners prize - four corner numbers
 */
export function validateCorners(
  ticket: Game.Ticket,
  calledNumbers: number[]
): boolean {
  const topRow = ticket.numbers[0].filter(n => n !== 0);
  const bottomRow = ticket.numbers[2].filter(n => n !== 0);
  
  if (topRow.length < 2 || bottomRow.length < 2) {
    return false;
  }
  
  const corners = [
    topRow[0], // Top left
    topRow[topRow.length - 1], // Top right
    bottomRow[0], // Bottom left
    bottomRow[bottomRow.length - 1] // Bottom right
  ];
  
  return corners.every(n => calledNumbers.includes(n));
}

/**
 * Validates Star Corners prize - four corners plus center
 */
export function validateStarCorners(
  ticket: Game.Ticket,
  calledNumbers: number[]
): boolean {
  const topRow = ticket.numbers[0].filter(n => n !== 0);
  const middleRow = ticket.numbers[1].filter(n => n !== 0);
  const bottomRow = ticket.numbers[2].filter(n => n !== 0);
  
  if (topRow.length < 2 || bottomRow.length < 2 || middleRow.length === 0) {
    return false;
  }
  
  const centerIndex = Math.floor(middleRow.length / 2);
  const starCorners = [
    topRow[0], // Top left
    topRow[topRow.length - 1], // Top right
    middleRow[centerIndex], // Center
    bottomRow[0], // Bottom left
    bottomRow[bottomRow.length - 1] // Bottom right
  ];
  
  return starCorners.every(n => calledNumbers.includes(n));
}

/**
 * Validates Full House prize - all numbers on ticket
 */
export function validateFullHouse(
  ticket: Game.Ticket,
  calledNumbers: number[]
): boolean {
  const allNumbers = ticket.numbers.flat().filter(n => n !== 0);
  return allNumbers.every(n => calledNumbers.includes(n));
}

/**
 * Validates Second Full House prize - same as Full House but excludes first winner
 */
export function validateSecondFullHouse(
  ticket: Game.Ticket,
  calledNumbers: number[],
  firstFullHouseWinners: string[],
  ticketId: string
): boolean {
  // Cannot win second full house if already won first full house
  if (firstFullHouseWinners.includes(ticketId)) {
    return false;
  }
  
  return validateFullHouse(ticket, calledNumbers);
}

/**
 * Calculates sheet number and position for a ticket
 */
function getSheetInfo(ticketNumber: number): { sheetNumber: number; position: number } {
  const sheetNumber = Math.ceil(ticketNumber / 6);
  const position = ((ticketNumber - 1) % 6) + 1;
  return { sheetNumber, position };
}

/**
 * Validates that a ticket has minimum required called numbers
 */
function hasMinimumCalledNumbers(
  ticket: Game.Ticket,
  calledNumbers: number[],
  minimum: number = 2
): boolean {
  const ticketNumbers = ticket.numbers.flat().filter(n => n !== 0);
  const calledCount = ticketNumbers.filter(n => calledNumbers.includes(n)).length;
  return calledCount >= minimum;
}

/**
 * Validates Half Sheet prize - 3 consecutive tickets from same sheet, same player
 */
export function validateHalfSheet(
  context: ValidationContext
): PrizeValidationResult {
  const { tickets, bookings, calledNumbers } = context;
  
  // Group tickets by sheet and player
  const sheetGroups = new Map<string, { ticketIds: string[]; playerName: string }>();
  
  Object.entries(bookings).forEach(([ticketId, booking]) => {
    const ticketNumber = parseInt(ticketId);
    const { sheetNumber } = getSheetInfo(ticketNumber);
    const key = `${sheetNumber}-${booking.playerName}`;
    
    if (!sheetGroups.has(key)) {
      sheetGroups.set(key, { ticketIds: [], playerName: booking.playerName });
    }
    sheetGroups.get(key)!.ticketIds.push(ticketId);
  });
  
  // Check each sheet group for valid half sheet
  for (const [key, group] of sheetGroups) {
    const { ticketIds, playerName } = group;
    const sheetNumber = parseInt(key.split('-')[0]);
    
    // Convert ticket IDs to numbers and sort
    const ticketNumbers = ticketIds
      .map(id => parseInt(id))
      .sort((a, b) => a - b);
    
    // Check for valid half sheet combinations (1,2,3 or 4,5,6 within sheet)
    const sheetStart = (sheetNumber - 1) * 6 + 1;
    const firstHalf = [sheetStart, sheetStart + 1, sheetStart + 2];
    const secondHalf = [sheetStart + 3, sheetStart + 4, sheetStart + 5];
    
    const hasFirstHalf = firstHalf.every(num => ticketNumbers.includes(num));
    const hasSecondHalf = secondHalf.every(num => ticketNumbers.includes(num));
    
    if (hasFirstHalf || hasSecondHalf) {
      const winningTickets = hasFirstHalf ? firstHalf : secondHalf;
      
      // Verify minimum numbers called on each ticket
      const validTickets = winningTickets.filter(ticketNum => {
        const ticketId = ticketNum.toString();
        const ticket = tickets[ticketId];
        return ticket && hasMinimumCalledNumbers(ticket, calledNumbers, 2);
      });
      
      if (validTickets.length === 3) {
        return {
          isWinner: true,
          winningTickets: validTickets.map(num => num.toString()),
          prizeType: 'halfSheet'
        };
      }
    }
  }
  
  return {
    isWinner: false,
    winningTickets: [],
    prizeType: 'halfSheet'
  };
}

/**
 * Validates Full Sheet prize - all 6 tickets from same sheet, same player
 */
export function validateFullSheet(
  context: ValidationContext
): PrizeValidationResult {
  const { tickets, bookings, calledNumbers } = context;
  
  // Group tickets by sheet and player
  const sheetGroups = new Map<string, { ticketIds: string[]; playerName: string }>();
  
  Object.entries(bookings).forEach(([ticketId, booking]) => {
    const ticketNumber = parseInt(ticketId);
    const { sheetNumber } = getSheetInfo(ticketNumber);
    const key = `${sheetNumber}-${booking.playerName}`;
    
    if (!sheetGroups.has(key)) {
      sheetGroups.set(key, { ticketIds: [], playerName: booking.playerName });
    }
    sheetGroups.get(key)!.ticketIds.push(ticketId);
  });
  
  // Check each sheet group for complete sheet
  for (const [key, group] of sheetGroups) {
    const { ticketIds } = group;
    const sheetNumber = parseInt(key.split('-')[0]);
    
    // Check if all 6 tickets from this sheet are present
    if (ticketIds.length === 6) {
      const ticketNumbers = ticketIds.map(id => parseInt(id)).sort((a, b) => a - b);
      const sheetStart = (sheetNumber - 1) * 6 + 1;
      const expectedTickets = Array.from({ length: 6 }, (_, i) => sheetStart + i);
      
      // Verify this is a complete valid sheet
      const isCompleteSheet = expectedTickets.every(num => ticketNumbers.includes(num));
      
      if (isCompleteSheet) {
        // Verify minimum numbers called on each ticket
        const validTickets = expectedTickets.filter(ticketNum => {
          const ticketId = ticketNum.toString();
          const ticket = tickets[ticketId];
          return ticket && hasMinimumCalledNumbers(ticket, calledNumbers, 2);
        });
        
        if (validTickets.length === 6) {
          return {
            isWinner: true,
            winningTickets: validTickets.map(num => num.toString()),
            prizeType: 'fullSheet'
          };
        }
      }
    }
  }
  
  return {
    isWinner: false,
    winningTickets: [],
    prizeType: 'fullSheet'
  };
}

/**
 * Main validation function that checks all active prize types
 */
export function validateAllPrizes(context: ValidationContext): PrizeValidationResult[] {
  const { tickets, bookings, calledNumbers, currentWinners, activePrizes } = context;
  const results: PrizeValidationResult[] = [];
  
  // Define validation functions for single-ticket prizes
  const singleTicketValidators: Record<string, (ticket: Game.Ticket, calledNumbers: number[]) => boolean> = {
    quickFive: validateQuickFive,
    topLine: validateTopLine,
    middleLine: validateMiddleLine,
    bottomLine: validateBottomLine,
    corners: validateCorners,
    starCorners: validateStarCorners,
    fullHouse: validateFullHouse
  };
  
  // Check single-ticket prizes
  Object.entries(singleTicketValidators).forEach(([prizeType, validator]) => {
    const prizeKey = prizeType as keyof Game.Winners;
    
    // Skip if prize not active or already won (except secondFullHouse)
    if (!activePrizes[prizeKey] || (currentWinners[prizeKey]?.length > 0 && prizeType !== 'secondFullHouse')) {
      return;
    }
    
    // Check each booked ticket
    Object.entries(bookings).forEach(([ticketId, booking]) => {
      const ticket = tickets[ticketId];
      if (!ticket) return;
      
      let isWinner = false;
      
      if (prizeType === 'secondFullHouse') {
        isWinner = validateSecondFullHouse(
          ticket,
          calledNumbers,
          currentWinners.fullHouse || [],
          ticketId
        );
      } else {
        isWinner = validator(ticket, calledNumbers);
      }
      
      if (isWinner) {
        results.push({
          isWinner: true,
          winningTickets: [ticketId],
          prizeType: prizeKey
        });
      }
    });
  });
  
  // Check Half Sheet prize
  if (activePrizes.halfSheet && (!currentWinners.halfSheet || currentWinners.halfSheet.length === 0)) {
    const halfSheetResult = validateHalfSheet(context);
    if (halfSheetResult.isWinner) {
      results.push(halfSheetResult);
    }
  }
  
  // Check Full Sheet prize
  if (activePrizes.fullSheet && (!currentWinners.fullSheet || currentWinners.fullSheet.length === 0)) {
    const fullSheetResult = validateFullSheet(context);
    if (fullSheetResult.isWinner) {
      results.push(fullSheetResult);
    }
  }
  
  return results;
}
