// src/components/Dashboard/Dashboard.tsx

import { useState, useEffect } from 'react';
import { ref, onValue, set, get } from 'firebase/database';
import { database } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import DashboardHeader from './DashboardHeader';
import GameSetup from './GamePhases/GameSetup/GameSetup';
import BookingPhase from './GamePhases/BookingPhase/BookingPhase';
import PlayingPhase from './GamePhases/PlayingPhase/PlayingPhase';
import { LoadingSpinner } from '@components';
import { Game, GAME_PHASES, GAME_STATUSES } from '../../types/game';
import SubscriptionExpiredPrompt from './SubscriptionExpiredPrompt';

const DEFAULT_GAME_STATE: Game.GameState = {
  phase: GAME_PHASES.SETUP,
  status: GAME_STATUSES.SETUP,
  isAutoCalling: false,
  soundEnabled: true,
  winners: {
    quickFive: [],
    topLine: [],
    middleLine: [],
    bottomLine: [],
    corners: [],
    starCorners: [],
    halfSheet: [],
    fullSheet: [],
    fullHouse: [],
    secondFullHouse: []
  }
};

const DEFAULT_NUMBER_SYSTEM: Game.NumberSystem = {
  callDelay: 5,
  currentNumber: null,
  calledNumbers: [],
  queue: []
};

const DEFAULT_SETTINGS: Game.Settings = {
  maxTickets: 90,
  selectedTicketSet: 1,
  callDelay: 5,
  hostPhone: '',
  prizes: {
    quickFive: true,
    topLine: true,
    middleLine: true,
    bottomLine: true,
    corners: true,
    starCorners: false,
    halfSheet: true,
    fullSheet: true,
    fullHouse: true,
    secondFullHouse: false
  }
};

function Dashboard() {
  const { currentUser, userProfile, isSubscriptionValid } = useAuth();
  const [currentGame, setCurrentGame] = useState<Game.CurrentGame | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitializingGame, setIsInitializingGame] = useState(false);

  useEffect(() => {
    if (!currentUser?.uid) return;

    const gameRef = ref(database, `hosts/${currentUser.uid}/currentGame`);
    
    const unsubscribe = onValue(gameRef, (snapshot) => {
      setIsLoading(true);
      try {
        const gameData = snapshot.val();
        console.log('Current game data:', gameData);
        if (gameData) {
          // Ensure gameState exists with a valid phase
          if (!gameData.gameState || !gameData.gameState.phase) {
            gameData.gameState = { ...DEFAULT_GAME_STATE };
          }
        }
        setCurrentGame(gameData);
        setError(null);
      } catch (err) {
        console.error('Error loading game data:', err);
        setError('Error loading game data');
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [currentUser?.uid]);

  const initializeNewGame = async () => {
    if (!currentUser?.uid) return;
    
    // Check if subscription is valid
    if (!isSubscriptionValid) {
      setError('Your subscription has expired. Please renew your subscription to create new games.');
      return;
    }
    
    setIsInitializingGame(true);
    try {
      // Try to load default settings
      let gameSettings = DEFAULT_SETTINGS;
      
      const defaultSettingsRef = ref(database, `hosts/${currentUser.uid}/defaultSettings`);
      const snapshot = await get(defaultSettingsRef);
      
      if (snapshot.exists()) {
        // Use stored default settings
        console.log('Using default settings from previous game');
        gameSettings = snapshot.val();
      }
      
      const gameRef = ref(database, `hosts/${currentUser.uid}/currentGame`);
      
      const newGame = {
        settings: gameSettings,
        gameState: DEFAULT_GAME_STATE,
        numberSystem: DEFAULT_NUMBER_SYSTEM,
        startTime: Date.now(),
        activeTickets: {
          tickets: {},
          bookings: {}
        }
      };

      await set(gameRef, newGame);
      setError(null);
    } catch (err) {
      console.error('Error initializing game:', err);
      setError('Failed to initialize new game');
    } finally {
      setIsInitializingGame(false);
    }
  };

  const renderGamePhase = () => {
    if (!currentGame || !currentGame.gameState) {
      return null;
    }

    const phase = currentGame.gameState.phase;
    console.log('Rendering phase:', phase);

    // Type assertion to fix prop passing issues
    const typedGame = currentGame as Game.CurrentGame;

    switch (phase) {
      case GAME_PHASES.SETUP:
        return <GameSetup currentGame={typedGame} />;
      case GAME_PHASES.BOOKING:
        return <BookingPhase currentGame={typedGame} />;
      case GAME_PHASES.PLAYING:
        return <PlayingPhase currentGame={typedGame} />;
      default:
        // If phase is invalid or 4 (completed), show the "Start New Game" option
        return (
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold text-gray-900">
              Game Completed or Invalid Phase
            </h2>
            <p className="mt-2 text-gray-600">
              Start a new game to continue
            </p>
            {isSubscriptionValid ? (
              <button
                onClick={initializeNewGame}
                disabled={isInitializingGame}
                className={`mt-4 px-6 py-2 rounded-lg bg-blue-500 text-white font-medium
                  ${isInitializingGame ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'}`}
              >
                {isInitializingGame ? 'Initializing...' : 'Start New Game'}
              </button>
            ) : (
              <SubscriptionExpiredPrompt />
            )}
          </div>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <DashboardHeader 
        username={userProfile?.username || 'Host'}
        subscriptionEnd={userProfile?.subscriptionEnd || 0}
      />
      
      <main className="px-6 py-4">
        {currentGame ? (
          <div className="mt-6">
            {renderGamePhase()}
          </div>
        ) : (
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold text-gray-900">
              No Active Game
            </h2>
            <p className="mt-2 text-gray-600">
              Start a new game by configuring game settings
            </p>
            {isSubscriptionValid ? (
              <button
                onClick={initializeNewGame}
                disabled={isInitializingGame}
                className={`mt-4 px-6 py-2 rounded-lg bg-blue-500 text-white font-medium
                  ${isInitializingGame ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'}`}
              >
                {isInitializingGame ? 'Initializing...' : 'Start New Game'}
              </button>
            ) : (
              <SubscriptionExpiredPrompt />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default Dashboard;
