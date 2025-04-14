// src/services/PrizeValidationService.ts

import { ref, get, set, update, remove, onValue } from 'firebase/database';
import { database } from '../lib/firebase';
import { Game } from '../types/game';
import { AudioManager } from '../utils/audioManager';
import { NotificationManager } from './NotificationManager';

interface ValidationResult {
  isValid: boolean;
  winners: string[];
  error?: string;
}

export class PrizeValidationService {
  private static instance: PrizeValidationService;
  private hostId: string | null = null;
  private audioManager: AudioManager;
  private notificationManager: NotificationManager;
  private isAnnouncingPrize: boolean = false;
  
  // Track announced prizes to prevent duplicates
  private announcedPrizes: Set<string> = new Set();
  // Cache of validated tickets to prevent re-validation
  private validatedTickets: Map<string, Set<string>> = new Map();
  // Timestamp of last validation to throttle calls
  private lastValidationTime: number = 0;

  private constructor() {
    this.audioManager = AudioManager.getInstance();
    this.notificationManager = NotificationManager.getInstance();
  }

  public static getInstance(): PrizeValidationService {
    if (!PrizeValidationService.instance) {
      PrizeValidationService.instance = new PrizeValidationService();
    }
    return PrizeValidationService.instance;
  }

  public initialize(hostId: string): void {
    this.hostId = hostId;
    this.announcedPrizes.clear();
    this.validatedTickets.clear();
    this.lastValidationTime = 0;
    
    // Subscribe to winners changes to keep local cache in sync
    if (hostId) {
      this.subscribeToWinners(hostId);
    }
  }
  
  // Subscribe to winners to keep local state in sync
  private subscribeToWinners(hostId: string): void {
    const winnersRef = ref(database, `hosts/${hostId}/currentGame/gameState/winners`);
    onValue(winnersRef, (snapshot) => {
      if (!snapshot.exists()) return;
      
      // Sync local state with database state
      const winners = snapshot.val() as Game.Winners;
      for (const [prizeType, ticketIds] of Object.entries(winners)) {
        if (Array.isArray(ticketIds) && ticketIds.length > 0) {
          // Mark these tickets as validated for this prize
          if (!this.validatedTickets.has(prizeType)) {
            this.validatedTickets.set(prizeType, new Set());
          }
          ticketIds.forEach(id => {
            this.validatedTickets.get(prizeType)?.add(id);
          });
          
          // Create a unique key for this prize win
          const prizeKey = `${prizeType}:${ticketIds.join(',')}`;
          this.announcedPrizes.add(prizeKey);
        }
      }
    });
  }

