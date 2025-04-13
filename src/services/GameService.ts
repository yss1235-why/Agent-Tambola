// src/services/GameService.ts

import { ref, update, get, onValue } from 'firebase/database';
import { database } from '../lib/firebase';
import { AudioManager } from '../utils/audioManager';
import type { Game } from '../types/game';

interface GameServiceCallbacks {
  onNumberCalled?: (number: number) => void;
  onPrizeWon?: (prizeType: keyof Game.Winners, ticketIds: string[]) => void;
  onQueueChanged?: (queue: number[]) => void;
  onGameComplete?: () => void;
  onError?: (error: string) => void;
}

export class GameService {
  private static instance: GameService;
  private hostId: string | null = null;
  private audioManager: AudioManager;
  private autoModeInterval: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;
  private callbacks: GameServiceCallbacks = {};
  private isPaused: boolean = false;
  
  private constructor() {
    this.audioManager = AudioManager.getInstance();
  }
  
  public static getInstance(): GameService {
    if (!GameService.instance) {
      GameService.instance = new GameService();
    }
    return GameService.instance;
  }
  
  public initialize(hostId: string, callbacks: GameServiceCallbacks = {}): void {
    this.hostId = hostId;
    this.callbacks = callbacks;
  }
  
  // Auto-calling functionality
  public async startAutoCalling(callDelay: number): Promise<void> {
    if (!this.hostId) {
      throw new Error('Host ID not set');
    }
    
    // Stop any existing auto-calling
    this.stopAutoCalling();
    
    try {
      // Update Firebase state
      await update(ref(database, `hosts/${this.hostId}/currentGame/gameState`), {
        isAutoCalling: true
      });
      
      this.isPaused = false;
      
      // Start by generating first number immediately
      await this.generateAndCallNumber();
      
      // Set up interval
      this.autoModeInterval = setInterval(async () => {
        if (!this.isProcessing && !this.isPaused) {
          try {
            await this.generateAndCallNumber();
          } catch (error) {
            console.error('Error during auto-calling:', error);
            this.callbacks.onError?.(error instanceof Error ? 
              error.message : 'Unknown error during auto-calling');
          }
        }
      }, callDelay * 1000);
    } catch (error) {
      this.callbacks.onError?.(error instanceof Error ? 
        error.message : 'Failed to start auto mode');
      throw error;
    }
  }
  
  public stopAutoCalling(): void {
    if (this.autoModeInterval) {
      clearInterval(this.autoModeInterval);
      this.autoModeInterval = null;
    }
    
    if (this.hostId) {
      update(ref(database, `hosts/${this.hostId}/currentGame/gameState`), {
        isAutoCalling: false
      }).catch(error => {
        console.error('Error updating auto-calling state:', error);
      });
    }
  }
  
