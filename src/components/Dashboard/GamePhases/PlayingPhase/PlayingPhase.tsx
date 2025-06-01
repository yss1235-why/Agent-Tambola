// src/components/Dashboard/GamePhases/PlayingPhase/PlayingPhase.tsx - COMPLETE FIXED VERSION
// Updated to use Command Queue Pattern with safe number generation and fixed prize validation

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import { useGame } from '../../../../contexts/GameContext';
import { LoadingSpinner } from '@components';
import PlayingPhaseView from './PlayingPhaseView';
import { Game } from '../../../../types/game';
import { CommandProcessor } from '../../../../services/CommandProcessor';

// Helper hook for safe number generation
function useNumberGenerator(calledNumbers: number[]) {
  const generateNumber = useCallback((): number | null => {
    return CommandProcessor.generateAvailableNumber(calledNumbers);
  }, [calledNumbers]);
  
  const getAvailableNumbers = useCallback((): number[] => {
    return CommandProcessor.getAvailableNumbers(calledNumbers);
  }, [calledNumbers]);
  
  const getRemainingCount = useCallback((): number => {
    return 90 - calledNumbers.length;
  }, [calledNumbers.length]);
  
  const getCalledCount = useCallback((): number => {
    return calledNumbers.length;
  }, [calledNumbers.length]);
  
  const isAllNumbersCalled = useCallback((): boolean => {
    return calledNumbers.length >= 90;
  }, [calledNumbers.length]);
  
  const canGenerateMore = useCallback((): boolean => {
    return calledNumbers.length < 90;
  }, [calledNumbers.length]);
  
  return {
    generateNumber,
    getAvailableNumbers,
    getRemainingCount,
    getCalledCount,
    isAllNumbersCalled,
    canGenerateMore
  };
}

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

  // FIXED: Safe number generation with duplicate prevention
  const calledNumbers = currentGame?.numberSystem?.calledNumbers || [];
  const {
    generateNumber,
    getRemainingCount,
    getCalledCount,
    isAllNumbersCalled,
    canGenerateMore,
    getAvailableNumbers
  } = useNumberGenerator(calledNumbers);

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
          calledNumbers: calledNumbers.length,
          remainingNumbers: getRemainingCount(),
          allPrizesWon: currentGame.gameState?.allPrizesWon
        });
        hasInitialized.current = true;
      }
      
      const isComplete = currentGame.gameState?.status === 'ended' || 
                        currentGame.gameState?.phase === 4 ||
                        currentGame.gameState?.allPrizesWon === true ||
                        isAllNumbersCalled();
      
      setIsLoading(false);
      setIsGameComplete(isComplete);
      setCallDelayLocal(currentGame.numberSystem?.callDelay || 5);
      setSoundEnabledLocal(currentGame.gameState?.soundEnabled !== false);
      
      // Update auto-calling state
      const shouldAutoCalling = currentGame.gameState?.status === 'active' && 
                               currentGame.gameState?.isAutoCalling === true &&
                               !isComplete &&
                               canGenerateMore();
      
      if (shouldAutoCalling !== isAutoCallingRef.current) {
        console.log(`🔄 Auto-calling state changed: ${isAutoCallingRef.current} → ${shouldAutoCalling}`);
        console.log(`📊 Game stats: called=${getCalledCount()}, remaining=${getRemainingCount()}, canGenerate=${canGenerateMore()}`);
        
        isAutoCallingRef.current = shouldAutoCalling;
        
        if (shouldAutoCalling) {
          startAutoCalling();
        } else {
          stopAutoCalling();
        }
      }
      
      // Auto-end game if all numbers called
      if (isAllNumbersCalled() && currentGame.gameState?.status !== 'ended') {
        console.log('🏁 All numbers called, auto-ending game...');
        setTimeout(() => {
          handleGameEnd();
        }, 2000);
      }
    }
  }, [currentUser, currentGame, navigate, canGenerateMore, getCalledCount, getRemainingCount, isAllNumbersCalled]);

  // Sync with game error
  useEffect(() => {
    if (gameError) {
      setError(gameError);
    }
  }, [gameError]);

  /**
   * FIXED: Start auto-calling numbers with safe generation
   */
  const startAutoCalling = useCallback(() => {
    if (autoCallTimer.current) {
      clearTimeout(autoCallTimer.current);
    }
    
    if (!currentGame || isGameComplete || !canGenerateMore()) {
      console.log('❌ Cannot start auto-calling:', {
        hasGame: !!currentGame,
        isComplete: isGameComplete,
        canGenerate: canGenerateMore(),
        remaining: getRemainingCount(),
        allCalled: isAllNumbersCalled()
      });
      return;
    }
    
    console.log(`⏰ Starting auto-calling with ${callDelay}s delay (${getRemainingCount()} numbers remaining)`);
    
    const scheduleNext = () => {
      if (!isAutoCallingRef.current) {
        console.log('❌ Auto-calling stopped');
        return;
      }
      
      // Check if we can still generate numbers
      const currentCalledNumbers = currentGame?.numberSystem?.calledNumbers || [];
      const availableCount = 90 - currentCalledNumbers.length;
      
      if (availableCount <= 0) {
        console.log('🏁 All numbers called, stopping auto-calling');
        isAutoCallingRef.current = false;
        return;
      }
      
      autoCallTimer.current = setTimeout(() => {
        if (isAutoCallingRef.current && currentGame) {
          // FIXED: Use safe number generation
          const numberToCall = generateNumber();
          
          if (numberToCall !== null) {
            console.log(`🎲 Auto-calling number: ${numberToCall} (${availableCount - 1} remaining)`);
            
            try {
              callNumber(numberToCall);
            } catch (error) {
              console.error('❌ Auto-call failed:', error);
              setError('Auto-calling failed');
              isAutoCallingRef.current = false;
              return;
            }
            
            // Schedule next call if more numbers available
            const newAvailableCount = availableCount - 1;
            if (newAvailableCount > 0 && isAutoCallingRef.current) {
              scheduleNext();
            } else {
              console.log('🏁 All numbers called or auto-calling stopped');
              isAutoCallingRef.current = false;
            }
          } else {
            console.log('🏁 No more numbers available, stopping auto-calling');
            isAutoCallingRef.current = false;
          }
        }
      }, callDelay * 1000);
    };
    
    scheduleNext();
  }, [currentGame, isGameComplete, callDelay, callNumber, generateNumber, canGenerateMore, getRemainingCount]);

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
   * FIXED: Manual number calling with safe generation
   */
  const callRandomNumber = useCallback(() => {
    if (!currentGame) {
      setError('No active game found');
      return;
    }
    
    if (!canGenerateMore()) {
      setError('All 90 numbers have been called');
      return;
    }
    
    const number = generateNumber();
    if (number !== null) {
      console.log(`🎲 Manually calling number: ${number}`);
      try {
        callNumber(number);
      } catch (error) {
        console.error('❌ Manual call failed:', error);
        setError('Failed to call number');
      }
    } else {
      setError('Failed to generate number - all numbers may have been called');
    }
  }, [currentGame, generateNumber, canGenerateMore, callNumber]);

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
    if (currentGame?.gameState?.allPrizesWon === true && status === 'active') {
      setError('Cannot resume game: All prizes have been won');
      return;
    }
    
    if (isGameComplete && status === 'active') {
      setError('Cannot resume game: Game is already completed');
      return;
    }
    
    if (isAllNumbersCalled() && status === 'active') {
      setError('Cannot resume game: All numbers have been called');
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
  }, [currentGame?.gameState?.allPrizesWon, isGameComplete, isAllNumbersCalled, updateGameStatus]);

  /**
   * Handle game end using command
   */
  const handleGameEnd = useCallback(async () => {
    try {
      console.log('🏁 Ending game with command...');
      setIsGameComplete(true);
      
      // Stop auto-calling immediately
      stopAutoCalling();
      
      const reason = isAllNumbersCalled() 
        ? 'All 90 numbers have been called'
        : currentGame?.gameState?.allPrizesWon
        ? 'All prizes have been won'
        : 'Manual end by host';
      
      const commandId = completeGame(reason);
      console.log(`📤 Complete game command sent: ${commandId}`);
      
      setTimeout(() => {
        navigate('/dashboard');
      }, 3000);
    } catch (err) {
      console.error('❌ Failed to end game:', err);
      setError('Failed to end game');
    }
  }, [completeGame, navigate, isAllNumbersCalled, currentGame?.gameState?.allPrizesWon, stopAutoCalling]);

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
        <div className="text-center">
          <LoadingSpinner size="large" />
          <p className="mt-4 text-gray-600">Loading game...</p>
        </div>
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
  const allPrizesWon = currentGame.gameState?.allPrizesWon === true;
  const allNumbersCalled = isAllNumbersCalled();

  return (
    <div className="space-y-4">
      {/* Debug panel for development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-gray-100 p-4 rounded-lg border">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Debug Panel - Enhanced Number System</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            <div><strong>Game Status:</strong> {currentGame.gameState?.status || 'unknown'}</div>
            <div><strong>Is Paused:</strong> {isPaused ? 'Yes' : 'No'}</div>
            <div><strong>Auto Calling:</strong> {isAutoCallingRef.current ? 'Yes' : 'No'}</div>
            <div><strong>Numbers Called:</strong> {getCalledCount()}/90</div>
            <div><strong>Numbers Remaining:</strong> {getRemainingCount()}</div>
            <div><strong>Current Number:</strong> {currentGame.numberSystem?.currentNumber || 'None'}</div>
            <div><strong>All Prizes Won:</strong> {allPrizesWon ? 'Yes' : 'No'}</div>
            <div><strong>All Numbers Called:</strong> {allNumbersCalled ? 'Yes' : 'No'}</div>
            <div><strong>Game Complete:</strong> {isGameComplete ? 'Yes' : 'No'}</div>
            <div><strong>Processing Commands:</strong> {isProcessing ? 'Yes' : 'No'}</div>
            <div><strong>Can Generate More:</strong> {canGenerateMore() ? 'Yes' : 'No'}</div>
            <div><strong>Available Numbers:</strong> {getAvailableNumbers().slice(0, 5).join(', ')}{getAvailableNumbers().length > 5 ? '...' : ''}</div>
          </div>
          
          {/* Manual Controls for Testing */}
          <div className="mt-4 pt-4 border-t border-gray-300">
            <h5 className="text-sm font-medium text-gray-700 mb-2">Manual Controls</h5>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={callRandomNumber}
                disabled={!canGenerateMore() || isProcessing}
                className={`px-3 py-1 text-xs rounded ${
                  canGenerateMore() && !isProcessing
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Call Random ({getRemainingCount()} left)
              </button>
              
              <button
                onClick={() => handleStatusChange(isPaused ? 'active' : 'paused')}
                disabled={isProcessing}
                className="px-3 py-1 text-xs rounded bg-yellow-600 text-white hover:bg-yellow-700"
              >
                {isPaused ? 'Resume' : 'Pause'}
              </button>
              
              <button
                onClick={handleGameEnd}
                disabled={isProcessing}
                className="px-3 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700"
              >
                End Game
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Progress Overview */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Game Progress</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3 border rounded-lg bg-blue-50">
            <div className="text-sm text-blue-600 font-medium">Numbers Called</div>
            <div className="text-2xl font-bold text-blue-800">
              {getCalledCount()}<span className="text-lg text-blue-600">/90</span>
            </div>
          </div>
          
          <div className="p-3 border rounded-lg bg-green-50">
            <div className="text-sm text-green-600 font-medium">Remaining</div>
            <div className="text-2xl font-bold text-green-800">
              {getRemainingCount()}
            </div>
          </div>
          
          <div className="p-3 border rounded-lg bg-purple-50">
            <div className="text-sm text-purple-600 font-medium">Progress</div>
            <div className="text-2xl font-bold text-purple-800">
              {Math.round((getCalledCount() / 90) * 100)}%
            </div>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${(getCalledCount() / 90) * 100}%` }}
            />
          </div>
        </div>
        
        {/* Status Messages */}
        {getRemainingCount() <= 10 && getRemainingCount() > 0 && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="flex items-center text-yellow-800">
              <span className="text-lg mr-2">⚠️</span>
              <span className="font-medium">
                Only {getRemainingCount()} numbers remaining! Game is nearing completion.
              </span>
            </div>
          </div>
        )}
        
        {allNumbersCalled && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center text-red-800">
              <span className="text-lg mr-2">🏁</span>
              <span className="font-medium">
                All 90 numbers have been called! The game is complete.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Main Playing Phase View */}
      <PlayingPhaseView
        currentGame={currentGame}
        winners={winners}
        soundEnabled={soundEnabled}
        callDelay={callDelay}
        error={error}
        isGameComplete={isGameComplete || allNumbersCalled}
        isProcessing={isProcessing}
        queueNumbers={[]} // No queue in command system
        allPrizesWon={allPrizesWon || allNumbersCalled}
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
