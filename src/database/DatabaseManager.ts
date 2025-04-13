import { FirebaseApp } from 'firebase/app';
import { 
  getDatabase, 
  ref, 
  set, 
  get,
  update,
  query,
  orderByChild,
  DatabaseReference,
  Database
} from 'firebase/database';
import { Auth } from 'firebase/auth';
import { app, auth, database } from '../lib/firebase';

interface HostData {
  email: string;
  lastLogin: number;
  role: 'host';
  status: 'active' | 'inactive';
  subscriptionEnd: number;
  username: string;
}

interface GameSettings {
  maxTickets: number;
  selectedTicketSet: number;
  callDelay: number;
  prizes: {
    quickFive: boolean;
    topLine: boolean;
    middleLine: boolean;
    bottomLine: boolean;
    corners: boolean;
    starCorners: boolean;
    halfSheet: boolean;
    fullSheet: boolean;
    fullHouse: boolean;
    secondFullHouse: boolean;
  };
}

export class DatabaseManager {
  private static instance: DatabaseManager | null = null;
  private readonly app: FirebaseApp;
  private readonly database: Database;
  private readonly auth: Auth;

  private constructor() {
    this.app = app;
    this.database = database;
    this.auth = auth;
  }

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  public getReference(path: string): DatabaseReference {
    try {
      return ref(this.database, path);
    } catch (error) {
      console.error('Error creating database reference:', error);
      throw new Error('Failed to create database reference');
    }
  }

  public async validateHostSubscription(hostId: string): Promise<boolean> {
    try {
      const hostRef = this.getReference(`hosts/${hostId}`);
      const snapshot = await get(hostRef);
      
      if (!snapshot.exists()) {
        return false;
      }

      const hostData = snapshot.val() as HostData;
      return hostData.status === 'active' && hostData.subscriptionEnd > Date.now();
    } catch (error) {
      console.error('Failed to validate host subscription:', error);
      return false;
    }
  }

  public async updateLastLogin(hostId: string): Promise<void> {
    try {
      const hostRef = this.getReference(`hosts/${hostId}/lastLogin`);
      await set(hostRef, Date.now());
    } catch (error) {
      console.error('Error updating last login:', error);
      throw new Error('Failed to update last login timestamp');
    }
  }

  public async getHostData(hostId: string): Promise<HostData | null> {
    try {
      const hostRef = this.getReference(`hosts/${hostId}`);
      const snapshot = await get(hostRef);
      
      if (!snapshot.exists()) {
        return null;
      }

      return snapshot.val() as HostData;
    } catch (error) {
      console.error('Error fetching host data:', error);
      throw new Error('Failed to fetch host data');
    }
  }

  public async createGameSession(hostId: string, settings: GameSettings): Promise<void> {
    try {
      const gameRef = this.getReference(`hosts/${hostId}/currentGame`);
      await set(gameRef, {
        settings,
        status: 'active',
        startTime: Date.now(),
        calledNumbers: [],
        winners: {}
      });
    } catch (error) {
      console.error('Error creating game session:', error);
      throw new Error('Failed to create game session');
    }
  }

  public async updateGameSettings(hostId: string, settings: Partial<GameSettings>): Promise<void> {
    try {
      const settingsRef = this.getReference(`hosts/${hostId}/currentGame/settings`);
      await update(settingsRef, settings);
    } catch (error) {
      console.error('Error updating game settings:', error);
      throw new Error('Failed to update game settings');
    }
  }

  public async addCalledNumber(hostId: string, number: number): Promise<void> {
    try {
      const gameRef = this.getReference(`hosts/${hostId}/currentGame`);
      const snapshot = await get(gameRef);
      
      if (!snapshot.exists()) {
        throw new Error('No active game session found');
      }

      const currentGame = snapshot.val();
      const calledNumbers = currentGame.calledNumbers || [];
      
      if (calledNumbers.includes(number)) {
        throw new Error('Number has already been called');
      }

      await update(gameRef, {
        calledNumbers: [...calledNumbers, number],
        lastCalledNumber: number,
        lastCalledTime: Date.now()
      });
    } catch (error) {
      console.error('Error adding called number:', error);
      throw new Error('Failed to add called number');
    }
  }

  public async endGameSession(hostId: string): Promise<void> {
    try {
      const gameRef = this.getReference(`hosts/${hostId}/currentGame`);
      const snapshot = await get(gameRef);
      
      if (!snapshot.exists()) {
        throw new Error('No active game session found');
      }

      const currentGame = snapshot.val();
      const historyRef = this.getReference(`hosts/${hostId}/gameHistory/${Date.now()}`);
      
      await set(historyRef, {
        ...currentGame,
        endTime: Date.now(),
        status: 'completed'
      });

      await set(gameRef, null);
    } catch (error) {
      console.error('Error ending game session:', error);
      throw new Error('Failed to end game session');
    }
  }

  public getDatabaseInstance(): Database {
    return this.database;
  }

  public getAuth(): Auth {
    return this.auth;
  }
}