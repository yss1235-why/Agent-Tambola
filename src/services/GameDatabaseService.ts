// src/services/GameDatabaseService.ts - OPTIMIZED VERSION
import { ref, update, get, onValue, off, remove } from 'firebase/database';
import { database } from '../lib/firebase';
import type { Game } from '../types/game';

export class GameDatabaseService {
  private static instance: GameDatabaseService;
  
  // Optimized batch system with immediate updates for critical operations
  private criticalUpdates = new Set(['gameState/status', 'gameState/isAutoCalling']);
  private batchUpdateTimers = new Map<string, NodeJS.Timeout>();
  private pendingBatchUpdates = new Map<string, Record<string, any>>();
  private readonly BATCH_DELAY = 100; // Reduced to 100ms for faster updates
  private readonly CRITICAL_DELAY = 50; // Even faster for critical updates

  private constructor() {}

  public static getInstance(): GameDatabaseService {
    if (!GameDatabaseService.instance) {
      GameDatabaseService.instance = new GameDatabaseService();
    }
    return GameDatabaseService.instance;
  }

  /**
   * IMMEDIATE update for critical operations (status changes, pause/play)
   */
  public async immediateUpdate(hostId: string, path: string, data: any): Promise<void> {
    try {
      const fullPath = `hosts/${hostId}/${path}`;
      const updateData = { [fullPath]: data };
      
      console.log(`⚡ IMMEDIATE UPDATE: ${path}`);
      await update(ref(database), updateData);
      
    } catch (error) {
      console.error(`❌ Immediate update failed: ${path}`, error);
      throw new Error(`Failed to update ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fast update for semi-critical operations (number calling)
   */
  public async fastUpdate(hostId: string, updates: Record<string, any>): Promise<void> {
    try {
      const batchUpdates: Record<string, any> = {};
      
      Object.entries(updates).forEach(([path, data]) => {
        batchUpdates[`hosts/${hostId}/${path}`] = data;
      });
      
      console.log(`🚀 FAST UPDATE: ${Object.keys(updates).join(', ')}`);
      await update(ref(database), batchUpdates);
      
    } catch (error) {
      console.error(`❌ Fast update failed:`, error);
      throw new Error(`Fast update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Enhanced game state update with smart routing
   */
  public async updateGameState(hostId: string, updates: Partial<Game.GameState>): Promise<void> {
    const updateEntries = Object.entries(updates);
    const criticalUpdates: Record<string, any> = {};
    const regularUpdates: Record<string, any> = {};
    
    // Separate critical from regular updates
    updateEntries.forEach(([key, value]) => {
      const path = `currentGame/gameState/${key}`;
      if (this.criticalUpdates.has(`gameState/${key}`) || key === 'status' || key === 'isAutoCalling') {
        criticalUpdates[path] = value;
      } else {
        regularUpdates[path] = value;
      }
    });
    
    // Process critical updates immediately
    if (Object.keys(criticalUpdates).length > 0) {
      await this.fastUpdate(hostId, criticalUpdates);
    }
    
    // Process regular updates with batching
    if (Object.keys(regularUpdates).length > 0) {
      await this.fastUpdate(hostId, regularUpdates);
    }
  }

  /**
   * Enhanced number system update
   */
  public async updateNumberSystem(hostId: string, updates: Partial<Game.NumberSystem>): Promise<void> {
    const batchUpdates: Record<string, any> = {};
    
    Object.entries(updates).forEach(([key, value]) => {
      batchUpdates[`currentGame/numberSystem/${key}`] = value;
    });

    // Number updates are semi-critical - use fast update
    await this.fastUpdate(hostId, batchUpdates);
  }

  /**
   * Optimized batch update for complex operations
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
    const criticalUpdates: Record<string, any> = {};
    
    // Game state updates
    if (updates.gameState) {
      Object.entries(updates.gameState).forEach(([key, value]) => {
        const path = `hosts/${hostId}/currentGame/gameState/${key}`;
        if (key === 'status' || key === 'isAutoCalling') {
          criticalUpdates[path] = value;
        } else {
          batchUpdates[path] = value;
        }
      });
    }
    
    // Number system updates (semi-critical)
    if (updates.numberSystem) {
      Object.entries(updates.numberSystem).forEach(([key, value]) => {
        batchUpdates[`hosts/${hostId}/currentGame/numberSystem/${key}`] = value;
      });
    }
    
    // Other updates (regular batching)
    ['bookings', 'tickets', 'players'].forEach(updateType => {
      const updateData = updates[updateType as keyof typeof updates] as Record<string, any>;
      if (updateData) {
        Object.entries(updateData).forEach(([id, data]) => {
          const basePath = updateType === 'bookings' || updateType === 'tickets' 
            ? `hosts/${hostId}/currentGame/activeTickets/${updateType}/${id}`
            : `hosts/${hostId}/currentGame/${updateType}/${id}`;
          
          if (data === null) {
            batchUpdates[basePath] = null;
          } else if (updateType === 'tickets') {
            Object.entries(data).forEach(([key, value]) => {
              batchUpdates[`${basePath}/${key}`] = value;
            });
          } else {
            batchUpdates[basePath] = data;
          }
        });
      }
    });
    
    // Handle metrics and settings
    if (updates.metrics) {
      batchUpdates[`hosts/${hostId}/currentGame/bookingMetrics`] = updates.metrics;
    }
    
    if (updates.settings) {
      Object.entries(updates.settings).forEach(([key, value]) => {
        batchUpdates[`hosts/${hostId}/currentGame/settings/${key}`] = value;
      });
    }
    
    try {
      // Execute critical updates first
      if (Object.keys(criticalUpdates).length > 0) {
        console.log(`⚡ CRITICAL batch: ${Object.keys(criticalUpdates).length} updates`);
        await update(ref(database), criticalUpdates);
      }
      
      // Then execute regular updates
      if (Object.keys(batchUpdates).length > 0) {
        console.log(`📦 REGULAR batch: ${Object.keys(batchUpdates).length} updates`);
        await update(ref(database), batchUpdates);
      }
      
    } catch (error) {
      console.error(`❌ Batch update failed for ${hostId}:`, error);
      throw new Error(`Batch update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Read current game data with caching
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
   * Optimized subscription with better error handling
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
   * Save game to history (background operation)
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
      // Use background update for history
      setTimeout(async () => {
        try {
          const historyRef = ref(database, `hosts/${hostId}/sessions/${timestamp}`);
          await update(historyRef, gameSession);
          console.log(`✅ Game saved to history: ${timestamp}`);
        } catch (error) {
          console.error(`Error saving game to history:`, error);
        }
      }, 100);
      
    } catch (error) {
      console.error(`Error saving game to history for ${hostId}:`, error);
      throw new Error(`Failed to save game to history: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

    await this.fastUpdate(hostId, { [`currentGame/settings`]: batchUpdates });
  }

  /**
   * Update player information
   */
  public async updatePlayer(hostId: string, playerId: string, player: Game.Player): Promise<void> {
    await this.fastUpdate(hostId, {
      [`currentGame/players/${playerId}`]: player
    });
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
   * Save default settings (background operation)
   */
  public async saveDefaultSettings(hostId: string, settings: Game.Settings): Promise<void> {
    try {
      // Background save for settings
      setTimeout(async () => {
        try {
          const settingsRef = ref(database, `hosts/${hostId}/defaultSettings`);
          await update(settingsRef, settings);
          console.log(`✅ Default settings saved for ${hostId}`);
        } catch (error) {
          console.error(`Error saving default settings:`, error);
        }
      }, 200);
      
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
      await remove(gameRef);
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
   * Cleanup method
   */
  public async cleanup(): Promise<void> {
    // Clear all timers
    for (const timer of this.batchUpdateTimers.values()) {
      clearTimeout(timer);
    }
    this.batchUpdateTimers.clear();
    this.pendingBatchUpdates.clear();
    
    console.log(`✅ Database service cleanup completed`);
  }
}
