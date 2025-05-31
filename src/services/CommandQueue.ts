// src/services/CommandQueue.ts
// Command queue implementation for sequential command processing
// This ensures only one command executes at a time, preventing race conditions

import { GameCommand, CommandResult, CommandPriority, PriorityCommand, CommandStats, CommandError, CommandErrorType } from '../types/commands';

interface QueueItem {
  command: GameCommand;
  priority: CommandPriority;
  timestamp: number;
  retryCount: number;
}

export class CommandQueue {
  private static instance: CommandQueue;
  private queue: QueueItem[] = [];
  private processing = false;
  private listeners: Set<(result: CommandResult) => void> = new Set();
  private errorListeners: Set<(error: CommandError) => void> = new Set();
  private stats: CommandStats = {
    totalExecuted: 0,
    totalFailed: 0,
    averageExecutionTime: 0,
    lastExecutionTime: 0
  };
  
  // Configuration
  private readonly MAX_QUEUE_SIZE = 100;
  private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second
  
  private constructor() {
    // Bind methods to ensure correct 'this' context
    this.processQueue = this.processQueue.bind(this);
    this.executeCommand = this.executeCommand.bind(this);
  }
  
  public static getInstance(): CommandQueue {
    if (!CommandQueue.instance) {
      CommandQueue.instance = new CommandQueue();
    }
    return CommandQueue.instance;
  }
  
  /**
   * Add a command to the queue
   */
  public enqueue(command: GameCommand, priority: CommandPriority = CommandPriority.NORMAL): boolean {
    // Check queue size limit
    if (this.queue.length >= this.MAX_QUEUE_SIZE) {
      console.warn(`⚠️ Command queue is full (${this.MAX_QUEUE_SIZE}), dropping command: ${command.type}`);
      this.notifyError({
        type: CommandErrorType.EXECUTION_ERROR,
        message: 'Command queue is full',
        command,
        timestamp: Date.now()
      });
      return false;
    }
    
    const queueItem: QueueItem = {
      command,
      priority,
      timestamp: Date.now(),
      retryCount: 0
    };
    
    // Insert based on priority (higher priority first)
    const insertIndex = this.queue.findIndex(item => item.priority < priority);
    if (insertIndex === -1) {
      this.queue.push(queueItem);
    } else {
      this.queue.splice(insertIndex, 0, queueItem);
    }
    
    console.log(`📝 Enqueued command: ${command.type} (priority: ${priority}, queue size: ${this.queue.length})`);
    
    // Start processing if not already processing
    if (!this.processing) {
      // Use setTimeout to ensure this doesn't block the current call
      setTimeout(this.processQueue, 0);
    }
    
    return true;
  }
  
  /**
   * Add a listener for command results
   */
  public addListener(listener: (result: CommandResult) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  /**
   * Add a listener for command errors
   */
  public addErrorListener(listener: (error: CommandError) => void): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }
  
