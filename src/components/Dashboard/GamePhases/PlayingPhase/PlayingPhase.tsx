// src/components/Dashboard/GamePhases/PlayingPhase/PlayingPhase.tsx - Fixed auto-calling
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, update, get } from 'firebase/database';
import { useAuth } from '../../../../contexts/AuthContext';
import { useGame } from '../../../../contexts/GameContext';
import { database } from '../../../../lib/firebase';
import { LoadingSpinner } from '@components';
import PlayingPhaseView from './PlayingPhaseView';
import { Game } from '../../../../types/game';
import { handleApiError } from '../../../../utils/errorHandler';
import appConfig from '../../../../config/appConfig';

// Define default prize and settings objects for safety
const DEFAULT_PRIZES: Game.Settings['prizes'] = {
  quickFive: false,
  topLine: false,
  middleLine: false,
  bottomLine: false,
  corners: false,
  starCorners: false,
  halfSheet: false,
  fullSheet: false,
  fullHouse: false,
  secondFullHouse: false,
};

const DEFAULT_SETTINGS: Game.Settings = {
  maxTickets: 0,
  selectedTicketSet: 1,
  callDelay: 5,
  hostPhone: '',
  prizes: DEFAULT_PRIZES
};

interface PlayingPhaseProps {
  currentGame?: Game.CurrentGame;
}

