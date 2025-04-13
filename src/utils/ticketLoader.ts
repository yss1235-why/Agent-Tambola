// src/utils/ticketLoader.ts

import { Game } from '../types/game';

/**
 * Loads ticket data from the public directory and processes it into the 
 * format expected by the prize validation system.
 * 
 * @param setId The ticket set ID (1-4)
 * @param maxTickets Maximum number of tickets to load
 * @returns A map of ticket IDs to their 2D number grids
 */
export async function loadTicketData(setId: number, maxTickets: number): Promise<Record<string, number[][]>> {
  try {
    // Load ticket data from JSON file
    const response = await fetch(`/data/ticket${setId}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load ticket data: ${response.status} ${response.statusText}`);
    }
    
    const rawData = await response.json() as Game.TicketRowData[];
    const ticketMap: Record<string, number[][]> = {};
    
    console.log(`Loaded ticket data for set ${setId}, processing ${rawData.length} rows`);
    
    // Process rows into 2D arrays grouped by ticket ID
    rawData.forEach((row: Game.TicketRowData) => {
      // Skip tickets beyond the maximum
      if (row.ticketId > maxTickets) return;
      
      const ticketId = row.ticketId.toString();
      
      // Initialize ticket's numbers array if it doesn't exist
      if (!ticketMap[ticketId]) {
        ticketMap[ticketId] = [[], [], []];
      }
      
      // Row IDs in the data are 1-indexed, but arrays are 0-indexed
      const rowIndex = row.rowId - 1;
      
      // Add the row's numbers to the appropriate row in the ticket
      ticketMap[ticketId][rowIndex] = [...row.numbers];
    });
    
    console.log(`Successfully processed ${Object.keys(ticketMap).length} tickets from set ${setId}`);
    
    return ticketMap;
  } catch (error) {
    console.error('Error loading ticket data:', error);
    throw error;
  }
}

/**
 * Verifies that ticket data is properly structured for validation.
 * 
 * @param ticketMap The processed ticket data map
 * @returns True if the data is valid, false otherwise
 */
export function validateTicketData(ticketMap: Record<string, number[][]>): boolean {
  for (const [ticketId, numberGrid] of Object.entries(ticketMap)) {
    // Check that we have 3 rows
    if (numberGrid.length !== 3) {
      console.error(`Invalid ticket data for ticket ${ticketId}: expected 3 rows, got ${numberGrid.length}`);
      return false;
    }
    
    // Check that each row has 9 columns
    for (let i = 0; i < 3; i++) {
      if (numberGrid[i].length !== 9) {
        console.error(`Invalid ticket data for ticket ${ticketId}, row ${i}: expected 9 columns, got ${numberGrid[i].length}`);
        return false;
      }
    }
  }
  
  return true;
}
