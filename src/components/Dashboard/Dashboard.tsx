// src/components/Dashboard/Dashboard.tsx - FIXED: Load previous settings for new games
// Modified to preserve prize selections and other settings across games

import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import DashboardHeader from './DashboardHeader';
import GameSetup from './GamePhases/GameSetup/GameSetup';
import BookingPhase from './GamePhases/BookingPhase/BookingPhase';
import PlayingPhase from './GamePhases/PlayingPhase/PlayingPhase';
import WinnerDisplay from './GamePhases/PlayingPhase/components/WinnerDisplay';
import { LoadingSpinner } from '@components';
import { Game, GAME_PHASES } from '../../types/game';
import SubscriptionExpiredPrompt from './SubscriptionExpiredPrompt';
import { GameDatabaseService } from '../../services/GameDatabaseService'; // NEW: Import for loading saved settings

// Default settings for new games - ONLY used if no saved settings exist
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
  const [isLoadingSettings, setIsLoadingSettings] = useState(false); // NEW: Loading state for settings

  // Sync errors from game context
  useEffect(() => {
    if (gameError) {
      setError(gameError);
    }
  }, [gameError]);

  /**
   * 🔥 FIXED: Load saved settings and preserve user preferences
   */
  const loadSavedSettings = async (): Promise<Game.Settings> => {
    if (!currentUser?.uid) {
      console.log('📁 No user ID, using default settings');
      return DEFAULT_SETTINGS;
    }
    
    try {
      setIsLoadingSettings(true);
      
      const dbService = GameDatabaseService.getInstance();
      const savedSettings = await dbService.getDefaultSettings(currentUser.uid);
      
      if (savedSettings) {
        console.log('✅ Loaded saved settings for new game:', {
          enabledPrizes: Object.entries(savedSettings.prizes || {}).filter(([_, enabled]) => enabled).length,
          maxTickets: savedSettings.maxTickets,
          callDelay: savedSettings.callDelay,
          hostPhone: savedSettings.hostPhone ? 'Present' : 'Missing',
          selectedTicketSet: savedSettings.selectedTicketSet
        });
        
        // Ensure all required properties exist (merge with defaults as fallback)
        const mergedSettings: Game.Settings = {
          ...DEFAULT_SETTINGS,
          ...savedSettings,
          // Ensure prizes object exists and has all required properties
          prizes: {
            ...DEFAULT_PRIZES,
            ...(savedSettings.prizes || {})
          }
        };
        
        return mergedSettings;
        
      } else {
        console.log('📁 No saved settings found, using defaults for first-time setup');
        return DEFAULT_SETTINGS;
      }
      
    } catch (error) {
      console.error('❌ Error loading saved settings:', error);
      console.log('📁 Falling back to default settings due to error');
      return DEFAULT_SETTINGS;
    } finally {
      setIsLoadingSettings(false);
    }
  };

  /**
   * 🔥 UPDATED: Initialize new game with saved settings (preserve prize selections)
   */
  const handleInitializeNewGame = async () => {
    if (!currentUser?.uid || !isSubscriptionValid) {
      setError('Cannot create new game: Invalid subscription or user');
      return;
    }
    
    setIsInitializing(true);
    setError(null);
    
    try {
      console.log('🎮 Initializing new game with preserved settings...');
      
      // 🔥 FIXED: Load previously saved settings instead of using hardcoded defaults
      const gameSettings = await loadSavedSettings();
      
      console.log('🔥 Using settings for new game:', {
        source: 'Loaded from database (preserves previous selections)',
        enabledPrizes: Object.entries(gameSettings.prizes).filter(([_, enabled]) => enabled).length,
        maxTickets: gameSettings.maxTickets,
        callDelay: gameSettings.callDelay,
        selectedTicketSet: gameSettings.selectedTicketSet,
        hostPhone: gameSettings.hostPhone ? 'Preserved' : 'Default',
        preservedPrizes: Object.entries(gameSettings.prizes)
          .filter(([_, enabled]) => enabled)
          .map(([name]) => name)
      });
      
      // Send command to initialize game with loaded settings
      const commandId = initializeGame(gameSettings);
      console.log(`📤 Initialize game command sent with preserved settings: ${commandId}`);
      
      // Show success message indicating settings were preserved
      if (gameSettings.hostPhone && gameSettings.hostPhone !== '+91') {
        console.log('✅ Settings preserved: Previous prize selections and preferences loaded successfully');
      }
      
    } catch (err) {
      console.error('❌ Failed to initialize game:', err);
      setError(`Failed to initialize new game: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
        // Show winners above "Start New Game" button
        const winners = currentGame.gameState?.winners || {
          quickFive: [], topLine: [], middleLine: [], bottomLine: [],
          corners: [], starCorners: [], halfSheet: [], fullSheet: [],
          fullHouse: [], secondFullHouse: []
        };
        
        const activeTickets = currentGame.activeTickets || { tickets: {}, bookings: {} };
        const settings = currentGame.settings || DEFAULT_SETTINGS;
        
        return (
          <div className="space-y-8">
            {/* Game Completion Header */}
            <div className="text-center py-8">
              <h2 className="text-2xl font-semibold text-gray-900">
                Game Completed
              </h2>
              <p className="mt-2 text-gray-600">
                The game has ended. Here are all the winners from this game.
              </p>
            </div>

            {/* Winners Display Section */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center mb-6">
                <div className="bg-green-100 p-3 rounded-full mr-4">
                  <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">Final Results</h3>
                  <p className="text-gray-600">All winners from this completed game</p>
                </div>
              </div>
              
              <WinnerDisplay
                winners={winners}
                tickets={activeTickets.tickets}
                bookings={activeTickets.bookings}
                prizes={settings.prizes}
                showAllPrizes={true}
              />
            </div>

            {/* Game Statistics */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h4 className="text-lg font-medium text-blue-900 mb-4">Game Statistics</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {currentGame.numberSystem?.calledNumbers?.length || 0}
                  </div>
                  <div className="text-sm text-gray-600">Numbers Called</div>
                </div>
                <div className="bg-white rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {Object.keys(activeTickets.bookings || {}).length}
                  </div>
                  <div className="text-sm text-gray-600">Total Tickets</div>
                </div>
                <div className="bg-white rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {Object.values(winners).reduce((acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0), 0)}
                  </div>
                  <div className="text-sm text-gray-600">Prizes Claimed</div>
                </div>
              </div>
            </div>

            {/* 🔥 UPDATED: Start New Game Section with settings preservation info */}
            <div className="text-center py-8">
              <p className="mb-4 text-gray-600">
                Ready to start a new game?
              </p>
              <p className="mb-6 text-sm text-blue-600">
                Your prize selections and game settings will be preserved from this game.
              </p>
              {isSubscriptionValid ? (
                <button
                  onClick={handleInitializeNewGame}
                  disabled={isInitializing || isProcessing || isLoadingSettings}
                  className={`px-8 py-3 rounded-lg bg-blue-500 text-white font-medium text-lg
                    ${isInitializing || isProcessing || isLoadingSettings ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'}`}
                >
                  {isInitializing ? (
                    <span className="flex items-center">
                      <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2" />
                      Initializing...
                    </span>
                  ) : isLoadingSettings ? (
                    <span className="flex items-center">
                      <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2" />
                      Loading Settings...
                    </span>
                  ) : (
                    'Start New Game'
                  )}
                </button>
              ) : (
                <SubscriptionExpiredPrompt />
              )}
              
              {/* 🔥 NEW: Settings preservation indicator */}
              {currentGame?.settings && (
                <div className="mt-4 text-xs text-gray-500 max-w-md mx-auto">
                  <p>
                    ✅ The new game will preserve: {Object.entries(currentGame.settings.prizes).filter(([_, enabled]) => enabled).length} prize selections, 
                    {currentGame.settings.maxTickets} max tickets, 
                    {currentGame.settings.callDelay}s delay, 
                    and ticket set {currentGame.settings.selectedTicketSet}
                  </p>
                </div>
              )}
            </div>
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

        {/* 🔥 NEW: Settings Loading Indicator */}
        {isLoadingSettings && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center">
              <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full mr-2" />
              <span className="text-sm text-blue-800">Loading your previous game settings...</span>
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
              Start a new game - your previous settings will be preserved
            </p>
            {isSubscriptionValid ? (
              <div>
                <button
                  onClick={handleInitializeNewGame}
                  disabled={isInitializing || isProcessing || isLoadingSettings}
                  className={`mt-4 px-6 py-2 rounded-lg bg-blue-500 text-white font-medium
                    ${isInitializing || isProcessing || isLoadingSettings ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'}`}
                >
                  {isInitializing ? (
                    <span className="flex items-center">
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                      Initializing...
                    </span>
                  ) : isLoadingSettings ? (
                    <span className="flex items-center">
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                      Loading Settings...
                    </span>
                  ) : (
                    'Start New Game'
                  )}
                </button>
                
                {/* 🔥 NEW: Settings preservation info for initial game start */}
                <p className="mt-3 text-sm text-blue-600">
                  Prize selections and game preferences will be preserved from your previous games
                </p>
              </div>
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