  // Queue management
  public async addToQueue(number: number): Promise<boolean> {
    if (!this.hostId) {
      throw new Error('Host ID not set');
    }
    
    if (this.isProcessing) {
      return false;
    }
    
    try {
      const gameRef = ref(database, `hosts/${this.hostId}/currentGame`);
      const snapshot = await get(gameRef);
      
      if (!snapshot.exists()) {
        throw new Error('No active game found');
      }
      
      const game = snapshot.val() as Game.CurrentGame;
      const calledNumbers = game.numberSystem?.calledNumbers || [];
      const queue = game.numberSystem?.queue || [];
      
      // Validate the number
      if (this.validateNumber(number, calledNumbers, queue)) {
        const updatedQueue = [...queue, number];
        
        // Update the queue
        await update(ref(database, `hosts/${this.hostId}/currentGame/numberSystem`), {
          queue: updatedQueue
        });
        
        this.callbacks.onQueueChanged?.(updatedQueue);
        
        // Start processing if queue was empty
        if (queue.length === 0 && !this.isPaused) {
          setTimeout(() => this.processQueue(), 100);
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      this.callbacks.onError?.(error instanceof Error ? 
        error.message : 'Failed to add number to queue');
      return false;
    }
  }
  
  private validateNumber(number: number, calledNumbers: number[], queue: number[]): boolean {
    // Check range
    if (number < 1 || number > 90) {
      this.callbacks.onError?.('Invalid number: must be between 1 and 90');
      return false;
    }
    
    // Check if already called
    if (calledNumbers.includes(number)) {
      this.callbacks.onError?.('Number has already been called');
      return false;
    }
    
    // Check if in queue
    if (queue.includes(number)) {
      this.callbacks.onError?.('Number is already in the queue');
      return false;
    }
    
    // Check queue size
    if (queue.length >= 10) {
      this.callbacks.onError?.('Queue is full (maximum 10 numbers)');
      return false;
    }
    
    return true;
  }
  
  public async processQueue(): Promise<void> {
    if (!this.hostId || this.isProcessing || this.isPaused) {
      return;
    }
    
    this.isProcessing = true;
    
    try {
      const gameRef = ref(database, `hosts/${this.hostId}/currentGame`);
      const snapshot = await get(gameRef);
      
      if (!snapshot.exists()) {
        this.isProcessing = false;
        return;
      }
      
      const game = snapshot.val() as Game.CurrentGame;
      const queue = game.numberSystem?.queue || [];
      
      if (queue.length === 0) {
        this.isProcessing = false;
        return;
      }
      
      // Get next number from queue
      const nextNumber = queue[0];
      const remainingQueue = queue.slice(1);
      const calledNumbers = [...(game.numberSystem?.calledNumbers || []), nextNumber];
      
      // Update database
      await update(ref(database, `hosts/${this.hostId}/currentGame/numberSystem`), {
        currentNumber: nextNumber,
        calledNumbers: calledNumbers,
        queue: remainingQueue
      });
      
      // Announce the number
      if (game.gameState.soundEnabled) {
        await this.audioManager.announceNumber(nextNumber);
      }
      
      this.callbacks.onNumberCalled?.(nextNumber);
      this.callbacks.onQueueChanged?.(remainingQueue);
      
      // Validate prizes
      await this.validatePrizes(game, calledNumbers);
      
      this.isProcessing = false;
      
      // Continue processing if there are more numbers
      if (remainingQueue.length > 0 && !this.isPaused) {
        const callDelay = game.settings?.callDelay || 5;
        setTimeout(() => this.processQueue(), callDelay * 1000);
      }
    } catch (error) {
      this.callbacks.onError?.(error instanceof Error ? 
        error.message : 'Failed to process queue');
      this.isProcessing = false;
    }
  }
  
  private async generateAndCallNumber(): Promise<void> {
    if (!this.hostId) {
      throw new Error('Host ID not set');
    }
    
    if (this.isProcessing) {
      return;
    }
    
    this.isProcessing = true;
    
    try {
      const gameRef = ref(database, `hosts/${this.hostId}/currentGame`);
      const snapshot = await get(gameRef);
      
      if (!snapshot.exists()) {
        throw new Error('No active game found');
      }
      
      const game = snapshot.val() as Game.CurrentGame;
      const calledNumbers = game.numberSystem?.calledNumbers || [];
      
      // Check if all numbers have been called
      if (calledNumbers.length >= 90) {
        await this.completeGame();
        return;
      }
      
      // Generate random number
      const availableNumbers = Array.from({ length: 90 }, (_, i) => i + 1)
        .filter(n => !calledNumbers.includes(n));
      
      if (availableNumbers.length === 0) {
        await this.completeGame();
        return;
      }
      
      const randomIndex = Math.floor(Math.random() * availableNumbers.length);
      const nextNumber = availableNumbers[randomIndex];
      const updatedCalledNumbers = [...calledNumbers, nextNumber];
      
      // Update database
      await update(ref(database, `hosts/${this.hostId}/currentGame/numberSystem`), {
        currentNumber: nextNumber,
        calledNumbers: updatedCalledNumbers
      });
      
      // Announce the number
      if (game.gameState.soundEnabled) {
        await this.audioManager.announceNumber(nextNumber);
      }
      
      this.callbacks.onNumberCalled?.(nextNumber);
      
      // Validate prizes
      await this.validatePrizes(game, updatedCalledNumbers);
      
      this.isProcessing = false;
    } catch (error) {
      this.callbacks.onError?.(error instanceof Error ? 
        error.message : 'Failed to generate and call number');
      this.isProcessing = false;
    }
  }
  
  public async clearQueue(): Promise<boolean> {
    if (!this.hostId) {
      return false;
    }
    
    try {
      await update(ref(database, `hosts/${this.hostId}/currentGame/numberSystem`), {
        queue: []
      });
      
      this.callbacks.onQueueChanged?.([]);
      return true;
    } catch (error) {
      this.callbacks.onError?.(error instanceof Error ? 
        error.message : 'Failed to clear queue');
      return false;
    }
  }
  
  // Game state control
  public async pauseGame(): Promise<void> {
    if (!this.hostId) {
      return;
    }
    
    this.isPaused = true;
    
    if (this.autoModeInterval) {
      clearInterval(this.autoModeInterval);
      this.autoModeInterval = null;
    }
    
    try {
      await update(ref(database, `hosts/${this.hostId}/currentGame/gameState`), {
        status: 'paused',
        isAutoCalling: false
      });
    } catch (error) {
      this.callbacks.onError?.(error instanceof Error ? 
        error.message : 'Failed to pause game');
    }
  }
  
  public async resumeGame(): Promise<void> {
    if (!this.hostId) {
      return;
    }
    
    this.isPaused = false;
    
    try {
      await update(ref(database, `hosts/${this.hostId}/currentGame/gameState`), {
        status: 'active'
      });
      
      const gameRef = ref(database, `hosts/${this.hostId}/currentGame`);
      const snapshot = await get(gameRef);
      
      if (snapshot.exists()) {
        const game = snapshot.val() as Game.CurrentGame;
        
        // Resume queue processing if there are numbers in queue
        if ((game.numberSystem?.queue?.length || 0) > 0) {
          this.processQueue();
        }
      }
    } catch (error) {
      this.callbacks.onError?.(error instanceof Error ? 
        error.message : 'Failed to resume game');
    }
  }
  
  public async completeGame(): Promise<void> {
    if (!this.hostId) {
      return;
    }
    
    // Stop auto-calling
    this.stopAutoCalling();
    
    try {
      const gameRef = ref(database, `hosts/${this.hostId}/currentGame`);
      const snapshot = await get(gameRef);
      
      if (!snapshot.exists()) {
        throw new Error('No active game found');
      }
      
      const game = snapshot.val() as Game.CurrentGame;
      const timestamp = Date.now();
      
      // Update game state
      await update(ref(database, `hosts/${this.hostId}/currentGame/gameState`), {
        phase: 4, // Completed phase
        status: 'ended',
        isAutoCalling: false
      });
      
      // Create history entry
      await update(ref(database, `hosts/${this.hostId}/gameHistory/${timestamp}`), {
        ...game,
        endTime: timestamp,
        endReason: 'Game completed'
      });
      
      this.callbacks.onGameComplete?.();
    } catch (error) {
      this.callbacks.onError?.(error instanceof Error ? 
        error.message : 'Failed to complete game');
    }
  }
  
  // Prize validation
  private async validatePrizes(game: Game.CurrentGame, calledNumbers: number[]): Promise<void> {
    try {
      const tickets = game.activeTickets?.tickets || {};
      const winners = game.gameState?.winners || {};
      const activePrizes = game.settings?.prizes || {};
      
      // For a real implementation, you would need detailed validation logic here
      // This is a simplified version
      
      // Check all prize types
      const prizeTypes: Array<keyof Game.Winners> = [
        'quickFive', 'topLine', 'middleLine', 'bottomLine', 'corners',
        'starCorners', 'halfSheet', 'fullSheet', 'fullHouse', 'secondFullHouse'
      ];
      
      let hasNewWinners = false;
      const updates: Partial<Game.Winners> = {};
      
      for (const prizeType of prizeTypes) {
        // Skip if prize not active or already claimed (except secondFullHouse)
        if (!activePrizes[prizeType] || 
            (winners[prizeType]?.length > 0 && prizeType !== 'secondFullHouse')) {
          continue;
        }
        
        // Check for winners
        // This would contain detailed validation logic for each prize type
        const winningTickets: string[] = [];
        
        if (winningTickets.length > 0) {
          hasNewWinners = true;
          updates[prizeType] = [
            ...(winners[prizeType] || []),
            ...winningTickets
          ];
          this.callbacks.onPrizeWon?.(prizeType, winningTickets);
        }
      }
      
      if (hasNewWinners && this.hostId) {
        await update(ref(database, `hosts/${this.hostId}/currentGame/gameState/winners`), 
          updates);
      }
    } catch (error) {
      console.error('Error validating prizes:', error);
    }
  }
  
  public cleanup(): void {
    this.stopAutoCalling();
    this.hostId = null;
    this.isProcessing = false;
    this.isPaused = false;
    this.callbacks = {};
  }
}