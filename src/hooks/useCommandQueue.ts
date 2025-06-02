// src/hooks/useCommandQueue.ts - PROPER FIX: Immediate state synchronization
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
  
  // PROPER FIX: Immediate state tracking
  isProcessing: boolean;
  queueLength: number;
  currentCommand: string | null;
  
  // Results and errors
  lastResult: CommandResult | null;
  lastError: CommandError | null;
  
  // Statistics
  stats: CommandStats;
  
  // PROPER FIX: Health monitoring
  systemHealth: { healthy: boolean; issues: string[] };
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
  // PROPER FIX: Immediate state tracking with refs for real-time updates
  const [isProcessing, setIsProcessing] = useState(false);
  const [queueLength, setQueueLength] = useState(0);
  const [currentCommand, setCurrentCommand] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<CommandResult | null>(null);
  const [lastError, setLastError] = useState<CommandError | null>(null);
  const [stats, setStats] = useState<CommandStats>({
    totalExecuted: 0,
    totalFailed: 0,
    averageExecutionTime: 0,
    lastExecutionTime: 0
  });
  const [systemHealth, setSystemHealth] = useState<{ healthy: boolean; issues: string[] }>({
    healthy: true,
    issues: []
  });
  
  // PROPER FIX: Use refs to prevent stale closures
  const commandQueue = useRef(CommandQueue.getInstance());
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  
  // Update refs when props change
  useEffect(() => {
    onResultRef.current = onResult;
    onErrorRef.current = onError;
  }, [onResult, onError]);
  
  // PROPER FIX: Real-time state synchronization
  const syncQueueState = useCallback(() => {
    const queue = commandQueue.current;
    const newIsProcessing = queue.isProcessing();
    const newQueueLength = queue.getQueueLength();
    const newCurrentCommand = queue.getCurrentCommand();
    const newStats = queue.getStats();
    const newHealth = queue.healthCheck();
    
    // PROPER FIX: Only update if values actually changed (prevent unnecessary re-renders)
    setIsProcessing(prev => prev !== newIsProcessing ? newIsProcessing : prev);
    setQueueLength(prev => prev !== newQueueLength ? newQueueLength : prev);
    setCurrentCommand(prev => prev !== newCurrentCommand ? newCurrentCommand : prev);
    setStats(prev => JSON.stringify(prev) !== JSON.stringify(newStats) ? newStats : prev);
    setSystemHealth(prev => JSON.stringify(prev) !== JSON.stringify(newHealth) ? newHealth : prev);
  }, []);
  
  // PROPER FIX: Subscribe to queue events with immediate state sync
  useEffect(() => {
    const queue = commandQueue.current;
    
    // PROPER FIX: Enhanced result listener with immediate state update
    const unsubscribeResults = queue.addListener((result: CommandResult) => {
      console.log(`🎯 Command result received: ${result.command.type}`, result);
      
      setLastResult(result);
      
      // PROPER FIX: Immediately sync state after each result
      syncQueueState();
      
      // Call external callback
      try {
        onResultRef.current?.(result);
      } catch (error) {
        console.error('Error in onResult callback:', error);
      }
    });
    
    // PROPER FIX: Enhanced error listener
    const unsubscribeErrors = queue.addErrorListener((error: CommandError) => {
      console.error(`🚨 Command error received:`, error);
      
      setLastError(error);
      
      // PROPER FIX: Immediately sync state after error
      syncQueueState();
      
      // Call external callback
      try {
        onErrorRef.current?.(error);
      } catch (err) {
        console.error('Error in onError callback:', err);
      }
    });
    
    // PROPER FIX: Initial state sync
    syncQueueState();
    
    // PROPER FIX: Periodic state sync to catch any missed updates
    const syncInterval = setInterval(syncQueueState, 1000);
    
    return () => {
      unsubscribeResults();
      unsubscribeErrors();
      clearInterval(syncInterval);
    };
  }, [syncQueueState]);
  
  /**
   * PROPER FIX: Generate unique command ID
   */
  const generateCommandId = useCallback((): string => {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);
  
  /**
   * PROPER FIX: Send command with immediate UI feedback
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
    
    console.log(`📤 Sending command: ${fullCommand.type}`, fullCommand);
    
    // PROPER FIX: Immediately update UI state before sending
    setIsProcessing(true);
    setQueueLength(prev => prev + 1);
    setCurrentCommand(fullCommand.type);
    
    const success = commandQueue.current.enqueue(fullCommand, priority);
    
    if (!success) {
      // PROPER FIX: Reset state immediately if enqueue failed
      console.error(`❌ Failed to enqueue command: ${fullCommand.type}`);
      syncQueueState(); // Sync actual state
      throw new Error(`Failed to enqueue command: ${fullCommand.type}`);
    }
    
    // PROPER FIX: Sync state immediately after successful enqueue
    setTimeout(syncQueueState, 10);
    
    return fullCommand.id;
  }, [hostId, generateCommandId, syncQueueState]);
  
  // PROPER FIX: Specific command helpers with immediate feedback
  const callNumber = useCallback((number: number): string => {
    console.log(`🎲 Calling number: ${number}`);
    return sendCommand({
      type: 'CALL_NUMBER',
      payload: { number }
    }, CommandPriority.HIGH);
  }, [sendCommand]);
  
  const updateGameStatus = useCallback((
    status: 'active' | 'paused' | 'ended', 
    isAutoCalling?: boolean
  ): string => {
    console.log(`🎮 Updating game status: ${status}`);
    return sendCommand({
      type: 'UPDATE_GAME_STATUS',
      payload: { status, isAutoCalling }
    }, CommandPriority.CRITICAL);
  }, [sendCommand]);
  
  const createBooking = useCallback((
    playerName: string, 
    phoneNumber: string, 
    tickets: string[]
  ): string => {
    console.log(`🎫 Creating booking for ${playerName}: ${tickets.length} tickets`);
    return sendCommand({
      type: 'CREATE_BOOKING',
      payload: { playerName, phoneNumber, tickets }
    }, CommandPriority.HIGH);
  }, [sendCommand]);
  
  const updateBooking = useCallback((
    ticketId: string, 
    playerName?: string, 
    phoneNumber?: string
  ): string => {
    console.log(`✏️ Updating booking: ${ticketId}`);
    return sendCommand({
      type: 'UPDATE_BOOKING',
      payload: { ticketId, playerName, phoneNumber }
    });
  }, [sendCommand]);
  
  const updatePrizeWinners = useCallback((
    prizeType: keyof Game.Winners,
    ticketIds: string[],
    playerName: string,
    phoneNumber: string,
    allPrizeTypes: string[]
  ): string => {
    console.log(`🏆 Updating prize winners: ${prizeType} for ${playerName}`);
    return sendCommand({
      type: 'UPDATE_PRIZE_WINNERS',
      payload: { prizeType, ticketIds, playerName, phoneNumber, allPrizeTypes }
    }, CommandPriority.HIGH);
  }, [sendCommand]);
  
  const updateGameSettings = useCallback((settings: Partial<Game.Settings>): string => {
    console.log(`⚙️ Updating game settings:`, settings);
    return sendCommand({
      type: 'UPDATE_GAME_SETTINGS',
      payload: settings
    });
  }, [sendCommand]);
  
  const initializeGame = useCallback((
    settings: Game.Settings, 
    tickets: Record<string, Game.Ticket> = {}
  ): string => {
    console.log(`🎮 Initializing new game`);
    return sendCommand({
      type: 'INITIALIZE_GAME',
      payload: { settings, tickets }
    }, CommandPriority.HIGH);
  }, [sendCommand]);
  
  const startBookingPhase = useCallback((
    settings: Game.Settings, 
    tickets: Record<string, Game.Ticket>
  ): string => {
    console.log(`🎫 Starting booking phase`);
    return sendCommand({
      type: 'START_BOOKING_PHASE',
      payload: { settings, tickets }
    }, CommandPriority.HIGH);
  }, [sendCommand]);
  
  const startPlayingPhase = useCallback((): string => {
    console.log(`🎯 Starting playing phase`);
    return sendCommand({
      type: 'START_PLAYING_PHASE',
      payload: {}
    }, CommandPriority.HIGH);
  }, [sendCommand]);
  
  const completeGame = useCallback((reason?: string): string => {
    console.log(`🏁 Completing game: ${reason || 'Manual completion'}`);
    return sendCommand({
      type: 'COMPLETE_GAME',
      payload: { reason }
    }, CommandPriority.CRITICAL);
  }, [sendCommand]);
  
  const updateCallDelay = useCallback((callDelay: number): string => {
    console.log(`⏱️ Updating call delay: ${callDelay}s`);
    return sendCommand({
      type: 'UPDATE_CALL_DELAY',
      payload: { callDelay }
    });
  }, [sendCommand]);
  
  const updateSoundSettings = useCallback((soundEnabled: boolean): string => {
    console.log(`🔊 Updating sound settings: ${soundEnabled ? 'enabled' : 'disabled'}`);
    return sendCommand({
      type: 'UPDATE_SOUND_SETTINGS',
      payload: { soundEnabled }
    });
  }, [sendCommand]);
  
  const cancelBooking = useCallback((ticketIds: string[]): string => {
    console.log(`❌ Canceling bookings: ${ticketIds.join(', ')}`);
    return sendCommand({
      type: 'CANCEL_BOOKING',
      payload: { ticketIds }
    }, CommandPriority.HIGH);
  }, [sendCommand]);
  
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
    
    // PROPER FIX: Real-time state
    isProcessing,
    queueLength,
    currentCommand,
    
    // Results and errors
    lastResult,
    lastError,
    
    // Statistics and health
    stats,
    systemHealth
  };
}

export default useCommandQueue;
