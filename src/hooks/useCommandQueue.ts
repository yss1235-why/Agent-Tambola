// src/hooks/useCommandQueue.ts - React hook for sending commands through the queue system
// This provides a clean interface for components to interact with the command system

import { useCallback, useEffect, useState, useRef } from 'react';
import { CommandQueue } from '../services/CommandQueue';
import { GameCommand, CommandResult, CommandPriority, CommandError, CommandStats, CreateCommand } from '../types/commands';
import type { Game } from '../types/game';

interface UseCommandQueueReturn {
  // Core command sending
  sendCommand: (command: CreateCommand<GameCommand>, priority?: CommandPriority) => string;
  
  // Specific command helpers
  callNumber: (number: number) => string;
  updateGameStatus: (status: 'active' | 'paused' | 'ended', isAutoCalling?: boolean) => string;
  createBooking: (playerName: string, phoneNumber: string, tickets: string[]) => string;
  updateBooking: (ticketId: string, playerName?: string, phoneNumber?: string) => string;
  updatePrizeWinners: (prizeType: keyof Game.Winners, ticketIds: string[], playerName: string, phoneNumber: string, allPrizeTypes: string[]) => string;
  updateGameSettings: (settings: Partial<Game.Settings>) => string;
  initializeGame: (settings: Game.Settings, tickets?: Record<string, Game.Ticket>) => string;
  startBookingPhase: (settings: Game.Settings, tickets: Record<string, Game.Ticket>) => string;
  startPlayingPhase: () => string;
  completeGame: (reason?: string) => string;
  updateCallDelay: (callDelay: number) => string;
  updateSoundSettings: (soundEnabled: boolean) => string;
  cancelBooking: (ticketIds: string[]) => string;
  
  // Queue state
  isProcessing: boolean;
  queueLength: number;
  
  // Results and errors
  lastResult: CommandResult | null;
  lastError: CommandError | null;
  
  // Statistics
  stats: CommandStats;
  
  // Utilities
  clearQueue: () => number;
  getQueueSnapshot: () => Array<{ type: string; priority: CommandPriority; timestamp: number; retryCount: number }>;
  healthCheck: () => { healthy: boolean; issues: string[] };
}

interface UseCommandQueueProps {
  hostId: string;
  onResult?: (result: CommandResult) => void;
  onError?: (error: CommandError) => void;
}

