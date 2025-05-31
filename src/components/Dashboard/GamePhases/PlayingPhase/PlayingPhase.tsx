// ===== COMPLETE FILE 3: src/components/Dashboard/GamePhases/PlayingPhase/PlayingPhase.tsx =====

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import { useGame } from '../../../../contexts/GameContext';
import { LoadingSpinner } from '@components';
import PlayingPhaseView from './PlayingPhaseView';
import { Game } from '../../../../types/game';

const PlayingPhase: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  // Use game controller from context
  const {
    currentGame,
    isProcessing,
    isPaused,
    currentNumber,
    calledNumbers,
    error: gameError,
    allPrizesWon,
    isGameEnded,
    pauseGame,
    resumeGame,
    completeGame,
    setCallDelay,
    setSoundEnabled,
    resetError
  } = useGame();
  
  // Local state - simplified
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGameComplete, setIsGameComplete] = useState(false);
  const [soundEnabled, setSoundEnabledLocal] = useState(true);
  const [callDelay, setCallDelayLocal] = useState(5);

  // FIXED: Initialize component without constant logging
  useEffect(() => {
    if (!currentUser?.uid) {
      navigate('/login');
      return;
    }
    
    if (currentGame) {
      console.log("PlayingPhase initialized with game:", {
        status: currentGame.gameState?.status,
        phase: currentGame.gameState?.phase,
        calledNumbers: currentGame.numberSystem?.calledNumbers?.length || 0,
        allPrizesWon: currentGame.gameState?.allPrizesWon
      });
      
      const isComplete = currentGame.gameState?.status === 'ended' || 
                        currentGame.gameState?.phase === 4 ||
                        isGameEnded;
      
      setIsLoading(false);
      setIsGameComplete(isComplete);
      setCallDelayLocal(currentGame.numberSystem?.callDelay || 5);
      setSoundEnabledLocal(currentGame.gameState?.soundEnabled !== false);
    }
  }, [currentUser, currentGame, navigate, isGameEnded]);

  // Sync with game completion states
  useEffect(() => {
    if (allPrizesWon || isGameEnded) {
      setIsGameComplete(true);
    }
  }, [allPrizesWon, isGameEnded]);

  // Sync with game error
  useEffect(() => {
    if (gameError) {
      setError(gameError);
    }
  }, [gameError]);

  // Handle delay change
  const handleDelayChange = useCallback(async (newDelay: number) => {
    setCallDelayLocal(newDelay);
    console.log(`Changing call delay to ${newDelay} seconds`);
    
    try {
      await setCallDelay(newDelay);
    } catch (err) {
      console.error('Failed to update call delay:', err);
      setError('Failed to update call delay');
    }
  }, [setCallDelay]);

  // Handle sound toggle
  const handleSoundToggle = useCallback(async () => {
    const newSoundEnabled = !soundEnabled;
    setSoundEnabledLocal(newSoundEnabled);
    console.log(`Sound toggled to ${newSoundEnabled ? 'on' : 'off'}`);
    
    try {
      await setSoundEnabled(newSoundEnabled);
    } catch (err) {
      console.error('Failed to toggle sound:', err);
      setError('Failed to toggle sound');
    }
  }, [soundEnabled, setSoundEnabled]);

  // Handle status change (pause/resume)
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
      console.error("Error changing game status:", err);
      setError('Failed to change game status');
    }
  }, [allPrizesWon, isGameComplete, pauseGame, resumeGame]);

  // Handle game end
  const handleGameEnd = useCallback(async () => {
    try {
      console.log('Ending game...');
      setIsGameComplete(true);
      
      await completeGame();
      
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (err) {
      console.error('Failed to end game:', err);
      setError('Failed to end game');
    }
  }, [completeGame, navigate]);

  // Handle start new game
  const handleStartNewGame = useCallback(async () => {
    navigate('/dashboard', { replace: true });
  }, [navigate]);

  // Handle error dismissal
  const handleErrorDismiss = useCallback(() => {
    setError(null);
    resetError();
  }, [resetError]);

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

  return (
    <div className="space-y-4">
      <PlayingPhaseView
        currentGame={currentGame}
        winners={winners}
        soundEnabled={soundEnabled}
        callDelay={callDelay}
        error={error}
        isGameComplete={isGameComplete}
        isProcessing={isProcessing}
        queueNumbers={[]}
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
