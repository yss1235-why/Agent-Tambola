// src/services/GameDatabaseService.ts
import { FirebaseUtils } from '../utils/firebaseUtils';
import type { Game } from '../types/game';

export class GameDatabaseService {
  private static instance: GameDatabaseService;
  private firebaseUtils: FirebaseUtils;

  private constructor() {
    this.firebaseUtils = FirebaseUtils.getInstance();
  }

  public static getInstance(): GameDatabaseService {
    if (!GameDatabaseService.instance) {
      GameDatabaseService.instance = new GameDatabaseService();
    }
    return GameDatabaseService.instance;
  }

  // Game State Operations
  public async updateGameState(hostId: string, updates: Partial<Game.GameState>) {
    const result = await this.firebaseUtils.updateData(hostId, updates, 'currentGame/gameState');
    if (!result.success) {
      throw new Error(result.error || 'Failed to update game state');
    }
  }

  public async getGameState(hostId: string): Promise<Game.GameState | null> {
    const result = await this.firebaseUtils.readData<Game.GameState>(hostId, 'currentGame/gameState');
    if (!result.success && result.error !== 'Data not found') {
      throw new Error(result.error || 'Failed to get game state');
    }
    return result.data || null;
  }

  // Number System Operations
  public async updateNumberSystem(hostId: string, updates: Partial<Game.NumberSystem>) {
    const result = await this.firebaseUtils.updateData(hostId, updates, 'currentGame/numberSystem');
    if (!result.success) {
      throw new Error(result.error || 'Failed to update number system');
    }
  }

  public async getNumberSystem(hostId: string): Promise<Game.NumberSystem | null> {
    const result = await this.firebaseUtils.readData<Game.NumberSystem>(hostId, 'currentGame/numberSystem');
    if (!result.success && result.error !== 'Data not found') {
      throw new Error(result.error || 'Failed to get number system');
    }
    return result.data || null;
  }

  // Complete Game Operations
  public async getCurrentGame(hostId: string): Promise<Game.CurrentGame | null> {
    const result = await this.firebaseUtils.readData<Game.CurrentGame>(hostId, 'currentGame');
    if (!result.success && result.error !== 'Data not found') {
      throw new Error(result.error || 'Failed to get current game');
    }
    return result.data || null;
  }

  public async setCurrentGame(hostId: string, game: Game.CurrentGame) {
    const result = await this.firebaseUtils.setData(hostId, 'currentGame', game);
    if (!result.success) {
      throw new Error(result.error || 'Failed to set current game');
    }
  }

