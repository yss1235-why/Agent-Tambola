// src/components/Dashboard/Dashboard.tsx - UPDATED to use Command Queue Pattern
// Simplified dashboard that uses commands instead of complex database operations

import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import DashboardHeader from './DashboardHeader';
import GameSetup from './GamePhases/GameSetup/GameSetup';
import BookingPhase from './GamePhases/BookingPhase/BookingPhase';
import PlayingPhase from './GamePhases/PlayingPhase/PlayingPhase';
import { LoadingSpinner } from '@components';
import { Game, GAME_PHASES } from '../../types/game';
import SubscriptionExpiredPrompt from './SubscriptionExpiredPrompt';

// Default settings for new games
const DEFAULT_PRIZES: Game.Settings['prizes'] = {
  quickFive: true,
  topLine: true,
  middleLine: true,
  bottomLine: true,
  corners: true,
  starCorners: false,
  halfSheet: true,
  fullSheet: true,
  fullHouse: true,
  secondFullHouse: false,
};

const DEFAULT_SETTINGS: Game.Settings = {
  maxTickets: 90,
  selectedTicketSet: 1,
  callDelay: 5,
  hostPhone: '',
  prizes: DEFAULT_PRIZES
};

function Dashboard() {
  const { currentUser, userProfile, isSubscriptionValid } = useAuth();
  
  // Get game state and command methods from context
  const { 
    currentGame, 
    isLoading: gameLoading, 
    error: gameError,
    initializeGame,
    isProcessing 
  } = useGame();
  
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  // Sync errors from game context
  useEffect(() => {
    if (gameError) {
      setError(gameError);
    }
  }, [gameError]);

  /**
   * Initialize a new game using commands
   */
  const handleInitializeNewGame = async () => {
    if (!currentUser?.uid || !isSubscriptionValid) {
      setError('Cannot create new game: Invalid subscription or user');
      return;
    }
    
    setIsInitializing(true);
    setError(null);
    
    try {
      console.log('🎮 Initializing new game with command');
      
      // Use default settings (could load from previous game if needed)
      let gameSettings = DEFAULT_SETTINGS;
      
      // Try to load default settings from a simple API call
      // Note: This could be enhanced to load from user preferences
      try {
        // For now, just use defaults
        console.log('Using default settings for new game');
      } catch (settingsError) {
        console.warn('Could not load default settings, using fallback:', settingsError);
        gameSettings = DEFAULT_SETTINGS;
      }
      
      // Send command to initialize game
      const commandId = initializeGame(gameSettings);
      console.log(`📤 Initialize game command sent: ${commandId}`);
      
      // The command processor will handle all the complex initialization
      // including creating the game state, setting up default tickets, etc.
      
    } catch (err) {
      console.error('❌ Failed to initialize game:', err);
      setError('Failed to initialize new game. Please try again.');
    } finally {
      setIsInitializing(false);
    }
  };

  /**
   * Render appropriate game phase based on current game state
   */
  const renderGamePhase = () => {
    if (!currentGame || !currentGame.gameState) {
      return null;
    }

    const phase = currentGame.gameState.phase;
    console.log('📍 Rendering phase:', phase);

    switch (phase) {
      case GAME_PHASES.SETUP:
        return <GameSetup currentGame={currentGame} />;
        
      case GAME_PHASES.BOOKING:
        return <BookingPhase currentGame={currentGame} />;
        
      case GAME_PHASES.PLAYING:
        return <PlayingPhase />;
        
      case GAME_PHASES.COMPLETED:
      default:
        return (
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold text-gray-900">
              Game Completed
            </h2>
            <p className="mt-2 text-gray-600">
              The game has ended. Start a new game to continue.
            </p>
            {isSubscriptionValid ? (
              <button
                onClick={handleInitializeNewGame}
                disabled={isInitializing || isProcessing}
                className={`mt-4 px-6 py-2 rounded-lg bg-blue-500 text-white font-medium
                  ${isInitializing || isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'}`}
              >
                {isInitializing ? 'Initializing...' : 'Start New Game'}
              </button>
            ) : (
              <SubscriptionExpiredPrompt />
            )}
          </div>
        );
    }
  };

  // Loading state
  if (gameLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <LoadingSpinner size="large" />
          <p className="mt-4 text-gray-600">Loading game data...</p>
        </div>
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
        {/* Command Queue Status (for debugging in development) */}
        {process.env.NODE_ENV === 'development' && isProcessing && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center">
              <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full mr-2" />
              <span className="text-sm text-blue-800">Commands are being processed...</span>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
            <div className="flex items-center justify-between">
              <span>{error}</span>
              <button 
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Game Content */}
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
                onClick={handleInitializeNewGame}
                disabled={isInitializing || isProcessing}
                className={`mt-4 px-6 py-2 rounded-lg bg-blue-500 text-white font-medium
                  ${isInitializing || isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'}`}
              >
                {isInitializing ? (
                  <span className="flex items-center">
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                    Initializing...
                  </span>
                ) : (
                  'Start New Game'
                )}
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