  public async validateAllPrizes(
    tickets: Record<string, Game.Ticket>,
    calledNumbers: number[],
    currentWinners: Game.Winners,
    activePrizes: Game.Settings['prizes'],
    bookings: Record<string, Game.Booking> = {}
  ): Promise<Record<keyof Game.Winners, ValidationResult>> {
    // Throttle validations to prevent rapid-fire checks (min 500ms between)
    const now = Date.now();
    if (now - this.lastValidationTime < 500) {
      return {} as Record<keyof Game.Winners, ValidationResult>;
    }
    this.lastValidationTime = now;
    
    // Get the latest winners state from database to ensure accuracy
    const latestWinners = await this.getLatestWinners();
    if (latestWinners) {
      currentWinners = latestWinners;
    }

    const results: Record<string, ValidationResult> = {};
    const prizeTypes: Array<keyof Game.Winners> = [
      'quickFive', 'topLine', 'middleLine', 'bottomLine', 'corners',
      'starCorners', 'halfSheet', 'fullSheet', 'fullHouse', 'secondFullHouse',
    ];

    // Initialize results for all prize types
    prizeTypes.forEach((prizeType) => {
      results[prizeType] = { isValid: false, winners: [] };
    });

    console.log(`Validating prizes with ${calledNumbers.length} called numbers`);
    console.log(`Available tickets: ${Object.keys(tickets).length}, Bookings: ${Object.keys(bookings).length}`);
    
    const newWinners: Partial<Game.Winners> = {};
    let hasNewWinners = false;
    
    for (const prizeType of prizeTypes) {
      try {
        // Skip prizes that are not active in the game settings
        if (!activePrizes[prizeType]) {
          console.log(`Prize ${prizeType} is not active, skipping`);
          continue;
        }
        
        // Skip prizes that have already been won
        if (currentWinners?.[prizeType]?.length > 0) {
          console.log(`Prize ${prizeType} already has winners, skipping`);
          continue;
        }
        
        // For secondFullHouse, only check if fullHouse has been won
        if (prizeType === 'secondFullHouse' && (!currentWinners?.fullHouse || currentWinners.fullHouse.length === 0)) {
          console.log('Second Full House requires Full House to be won first, skipping');
          continue;
        }

        console.log(`Validating prize type: ${prizeType}`);
        
        if (prizeType === 'fullSheet') {
          // Full sheet validation logic with improved error handling
          console.log("************************");
          console.log("FULL SHEET VALIDATION START");
          console.log("************************");
          
          try {
            // First, collect all sheet data and log it
            const sheetTicketsMap = new Map<number, Game.Ticket[]>();
            
            // Group tickets by sheet number
            Object.values(tickets).forEach(ticket => {
              if (!ticket.sheetNumber) {
                console.log(`Warning: Ticket ${ticket.id} has no sheetNumber property`);
                return;
              }
              
              const sheetNum = ticket.sheetNumber;
              if (!sheetTicketsMap.has(sheetNum)) {
                sheetTicketsMap.set(sheetNum, []);
              }
              sheetTicketsMap.get(sheetNum)?.push(ticket);
            });
            
            // Log all available sheet groups
            console.log(`Found ${sheetTicketsMap.size} sheet groups`);
            sheetTicketsMap.forEach((ticketsInSheet, sheetNum) => {
              console.log(`Sheet ${sheetNum}: Contains ${ticketsInSheet.length} tickets`);
              console.log(`- Ticket IDs: ${ticketsInSheet.map(t => t.id).join(', ')}`);
            });
            
            // Process each sheet
            let foundValidSheet = false;
            
            for (const [sheetNum, ticketsInSheet] of sheetTicketsMap) {
              // Skip if not exactly 6 tickets
              if (ticketsInSheet.length !== 6) {
                console.log(`Sheet ${sheetNum}: INVALID - Has ${ticketsInSheet.length} tickets, not 6`);
                continue;
              }
              
              console.log(`Sheet ${sheetNum}: Validating - Has exactly 6 tickets`);
              
              // Get ticket IDs
              const ticketIds = ticketsInSheet.map(t => t.id);
              
              // Check if all tickets are booked
              const bookedTickets = ticketIds.filter(id => bookings[id]);
              if (bookedTickets.length !== 6) {
                console.log(`Sheet ${sheetNum}: INVALID - Only ${bookedTickets.length}/6 tickets are booked`);
                console.log(`- Booked tickets: ${bookedTickets.join(', ')}`);
                continue;
              }
              
              console.log(`Sheet ${sheetNum}: All 6 tickets are booked`);
              
              // Check if booked by the same player
              const bookingPlayers = new Set<string>();
              let hasInvalidBooking = false;
              
              for (const ticketId of ticketIds) {
                const booking = bookings[ticketId];
                if (!booking || !booking.playerName) {
                  hasInvalidBooking = true;
                  console.log(`Sheet ${sheetNum}: INVALID - Ticket ${ticketId} has no valid booking`);
                  break;
                }
                bookingPlayers.add(booking.playerName);
              }
              
              if (hasInvalidBooking) continue;
              
              if (bookingPlayers.size !== 1) {
                console.log(`Sheet ${sheetNum}: INVALID - Tickets booked by ${bookingPlayers.size} different players`);
                console.log(`- Players: ${Array.from(bookingPlayers).join(', ')}`);
                continue;
              }
              
              const playerName = bookings[ticketIds[0]].playerName;
              console.log(`Sheet ${sheetNum}: All tickets booked by same player: "${playerName}"`);
              
              // Check AT LEAST one number called per ticket
              console.log(`Sheet ${sheetNum}: Checking called numbers per ticket...`);
              let allTicketsHaveAtLeastOneNumber = true;
              const ticketResults: {id: string, calledCount: number, calledNumbers: number[]}[] = [];
              
              for (const ticket of ticketsInSheet) {
                // Get all non-zero numbers on this ticket
                const allTicketNumbers = ticket.numbers.flat().filter(n => n !== 0);
                // Find which ones have been called
                const ticketCalledNumbers = allTicketNumbers.filter(n => calledNumbers.includes(n));
                
                ticketResults.push({
                  id: ticket.id,
                  calledCount: ticketCalledNumbers.length,
                  calledNumbers: ticketCalledNumbers
                });
                
                if (ticketCalledNumbers.length < 1) {
                  allTicketsHaveAtLeastOneNumber = false;
                }
              }
              
              // Log detailed results for each ticket
              ticketResults.forEach(result => {
                console.log(`- Ticket ${result.id}: ${result.calledCount} number(s) called [${result.calledNumbers.join(', ')}]`);
              });
              
              console.log(`Sheet ${sheetNum}: At least one number per ticket: ${allTicketsHaveAtLeastOneNumber}`);
              
              // If valid, mark as a winner
              if (allTicketsHaveAtLeastOneNumber) {
                console.log(`*** FULL SHEET WIN FOUND! - Sheet ${sheetNum} - Player: ${playerName} ***`);
                results[prizeType].winners = ticketIds;
                results[prizeType].isValid = true;
                newWinners[prizeType] = [...(currentWinners[prizeType] || []), ...ticketIds];
                hasNewWinners = true;
                foundValidSheet = true;
                break;
              } else {
                console.log(`Sheet ${sheetNum}: INVALID - Does not have exactly one number called per ticket`);
              }
            }
            
            if (!foundValidSheet) {
              console.log("No valid full sheets found");
            }
          } catch (error) {
            console.error("Error in full sheet validation:", error);
            results[prizeType] = { isValid: false, winners: [], error: 'Full sheet validation error' };
          }
          
          console.log("************************");
          console.log("FULL SHEET VALIDATION END");
          console.log("************************");
          
        } else if (prizeType === 'halfSheet') {
          // Half sheet validation logic with improved error handling
          console.log("************************");
          console.log("HALF SHEET VALIDATION START");
          console.log("************************");
          
          try {
            // We need to group tickets by sheetNumber and position (3 tickets per half sheet)
            const halfSheetGroups = new Map<string, Game.Ticket[]>();
            
            // Group tickets by half sheet
            Object.values(tickets).forEach(ticket => {
              if (!ticket.sheetNumber) return;
              
              const sheetNum = ticket.sheetNumber;
              const position = ticket.position;
              // First half: positions 1-3, Second half: positions 4-6
              const halfIndex = position <= 3 ? 0 : 1;
              const groupKey = `${sheetNum}_${halfIndex}`;
              
              if (!halfSheetGroups.has(groupKey)) {
                halfSheetGroups.set(groupKey, []);
              }
              halfSheetGroups.get(groupKey)?.push(ticket);
            });
            
            // Log all available half sheet groups
            console.log(`Found ${halfSheetGroups.size} half sheet groups`);
            halfSheetGroups.forEach((ticketsInGroup, groupKey) => {
              console.log(`Half Sheet ${groupKey}: Contains ${ticketsInGroup.length} tickets`);
              console.log(`- Ticket IDs: ${ticketsInGroup.map(t => t.id).join(', ')}`);
            });
            
            // Process each half sheet
            let foundValidHalfSheet = false;
            
            for (const [groupKey, ticketsInGroup] of halfSheetGroups) {
              // Skip if not exactly 3 tickets
              if (ticketsInGroup.length !== 3) {
                console.log(`Half Sheet ${groupKey}: INVALID - Has ${ticketsInGroup.length} tickets, not 3`);
                continue;
              }
              
              console.log(`Half Sheet ${groupKey}: Validating - Has exactly 3 tickets`);
              
              // Get ticket IDs
              const ticketIds = ticketsInGroup.map(t => t.id);
              
              // Check if all tickets are booked
              const bookedTickets = ticketIds.filter(id => bookings[id]);
              if (bookedTickets.length !== 3) {
                console.log(`Half Sheet ${groupKey}: INVALID - Only ${bookedTickets.length}/3 tickets are booked`);
                continue;
              }
              
              console.log(`Half Sheet ${groupKey}: All 3 tickets are booked`);
              
              // Check if booked by the same player
              const bookingPlayers = new Set<string>();
              let hasInvalidBooking = false;
              
              for (const ticketId of ticketIds) {
                const booking = bookings[ticketId];
                if (!booking || !booking.playerName) {
                  hasInvalidBooking = true;
                  break;
                }
                bookingPlayers.add(booking.playerName);
              }
              
              if (hasInvalidBooking) continue;
              
              if (bookingPlayers.size !== 1) {
                console.log(`Half Sheet ${groupKey}: INVALID - Tickets booked by ${bookingPlayers.size} different players`);
                continue;
              }
              
              const playerName = bookings[ticketIds[0]].playerName;
              console.log(`Half Sheet ${groupKey}: All tickets booked by same player: "${playerName}"`);
              
              // Check AT LEAST two numbers called per ticket
              console.log(`Half Sheet ${groupKey}: Checking called numbers per ticket...`);
              let allTicketsHaveAtLeastTwoNumbers = true;
              const ticketResults: {id: string, calledCount: number, calledNumbers: number[]}[] = [];
              
              for (const ticket of ticketsInGroup) {
                // Get all non-zero numbers on this ticket
                const allTicketNumbers = ticket.numbers.flat().filter(n => n !== 0);
                // Find which ones have been called
                const ticketCalledNumbers = allTicketNumbers.filter(n => calledNumbers.includes(n));
                
                ticketResults.push({
                  id: ticket.id,
                  calledCount: ticketCalledNumbers.length,
                  calledNumbers: ticketCalledNumbers
                });
                
                if (ticketCalledNumbers.length < 2) {
                  allTicketsHaveAtLeastTwoNumbers = false;
                }
              }
              
              // Log detailed results for each ticket
              ticketResults.forEach(result => {
                console.log(`- Ticket ${result.id}: ${result.calledCount} number(s) called [${result.calledNumbers.join(', ')}]`);
              });
              
              console.log(`Half Sheet ${groupKey}: At least two numbers per ticket: ${allTicketsHaveAtLeastTwoNumbers}`);
              
              // If valid, mark as a winner
              if (allTicketsHaveAtLeastTwoNumbers) {
                console.log(`*** HALF SHEET WIN FOUND! - Group ${groupKey} - Player: ${playerName} ***`);
                results[prizeType].winners = ticketIds;
                results[prizeType].isValid = true;
                newWinners[prizeType] = [...(currentWinners[prizeType] || []), ...ticketIds];
                hasNewWinners = true;
                foundValidHalfSheet = true;
                break;
              } else {
                console.log(`Half Sheet ${groupKey}: INVALID - Does not have exactly two numbers called per ticket`);
              }
            }
            
            if (!foundValidHalfSheet) {
              console.log("No valid half sheets found");
            }
          } catch (error) {
            console.error("Error in half sheet validation:", error);
            results[prizeType] = { isValid: false, winners: [], error: 'Half sheet validation error' };
          }
          
          console.log("************************");
          console.log("HALF SHEET VALIDATION END");
          console.log("************************");
          
        } else if (prizeType === 'secondFullHouse') {
          // Special handling for secondFullHouse
          console.log(`Processing secondFullHouse prize`);
          
          // Get the tickets that have won the first full house
          const firstFullHouseTickets = currentWinners.fullHouse || [];
          console.log(`First Full House tickets to exclude: ${firstFullHouseTickets.join(', ')}`);
          
          for (const [ticketId, ticket] of Object.entries(tickets)) {
            // Skip tickets that aren't booked
            if (!bookings[ticketId]) continue;
            
            // Skip tickets that have already won the first full house
            if (firstFullHouseTickets.includes(ticketId)) {
              console.log(`Ticket ${ticketId} already won Full House, skipping for Second Full House`);
              continue;
            }
            
            if (this.validateFullHouse(ticket, calledNumbers)) {
              console.log(`Ticket ${ticketId} won Second Full House!`);
              results[prizeType].winners.push(ticketId);
              results[prizeType].isValid = true;
              
              // Create or append to winners array for this prize type
              if (!newWinners[prizeType]) {
                newWinners[prizeType] = [];
              }
              newWinners[prizeType] = [...(newWinners[prizeType] || []), ticketId];
              hasNewWinners = true;
              
              // Only allow one ticket to win second full house
              break;
            }
          }
        } else {
          // Validate other prize types (standard validation)
          for (const [ticketId, ticket] of Object.entries(tickets)) {
            // Skip tickets that aren't booked
            if (!bookings[ticketId]) continue;
            
            // Skip tickets that we've already validated for this prize type
            const validatedSet = this.validatedTickets.get(prizeType);
            if (validatedSet && validatedSet.has(ticketId)) {
              continue;
            }
            
            if (this.validateTicketNumbers(ticket, calledNumbers, prizeType)) {
              console.log(`Ticket ${ticketId} won ${prizeType}!`);
              results[prizeType].winners.push(ticketId);
              results[prizeType].isValid = true;
              
              // Create or append to winners array for this prize type
              if (!newWinners[prizeType]) {
                newWinners[prizeType] = [];
              }
              newWinners[prizeType] = [...(newWinners[prizeType] || []), ticketId];
              hasNewWinners = true;
              break; // Only allow one winner per prize type (except for special cases)
            }
          }
        }
      } catch (error) {
        console.error(`Error validating ${prizeType}:`, error);
        results[prizeType] = { isValid: false, winners: [], error: 'Validation error' };
      }
    }

    // Update database and announce prizes if we have new winners
    if (hasNewWinners && this.hostId) {
      try {
        // Double-check we don't have duplicate winners before updating database
        // Get latest winners state again
        const latestWinners = await this.getLatestWinners() || currentWinners;
        let updatedNewWinners: Partial<Game.Winners> = {};
        let stillHasNewWinners = false;
        
        // Filter out any winners that have been added in the meantime
        for (const [prizeType, ticketIds] of Object.entries(newWinners)) {
          const existingWinners = latestWinners[prizeType as keyof Game.Winners] || [];
          const trulyNewWinners = (ticketIds as string[]).filter(id => !existingWinners.includes(id));
          
          if (trulyNewWinners.length > 0) {
            updatedNewWinners[prizeType as keyof Game.Winners] = [
              ...existingWinners,
              ...trulyNewWinners
            ];
            stillHasNewWinners = true;
          }
        }
        
        if (stillHasNewWinners) {
          // Update database first to prevent race conditions
          console.log("Updating winners in database:", updatedNewWinners);
          await update(ref(database, `hosts/${this.hostId}/currentGame/gameState/winners`), updatedNewWinners);
          
          // Now handle prize announcements - don't wait for them to complete
          this.handlePrizeAnnouncements(updatedNewWinners, bookings);
          
          // Check if all active prizes have been won - don't await
          this.checkAllPrizesWon(activePrizes, { ...latestWinners, ...updatedNewWinners } as Game.Winners);
        } else {
          console.log("No new winners after re-validation - skipping database update");
        }
      } catch (error) {
        console.error('Error updating winners in database:', error);
      }
    }

    // Log validation results
    const wonPrizes = Object.entries(results)
      .filter(([_, result]) => result.isValid)
      .map(([prizeType, result]) => `${prizeType} (${result.winners.length} winners)`);
    
    if (wonPrizes.length > 0) {
      console.log("Prizes won:", wonPrizes.join(", "));
    } else {
      console.log("No prizes won in this validation round");
    }

    return results as Record<keyof Game.Winners, ValidationResult>;
  }

