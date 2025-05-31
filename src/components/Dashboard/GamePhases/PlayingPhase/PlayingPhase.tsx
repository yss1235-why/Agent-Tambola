// src/components/Dashboard/GamePhases/PlayingPhase/PlayingPhase.tsx - UPDATED to use Command Queue Pattern
// Simplified playing phase that uses commands instead of complex game controller

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import { useGame } from '../../../../contexts/GameContext';
import { LoadingSpinner } from '@components';
import PlayingPhaseView from './PlayingPhaseView';
import { Game } from '../../../../types/game';

const PlayingPhase: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  // Get game state and command methods from context
  const { 
    currentGame,
    updateGameStatus,
    updateCallDelay,
    updateSoundSettings,
    completeGame,
    callNumber,
    error: gameError,
    isProcessing,
    clearError
  } = useGame();
  
  // Local state for UI
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGameComplete, setIsGameComplete] = useState(false);
  const [soundEnabled, setSoundEnabledLocal] = useState(true);
  const [callDelay, setCallDelayLocal] = useState(5);
  
  // Refs for auto-calling logic
  const autoCallTimer = useRef<NodeJS.Timeout | null>(null);
  const isAutoCallingRef = useRef(false);
  const hasInitialized = useRef(false);

  // Initialize component
  useEffect(() => {
    if (!currentUser?.uid) {
      navigate('/login');
      return;
    }
    
    if (currentGame) {
      if (!hasInitialized.current) {
        console.log("PlayingPhase initialized with game:", {
          status: currentGame.gameState?.status,
          phase: currentGame.gameState?.phase,
          calledNumbers: currentGame.numberSystem?.calledNumbers?.length || 0,
          allPrizesWon: currentGame.gameState?.allPrizesWon
        });
        hasInitialized.current = true;
      }
      
      const isComplete = currentGame.gameState?.status === 'ended' || 
                        currentGame.gameState?.phase === 4 ||
                        currentGame.gameState?.allPrizesWon;
      
      setIsLoading(false);
      setIsGameComplete(isComplete);
      setCallDelayLocal(currentGame.numberSystem?.callDelay || 5);
      setSoundEnabledLocal(currentGame.gameState?.soundEnabled !== false);
      
      // Update auto-calling state
      const shouldAutoCalling = currentGame.gameState?.status === 'active' && 
                               currentGame.gameState?.isAutoCalling && 
                               !isComplete;
      
      if (shouldAutoCalling !== isAutoCallingRef.current) {
        console.log(`🔄 Auto-calling state changed: ${isAutoCallingRef.current} → ${shouldAutoCalling}`);
        isAutoCallingRef.current = shouldAutoCalling;
        
        if (shouldAutoCalling) {
          startAutoCalling();
        } else {
          stopAutoCalling();
        }
      }
    }
  }, [currentUser, currentGame, navigate]);

  // Sync with game error
  useEffect(() => {
    if (gameError) {
      setError(gameError);
    }
  }, [gameError]);

  /**
   * Start auto-calling numbers
   */
  const startAutoCalling = useCallback(() => {
    if (autoCallTimer.current) {
      clearTimeout(autoCallTimer.current);
    }
    
    if (!currentGame || isGameComplete) {
      console.log('❌ Cannot start auto-calling: no game or game complete');
      return;
    }
    
    const calledNumbers = currentGame.numberSystem?.calledNumbers || [];
    if (calledNumbers.length >= 90) {
      console.log('❌ Cannot start auto-calling: all numbers called');
      return;
    }
    
    console.log(`⏰ Starting auto-calling with ${callDelay}s delay`);
    
    const scheduleNext = () => {
      if (!isAutoCallingRef.current) {
        console.log('❌ Auto-calling stopped');
        return;
      }
      
      autoCallTimer.current = setTimeout(() => {
        if (isAutoCallingRef.current && currentGame) {
          const currentCalledNumbers = currentGame.numberSystem?.calledNumbers || [];
          
          if (currentCalledNumbers.length < 90) {
            // Generate random available number
            const availableNumbers = Array.from({ length: 90 }, (_, i) => i + 1)
              .filter(n => !currentCalledNumbers.includes(n));
            
            if (availableNumbers.length > 0) {
              const randomIndex = Math.floor(Math.random() * availableNumbers.length);
              const numberToCall = availableNumbers[randomIndex];
              
              console.log(`🎲 Auto-calling number: ${numberToCall}`);
              
              try {
                callNumber(numberToCall);
              } catch (error) {
                console.error('❌ Auto-call failed:', error);
                setError('Auto-calling failed');
              }
              
              // Schedule next call
              scheduleNext();
            } else {
              console.log('🏁 All numbers called, stopping auto-calling');
              isAutoCallingRef.current = false;
            }
          }
        }
      }, callDelay * 1000);
    };
    
    scheduleNext();
  }, [currentGame, isGameComplete, callDelay, callNumber]);

  /**
   * Stop auto-calling
   */
  const stopAutoCalling = useCallback(() => {
    console.log('🛑 Stopping auto-calling');
    isAutoCallingRef.current = false;
    
    if (autoCallTimer.current) {
      clearTimeout(autoCallTimer.current);
      autoCallTimer.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAutoCalling();
    };
  }, [stopAutoCalling]);

  /**
   * Handle delay change using command
   */
  const handleDelayChange = useCallback(async (newDelay: number) => {
    setCallDelayLocal(newDelay);
    console.log(`⏱️ Changing call delay to ${newDelay} seconds`);
    
    try {
      const commandId = updateCallDelay(newDelay);
      console.log(`📤 Update delay command sent: ${commandId}`);
    } catch (err) {
      console.error('❌ Failed to update call delay:', err);
      setError('Failed to update call delay');
    }
  }, [updateCallDelay]);

  /**
   * Handle sound toggle using command
   */
  const handleSoundToggle = useCallback(async () => {
    const newSoundEnabled = !soundEnabled;
    setSoundEnabledLocal(newSoundEnabled);
    console.log(`🔊 Sound toggled to ${newSoundEnabled ? 'on' : 'off'}`);
    
    try {
      const commandId = updateSoundSettings(newSoundEnabled);
      console.log(`📤 Update sound command sent: ${commandId}`);
    } catch (err) {
      console.error('❌ Failed to toggle sound:', err);
      setError('Failed to toggle sound');
    }
  }, [soundEnabled, updateSoundSettings]);

  /**
   * Handle status change using command
   */
  const handleStatusChange = useCallback(async (status: 'active' | 'paused') => {
    if (currentGame?.gameState?.allPrizesWon && status === 'active') {
      setError('Cannot resume game: All prizes have been won');
      return;
    }
    
    if (isGameComplete && status === 'active') {
      setError('Cannot resume game: Game is already completed');
      return;
    }
    
    console.log(`🎮 Changing game status to: ${status}`);
    
    try {
      const commandId = updateGameStatus(status, status === 'active');
      console.log(`📤 Update status command sent: ${commandId}`);
    } catch (err) {
      console.error("❌ Error changing game status:", err);
      setError('Failed to change game status');
    }
  }, [currentGame?.gameState?.allPrizesWon, isGameComplete, updateGameStatus]);

  /**
   * Handle game end using command
   */
  const handleGameEnd = useCallback(async () => {
    try {
      console.log('🏁 Ending game with command...');
      setIsGameComplete(true);
      
      const commandId = completeGame('Manual end by host');
      console.log(`📤 Complete game command sent: ${commandId}`);
      
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (err) {
      console.error('❌ Failed to end game:', err);
      setError('Failed to end game');
    }
  }, [completeGame, navigate]);

  /**
   * Handle start new game
   */
  const handleStartNewGame = useCallback(async () => {
    navigate('/dashboard', { replace: true });
  }, [navigate]);

  /**
   * Handle error dismiss
   */
  const handleErrorDismiss = useCallback(() => {
    setError(null);
    clearError();
  }, [clearError]);

  // Render loading state
  if (isLoading || !currentGame) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  // Safely extract winners and settings
  const winners = currentGame.gameState?.winners || {
    quickFive: [], topLine: [], middleLine: [], bottomLine: [],
    corners: [], starCorners: [], halfSheet: [], fullSheet: [],
    fullHouse: [], secondFullHouse: []
  };

  const settings = currentGame.settings || {
    maxTickets: 0,
    selectedTicketSet: 1,
    callDelay: 5,
    hostPhone: '',
    prizes: {
      quickFive: false, topLine: false, middleLine: false, bottomLine: false,
      corners: false, starCorners: false, halfSheet: false, fullSheet: false,
      fullHouse: false, secondFullHouse: false
    }
  };

  const isPaused = currentGame.gameState?.status === 'paused' || !currentGame.gameState?.isAutoCalling;
  const allPrizesWon = currentGame.gameState?.allPrizesWon || false;

  return (
    <div className="space-y-4">
      {/* Debug panel for development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-gray-100 p-4 rounded-lg border">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Debug Panel - Command Queue System</h4>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div><strong>Game Status:</strong> {currentGame.gameState?.status || 'unknown'}</div>
            <div><strong>Is Paused:</strong> {isPaused ? 'Yes' : 'No'}</div>
            <div><strong>Auto Calling:</strong> {isAutoCallingRef.current ? 'Yes' : 'No'}</div>
            <div><strong>Numbers Called:</strong> {currentGame.numberSystem?.calledNumbers?.length || 0}/90</div>
            <div><strong>Current Number:</strong> {currentGame.numberSystem?.currentNumber || 'None'}</div>
            <div><strong>All Prizes Won:</strong> {allPrizesWon ? 'Yes' : 'No'}</div>
            <div><strong>Game Complete:</strong> {isGameComplete ? 'Yes' : 'No'}</div>
            <div><strong>Processing Commands:</strong> {isProcessing ? 'Yes' : 'No'}</div>
          </div>
        </div>
      )}

      <PlayingPhaseView
        currentGame={currentGame}
        winners={winners}
        soundEnabled={soundEnabled}
        callDelay={callDelay}
        error={error}
        isGameComplete={isGameComplete}
        isProcessing={isProcessing}
        queueNumbers={[]} // No queue in command system
        allPrizesWon={allPrizesWon}
        onSoundToggle={handleSoundToggle}
        onDelayChange={handleDelayChange}
        onGameEnd={handleGameEnd}
        onStartNewGame={handleStartNewGame}
        onErrorDismiss={handleErrorDismiss}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
};

export default PlayingPhase;
