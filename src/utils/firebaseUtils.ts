// src/utils/firebaseUtils.ts
import { ref, update, get, set, remove, onValue, off, Database } from 'firebase/database';
import { database } from '../lib/firebase';
import type { Game } from '../types/game';

export interface FirebaseUpdateResult {
  success: boolean;
  error?: string;
}

export interface FirebaseReadResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class FirebaseUtils {
  private static instance: FirebaseUtils;
  private db: Database;

  private constructor() {
    this.db = database;
  }

  public static getInstance(): FirebaseUtils {
    if (!FirebaseUtils.instance) {
      FirebaseUtils.instance = new FirebaseUtils();
    }
    return FirebaseUtils.instance;
  }

  /**
   * Generate standardized Firebase path
   */
  private getPath(hostId: string, ...segments: string[]): string {
    return `hosts/${hostId}/${segments.join('/')}`;
  }

  /**
   * Centralized update operation with error handling
   */
  public async updateData(
    hostId: string,
    updates: Record<string, any>,
    pathPrefix?: string
  ): Promise<FirebaseUpdateResult> {
    try {
      if (!hostId) {
        throw new Error('Host ID is required for database operations');
      }

      const formattedUpdates: Record<string, any> = {};
      
      Object.entries(updates).forEach(([key, value]) => {
        const fullPath = pathPrefix 
          ? this.getPath(hostId, pathPrefix, key)
          : this.getPath(hostId, key);
        formattedUpdates[fullPath] = value;
      });

      await update(ref(this.db), formattedUpdates);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Database update failed';
      console.error('Firebase update error:', error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Centralized read operation with error handling
   */
  public async readData<T>(
    hostId: string,
    path: string
  ): Promise<FirebaseReadResult<T>> {
    try {
      if (!hostId) {
        throw new Error('Host ID is required for database operations');
      }

      const fullPath = this.getPath(hostId, path);
      const snapshot = await get(ref(this.db, fullPath));
      
      if (!snapshot.exists()) {
        return { success: false, error: 'Data not found' };
      }

      return { success: true, data: snapshot.val() as T };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Database read failed';
      console.error('Firebase read error:', error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Centralized set operation with error handling
   */
  public async setData(
    hostId: string,
    path: string,
    data: any
  ): Promise<FirebaseUpdateResult> {
    try {
      if (!hostId) {
        throw new Error('Host ID is required for database operations');
      }

      const fullPath = this.getPath(hostId, path);
      await set(ref(this.db, fullPath), data);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Database set failed';
      console.error('Firebase set error:', error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Centralized delete operation with error handling
   */
  public async deleteData(
    hostId: string,
    path: string
  ): Promise<FirebaseUpdateResult> {
    try {
      if (!hostId) {
        throw new Error('Host ID is required for database operations');
      }

      const fullPath = this.getPath(hostId, path);
      await remove(ref(this.db, fullPath));
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Database delete failed';
      console.error('Firebase delete error:', error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Centralized subscription with automatic cleanup
   */
  public subscribeToData<T>(
    hostId: string,
    path: string,
    callback: (data: T | null, error?: string) => void
  ): () => void {
    if (!hostId) {
      callback(null, 'Host ID is required for database operations');
      return () => {};
    }

    const fullPath = this.getPath(hostId, path);
    const dbRef = ref(this.db, fullPath);

    const unsubscribe = onValue(
      dbRef,
      (snapshot) => {
        try {
          const data = snapshot.exists() ? snapshot.val() as T : null;
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
      off(dbRef, 'value', unsubscribe);
    };
  }

  /**
   * Batch update multiple paths atomically
   */
  public async batchUpdate(
    operations: Array<{
      hostId: string;
      path: string;
      data: any;
    }>
  ): Promise<FirebaseUpdateResult> {
    try {
      const updates: Record<string, any> = {};

      operations.forEach(({ hostId, path, data }) => {
        if (!hostId) {
          throw new Error('Host ID is required for all batch operations');
        }
        const fullPath = this.getPath(hostId, path);
        updates[fullPath] = data;
      });

      await update(ref(this.db), updates);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Batch update failed';
      console.error('Firebase batch update error:', error);
      return { success: false, error: errorMessage };
    }
  }
}