export function useCommandQueue({
  hostId,
  onResult,
  onError
}: UseCommandQueueProps): UseCommandQueueReturn {
  // State
  const [isProcessing, setIsProcessing] = useState(false);
  const [queueLength, setQueueLength] = useState(0);
  const [lastResult, setLastResult] = useState<CommandResult | null>(null);
  const [lastError, setLastError] = useState<CommandError | null>(null);
  const [stats, setStats] = useState<CommandStats>({
    totalExecuted: 0,
    totalFailed: 0,
    averageExecutionTime: 0,
    lastExecutionTime: 0
  });
  
  // Refs
  const commandQueue = useRef(CommandQueue.getInstance());
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  
  // Update refs when props change
  useEffect(() => {
    onResultRef.current = onResult;
    onErrorRef.current = onError;
  }, [onResult, onError]);
  
  // Subscribe to queue events
  useEffect(() => {
    const queue = commandQueue.current;
    
    // Subscribe to command results
    const unsubscribeResults = queue.addListener((result: CommandResult) => {
      setLastResult(result);
      setIsProcessing(queue.isProcessing());
      setQueueLength(queue.getQueueLength());
      setStats(queue.getStats());
      
      // Call external callback
      onResultRef.current?.(result);
    });
    
    // Subscribe to command errors
    const unsubscribeErrors = queue.addErrorListener((error: CommandError) => {
      setLastError(error);
      
      // Call external callback
      onErrorRef.current?.(error);
    });
    
    // Initial state sync
    setIsProcessing(queue.isProcessing());
    setQueueLength(queue.getQueueLength());
    setStats(queue.getStats());
    
    return () => {
      unsubscribeResults();
      unsubscribeErrors();
    };
  }, []);
  
  /**
   * Generate a unique command ID
   */
  const generateCommandId = useCallback((): string => {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);
  
  /**
   * Send a generic command
   */
  const sendCommand = useCallback((
    command: CreateCommand<GameCommand>, 
    priority: CommandPriority = CommandPriority.NORMAL
  ): string => {
    const fullCommand: GameCommand = {
      ...command,
      id: generateCommandId(),
      timestamp: Date.now(),
      hostId
    } as GameCommand;
    
    const success = commandQueue.current.enqueue(fullCommand, priority);
    
    if (success) {
      // Update local state immediately for UI responsiveness
      setQueueLength(prev => prev + 1);
      setIsProcessing(true);
      
      return fullCommand.id;
    } else {
      throw new Error('Failed to enqueue command - queue may be full');
    }
  }, [hostId, generateCommandId]);
  
  /**
   * Call a number in the game
   */
  const callNumber = useCallback((number: number): string => {
    return sendCommand({
      type: 'CALL_NUMBER',
      payload: { number }
    }, CommandPriority.HIGH);
  }, [sendCommand]);
  
  /**
   * Update game status (pause/resume/end)
   */
  const updateGameStatus = useCallback((
    status: 'active' | 'paused' | 'ended', 
    isAutoCalling?: boolean
  ): string => {
    return sendCommand({
      type: 'UPDATE_GAME_STATUS',
      payload: { status, isAutoCalling }
    }, CommandPriority.CRITICAL);
  }, [sendCommand]);
  
  /**
   * Create a new booking
   */
  const createBooking = useCallback((
    playerName: string, 
    phoneNumber: string, 
    tickets: string[]
  ): string => {
    return sendCommand({
      type: 'CREATE_BOOKING',
      payload: { playerName, phoneNumber, tickets }
    }, CommandPriority.HIGH);
  }, [sendCommand]);
  
  /**
   * Update an existing booking
   */
  const updateBooking = useCallback((
    ticketId: string, 
    playerName?: string, 
    phoneNumber?: string
  ): string => {
    return sendCommand({
      type: 'UPDATE_BOOKING',
      payload: { ticketId, playerName, phoneNumber }
    });
  }, [sendCommand]);
  
  /**
   * Update prize winners
   */
  const updatePrizeWinners = useCallback((
    prizeType: keyof Game.Winners,
    ticketIds: string[],
    playerName: string,
    phoneNumber: string,
    allPrizeTypes: string[]
  ): string => {
    return sendCommand({
      type: 'UPDATE_PRIZE_WINNERS',
      payload: { prizeType, ticketIds, playerName, phoneNumber, allPrizeTypes }
    }, CommandPriority.HIGH);
  }, [sendCommand]);
  
  /**
   * Update game settings
   */
  const updateGameSettings = useCallback((settings: Partial<Game.Settings>): string => {
    return sendCommand({
      type: 'UPDATE_GAME_SETTINGS',
      payload: settings
    });
  }, [sendCommand]);
  
  /**
   * Initialize a new game
   */
  const initializeGame = useCallback((
    settings: Game.Settings, 
    tickets: Record<string, Game.Ticket> = {}
  ): string => {
    return sendCommand({
      type: 'INITIALIZE_GAME',
      payload: { settings, tickets }
    }, CommandPriority.HIGH);
  }, [sendCommand]);
  
  /**
   * Start the booking phase
   */
  const startBookingPhase = useCallback((
    settings: Game.Settings, 
    tickets: Record<string, Game.Ticket>
  ): string => {
    return sendCommand({
      type: 'START_BOOKING_PHASE',
      payload: { settings, tickets }
    }, CommandPriority.HIGH);
  }, [sendCommand]);
  
  /**
   * Start the playing phase
   */
  const startPlayingPhase = useCallback((): string => {
    return sendCommand({
      type: 'START_PLAYING_PHASE',
      payload: {}
    }, CommandPriority.HIGH);
  }, [sendCommand]);
  
  /**
   * Complete the game
   */
  const completeGame = useCallback((reason?: string): string => {
    return sendCommand({
      type: 'COMPLETE_GAME',
      payload: { reason }
    }, CommandPriority.CRITICAL);
  }, [sendCommand]);
  
  /**
   * Update call delay
   */
  const updateCallDelay = useCallback((callDelay: number): string => {
    return sendCommand({
      type: 'UPDATE_CALL_DELAY',
      payload: { callDelay }
    });
  }, [sendCommand]);
  
  /**
   * Update sound settings
   */
  const updateSoundSettings = useCallback((soundEnabled: boolean): string => {
    return sendCommand({
      type: 'UPDATE_SOUND_SETTINGS',
      payload: { soundEnabled }
    });
  }, [sendCommand]);
  
  /**
   * Cancel booking(s)
   */
  const cancelBooking = useCallback((ticketIds: string[]): string => {
    return sendCommand({
      type: 'CANCEL_BOOKING',
      payload: { ticketIds }
    }, CommandPriority.HIGH);
  }, [sendCommand]);
  
  /**
   * Clear the queue (emergency use)
   */
  const clearQueue = useCallback((): number => {
    const clearedCount = commandQueue.current.clearQueue();
    setQueueLength(0);
    setIsProcessing(false);
    return clearedCount;
  }, []);
  
  /**
   * Get queue snapshot for debugging
   */
  const getQueueSnapshot = useCallback(() => {
    return commandQueue.current.getQueueSnapshot();
  }, []);
  
  /**
   * Perform health check
   */
  const healthCheck = useCallback(() => {
    return commandQueue.current.healthCheck();
  }, []);
  
  return {
    // Core command sending
    sendCommand,
    
    // Specific command helpers
    callNumber,
    updateGameStatus,
    createBooking,
    updateBooking,
    updatePrizeWinners,
    updateGameSettings,
    initializeGame,
    startBookingPhase,
    startPlayingPhase,
    completeGame,
    updateCallDelay,
    updateSoundSettings,
    cancelBooking,
    
    // Queue state
    isProcessing,
    queueLength,
    
    // Results and errors
    lastResult,
    lastError,
    
    // Statistics
    stats,
    
    // Utilities
    clearQueue,
    getQueueSnapshot,
    healthCheck
  };
}

export default useCommandQueue;
