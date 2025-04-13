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
      setIsLoading(false);
      setIsGameComplete(gameState.gameState?.status === 'ended');
      setLocalCallDelay(gameState.numberSystem?.callDelay || appConfig.gameDefaults.callDelay);
      setSoundEnabled(gameState.gameState?.soundEnabled || true);
      
      // Initialize game in paused state if needed
      if (appConfig.gameDefaults.startInPausedState && 
          gameState.gameState?.status === 'active' && 
          gameState.numberSystem?.calledNumbers?.length === 0) {
        console.log('Initializing game in paused state');
        initializeGameInPausedState(currentUser.uid);
      }
      
      setInitialized(true);
    } else if (gameState) {
      setIsLoading(false);
      setIsGameComplete(gameState.gameState?.status === 'ended');
    }
  }, [currentUser, gameState, navigate, initialized]);

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
        // Only update if the game has no called numbers
        const game = snapshot.val() as Game.CurrentGame;
        if ((game.numberSystem?.calledNumbers?.length || 0) === 0) {
          await update(ref(database, `hosts/${hostId}/currentGame/gameState`), {
            status: 'paused'
          });
          console.log('Game initialized in paused state');
        }
      }
    } catch (err) {
      console.error('Failed to initialize game in paused state:', err);
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
    
    console.log(`Changing game status to: ${status}`);
    
    try {
      if (status === 'paused') {
        await pauseGame();
      } else {
        await resumeGame();
      }
    } catch (err) {
      setError(handleApiError(err, 'Failed to change game status'));
    }
  }, [pauseGame, resumeGame, allPrizesWon]);

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

  return (
    <PlayingPhaseView
      currentGame={gameState}
      winners={gameState.gameState.winners}
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