// src/services/GameDatabaseService.ts - REPLACE EXISTING FILE
import { ref, update, get, onValue, off } from 'firebase/database';
import { database } from '../lib/firebase';
import type { Game } from '../types/game';

export class GameDatabaseService {
  private static instance: GameDatabaseService;
  
  // Optimized batch update system
  private batchUpdateTimers = new Map<string, NodeJS.Timeout>();
  private pendingBatchUpdates = new Map<string, Record<string, any>>();
  private readonly BATCH_DELAY = 500; // ms - collect updates for 500ms then send

  private constructor() {}

  public static getInstance(): GameDatabaseService {
    if (!GameDatabaseService.instance) {
      GameDatabaseService.instance = new GameDatabaseService();
    }
    return GameDatabaseService.instance;
  }

  /**
   * Immediate single update - use for critical data like game status
   */
  public async immediateUpdate(hostId: string, path: string, data: any): Promise<void> {
    try {
      const fullPath = `hosts/${hostId}/${path}`;
      const dbRef = ref(database, fullPath);
      await update(dbRef, data);
      console.log(`✅ Immediate update: ${fullPath}`);
    } catch (error) {
      console.error(`❌ Immediate update failed: ${path}`, error);
      throw new Error(`Failed to update ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Batched update - use for frequent updates like number calling
   */
  public batchUpdate(hostId: string, path: string, data: any): void {
    const batchKey = hostId;
    
    // Initialize batch if it doesn't exist
    if (!this.pendingBatchUpdates.has(batchKey)) {
      this.pendingBatchUpdates.set(batchKey, {});
    }
    
    // Add to batch
    const batch = this.pendingBatchUpdates.get(batchKey)!;
    const fullPath = `hosts/${hostId}/${path}`;
    
    // Merge with existing updates for same path
    if (batch[fullPath] && typeof batch[fullPath] === 'object' && typeof data === 'object') {
      batch[fullPath] = { ...batch[fullPath], ...data };
    } else {
      batch[fullPath] = data;
    }
    
    // Clear existing timer and set new one
    if (this.batchUpdateTimers.has(batchKey)) {
      clearTimeout(this.batchUpdateTimers.get(batchKey)!);
    }
    
    this.batchUpdateTimers.set(batchKey, setTimeout(() => {
      this.flushBatch(batchKey);
    }, this.BATCH_DELAY));
    
    console.log(`⏳ Batched update queued: ${fullPath}`);
  }

  /**
   * Flush batch immediately
   */
  public async flushBatch(hostId: string): Promise<void> {
    const batchKey = hostId;
    
    // Clear timer
    if (this.batchUpdateTimers.has(batchKey)) {
      clearTimeout(this.batchUpdateTimers.get(batchKey)!);
      this.batchUpdateTimers.delete(batchKey);
    }
    
    // Get and clear batch
    const batch = this.pendingBatchUpdates.get(batchKey);
    if (!batch || Object.keys(batch).length === 0) {
      return;
    }
    
    this.pendingBatchUpdates.delete(batchKey);
    
    try {
      await update(ref(database), batch);
      console.log(`✅ Batch update completed: ${Object.keys(batch).length} updates for ${hostId}`);
    } catch (error) {
      console.error(`❌ Batch update failed for ${hostId}:`, error);
      throw new Error(`Batch update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Enhanced batch update for complex game data - REPLACES the old method
   */
  public async batchUpdateGameData(
    hostId: string,
    updates: {
      gameState?: Partial<Game.GameState>;
      numberSystem?: Partial<Game.NumberSystem>;
      bookings?: Record<string, Game.Booking | null>;
      tickets?: Record<string, Partial<Game.Ticket>>;
      metrics?: Game.BookingMetrics;
      players?: Record<string, Game.Player | null>;
      settings?: Partial<Game.Settings>;
    }
  ): Promise<void> {
    const batchUpdates: Record<string, any> = {};
    
    // Game state updates
    if (updates.gameState) {
      Object.entries(updates.gameState).forEach(([key, value]) => {
        batchUpdates[`hosts/${hostId}/currentGame/gameState/${key}`] = value;
      });
    }
    
    // Number system updates
    if (updates.numberSystem) {
      Object.entries(updates.numberSystem).forEach(([key, value]) => {
        batchUpdates[`hosts/${hostId}/currentGame/numberSystem/${key}`] = value;
      });
    }
    
    // Booking updates (including deletions)
    if (updates.bookings) {
      Object.entries(updates.bookings).forEach(([ticketId, booking]) => {
        batchUpdates[`hosts/${hostId}/currentGame/activeTickets/bookings/${ticketId}`] = booking;
      });
    }
    
    // Ticket updates
    if (updates.tickets) {
      Object.entries(updates.tickets).forEach(([ticketId, ticket]) => {
        if (ticket === null) {
          batchUpdates[`hosts/${hostId}/currentGame/activeTickets/tickets/${ticketId}`] = null;
        } else {
          Object.entries(ticket).forEach(([key, value]) => {
            batchUpdates[`hosts/${hostId}/currentGame/activeTickets/tickets/${ticketId}/${key}`] = value;
          });
        }
      });
    }
    
    // Metrics updates
    if (updates.metrics) {
      batchUpdates[`hosts/${hostId}/currentGame/bookingMetrics`] = updates.metrics;
    }
    
    // Player updates (including deletions)
    if (updates.players) {
      Object.entries(updates.players).forEach(([playerId, player]) => {
        batchUpdates[`hosts/${hostId}/currentGame/players/${playerId}`] = player;
      });
    }
    
    // Settings updates
    if (updates.settings) {
      Object.entries(updates.settings).forEach(([key, value]) => {
        batchUpdates[`hosts/${hostId}/currentGame/settings/${key}`] = value;
      });
    }
    
    if (Object.keys(batchUpdates).length === 0) {
      return;
    }
    
    try {
      await update(ref(database), batchUpdates);
      console.log(`✅ Game data batch update: ${Object.keys(batchUpdates).length} updates for ${hostId}`);
    } catch (error) {
      console.error(`❌ Game data batch update failed for ${hostId}:`, error);
      throw new Error(`Game data update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Read current game data
   */
  public async getCurrentGame(hostId: string): Promise<Game.CurrentGame | null> {
    try {
      const gameRef = ref(database, `hosts/${hostId}/currentGame`);
      const snapshot = await get(gameRef);
      
      if (!snapshot.exists()) {
        return null;
      }
      
      return snapshot.val() as Game.CurrentGame;
    } catch (error) {
      console.error('Error getting current game:', error);
      throw new Error(`Failed to get current game: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Subscribe to current game with optimized listener
   */
  public subscribeToCurrentGame(
    hostId: string,
    callback: (game: Game.CurrentGame | null, error?: string) => void
  ): () => void {
    const gameRef = ref(database, `hosts/${hostId}/currentGame`);
    
    const unsubscribe = onValue(
      gameRef,
      (snapshot) => {
        try {
          const data = snapshot.exists() ? snapshot.val() as Game.CurrentGame : null;
          callback(data);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Data processing error';
          callback(null, errorMessage);
        }
      },
      (error) => {
        const errorMessage = error instanceof Error ? error.message : 'Subscription error';
        callback(null, errorMessage);
      }
    );

    return () => {
      off(gameRef, 'value', unsubscribe);
    };
  }

  /**
   * Set complete game data
   */
  public async setCurrentGame(hostId: string, game: Game.CurrentGame): Promise<void> {
    try {
      const gameRef = ref(database, `hosts/${hostId}/currentGame`);
      await update(gameRef, game);
      console.log(`✅ Complete game data set for ${hostId}`);
    } catch (error) {
      console.error(`Error setting current game for ${hostId}:`, error);
      throw new Error(`Failed to set current game: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save game to history
   */
  public async saveGameToHistory(hostId: string, game: Game.CurrentGame): Promise<void> {
    const timestamp = Date.now();
    const gameSession: Game.GameSession = {
      ...game,
      id: timestamp.toString(),
      hostId,
      endTime: timestamp,
      endReason: 'Game completed'
    };

    try {
      const historyRef = ref(database, `hosts/${hostId}/sessions/${timestamp}`);
      await update(historyRef, gameSession);
      console.log(`✅ Game saved to history: ${timestamp} for ${hostId}`);
    } catch (error) {
      console.error(`Error saving game to history for ${hostId}:`, error);
      throw new Error(`Failed to save game to history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update game state only
   */
  public async updateGameState(hostId: string, updates: Partial<Game.GameState>): Promise<void> {
    const batchUpdates: Record<string, any> = {};
    
    Object.entries(updates).forEach(([key, value]) => {
      batchUpdates[`hosts/${hostId}/currentGame/gameState/${key}`] = value;
    });

    try {
      await update(ref(database), batchUpdates);
      console.log(`✅ Game state updated for ${hostId}:`, Object.keys(updates));
    } catch (error) {
      console.error(`Error updating game state for ${hostId}:`, error);
      throw new Error(`Failed to update game state: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update number system only
   */
  public async updateNumberSystem(hostId: string, updates: Partial<Game.NumberSystem>): Promise<void> {
    const batchUpdates: Record<string, any> = {};
    
    Object.entries(updates).forEach(([key, value]) => {
      batchUpdates[`hosts/${hostId}/currentGame/numberSystem/${key}`] = value;
    });

    try {
      await update(ref(database), batchUpdates);
      console.log(`✅ Number system updated for ${hostId}:`, Object.keys(updates));
    } catch (error) {
      console.error(`Error updating number system for ${hostId}:`, error);
      throw new Error(`Failed to update number system: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update game settings
   */
  public async updateGameSettings(hostId: string, settings: Partial<Game.Settings>): Promise<void> {
    const batchUpdates: Record<string, any> = {};
    
    Object.entries(settings).forEach(([key, value]) => {
      batchUpdates[`hosts/${hostId}/currentGame/settings/${key}`] = value;
    });

    try {
      await update(ref(database), batchUpdates);
      console.log(`✅ Game settings updated for ${hostId}:`, Object.keys(settings));
    } catch (error) {
      console.error(`Error updating game settings for ${hostId}:`, error);
      throw new Error(`Failed to update game settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update player information
   */
  public async updatePlayer(hostId: string, playerId: string, player: Game.Player): Promise<void> {
    try {
      const playerRef = ref(database, `hosts/${hostId}/currentGame/players/${playerId}`);
      await update(playerRef, player);
      console.log(`✅ Player updated: ${playerId} for ${hostId}`);
    } catch (error) {
      console.error(`Error updating player ${playerId} for ${hostId}:`, error);
      throw new Error(`Failed to update player: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update booking metrics
   */
  public async updateBookingMetrics(hostId: string, metrics: Game.BookingMetrics): Promise<void> {
    try {
      const metricsRef = ref(database, `hosts/${hostId}/currentGame/bookingMetrics`);
      await update(metricsRef, metrics);
      console.log(`✅ Booking metrics updated for ${hostId}`);
    } catch (error) {
      console.error(`Error updating booking metrics for ${hostId}:`, error);
      throw new Error(`Failed to update booking metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get default settings
   */
  public async getDefaultSettings(hostId: string): Promise<Game.Settings | null> {
    try {
      const settingsRef = ref(database, `hosts/${hostId}/defaultSettings`);
      const snapshot = await get(settingsRef);
      return snapshot.exists() ? snapshot.val() as Game.Settings : null;
    } catch (error) {
      console.error(`Error getting default settings for ${hostId}:`, error);
      return null;
    }
  }

  /**
   * Save default settings
   */
  public async saveDefaultSettings(hostId: string, settings: Game.Settings): Promise<void> {
    try {
      const settingsRef = ref(database, `hosts/${hostId}/defaultSettings`);
      await update(settingsRef, settings);
      console.log(`✅ Default settings saved for ${hostId}`);
    } catch (error) {
      console.error(`Error saving default settings for ${hostId}:`, error);
      throw new Error(`Failed to save default settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete current game
   */
  public async deleteCurrentGame(hostId: string): Promise<void> {
    try {
      const gameRef = ref(database, `hosts/${hostId}/currentGame`);
      await update(gameRef, null);
      console.log(`✅ Current game deleted for ${hostId}`);
    } catch (error) {
      console.error(`Error deleting current game for ${hostId}:`, error);
      throw new Error(`Failed to delete current game: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get game history
   */
  public async getGameHistory(hostId: string): Promise<Record<string, Game.GameSession> | null> {
    try {
      const historyRef = ref(database, `hosts/${hostId}/sessions`);
      const snapshot = await get(historyRef);
      return snapshot.exists() ? snapshot.val() as Record<string, Game.GameSession> : null;
    } catch (error) {
      console.error(`Error getting game history for ${hostId}:`, error);
      return null;
    }
  }

  /**
   * Cleanup method to flush all pending batches
   */
  public async cleanup(): Promise<void> {
    const hostIds = Array.from(this.pendingBatchUpdates.keys());
    
    for (const hostId of hostIds) {
      try {
        await this.flushBatch(hostId);
      } catch (error) {
        console.error(`Failed to flush batch for ${hostId}:`, error);
      }
    }
    
    // Clear all timers
    for (const timer of this.batchUpdateTimers.values()) {
      clearTimeout(timer);
    }
    this.batchUpdateTimers.clear();
    this.pendingBatchUpdates.clear();
    
    console.log(`✅ Database service cleanup completed`);
  }
}