  // Get the latest winners from the database
  private async getLatestWinners(): Promise<Game.Winners | null> {
    if (!this.hostId) return null;
    
    try {
      const winnersRef = ref(database, `hosts/${this.hostId}/currentGame/gameState/winners`);
      const snapshot = await get(winnersRef);
      
      if (snapshot.exists()) {
        return snapshot.val() as Game.Winners;
      }
      return null;
    } catch (error) {
      console.error('Error fetching latest winners:', error);
      return null;
    }
  }

  // Modified to use the announcedPrizes set to prevent duplicates
  private handlePrizeAnnouncements(
    newWinners: Partial<Game.Winners>,
    bookings: Record<string, Game.Booking>
  ): void {
    this.isAnnouncingPrize = true;
    
    // Start a background process for announcements
    (async () => {
      try {
        // Process each prize type in sequence
        for (const [prizeType, ticketIds] of Object.entries(newWinners)) {
          if (!Array.isArray(ticketIds) || ticketIds.length === 0) continue;
          
          // Create a unique key for this prize win
          const prizeKey = `${prizeType}:${ticketIds.join(',')}`;
          
          // Skip if we've already announced this exact prize
          if (this.announcedPrizes.has(prizeKey)) {
            console.log(`Prize ${prizeType} with tickets ${ticketIds.join(',')} already announced, skipping`);
            continue;
          }
          
          // Add to announced set first to prevent concurrent announcements
          this.announcedPrizes.add(prizeKey);
          
          // Announce the prize
          console.log(`Announcing prize win for ${prizeType}`);
          await this.announcePrizeWin(prizeType as keyof Game.Winners, ticketIds as string[], bookings);
          
          // Add a smaller delay between announcements if there are multiple
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error('Error announcing prizes:', error);
      } finally {
        this.isAnnouncingPrize = false;
      }
    })().catch(error => {
      console.error('Error in prize announcement process:', error);
      this.isAnnouncingPrize = false;
    });
  }

  private validateTicketNumbers(
    ticket: Game.Ticket,
    calledNumbers: number[],
    prizeType: keyof Game.Winners
  ): boolean {
    if (!ticket?.numbers) return false;

    switch (prizeType) {
      case 'quickFive':
        return this.validateQuickFive(ticket, calledNumbers);
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
        return this.validateFullHouse(ticket, calledNumbers);
      case 'fullSheet':
      case 'halfSheet':
        // These are handled separately
        return false;
      default:
        console.error(`Unknown prize type: ${prizeType}`);
        return false;
    }
  }

  private validateQuickFive(ticket: Game.Ticket, calledNumbers: number[]): boolean {
    if (!ticket?.numbers) return false;
    const flatNumbers = ticket.numbers.flat().filter((num) => num !== 0);
    let markedCount = 0;

    console.log(`Validating Quick Five for ticket ${ticket.id}`);
    console.log(`Total non-zero numbers: ${flatNumbers.length}`);

    for (const number of flatNumbers) {
      if (calledNumbers.includes(number)) {
        markedCount++;
        if (markedCount >= 5) {
          console.log(`Quick Five validated! Found 5 marked numbers in ticket ${ticket.id}`);
          return true;
        }
      }
    }
    
    console.log(`Quick Five not validated. Only found ${markedCount} marked numbers in ticket ${ticket.id}`);
    return false;
  }

  private validateLine(ticket: Game.Ticket, calledNumbers: number[], rowIndex: number): boolean {
    if (!ticket?.numbers?.[rowIndex]) return false;
    const numbersInRow = ticket.numbers[rowIndex].filter((num) => num !== 0);
    
    const lineTypes = ['top', 'middle', 'bottom'];
    console.log(`Validating ${lineTypes[rowIndex]} line for ticket ${ticket.id}`);
    console.log(`Numbers in row: ${numbersInRow.join(', ')}`);
    
    const allMarked = numbersInRow.every((num) => {
      const isCalled = calledNumbers.includes(num);
      return isCalled;
    });
    
    console.log(`${lineTypes[rowIndex]} line validation result: ${allMarked}`);
    return allMarked;
  }

  private validateCorners(ticket: Game.Ticket, calledNumbers: number[]): boolean {
    if (!ticket?.numbers) return false;
    
    console.log(`Validating corners for ticket ${ticket.id}`);
    
    // Get first and last non-zero numbers from top row
    const topRow = ticket.numbers[0].filter(num => num !== 0);
    if (topRow.length < 2) {
      console.log(`Not enough non-zero numbers in top row for ticket ${ticket.id}`);
      return false;
    }
    const topLeft = topRow[0];
    const topRight = topRow[topRow.length - 1];
    
    // Get first and last non-zero numbers from bottom row
    const bottomRow = ticket.numbers[2].filter(num => num !== 0);
    if (bottomRow.length < 2) {
      console.log(`Not enough non-zero numbers in bottom row for ticket ${ticket.id}`);
      return false;
    }
    const bottomLeft = bottomRow[0];
    const bottomRight = bottomRow[bottomRow.length - 1];
    
    // Check if all corner numbers have been called
    const cornerNumbers = [topLeft, topRight, bottomLeft, bottomRight];
    const allCalled = cornerNumbers.every(num => calledNumbers.includes(num));
    
    console.log(`Corners validation result: ${allCalled}`);
    return allCalled;
  }

  private validateStarCorners(ticket: Game.Ticket, calledNumbers: number[]): boolean {
    if (!ticket?.numbers) return false;
    
    console.log(`Validating star corners for ticket ${ticket.id}`);
    
    // First, validate the four corners
    // Get first and last non-zero numbers from top row
    const topRow = ticket.numbers[0].filter(num => num !== 0);
    if (topRow.length < 2) {
      console.log(`Not enough non-zero numbers in top row for ticket ${ticket.id}`);
      return false;
    }
    const topLeft = topRow[0];
    const topRight = topRow[topRow.length - 1];
    
    // Get first and last non-zero numbers from bottom row
    const bottomRow = ticket.numbers[2].filter(num => num !== 0);
    if (bottomRow.length < 2) {
      console.log(`Not enough non-zero numbers in bottom row for ticket ${ticket.id}`);
      return false;
    }
    const bottomLeft = bottomRow[0];
    const bottomRight = bottomRow[bottomRow.length - 1];
    
    // Now, find the middle number from the middle row
    const middleRow = ticket.numbers[1].filter(num => num !== 0);
    if (middleRow.length === 0) {
      console.log(`No non-zero numbers in middle row for ticket ${ticket.id}`);
      return false;
    }
    
    // Get the middle element from the filtered non-zero numbers
    const middleIndex = Math.floor(middleRow.length / 2);
    const middleNumber = middleRow[middleIndex];
    
    // Check if all star corner numbers have been called
    const starCornerNumbers = [topLeft, topRight, middleNumber, bottomLeft, bottomRight];
    const allCalled = starCornerNumbers.every(num => calledNumbers.includes(num));
    
    console.log(`Star corners validation result: ${allCalled}`);
    return allCalled;
  }

  private validateFullHouse(ticket: Game.Ticket, calledNumbers: number[]): boolean {
    if (!ticket?.numbers) return false;
    const flatNumbers = ticket.numbers.flat().filter((num) => num !== 0);
    
    console.log(`Validating Full House for ticket ${ticket.id}`);
    console.log(`Total non-zero numbers: ${flatNumbers.length}`);
    
    const allMarked = flatNumbers.every(num => {
      const isCalled = calledNumbers.includes(num);
      if (!isCalled) {
        console.log(`Number ${num} has not been called for full house`);
      }
      return isCalled;
    });
    
    console.log(`Full House validation result: ${allMarked}`);
    return allMarked;
  }

  // Improved to check against latest database state and end game when all prizes won
  private async checkAllPrizesWon(
    activePrizes: Game.Settings['prizes'], 
    winners: Game.Winners
  ): Promise<void> {
    if (!this.hostId) return;
    
    // Get the latest state to be absolutely sure
    const latestWinners = await this.getLatestWinners() || winners;
    
    // Check if all active prizes have been won
    const allPrizesWon = Object.entries(activePrizes)
      .filter(([_, isActive]) => isActive) // Only check active prizes
      .every(([prizeType]) => {
        const hasWinners = latestWinners[prizeType as keyof Game.Winners]?.length > 0;
        return hasWinners;
      });
    
    if (allPrizesWon) {
      console.log('All active prizes have been won! Disabling number generation and ending game.');
      
      try {
        // Check current state first to avoid race conditions
        const gameStateRef = ref(database, `hosts/${this.hostId}/currentGame/gameState/allPrizesWon`);
        const snapshot = await get(gameStateRef);
        
        if (snapshot.exists() && snapshot.val() === true) {
          console.log('Game is already marked as all prizes won, no update needed');
          return;
        }
        
        // Update game state with all prizes won flag AND CHANGE GAME STATUS TO ENDED
        await update(ref(database, `hosts/${this.hostId}/currentGame/gameState`), {
          allPrizesWon: true,
          isAutoCalling: false,
          status: 'ended',  // This will effectively end the game
          phase: 4  // Set to completed phase
        });
        
        // Clear any existing queue
        await update(ref(database, `hosts/${this.hostId}/currentGame/numberSystem`), {
          queue: []
        });
        
        // Create session record with completed status
        const gameRef = ref(database, `hosts/${this.hostId}/currentGame`);
        const gameSnapshot = await get(gameRef);
        
        if (gameSnapshot.exists()) {
          const game = gameSnapshot.val();
          const timestamp = Date.now();
          
          // Save to game history
          await set(ref(database, `hosts/${this.hostId}/sessions/${timestamp}`), {
            ...game,
            endTime: timestamp,
            endReason: 'All prizes won'
          });
        }
        
        console.log('Successfully updated game state and created history record for all prizes won');
        
        // Send a notification about game ending
        this.notificationManager.showNotification({
          title: 'Game Completed',
          message: 'All prizes have been won! The game has ended automatically.',
          type: 'system',
          priority: 'high',
          playSound: true,
          requireInteraction: true
        });
        
      } catch (error) {
        console.error('Error updating game state after all prizes won:', error);
      }
    }
  }

  private async announcePrizeWin(
    prizeType: keyof Game.Winners,
    ticketIds: string[],
    bookings: Record<string, Game.Booking>
  ): Promise<void> {
    try {
      console.log(`ANNOUNCING PRIZE WIN: ${prizeType} for tickets ${ticketIds.join(', ')}`);
      
      // Play win sound without waiting
      this.audioManager.playEffect(`${prizeType}Win`);
      
      // Show notification immediately
      if (ticketIds.length > 0) {
        const ticketId = ticketIds[0]; // Get first ticket for the notification
        const booking = bookings[ticketId];
        
        if (booking) {
          const prettyPrizeType = prizeType.replace(/([A-Z])/g, ' $1').trim();
          const message = `${booking.playerName} won ${prettyPrizeType} with ticket #${ticketId}!`;
          
          this.notificationManager.showNotification({
            title: `${prettyPrizeType} Won!`,
            message,
            type: 'prize',
            priority: 'high',
            playSound: true,
            requireInteraction: true
          });
          
          console.log(`Prize announcement: ${message}`);
          
          // Reduced delay for better responsiveness
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    } catch (error) {
      console.error('Error announcing prize win:', error);
    }
  }

  public cleanup(): void {
    this.hostId = null;
    this.announcedPrizes.clear();
    this.validatedTickets.clear();
    this.lastValidationTime = 0;
    this.isAnnouncingPrize = false;
  }
}

export default PrizeValidationService;
