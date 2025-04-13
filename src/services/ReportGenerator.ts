// src/services/ReportGenerator.ts

import { ref, get } from 'firebase/database';
import { database } from '../lib/firebase';
import type { Game } from '../types/game';

export interface ReportOptions {
  includePlayerDetails: boolean;
  includePrizeHistory: boolean;
  includeGameStats: boolean;
  format?: 'simple' | 'detailed';
}

export interface GameReport {
  id: string;
  hostId: string;
  timestamp: number;
  gameData: any;
  statistics: any;
  players: any;
  performance: any;
}

export class ReportGenerator {
  private static instance: ReportGenerator;
  
  private constructor() {}
  
  public static getInstance(): ReportGenerator {
    if (!ReportGenerator.instance) {
      ReportGenerator.instance = new ReportGenerator();
    }
    return ReportGenerator.instance;
  }
  
  public async generateGameReport(gameData: any): Promise<GameReport> {
    const timestamp = Date.now();
    const gameId = gameData.id || `game_${timestamp}`;
    const hostId = gameData.hostId || '';
    
    // Extract game statistics
    const statistics = this.extractGameStatistics(gameData);
    
    // Extract player information
    const players = this.extractPlayerData(gameData);
    
    // Extract performance metrics
    const performance = this.extractPerformanceData(gameData);
    
    return {
      id: gameId,
      hostId,
      timestamp,
      gameData,
      statistics,
      players,
      performance
    };
  }
  
  private extractGameStatistics(gameData: any): any {
    // Calculate game statistics
    const calledNumbers = gameData.numberSystem?.calledNumbers || [];
    const bookings = gameData.activeTickets?.bookings || {};
    const winners = gameData.gameState?.winners || {};
    
    // Calculate total winners
    const totalWinners = Object.values(winners).reduce((total, list: any) => {
      return total + (list?.length || 0);
    }, 0);
    
    return {
      totalNumbers: calledNumbers.length,
      totalTickets: Object.keys(bookings).length,
      totalWinners: totalWinners,
      duration: (gameData.endTime || Date.now()) - gameData.startTime,
      averageTimePerNumber: calledNumbers.length > 0 
        ? ((gameData.endTime || Date.now()) - gameData.startTime) / calledNumbers.length
        : 0
    };
  }
  
  private extractPlayerData(gameData: any): any {
    const players = gameData.players || {};
    const bookings = gameData.activeTickets?.bookings || {};
    
    const playerStats = Object.values(players).map((player: any) => {
      // Count player's tickets
      const ticketCount = player.tickets?.length || 0;
      
      // Count player's wins
      let winCount = 0;
      const winners = gameData.gameState?.winners || {};
      
      Object.values(winners).forEach((winningTickets: any) => {
        if (Array.isArray(winningTickets)) {
          winningTickets.forEach((ticketId: string) => {
            if (player.tickets?.includes(ticketId)) {
              winCount++;
            }
          });
        }
      });
      
      return {
        id: player.id,
        name: player.name,
        phoneNumber: player.phoneNumber,
        ticketCount,
        winCount,
        ticketIds: player.tickets || []
      };
    });
    
    return {
      totalPlayers: Object.keys(players).length,
      averageTicketsPerPlayer: Object.keys(players).length > 0
        ? Object.keys(bookings).length / Object.keys(players).length
        : 0,
      playerStats
    };
  }
  
  private extractPerformanceData(gameData: any): any {
    const startTime = gameData.startTime;
    const endTime = gameData.endTime || Date.now();
    const calledNumbers = gameData.numberSystem?.calledNumbers || [];
    
    // Create time series data if timestamps are available
    let timeSeriesData = [];
    
    if (calledNumbers.length > 0 && gameData.numberSystem?.timestamps) {
      timeSeriesData = calledNumbers.map((number: number, index: number) => {
        const timestamp = gameData.numberSystem.timestamps[index] || 0;
        return {
          number,
          timestamp,
          elapsed: timestamp - startTime
        };
      });
    }
    
    return {
      totalDuration: endTime - startTime,
      averageCallTime: calledNumbers.length > 0
        ? (endTime - startTime) / calledNumbers.length
        : 0,
      timeSeriesData
    };
  }
  
  public async exportReport(gameId: string, options: ReportOptions = {
    includePlayerDetails: true,
    includePrizeHistory: true,
    includeGameStats: true,
    format: 'detailed'
  }): Promise<string> {
    // This would generate a formatted report
    return "Report content would go here";
  }
}

export default ReportGenerator;