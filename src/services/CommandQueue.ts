// src/services/CommandQueue.ts - PROPER FIX (No manual overrides or long timeouts)
// Fixed: Race conditions, proper async handling, immediate state reset

import { GameCommand, CommandResult, CommandPriority, CommandStats, CommandError, CommandErrorType } from '../types/commands';

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
  private currentCommand: GameCommand | null = null;
  private listeners: Set<(result: CommandResult) => void> = new Set();
  private errorListeners: Set<(error: CommandError) => void> = new Set();
  private stats: CommandStats = {
    totalExecuted: 0,
    totalFailed: 0,
    averageExecutionTime: 0,
    lastExecutionTime: 0
  };
  
  // PROPER FIX: Reduced timeouts and better limits
  private readonly MAX_QUEUE_SIZE = 20; // Reduced from 100
  private readonly COMMAND_TIMEOUT = 8000; // 8 seconds max per command
  private readonly MAX_RETRIES = 1; // Only 1 retry
  private readonly RETRY_DELAY = 1000; // 1 second retry delay
  
  // PROPER FIX: Abort controller for canceling operations
  private currentAbortController: AbortController | null = null;
  
  private constructor() {
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
   * PROPER FIX: Enqueue with immediate validation and cleanup
   */
  public enqueue(command: GameCommand, priority: CommandPriority = CommandPriority.NORMAL): boolean {
    try {
      // PROPER FIX: Reject if queue is too full (prevent memory buildup)
      if (this.queue.length >= this.MAX_QUEUE_SIZE) {
        console.warn(`❌ Queue full, rejecting command: ${command.type}`);
        this.notifyError({
          type: CommandErrorType.EXECUTION_ERROR,
          message: 'System is busy. Please try again in a moment.',
          command,
          timestamp: Date.now()
        });
        return false;
      }
      
      // PROPER FIX: Check for duplicate commands (prevent spam)
      const isDuplicate = this.queue.some(item => 
        item.command.type === command.type && 
        JSON.stringify(item.command.payload) === JSON.stringify(command.payload) &&
        Date.now() - item.timestamp < 2000 // Within 2 seconds
      );
      
      if (isDuplicate) {
        console.warn(`❌ Duplicate command rejected: ${command.type}`);
        return false;
      }
      
      const queueItem: QueueItem = {
        command,
        priority,
        timestamp: Date.now(),
        retryCount: 0
      };
      
      // Insert based on priority
      const insertIndex = this.queue.findIndex(item => item.priority < priority);
      if (insertIndex === -1) {
        this.queue.push(queueItem);
      } else {
        this.queue.splice(insertIndex, 0, queueItem);
      }
      
      console.log(`✅ Command enqueued: ${command.type} (queue: ${this.queue.length})`);
      
      // PROPER FIX: Start processing immediately with proper state check
      this.startProcessing();
      
      return true;
    } catch (error) {
      console.error(`❌ Enqueue error:`, error);
      return false;
    }
  }
  
  /**
   * PROPER FIX: Safe processing start with state validation
   */
  private startProcessing(): void {
    if (this.processing) {
      console.log('⏳ Already processing, skipping start');
      return;
    }
    
    if (this.queue.length === 0) {
      console.log('📭 Queue empty, nothing to process');
      return;
    }
    
    // Start processing immediately
    setImmediate(() => this.processQueue());
  }
  
  /**
   * PROPER FIX: Sequential processing with proper error handling
   */
  private async processQueue(): Promise<void> {
    // PROPER FIX: Double-check processing state to prevent race conditions
    if (this.processing) {
      console.log('⚠️ Process queue called but already processing');
      return;
    }
    
    if (this.queue.length === 0) {
      console.log('📭 Queue became empty during processing start');
      return;
    }
    
    this.processing = true;
    console.log(`🚀 Starting queue processing (${this.queue.length} commands)`);
    
    try {
      // PROPER FIX: Process commands one by one with proper cleanup
      while (this.queue.length > 0) {
        const queueItem = this.queue.shift()!;
        this.currentCommand = queueItem.command;
        
        try {
          console.log(`⚡ Processing: ${queueItem.command.type}`);
          const startTime = Date.now();
          
          // PROPER FIX: Execute with timeout and abort controller
          const result = await this.executeCommandWithProperTimeout(queueItem.command);
          
          const executionTime = Date.now() - startTime;
          this.updateStats(result.success, executionTime);
          
          console.log(`✅ Completed: ${queueItem.command.type} (${executionTime}ms)`);
          
          // PROPER FIX: Always notify listeners, success or failure
          this.notifyListeners(result);
          
          if (!result.success && this.shouldRetry(queueItem.command, result)) {
            if (queueItem.retryCount < this.MAX_RETRIES) {
              queueItem.retryCount++;
              console.log(`🔄 Retrying: ${queueItem.command.type} (${queueItem.retryCount}/${this.MAX_RETRIES})`);
              
              // PROPER FIX: Add retry to front of queue with delay
              setTimeout(() => {
                this.queue.unshift(queueItem);
                // Only restart processing if not already processing
                if (!this.processing) {
                  this.startProcessing();
                }
              }, this.RETRY_DELAY);
            } else {
              console.error(`❌ Max retries exceeded: ${queueItem.command.type}`);
              this.notifyError({
                type: CommandErrorType.EXECUTION_ERROR,
                message: result.error || 'Command failed after retries',
                command: queueItem.command,
                timestamp: Date.now()
              });
            }
          }
          
        } catch (error) {
          // PROPER FIX: Handle unexpected errors properly
          const executionTime = Date.now() - Date.now();
          this.updateStats(false, executionTime);
          
          console.error(`💥 Command error: ${queueItem.command.type}`, error);
          
          const commandError: CommandError = {
            type: CommandErrorType.EXECUTION_ERROR,
            message: error instanceof Error ? error.message : 'Unexpected error',
            command: queueItem.command,
            timestamp: Date.now(),
            stack: error instanceof Error ? error.stack : undefined
          };
          
          this.notifyError(commandError);
          this.notifyListeners({
            success: false,
            command: queueItem.command,
            error: commandError.message,
            timestamp: Date.now()
          });
        }
        
        // PROPER FIX: Small delay between commands to prevent overwhelming Firebase
        if (this.queue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      
    } catch (error) {
      console.error(`💥 Fatal error in processQueue:`, error);
    } finally {
      // PROPER FIX: Always reset processing state
      this.processing = false;
      this.currentCommand = null;
      
      // PROPER FIX: Cancel any pending abort controller
      if (this.currentAbortController) {
        this.currentAbortController.abort();
        this.currentAbortController = null;
      }
      
      console.log(`🏁 Queue processing completed`);
      
      // PROPER FIX: Notify UI immediately about completion
      this.notifyProcessingComplete();
    }
  }
  
  /**
   * PROPER FIX: Execute command with proper timeout and cancellation
   */
  private async executeCommandWithProperTimeout(command: GameCommand): Promise<CommandResult> {
    return new Promise<CommandResult>(async (resolve, reject) => {
      // PROPER FIX: Create abort controller for this command
      this.currentAbortController = new AbortController();
      const timeoutId = setTimeout(() => {
        if (this.currentAbortController) {
          this.currentAbortController.abort();
          reject(new Error(`Command ${command.type} timed out after ${this.COMMAND_TIMEOUT}ms`));
        }
      }, this.COMMAND_TIMEOUT);
      
      try {
        // PROPER FIX: Execute with abort signal
        const result = await this.executeCommand(command, this.currentAbortController.signal);
        
        // PROPER FIX: Clear timeout on success
        clearTimeout(timeoutId);
        this.currentAbortController = null;
        
        resolve(result);
      } catch (error) {
        // PROPER FIX: Clear timeout on error
        clearTimeout(timeoutId);
        this.currentAbortController = null;
        
        if (error instanceof Error && error.name === 'AbortError') {
          reject(new Error(`Command ${command.type} was cancelled`));
        } else {
          reject(error);
        }
      }
    });
  }
  
  /**
   * PROPER FIX: Execute command with abort signal support
   */
  private async executeCommand(command: GameCommand, abortSignal?: AbortSignal): Promise<CommandResult> {
    // PROPER FIX: Check if operation was aborted before starting
    if (abortSignal?.aborted) {
      throw new Error('Command execution was aborted');
    }
    
    try {
      // Dynamic import to avoid circular dependencies
      const { CommandProcessor } = await import('./CommandProcessor');
      const processor = CommandProcessor.getInstance();
      
      // PROPER FIX: Pass abort signal to processor
      return await processor.execute(command, abortSignal);
    } catch (error) {
      console.error(`❌ Execute command error:`, error);
      throw error;
    }
  }
  
  /**
   * PROPER FIX: Notify processing completion to force UI update
   */
  private notifyProcessingComplete(): void {
    // PROPER FIX: Send completion signal to all listeners
    const completionResult: CommandResult = {
      success: true,
      command: { type: 'PROCESSING_COMPLETE' } as GameCommand,
      timestamp: Date.now(),
      data: { processingComplete: true }
    };
    
    this.notifyListeners(completionResult);
  }
  
  /**
   * PROPER FIX: Determine retry logic (more conservative)
   */
  private shouldRetry(command: GameCommand, result: CommandResult): boolean {
    if (!result.error) return false;
    
    const error = result.error.toLowerCase();
    
    // PROPER FIX: Don't retry validation errors or conflicts
    if (error.includes('validation') || 
        error.includes('invalid') || 
        error.includes('already') || 
        error.includes('duplicate') ||
        error.includes('permission')) {
      return false;
    }
    
    // PROPER FIX: Only retry clear network/temporary errors
    return error.includes('network') || 
           error.includes('timeout') || 
           error.includes('502') || 
           error.includes('503') ||
           error.includes('connection');
  }
  
  /**
   * PROPER FIX: Health check with immediate response
   */
  public healthCheck(): { healthy: boolean; issues: string[] } {
    const issues: string[] = [];
    
    if (this.queue.length > 10) {
      issues.push(`Queue has ${this.queue.length} pending commands`);
    }
    
    if (this.processing && this.currentCommand) {
      issues.push(`Currently processing: ${this.currentCommand.type}`);
    }
    
    if (this.stats.totalFailed > 0) {
      const failureRate = (this.stats.totalFailed / (this.stats.totalExecuted || 1)) * 100;
      if (failureRate > 20) {
        issues.push(`High failure rate: ${failureRate.toFixed(1)}%`);
      }
    }
    
    return {
      healthy: issues.length === 0,
      issues
    };
  }
  
  // PROPER FIX: Simplified listener management
  public addListener(listener: (result: CommandResult) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  public addErrorListener(listener: (error: CommandError) => void): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }
  
  // PROPER FIX: Safe notification methods
  private notifyListeners(result: CommandResult): void {
    for (const listener of this.listeners) {
      try {
        listener(result);
      } catch (error) {
        console.error('Error in listener:', error);
      }
    }
  }
  
  private notifyError(error: CommandError): void {
    for (const listener of this.errorListeners) {
      try {
        listener(error);
      } catch (err) {
        console.error('Error in error listener:', err);
      }
    }
  }
  
  // PROPER FIX: Statistics with proper defaults
  private updateStats(success: boolean, executionTime: number): void {
    this.stats.totalExecuted++;
    this.stats.lastExecutionTime = executionTime;
    
    if (!success) {
      this.stats.totalFailed++;
    }
    
    // Simple moving average
    if (this.stats.totalExecuted === 1) {
      this.stats.averageExecutionTime = executionTime;
    } else {
      this.stats.averageExecutionTime = 
        (this.stats.averageExecutionTime * (this.stats.totalExecuted - 1) + executionTime) / 
        this.stats.totalExecuted;
    }
  }
  
  // PROPER FIX: Clean getters
  public getQueueLength(): number {
    return this.queue.length;
  }
  
  public isProcessing(): boolean {
    return this.processing;
  }
  
  public getStats(): CommandStats {
    return { ...this.stats };
  }
  
  public getCurrentCommand(): string | null {
    return this.currentCommand?.type || null;
  }
  
  // PROPER FIX: Simple cleanup without nuclear options
  public cleanup(): void {
    console.log('🧹 Cleaning up command queue');
    
    // Cancel current operation
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
    
    // Clear queue
    this.queue = [];
    
    // Reset state
    this.processing = false;
    this.currentCommand = null;
    
    // Clear listeners
    this.listeners.clear();
    this.errorListeners.clear();
    
    console.log('✅ Command queue cleaned up');
  }
}