  public async deleteCurrentGame(hostId: string) {
    const result = await this.firebaseUtils.deleteData(hostId, 'currentGame');
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete current game');
    }
  }

  // Subscription for real-time updates
  public subscribeToCurrentGame(
    hostId: string, 
    callback: (game: Game.CurrentGame | null, error?: string) => void
  ): () => void {
    return this.firebaseUtils.subscribeToData<Game.CurrentGame>(
      hostId, 
      'currentGame', 
      callback
    );
  }

  // Settings Operations
  public async updateGameSettings(hostId: string, settings: Partial<Game.Settings>) {
    const result = await this.firebaseUtils.updateData(hostId, settings, 'currentGame/settings');
    if (!result.success) {
      throw new Error(result.error || 'Failed to update game settings');
    }
  }

  public async saveDefaultSettings(hostId: string, settings: Game.Settings) {
    const result = await this.firebaseUtils.setData(hostId, 'defaultSettings', settings);
    if (!result.success) {
      throw new Error(result.error || 'Failed to save default settings');
    }
  }

  public async getDefaultSettings(hostId: string): Promise<Game.Settings | null> {
    const result = await this.firebaseUtils.readData<Game.Settings>(hostId, 'defaultSettings');
    if (!result.success && result.error !== 'Data not found') {
      throw new Error(result.error || 'Failed to get default settings');
    }
    return result.data || null;
  }

  // Booking Operations
  public async updateBookings(hostId: string, bookings: Record<string, Game.Booking>) {
    const result = await this.firebaseUtils.updateData(hostId, bookings, 'currentGame/activeTickets/bookings');
    if (!result.success) {
      throw new Error(result.error || 'Failed to update bookings');
    }
  }

  public async updateTickets(hostId: string, tickets: Record<string, Game.Ticket>) {
    const result = await this.firebaseUtils.updateData(hostId, tickets, 'currentGame/activeTickets/tickets');
    if (!result.success) {
      throw new Error(result.error || 'Failed to update tickets');
    }
  }

  public async updatePlayer(hostId: string, playerId: string, player: Game.Player) {
    const result = await this.firebaseUtils.setData(hostId, `currentGame/players/${playerId}`, player);
    if (!result.success) {
      throw new Error(result.error || 'Failed to update player');
    }
  }

  public async updateBookingMetrics(hostId: string, metrics: Game.BookingMetrics) {
    const result = await this.firebaseUtils.setData(hostId, 'currentGame/bookingMetrics', metrics);
    if (!result.success) {
      throw new Error(result.error || 'Failed to update booking metrics');
    }
  }

  // Winners Operations
  public async updateWinners(hostId: string, winners: Partial<Game.Winners>) {
    const result = await this.firebaseUtils.updateData(hostId, winners, 'currentGame/gameState/winners');
    if (!result.success) {
      throw new Error(result.error || 'Failed to update winners');
    }
  }

  // History Operations
  public async saveGameToHistory(hostId: string, game: Game.CurrentGame) {
    const timestamp = Date.now();
    const gameSession: Game.GameSession = {
      ...game,
      id: timestamp.toString(),
      hostId,
      endTime: timestamp,
      endReason: 'Game completed'
    };

    const result = await this.firebaseUtils.setData(hostId, `sessions/${timestamp}`, gameSession);
    if (!result.success) {
      throw new Error(result.error || 'Failed to save game to history');
    }
  }

  public async getGameHistory(hostId: string): Promise<Record<string, Game.GameSession> | null> {
    const result = await this.firebaseUtils.readData<Record<string, Game.GameSession>>(hostId, 'sessions');
    if (!result.success && result.error !== 'Data not found') {
      throw new Error(result.error || 'Failed to get game history');
    }
    return result.data || null;
  }

  // Batch Operations for Complex Updates
  public async batchUpdateGameData(
    hostId: string,
    updates: {
      gameState?: Partial<Game.GameState>;
      numberSystem?: Partial<Game.NumberSystem>;
      bookings?: Record<string, Game.Booking>;
      tickets?: Record<string, Partial<Game.Ticket>>;
      metrics?: Game.BookingMetrics;
      players?: Record<string, Game.Player>;
    }
  ) {
    const operations: Array<{ hostId: string; path: string; data: any }> = [];

    if (updates.gameState) {
      Object.entries(updates.gameState).forEach(([key, value]) => {
        operations.push({
          hostId,
          path: `currentGame/gameState/${key}`,
          data: value
        });
      });
    }

    if (updates.numberSystem) {
      Object.entries(updates.numberSystem).forEach(([key, value]) => {
        operations.push({
          hostId,
          path: `currentGame/numberSystem/${key}`,
          data: value
        });
      });
    }

    if (updates.bookings) {
      Object.entries(updates.bookings).forEach(([ticketId, booking]) => {
        operations.push({
          hostId,
          path: `currentGame/activeTickets/bookings/${ticketId}`,
          data: booking
        });
      });
    }

    if (updates.tickets) {
      Object.entries(updates.tickets).forEach(([ticketId, ticket]) => {
        operations.push({
          hostId,
          path: `currentGame/activeTickets/tickets/${ticketId}`,
          data: ticket
        });
      });
    }

    if (updates.metrics) {
      operations.push({
        hostId,
        path: 'currentGame/bookingMetrics',
        data: updates.metrics
      });
    }

    if (updates.players) {
      Object.entries(updates.players).forEach(([playerId, player]) => {
        operations.push({
          hostId,
          path: `currentGame/players/${playerId}`,
          data: player
        });
      });
    }

    if (operations.length === 0) {
      return;
    }

    const result = await this.firebaseUtils.batchUpdate(operations);
    if (!result.success) {
      throw new Error(result.error || 'Failed to perform batch update');
    }
  }

  // Host Profile Operations
  public async updateHostProfile(hostId: string, updates: any) {
    const result = await this.firebaseUtils.updateData(hostId, updates);
    if (!result.success) {
      throw new Error(result.error || 'Failed to update host profile');
    }
  }

  public async getHostProfile(hostId: string): Promise<any> {
    const result = await this.firebaseUtils.readData(hostId, '');
    if (!result.success) {
      throw new Error(result.error || 'Failed to get host profile');
    }
    return result.data;
  }
}