  /**
   * Process the command queue sequentially
   */
  private async processQueue(): Promise<void> {
    if (this.processing) {
      console.log('🔄 Queue processing already in progress');
      return;
    }
    
    if (this.queue.length === 0) {
      console.log('📭 Queue is empty, nothing to process');
      return;
    }
    
    this.processing = true;
    console.log(`🚀 Starting queue processing with ${this.queue.length} commands`);
    
    while (this.queue.length > 0) {
      const queueItem = this.queue.shift()!;
      const { command } = queueItem;
      
      try {
        console.log(`⚡ Processing command: ${command.type} (${command.id})`);
        const startTime = Date.now();
        
        const result = await this.executeCommand(command);
        
        const executionTime = Date.now() - startTime;
        this.updateStats(true, executionTime);
        
        console.log(`✅ Command completed: ${command.type} (${executionTime}ms)`);
        this.notifyListeners(result);
        
        if (!result.success) {
          console.error(`❌ Command failed: ${command.type}`, result.error);
          
          // Check if we should retry
          if (queueItem.retryCount < this.MAX_RETRIES && this.shouldRetry(command, result)) {
            queueItem.retryCount++;
            console.log(`🔄 Retrying command ${command.type} (attempt ${queueItem.retryCount}/${this.MAX_RETRIES})`);
            
            // Add back to queue with delay
            setTimeout(() => {
              this.queue.unshift(queueItem);
            }, this.RETRY_DELAY * queueItem.retryCount);
          } else {
            // Max retries exceeded or not retryable
            this.notifyError({
              type: CommandErrorType.EXECUTION_ERROR,
              message: result.error || 'Command execution failed',
              command,
              timestamp: Date.now()
            });
          }
        }
        
        // Small delay between commands to prevent overwhelming Firebase
        if (this.queue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        
      } catch (error) {
        const executionTime = Date.now() - Date.now();
        this.updateStats(false, executionTime);
        
        console.error(`💥 Command execution error: ${command.type}`, error);
        
        const commandError: CommandError = {
          type: CommandErrorType.EXECUTION_ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
          command,
          timestamp: Date.now(),
          stack: error instanceof Error ? error.stack : undefined
        };
        
        this.notifyError(commandError);
        this.notifyListeners({
          success: false,
          command,
          error: commandError.message,
          timestamp: Date.now()
        });
      }
    }
    
    this.processing = false;
    console.log('🏁 Queue processing completed');
  }
  
  /**
   * Execute a single command
   */
  private async executeCommand(command: GameCommand): Promise<CommandResult> {
    // Dynamic import to avoid circular dependencies
    const { CommandProcessor } = await import('./CommandProcessor');
    const processor = CommandProcessor.getInstance();
    
    // Execute with timeout
    return this.executeWithTimeout(
      () => processor.execute(command),
      this.DEFAULT_TIMEOUT
    );
  }
  
  /**
   * Execute a function with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Command execution timed out after ${timeout}ms`));
      }, timeout);
      
      fn()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
  
  /**
   * Determine if a command should be retried based on the error
   */
  private shouldRetry(command: GameCommand, result: CommandResult): boolean {
    if (!result.error) return false;
    
    // Don't retry validation errors
    if (result.error.includes('validation') || result.error.includes('invalid')) {
      return false;
    }
    
    // Don't retry duplicate operations
    if (result.error.includes('already') || result.error.includes('duplicate')) {
      return false;
    }
    
    // Retry network and temporary errors
    if (result.error.includes('network') || 
        result.error.includes('timeout') || 
        result.error.includes('temporary') ||
        result.error.includes('503') ||
        result.error.includes('502')) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Update execution statistics
   */
  private updateStats(success: boolean, executionTime: number): void {
    this.stats.totalExecuted++;
    this.stats.lastExecutionTime = executionTime;
    
    if (!success) {
      this.stats.totalFailed++;
    }
    
    // Update average execution time (simple moving average)
    this.stats.averageExecutionTime = 
      (this.stats.averageExecutionTime * (this.stats.totalExecuted - 1) + executionTime) / 
      this.stats.totalExecuted;
  }
  
  /**
   * Notify all listeners of command results
   */
  private notifyListeners(result: CommandResult): void {
    this.listeners.forEach(listener => {
      try {
        listener(result);
      } catch (error) {
        console.error('Error in command result listener:', error);
      }
    });
  }
  
  /**
   * Notify all error listeners
   */
  private notifyError(error: CommandError): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (err) {
        console.error('Error in command error listener:', err);
      }
    });
  }
  
  /**
   * Get current queue length
   */
  public getQueueLength(): number {
    return this.queue.length;
  }
  
  /**
   * Check if queue is currently processing
   */
  public isProcessing(): boolean {
    return this.processing;
  }
  
  /**
   * Get execution statistics
   */
  public getStats(): CommandStats {
    return { ...this.stats };
  }
  
  /**
   * Clear the queue (emergency use only)
   */
  public clearQueue(): number {
    const clearedCount = this.queue.length;
    this.queue = [];
    console.warn(`🗑️ Cleared ${clearedCount} commands from queue`);
    return clearedCount;
  }
  
  /**
   * Get queue snapshot for debugging
   */
  public getQueueSnapshot(): Array<{ type: string; priority: CommandPriority; timestamp: number; retryCount: number }> {
    return this.queue.map(item => ({
      type: item.command.type,
      priority: item.priority,
      timestamp: item.timestamp,
      retryCount: item.retryCount
    }));
  }
  
  /**
   * Pause queue processing
   */
  public pause(): void {
    console.log('⏸️ Pausing command queue');
    this.processing = false;
  }
  
  /**
   * Resume queue processing
   */
  public resume(): void {
    console.log('▶️ Resuming command queue');
    if (this.queue.length > 0) {
      setTimeout(this.processQueue, 0);
    }
  }
  
  /**
   * Health check for the queue
   */
  public healthCheck(): { healthy: boolean; issues: string[] } {
    const issues: string[] = [];
    
    if (this.queue.length >= this.MAX_QUEUE_SIZE * 0.8) {
      issues.push(`Queue is ${Math.round((this.queue.length / this.MAX_QUEUE_SIZE) * 100)}% full`);
    }
    
    if (this.stats.totalFailed > 0 && this.stats.totalFailed / this.stats.totalExecuted > 0.1) {
      issues.push(`High failure rate: ${Math.round((this.stats.totalFailed / this.stats.totalExecuted) * 100)}%`);
    }
    
    if (this.stats.averageExecutionTime > 5000) {
      issues.push(`Slow average execution time: ${Math.round(this.stats.averageExecutionTime)}ms`);
    }
    
    // Check for stuck processing
    const oldestQueueItem = this.queue[0];
    if (oldestQueueItem && Date.now() - oldestQueueItem.timestamp > 60000) {
      issues.push('Queue appears to be stuck');
    }
    
    return {
      healthy: issues.length === 0,
      issues
    };
  }
  
  /**
   * Cleanup method for shutdown
   */
  public cleanup(): void {
    console.log('🧹 Cleaning up command queue');
    this.pause();
    this.clearQueue();
    this.listeners.clear();
    this.errorListeners.clear();
    
    // Reset stats
    this.stats = {
      totalExecuted: 0,
      totalFailed: 0,
      averageExecutionTime: 0,
      lastExecutionTime: 0
    };
  }
  
  /**
   * Debug method to log queue state
   */
  public debugLog(): void {
    console.log('🔍 Command Queue Debug Info:', {
      queueLength: this.queue.length,
      processing: this.processing,
      stats: this.stats,
      listeners: this.listeners.size,
      errorListeners: this.errorListeners.size,
      queue: this.getQueueSnapshot(),
      health: this.healthCheck()
    });
  }
}
