// src/components/Dashboard/GamePhases/PlayingPhase/PlayingPhase.tsx

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
  currentGame?: Game.CurrentGame; // Make currentGame optional
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
    pauseGame,
    resumeGame,
    completeGame,
    setCallDelay
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

  // Set up loading state and initialize game
  useEffect(() => {
    if (!currentUser?.uid) {
      navigate('/login');
      return;
    }
    
    if (gameState && !initialized) {
      console.log("Initializing PlayingPhase with game state:", gameState);
      console.log("Game status:", gameState.gameState?.status);
      console.log("Game phase:", gameState.gameState?.phase);
      console.log("Called numbers:", gameState.numberSystem?.calledNumbers?.length || 0);
      
      const isComplete = gameState.gameState?.status === 'ended' || 
                        gameState.gameState?.phase === 4;
      
      setIsLoading(false);
      setIsGameComplete(isComplete);
      setLocalCallDelay(gameState.numberSystem?.callDelay || appConfig.gameDefaults.callDelay);
      setSoundEnabled(gameState.gameState?.soundEnabled || true);
      
      // Always initialize game in paused state when first entering the playing phase
      if (!isComplete && gameState.gameState?.status !== 'paused' && 
          (gameState.numberSystem?.calledNumbers?.length === 0 || 
           appConfig.gameDefaults.startInPausedState)) {
        console.log('Initializing game in paused state');
        initializeGameInPausedState(currentUser.uid);
      }
      
      setInitialized(true);
    } else if (gameState) {
      setIsLoading(false);
      setIsGameComplete(gameState.gameState?.status === 'ended' || 
                        gameState.gameState?.phase === 4);
    }
  }, [currentUser, gameState, navigate, initialized]);

  // Keep track of all prizes won status
  useEffect(() => {
    if (allPrizesWon && !isGameComplete) {
      console.log("All prizes have been won - updating UI");
    }
  }, [allPrizesWon, isGameComplete]);

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

  // Initialize game in paused state
  const initializeGameInPausedState = async (hostId: string) => {
    try {
      console.log('Setting game to paused state');
      const gameRef = ref(database, `hosts/${hostId}/currentGame`);
      const snapshot = await get(gameRef);
      
      if (snapshot.exists()) {
        // Update regardless of number count to ensure game starts paused
        await update(ref(database, `hosts/${hostId}/currentGame/gameState`), {
          status: 'paused'
        });
        console.log('Game initialized in paused state');
      }
    } catch (err) {
      console.error('Failed to initialize game in paused state:', err);
      setError(handleApiError(err, 'Failed to initialize game state. Please try refreshing.'));
    }
  };

  // Update error from game context
  useEffect(() => {
    if (gameError) {
      setError(gameError);
    }
  }, [gameError]);

  const handleDelayChange = useCallback(async (newDelay: number) => {
    // Update local state immediately for better UX
    setLocalCallDelay(newDelay);
    console.log(`Changing call delay to ${newDelay} seconds`);
    
    // Then update through the game context (which will update Firebase)
    try {
      await setCallDelay(newDelay);
    } catch (err) {
      setError(handleApiError(err, 'Failed to update call delay'));
    }
  }, [setCallDelay]);

  const handleSoundToggle = useCallback(async () => {
    if (!currentUser?.uid || !gameState) return;
    
    try {
      // Toggle sound in local state for immediate feedback
      const newSoundEnabled = !soundEnabled;
      setSoundEnabled(newSoundEnabled);
      console.log(`Sound toggled to ${newSoundEnabled ? 'on' : 'off'}`);
      
      // Update in Firebase
      await update(ref(database, `hosts/${currentUser.uid}/currentGame/gameState`), {
        soundEnabled: newSoundEnabled
      });
    } catch (err) {
      setError(handleApiError(err, 'Failed to toggle sound'));
    }
  }, [currentUser, gameState, soundEnabled]);

  const handleStatusChange = useCallback(async (status: 'active' | 'paused') => {
    if (allPrizesWon && status === 'active') {
      setError('Cannot resume game: All prizes have been won');
      return;
    }
    
    if (isGameComplete && status === 'active') {
      setError('Cannot resume game: Game is already completed');
      return;
    }
    
    console.log(`Changing game status to: ${status}`);
    
    try {
      if (status === 'paused') {
        await pauseGame();
      } else {
        await resumeGame();
      }
    } catch (err) {
      // More robust error handling
      console.error("Error changing game status:", err);
      
      // Try alternative approach if permission denied
      if (err instanceof Error && err.message.includes("PERMISSION_DENIED")) {
        try {
          console.log("Trying alternative approach to update game status");
          
          // Direct database update as a fallback
          if (currentUser?.uid) {
            if (status === 'paused') {
              await update(ref(database, `hosts/${currentUser.uid}/currentGame/gameState`), {
                status: 'paused',
                isAutoCalling: false
              });
            } else {
              await update(ref(database, `hosts/${currentUser.uid}/currentGame/gameState`), {
                status: 'active',
                isAutoCalling: true
              });
            }
            console.log("Status updated successfully with fallback method");
          }
        } catch (fallbackErr) {
          console.error("Fallback also failed:", fallbackErr);
          setError(handleApiError(err, 'Failed to change game status. Please check permissions.'));
        }
      } else {
        setError(handleApiError(err, 'Failed to change game status'));
      }
    }
  }, [pauseGame, resumeGame, allPrizesWon, currentUser, isGameComplete]);

  const handleGameEnd = useCallback(async () => {
    try {
      console.log('Ending game...');
      await completeGame();
      setIsGameComplete(true);
      navigate('/dashboard');
    } catch (err) {
      setError(handleApiError(err, 'Failed to end game'));
    }
  }, [completeGame, navigate]);

  const handleStartNewGame = useCallback(async () => {
    navigate('/dashboard', { replace: true });
  }, [navigate]);

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
  
  // Safe extraction of settings to prevent 'maxTickets' property error
  const settings = gameState.settings || DEFAULT_SETTINGS;

  return (
    <PlayingPhaseView
      currentGame={gameState}
      winners={winners}
      soundEnabled={soundEnabled}
      callDelay={callDelay}
      error={error}
      isGameComplete={isGameComplete}
      isProcessing={isProcessing}
      queueNumbers={queueNumbers}
      allPrizesWon={allPrizesWon}
      onSoundToggle={handleSoundToggle}
      onDelayChange={handleDelayChange}
      onGameEnd={handleGameEnd}
      onStartNewGame={handleStartNewGame}
      onErrorDismiss={() => setError(null)}
      onStatusChange={handleStatusChange}
    />
  );
};

export default PlayingPhase;