const PlayingPhase: React.FC<PlayingPhaseProps> = ({ currentGame: propCurrentGame }) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { 
    gameState: contextGameState,
    isProcessing,
    isPaused,
    queueNumbers,
    calledNumbers,
    currentNumber,
    error: gameError,
    allPrizesWon,
    isGameEnded,
    pauseGame,
    resumeGame,
    completeGame,
    setCallDelay,
    triggerManualValidation
  } = useGame();
  
  // Use prop if provided, otherwise use context
  const gameState = propCurrentGame || contextGameState;

  // Local state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [callDelay, setLocalCallDelay] = useState(appConfig.gameDefaults.callDelay);
  const [isGameComplete, setIsGameComplete] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [localAllPrizesWon, setLocalAllPrizesWon] = useState(false);

  // Set up loading state and initialize game
  useEffect(() => {
    if (!currentUser?.uid) {
      navigate('/login');
      return;
    }
    
    if (gameState && !initialized) {
      console.log("🎮 Initializing PlayingPhase with game state:", {
        status: gameState.gameState?.status,
        phase: gameState.gameState?.phase,
        calledNumbers: gameState.numberSystem?.calledNumbers?.length || 0,
        allPrizesWon: gameState.gameState?.allPrizesWon,
        isAutoCalling: gameState.gameState?.isAutoCalling
      });
      
      const isComplete = gameState.gameState?.status === 'ended' || 
                        gameState.gameState?.phase === 4;
      
      setIsLoading(false);
      setIsGameComplete(isComplete);
      setLocalCallDelay(gameState.numberSystem?.callDelay || appConfig.gameDefaults.callDelay);
      setSoundEnabled(gameState.gameState?.soundEnabled || true);
      setLocalAllPrizesWon(gameState.gameState?.allPrizesWon || false);
      
      // Always initialize game in paused state when first entering the playing phase
      if (!isComplete && !gameState.gameState?.allPrizesWon && 
          gameState.gameState?.status !== 'paused' && 
          (gameState.numberSystem?.calledNumbers?.length === 0 || 
           appConfig.gameDefaults.startInPausedState)) {
        console.log('🛑 Initializing game in paused state');
        initializeGameInPausedState(currentUser.uid);
      }
      
      setInitialized(true);
    } else if (gameState) {
      setIsLoading(false);
      setIsGameComplete(gameState.gameState?.status === 'ended' || 
                        gameState.gameState?.phase === 4);
      setLocalAllPrizesWon(gameState.gameState?.allPrizesWon || false);
    }
  }, [currentUser, gameState, navigate, initialized]);

  // Keep track of all prizes won status
  useEffect(() => {
    if (allPrizesWon && !isGameComplete) {
      console.log("🏆 All prizes have been won - updating UI");
      setLocalAllPrizesWon(true);
      
      // Auto-end the game after a short delay if all prizes are won
      const timer = setTimeout(() => {
        if (!isGameComplete) {
          console.log("🏁 Auto-completing game due to all prizes won");
          handleGameEnd();
        }
      }, 3000); // 3 second delay
      
      return () => clearTimeout(timer);
    }
  }, [allPrizesWon, isGameComplete]);

  // Effect for when isGameEnded changes
  useEffect(() => {
    if (isGameEnded && !isGameComplete) {
      console.log("🏁 Game has been marked as ended - updating UI");
      setIsGameComplete(true);
    }
  }, [isGameEnded, isGameComplete]);

  // Keep call delay in sync
  useEffect(() => {
    if (gameState?.numberSystem?.callDelay) {
      setLocalCallDelay(gameState.numberSystem.callDelay);
    }
  }, [gameState?.numberSystem?.callDelay]);

  // Keep sound enabled state in sync
  useEffect(() => {
    if (gameState?.gameState?.soundEnabled !== undefined) {
      setSoundEnabled(gameState.gameState.soundEnabled);
    }
  }, [gameState?.gameState?.soundEnabled]);

  // Update error from game context
  useEffect(() => {
    if (gameError) {
      setError(gameError);
    }
  }, [gameError]);

  // Initialize game in paused state
  const initializeGameInPausedState = async (hostId: string) => {
    try {
      console.log('🛑 Setting game to paused state');
      const gameRef = ref(database, `hosts/${hostId}/currentGame`);
      const snapshot = await get(gameRef);
      
      if (snapshot.exists()) {
        await update(ref(database, `hosts/${hostId}/currentGame/gameState`), {
          status: 'paused',
          isAutoCalling: false
        });
        console.log('✅ Game initialized in paused state');
      }
    } catch (err) {
      console.error('❌ Failed to initialize game in paused state:', err);
      setError(handleApiError(err, 'Failed to initialize game state. Please try refreshing.'));
    }
  };

  const handleDelayChange = useCallback(async (newDelay: number) => {
    setLocalCallDelay(newDelay);
    console.log(`⏱️ Changing call delay to ${newDelay} seconds`);
    
    try {
      await setCallDelay(newDelay);
    } catch (err) {
      setError(handleApiError(err, 'Failed to update call delay'));
    }
  }, [setCallDelay]);

  const handleSoundToggle = useCallback(async () => {
    if (!currentUser?.uid || !gameState) return;
    
    try {
      const newSoundEnabled = !soundEnabled;
      setSoundEnabled(newSoundEnabled);
      console.log(`🔊 Sound toggled to ${newSoundEnabled ? 'on' : 'off'}`);
      
      await update(ref(database, `hosts/${currentUser.uid}/currentGame/gameState`), {
        soundEnabled: newSoundEnabled
      });
    } catch (err) {
      setError(handleApiError(err, 'Failed to toggle sound'));
    }
  }, [currentUser, gameState, soundEnabled]);

  const handleStatusChange = useCallback(async (status: 'active' | 'paused') => {
    if (localAllPrizesWon && status === 'active') {
      setError('Cannot resume game: All prizes have been won');
      return;
    }
    
    if (isGameComplete && status === 'active') {
      setError('Cannot resume game: Game is already completed');
      return;
    }
    
    console.log(`🔄 Changing game status to: ${status}`);
    
    try {
      if (status === 'paused') {
        console.log('🛑 Calling pauseGame()');
        await pauseGame();
      } else {
        console.log('▶️ Calling resumeGame()');
        await resumeGame();
        
        // Additional verification - make sure the game actually started
        setTimeout(async () => {
          try {
            if (currentUser?.uid) {
              const gameRef = ref(database, `hosts/${currentUser.uid}/currentGame/gameState`);
              const snapshot = await get(gameRef);
              
              if (snapshot.exists()) {
                const currentState = snapshot.val();
                console.log('🔍 Verifying game state after resume:', {
                  status: currentState.status,
                  isAutoCalling: currentState.isAutoCalling
                });
                
                if (currentState.status !== 'active' || !currentState.isAutoCalling) {
                  console.log('⚠️ Game not properly activated, forcing update');
                  await update(gameRef, {
                    status: 'active',
                    isAutoCalling: true
                  });
                }
              }
            }
          } catch (verifyErr) {
            console.error('❌ Error verifying game state:', verifyErr);
          }
        }, 500);
      }
    } catch (err) {
      console.error("❌ Error changing game status:", err);
      
      if (err instanceof Error && err.message.includes("PERMISSION_DENIED")) {
        try {
          console.log("🔄 Trying fallback approach to update game status");
          
          if (currentUser?.uid) {
            const updates = status === 'paused' 
              ? { status: 'paused', isAutoCalling: false }
              : { status: 'active', isAutoCalling: true };
              
            await update(ref(database, `hosts/${currentUser.uid}/currentGame/gameState`), updates);
            console.log("✅ Status updated successfully with fallback method");
          }
        } catch (fallbackErr) {
          console.error("❌ Fallback also failed:", fallbackErr);
          setError(handleApiError(err, 'Failed to change game status. Please check permissions.'));
        }
      } else {
        setError(handleApiError(err, 'Failed to change game status'));
      }
    }
  }, [pauseGame, resumeGame, localAllPrizesWon, currentUser, isGameComplete]);

  const handleGameEnd = useCallback(async () => {
    try {
      console.log('🏁 Ending game...');
      setIsGameComplete(true);
      
      await completeGame();
      
      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);
    } catch (err) {
      setError(handleApiError(err, 'Failed to end game'));
    }
  }, [completeGame, navigate]);

  const handleStartNewGame = useCallback(async () => {
    navigate('/dashboard', { replace: true });
  }, [navigate]);

  // Manual validation trigger for debugging
  const handleManualValidation = useCallback(async () => {
    try {
      console.log('🔍 Triggering manual prize validation...');
      if (triggerManualValidation) {
        await triggerManualValidation();
        console.log('✅ Manual validation completed');
      }
    } catch (err) {
      console.error('❌ Manual validation failed:', err);
      setError('Manual validation failed');
    }
  }, [triggerManualValidation]);

  // Rendering
  if (isLoading || !gameState) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  // Safely extract the winners from gameState
  const winners = gameState.gameState.winners || {};
  
  // Safe extraction of settings to prevent property errors
  const settings = gameState.settings || DEFAULT_SETTINGS;

  return (
    <div className="space-y-4">
      {/* Debug panel for development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-gray-100 p-4 rounded-lg border">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Debug Panel</h4>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <strong>Game Status:</strong> {gameState.gameState?.status || 'unknown'}
            </div>
            <div>
              <strong>Phase:</strong> {gameState.gameState?.phase || 'unknown'}
            </div>
            <div>
              <strong>Is Auto Calling:</strong> {gameState.gameState?.isAutoCalling ? 'Yes' : 'No'}
            </div>
            <div>
              <strong>Is Paused (derived):</strong> {isPaused ? 'Yes' : 'No'}
            </div>
            <div>
              <strong>Numbers Called:</strong> {calledNumbers.length}/90
            </div>
            <div>
              <strong>All Prizes Won:</strong> {localAllPrizesWon ? 'Yes' : 'No'}
            </div>
            <div>
              <strong>Game Complete:</strong> {isGameComplete ? 'Yes' : 'No'}
            </div>
            <div>
              <strong>Processing:</strong> {isProcessing ? 'Yes' : 'No'}
            </div>
          </div>
          <div className="mt-2 space-x-2">
            <button
              onClick={handleManualValidation}
              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Trigger Manual Validation
            </button>
            <button
              onClick={() => console.log('Current Game State:', gameState)}
              className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
            >
              Log Game State
            </button>
          </div>
        </div>
      )}

      <PlayingPhaseView
        currentGame={gameState}
        winners={winners}
        soundEnabled={soundEnabled}
        callDelay={callDelay}
        error={error}
        isGameComplete={isGameComplete}
        isProcessing={isProcessing}
        queueNumbers={queueNumbers}
        allPrizesWon={localAllPrizesWon}
        onSoundToggle={handleSoundToggle}
        onDelayChange={handleDelayChange}
        onGameEnd={handleGameEnd}
        onStartNewGame={handleStartNewGame}
        onErrorDismiss={() => setError(null)}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
};

export default PlayingPhase;
