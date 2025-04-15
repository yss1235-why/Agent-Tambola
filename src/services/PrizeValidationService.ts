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

        // NEW CONDITION: For fullSheet, only check if halfSheet has been won
        if (prizeType === 'fullSheet' && (!currentWinners?.halfSheet || currentWinners.halfSheet.length === 0)) {
          console.log('Full Sheet requires Half Sheet to be won first, skipping');
          continue;
        }

        console.log(`Validating prize type: ${prizeType}`);
        
        if (prizeType === 'fullSheet') {
          // Full sheet validation logic with improved error handling
          console.log("************************");
          console.log("FULL SHEET VALIDATION START");
          console.log("************************");
          console.log(`Time: ${new Date().toLocaleTimeString()}`);
          console.log(`Called numbers count: ${calledNumbers.length}`);
          console.log(`First few called numbers: ${calledNumbers.slice(0, 5).join(', ')}...`);
          
          try {
            // First, collect all sheet data and log it
            const sheetTicketsMap = new Map<number, Game.Ticket[]>();
            
            // Group tickets by sheet number
            console.log("Grouping tickets by sheet number...");
            Object.values(tickets).forEach(ticket => {
              if (!ticket.sheetNumber) {
                console.log(`Warning: Ticket ${ticket.id} has no sheetNumber property`);
                return;
              }
              
              const sheetNum = ticket.sheetNumber;
              if (!sheetTicketsMap.has(sheetNum)) {
                sheetTicketsMap.set(sheetNum, []);
                console.log(`Created new sheet group for sheet ${sheetNum}`);
              }
              sheetTicketsMap.get(sheetNum)?.push(ticket);
            });
            
            // Log all available sheet groups
            console.log(`Found ${sheetTicketsMap.size} sheet groups`);
            sheetTicketsMap.forEach((ticketsInSheet, sheetNum) => {
              console.log(`Sheet ${sheetNum}: Contains ${ticketsInSheet.length} tickets`);
              console.log(`- Ticket IDs: ${ticketsInSheet.map(t => t.id).join(', ')}`);
              
              // Log position distribution
              const positions = ticketsInSheet.map(t => t.position).sort((a, b) => a - b);
              console.log(`- Positions: ${positions.join(', ')}`);
            });
            
            // Process each sheet
            let foundValidSheet = false;
            console.log("Beginning validation of individual sheets...");
            
            for (const [sheetNum, ticketsInSheet] of sheetTicketsMap) {
              console.log(`\n[VALIDATING] Sheet ${sheetNum} with ${ticketsInSheet.length} tickets`);
              
              // Skip if not exactly 6 tickets
              if (ticketsInSheet.length !== 6) {
                console.log(`Sheet ${sheetNum}: INVALID - Has ${ticketsInSheet.length} tickets, not 6`);
                continue;
              }
              
              console.log(`Sheet ${sheetNum}: Validating - Has exactly 6 tickets ✓`);
              
              // Get ticket IDs
              const ticketIds = ticketsInSheet.map(t => t.id);
              console.log(`Sheet ${sheetNum}: Ticket IDs: ${ticketIds.join(', ')}`);
              
              // Check if all tickets are booked
              console.log(`Sheet ${sheetNum}: Checking if all tickets are booked...`);
              const bookedTickets = ticketIds.filter(id => bookings[id]);
              if (bookedTickets.length !== 6) {
                console.log(`Sheet ${sheetNum}: INVALID - Only ${bookedTickets.length}/6 tickets are booked`);
                console.log(`- Booked tickets: ${bookedTickets.join(', ')}`);
                console.log(`- Missing bookings for: ${ticketIds.filter(id => !bookings[id]).join(', ')}`);
                continue;
              }
              
              console.log(`Sheet ${sheetNum}: All 6 tickets are booked ✓`);
              
              // Check if booked by the same player
              console.log(`Sheet ${sheetNum}: Checking if all tickets are booked by the same player...`);
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
                console.log(`Sheet ${sheetNum}: Ticket ${ticketId} booked by ${booking.playerName}`);
              }
              
              if (hasInvalidBooking) {
                console.log(`Sheet ${sheetNum}: Has invalid bookings, skipping further validation`);
                continue;
              }
              
              if (bookingPlayers.size !== 1) {
                console.log(`Sheet ${sheetNum}: INVALID - Tickets booked by ${bookingPlayers.size} different players`);
                console.log(`- Players: ${Array.from(bookingPlayers).join(', ')}`);
                continue;
              }
              
              const playerName = bookings[ticketIds[0]].playerName;
              console.log(`Sheet ${sheetNum}: All tickets booked by same player: "${playerName}" ✓`);
              
              // MODIFIED: Check AT LEAST TWO numbers called per ticket
              console.log(`Sheet ${sheetNum}: Checking called numbers per ticket...`);
              console.log(`For full sheet validation, we require at least 2 numbers called per ticket`);
              
              let allTicketsHaveAtLeastTwoNumbers = true;
              const ticketResults: {id: string, calledCount: number, calledNumbers: number[]}[] = [];
              
              for (const ticket of ticketsInSheet) {
                // Get all non-zero numbers on this ticket
                const allTicketNumbers = ticket.numbers.flat().filter(n => n !== 0);
                console.log(`Ticket ${ticket.id} has ${allTicketNumbers.length} numbers: [${allTicketNumbers.join(', ')}]`);
                
                // Find which ones have been called
                const ticketCalledNumbers = allTicketNumbers.filter(n => calledNumbers.includes(n));
                
                ticketResults.push({
                  id: ticket.id,
                  calledCount: ticketCalledNumbers.length,
                  calledNumbers: ticketCalledNumbers
                });
                
                // MODIFIED: Changed from < 1 to < 2
                if (ticketCalledNumbers.length < 2) {
                  allTicketsHaveAtLeastTwoNumbers = false;
                  console.log(`Sheet ${sheetNum}: Ticket ${ticket.id} has only ${ticketCalledNumbers.length} called numbers - NEEDS AT LEAST 2`);
                } else {
                  console.log(`Sheet ${sheetNum}: Ticket ${ticket.id} has ${ticketCalledNumbers.length} called numbers ✓`);
                }
              }
              
              // Log detailed results for each ticket
              console.log(`Sheet ${sheetNum}: Detailed results per ticket:`);
              ticketResults.forEach(result => {
                console.log(`- Ticket ${result.id}: ${result.calledCount} number(s) called [${result.calledNumbers.join(', ')}]`);
              });
              
              // MODIFIED: Changed variable name to reflect new requirement
              console.log(`Sheet ${sheetNum}: At least two numbers per ticket requirement met: ${allTicketsHaveAtLeastTwoNumbers}`);
              
              // If valid, mark as a winner
              if (allTicketsHaveAtLeastTwoNumbers) {
                console.log(`*** FULL SHEET WIN FOUND! - Sheet ${sheetNum} - Player: ${playerName} ***`);
                console.log(`Winning sheet details:`);
                console.log(`- Sheet number: ${sheetNum}`);
                console.log(`- Player: ${playerName}`);
                console.log(`- Ticket IDs: ${ticketIds.join(', ')}`);
                console.log(`- Total called numbers found: ${ticketResults.reduce((sum, t) => sum + t.calledCount, 0)}`);
                
                results[prizeType].winners = ticketIds;
                results[prizeType].isValid = true;
                newWinners[prizeType] = [...(currentWinners[prizeType] || []), ...ticketIds];
                hasNewWinners = true;
                foundValidSheet = true;
                break;
              } else {
                console.log(`Sheet ${sheetNum}: INVALID - Does not have at least two numbers called per ticket`);
              }
            }
            
            if (!foundValidSheet) {
              console.log("No valid full sheets found after checking all sheets");
            }
          } catch (error) {
            console.error("Error in full sheet validation:", error);
            results[prizeType] = { isValid: false, winners: [], error: 'Full sheet validation error' };
          }
          
          console.log("************************");
          console.log("FULL SHEET VALIDATION END");
          console.log("************************");
          
        } else if (prizeType === 'halfSheet') {
          // MODIFIED Half sheet validation logic to handle tickets with identical positions
          // AND UPDATED to require at least 2 numbers called per ticket
          console.log("************************");
          console.log("HALF SHEET VALIDATION START");
          console.log("************************");
          console.log(`Time: ${new Date().toLocaleTimeString()}`);
          console.log(`Called numbers count: ${calledNumbers.length}`);
          console.log(`First few called numbers: ${calledNumbers.slice(0, 5).join(', ')}...`);
          
          try {
            // Group tickets by sheet number only (ignore position)
            const sheetTicketsMap = new Map<number, Game.Ticket[]>();
            const invalidTickets: string[] = [];
            
            // Log total tickets count before filtering
            console.log(`Total tickets being processed: ${Object.keys(tickets).length}`);
            console.log("Grouping tickets by sheet number only (ignoring position)...");
            
            // Group tickets by sheet number
            Object.values(tickets).forEach(ticket => {
              // Verify ticket has required properties
              if (!ticket.id) {
                console.log(`Warning: Found ticket with no ID`);
                return;
              }
              
              if (!ticket.sheetNumber) {
                console.log(`Warning: Ticket ${ticket.id} has no sheetNumber property`);
                invalidTickets.push(ticket.id);
                return;
              }
              
              console.log(`Processing ticket ${ticket.id}: sheet=${ticket.sheetNumber}`);
              
              const sheetNum = ticket.sheetNumber;
              
              if (!sheetTicketsMap.has(sheetNum)) {
                sheetTicketsMap.set(sheetNum, []);
                console.log(`Created new sheet group for sheet ${sheetNum}`);
              }
              
              sheetTicketsMap.get(sheetNum)?.push(ticket);
              console.log(`Added ticket ${ticket.id} to sheet group ${sheetNum}`);
            });
            
            if (invalidTickets.length > 0) {
              console.log(`Found ${invalidTickets.length} invalid tickets: ${invalidTickets.join(', ')}`);
            }
            
            // Log all available sheet groups
            console.log(`Found ${sheetTicketsMap.size} sheet groups`);
            sheetTicketsMap.forEach((ticketsInSheet, sheetNum) => {
              console.log(`Sheet ${sheetNum}: Contains ${ticketsInSheet.length} tickets`);
              console.log(`- Ticket IDs: ${ticketsInSheet.map(t => t.id).join(', ')}`);
            });
            
            // Process each sheet and divide into half-sheets of 3 tickets each
            let foundValidHalfSheet = false;
            console.log("Beginning validation of half-sheets by arbitrary division...");
            
            for (const [sheetNum, ticketsInSheet] of sheetTicketsMap) {
              console.log(`\n[VALIDATING] Sheet ${sheetNum} with ${ticketsInSheet.length} tickets for half-sheets`);
              
              // We need at least 3 tickets to form a half-sheet
              if (ticketsInSheet.length < 3) {
                console.log(`Sheet ${sheetNum}: INVALID - Has only ${ticketsInSheet.length} tickets, need at least 3 for a half-sheet`);
                continue;
              }
              
              // If more than 3 tickets, we'll create potential half-sheets in groups of 3
              // We'll try all possible combinations of 3 tickets
              const halfSheetCombinations: Game.Ticket[][] = [];
              
              if (ticketsInSheet.length === 3) {
                // Exact match, just one combination
                halfSheetCombinations.push([...ticketsInSheet]);
                console.log(`Sheet ${sheetNum}: Exactly 3 tickets, creating one half-sheet group`);
              } else if (ticketsInSheet.length === 6) {
                // Perfect for two half-sheets (first 3 and last 3)
                const firstHalf = ticketsInSheet.slice(0, 3);
                const secondHalf = ticketsInSheet.slice(3, 6);
                
                halfSheetCombinations.push(firstHalf);
                halfSheetCombinations.push(secondHalf);
                
                console.log(`Sheet ${sheetNum}: 6 tickets, creating two half-sheet groups of 3 tickets each`);
                console.log(`- First half: ${firstHalf.map(t => t.id).join(', ')}`);
                console.log(`- Second half: ${secondHalf.map(t => t.id).join(', ')}`);
              } else {
                // For other numbers, we'll generate combinations of 3
                console.log(`Sheet ${sheetNum}: ${ticketsInSheet.length} tickets, generating all possible combinations of 3`);
                
                // Use a simple algorithm to generate combinations of 3 tickets
                for (let i = 0; i < ticketsInSheet.length - 2; i++) {
                  for (let j = i + 1; j < ticketsInSheet.length - 1; j++) {
                    for (let k = j + 1; k < ticketsInSheet.length; k++) {
                      const combination = [ticketsInSheet[i], ticketsInSheet[j], ticketsInSheet[k]];
                      halfSheetCombinations.push(combination);
                    }
                  }
                }
                
                console.log(`Generated ${halfSheetCombinations.length} possible combinations of 3 tickets`);
              }
              
              // Now validate each potential half-sheet
              console.log(`Validating ${halfSheetCombinations.length} potential half-sheets for sheet ${sheetNum}...`);
              
              let combinationIndex = 0;
              for (const halfSheetTickets of halfSheetCombinations) {
                combinationIndex++;
                console.log(`\n[VALIDATING] Half-sheet combination ${combinationIndex}/${halfSheetCombinations.length} for sheet ${sheetNum}`);
                
                // Get ticket IDs
                const ticketIds = halfSheetTickets.map(t => t.id);
                console.log(`Half-sheet tickets: ${ticketIds.join(', ')}`);
                
                // Check if all tickets are booked
                console.log(`Checking if all tickets are booked...`);
                const bookedTickets = ticketIds.filter(id => bookings[id]);
                if (bookedTickets.length !== 3) {
                  console.log(`INVALID - Only ${bookedTickets.length}/3 tickets are booked`);
                  console.log(`- Booked tickets: ${bookedTickets.join(', ')}`);
                  console.log(`- Missing bookings for: ${ticketIds.filter(id => !bookings[id]).join(', ')}`);
                  continue;
                }
                
                console.log(`All 3 tickets are booked ✓`);
                
                // Check if booked by the same player
                console.log(`Checking if all tickets are booked by the same player...`);
                const bookingPlayers = new Map<string, string[]>();
                let hasInvalidBooking = false;
                
                for (const ticketId of ticketIds) {
                  const booking = bookings[ticketId];
                  if (!booking || !booking.playerName) {
                    hasInvalidBooking = true;
                    console.log(`INVALID - Ticket ${ticketId} has no valid booking`);
                    break;
                  }
                  
                  const playerName = booking.playerName;
                  console.log(`Ticket ${ticketId} booked by ${playerName}`);
                  
                  if (!bookingPlayers.has(playerName)) {
                    bookingPlayers.set(playerName, []);
                  }
                  bookingPlayers.get(playerName)?.push(ticketId);
                }
                
                if (hasInvalidBooking) {
                  console.log(`Has invalid bookings, skipping further validation`);
                  continue;
                }
                
                if (bookingPlayers.size !== 1) {
                  console.log(`INVALID - Tickets booked by ${bookingPlayers.size} different players`);
                  bookingPlayers.forEach((ticketIds, playerName) => {
                    console.log(`- Player "${playerName}" has tickets: ${ticketIds.join(', ')}`);
                  });
                  continue;
                }
                
                const playerName = [...bookingPlayers.keys()][0];
                console.log(`All tickets booked by same player: "${playerName}" ✓`);
                
                // UPDATED: Check AT LEAST TWO numbers called per ticket (changed from one)
                console.log(`Checking called numbers per ticket...`);
                console.log(`For half sheet validation, we require at least 2 numbers called per ticket`);
                
                let allTicketsHaveAtLeastTwoNumbers = true;
                const ticketResults: {id: string, calledCount: number, calledNumbers: number[]}[] = [];
                
                for (const ticket of halfSheetTickets) {
                  // Get all non-zero numbers on this ticket
                  const allTicketNumbers = ticket.numbers.flat().filter(n => n !== 0);
                  console.log(`Ticket ${ticket.id} has ${allTicketNumbers.length} numbers: [${allTicketNumbers.join(', ')}]`);
                  
                  // Find which ones have been called
                  const ticketCalledNumbers = allTicketNumbers.filter(n => calledNumbers.includes(n));
                  
                  ticketResults.push({
                    id: ticket.id,
                    calledCount: ticketCalledNumbers.length,
                    calledNumbers: ticketCalledNumbers
                  });
                  
                  // UPDATED: Check if at least TWO numbers are called (changed from one)
                  if (ticketCalledNumbers.length < 2) {
                    allTicketsHaveAtLeastTwoNumbers = false;
                    console.log(`Ticket ${ticket.id} has only ${ticketCalledNumbers.length} called numbers - NEEDS AT LEAST 2`);
                  } else {
                    console.log(`Ticket ${ticket.id} has ${ticketCalledNumbers.length} called numbers ✓`);
                  }
                }
                
                // Log detailed results for each ticket
                console.log(`Detailed results per ticket:`);
                ticketResults.forEach(result => {
                  console.log(`- Ticket ${result.id}: ${result.calledCount} number(s) called [${result.calledNumbers.join(', ')}]`);
                });
                
                // UPDATED: Changed variable name and condition text to reflect new requirement
                console.log(`At least two numbers per ticket requirement met: ${allTicketsHaveAtLeastTwoNumbers}`);
                
                // For reference, check more lenient requirement for debugging
                const allTicketsHaveAtLeastOneNumber = ticketResults.every(r => r.calledCount >= 1);
                console.log(`At least one number per ticket: ${allTicketsHaveAtLeastOneNumber} (not used for validation)`);
                
                // UPDATED: If valid, mark as a winner - USING THE STRICTER REQUIREMENT
                if (allTicketsHaveAtLeastTwoNumbers) {
                  console.log(`*** HALF SHEET WIN FOUND! - Sheet ${sheetNum} - Player: ${playerName} ***`);
                  console.log(`Winning half-sheet details:`);
                  console.log(`- Sheet number: ${sheetNum}`);
                  console.log(`- Player: ${playerName}`);
                  console.log(`- Ticket IDs: ${ticketIds.join(', ')}`);
                  console.log(`- Total called numbers found: ${ticketResults.reduce((sum, t) => sum + t.calledCount, 0)}`);
                  
                  results[prizeType].winners = ticketIds;
                  results[prizeType].isValid = true;
                  newWinners[prizeType] = [...(currentWinners[prizeType] || []), ...ticketIds];
                  hasNewWinners = true;
                  foundValidHalfSheet = true;
                  break;
                } else {
                  console.log(`INVALID - Does not meet minimum called numbers requirement`);
                }
              }
              
              // If we found a valid half sheet, no need to check other sheets
              if (foundValidHalfSheet) break;
            }
            
            if (!foundValidHalfSheet) {
              console.log("No valid half sheets found after checking all groups");
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
