// src/components/Dashboard/Dashboard.tsx - Updated with debug component

import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext'; // Add this import
import { GameDatabaseService } from '../../services/GameDatabaseService';
import DashboardHeader from './DashboardHeader';
import GameSetup from './GamePhases/GameSetup/GameSetup';
import BookingPhase from './GamePhases/BookingPhase/BookingPhase';
import PlayingPhase from './GamePhases/PlayingPhase/PlayingPhase';
import { LoadingSpinner } from '@components';
import { Game, GAME_PHASES, GAME_STATUSES } from '../../types/game';
import SubscriptionExpiredPrompt from './SubscriptionExpiredPrompt';
import appConfig from '../../config/appConfig'; // Add this import

// ADD THIS DEBUG COMPONENT DIRECTLY IN YOUR DASHBOARD FILE
const DeepDebugAnalysis = () => {
  const { currentUser } = useAuth();
  const gameContext = useGame();
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    // Comprehensive analysis
    const analysis = {
      timestamp: new Date().toISOString(),
      
      // 1. App Configuration
      appConfig: {
        hostUID: appConfig.hostUID,
        hostUID_type: typeof appConfig.hostUID,
        hostUID_length: appConfig.hostUID?.length,
        hostUID_truthy: !!appConfig.hostUID,
        entire_appConfig: appConfig
      },
      
      // 2. Current User
      currentUser: {
        uid: currentUser?.uid,
        email: currentUser?.email,
        exists: !!currentUser
      },
      
      // 3. Game Context
      gameContext: {
        hostId: gameContext.hostId,
        gameState_exists: !!gameContext.gameState,
        gameState_phase: gameContext.gameState?.gameState?.phase,
        gameState_status: gameContext.gameState?.gameState?.status,
        full_gameContext: gameContext
      },
      
      // 4. Browser Environment
      browser: {
        userAgent: navigator.userAgent,
        localStorage_keys: Object.keys(localStorage),
        sessionStorage_keys: Object.keys(sessionStorage),
        url: window.location.href,
        origin: window.location.origin
      },
      
      // 5. Check for old UID in various places
      oldUID_search: {
        in_localStorage: checkLocalStorageForOldUID(),
        in_sessionStorage: checkSessionStorageForOldUID(),
        in_appConfig: JSON.stringify(appConfig).includes('B8kbztcNrrXbvWYtlv3slaXJSyR2'),
        in_gameContext: JSON.stringify(gameContext).includes('B8kbztcNrrXbvWYtlv3slaXJSyR2')
      }
    };
    
    setDebugInfo(analysis);
    
    // Log everything to console
    console.log('🕵️ DEEP DEBUG ANALYSIS:', analysis);
    
    // Special check: look for the exact error path
    if (analysis.oldUID_search.in_gameContext) {
      console.log('🚨 FOUND OLD UID IN GAME CONTEXT!');
      console.log('Game Context:', gameContext);
    }
    
  }, [currentUser, gameContext]);

  // Helper functions
  function checkLocalStorageForOldUID() {
    const findings: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = localStorage.getItem(key || '');
      if (value?.includes('B8kbztcNrrXbvWYtlv3slaXJSyR2')) {
        findings.push(`${key}: ${value}`);
      }
    }
    return findings;
  }

  function checkSessionStorageForOldUID() {
    const findings: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      const value = sessionStorage.getItem(key || '');
      if (value?.includes('B8kbztcNrrXbvWYtlv3slaXJSyR2')) {
        findings.push(`${key}: ${value}`);
      }
    }
    return findings;
  }

  return (
    <div className="bg-red-50 border-4 border-red-500 rounded-lg p-6 mb-4 max-w-full overflow-auto">
      <h2 className="text-2xl font-bold text-red-800 mb-4">🕵️ DEEP DEBUG ANALYSIS</h2>
      
      {/* Quick Status */}
      <div className="bg-white p-4 rounded border-2 border-red-300 mb-4">
        <h3 className="font-bold text-lg text-red-700 mb-2">🎯 SMOKING GUN CHECK</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>App Config Host UID:</span>
            <span className="font-mono font-bold text-blue-600">{debugInfo.appConfig?.hostUID}</span>
          </div>
          <div className="flex justify-between">
            <span>Game Context Host ID:</span>
            <span className="font-mono font-bold text-purple-600">{debugInfo.gameContext?.hostId}</span>
          </div>
          <div className="flex justify-between">
            <span>Current User UID:</span>
            <span className="font-mono font-bold text-green-600">{debugInfo.currentUser?.uid}</span>
          </div>
          <div className="flex justify-between">
            <span>Old UID in Game Context:</span>
            <span className="font-bold text-red-600">
              {debugInfo.oldUID_search?.in_gameContext ? '🚨 YES - FOUND THE PROBLEM!' : '✅ No'}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex flex-wrap gap-3">
        <button 
          onClick={() => {
            console.log('🧹 CLEARING ALL BROWSER DATA');
            localStorage.clear();
            sessionStorage.clear();
            alert('All browser storage cleared! Please refresh the page.');
          }}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          🧹 Clear All Storage
        </button>
        
        <button 
          onClick={() => {
            console.log('🔍 FULL DEBUG DUMP:');
            console.log(debugInfo);
            console.log('appConfig object:', appConfig);
            console.log('gameContext object:', gameContext);
            console.log('currentUser object:', currentUser);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          🔍 Full Console Log
        </button>
        
        <button 
          onClick={() => {
            // Force hard refresh
            window.location.reload();
          }}
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          🔄 Hard Refresh
        </button>
      </div>
    </div>
  );
};

// YOUR EXISTING DASHBOARD COMPONENT (add the debug at the top of the return)
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
  prizes: DEFAULT_PRIZES
};

function Dashboard() {
  const { currentUser, userProfile, isSubscriptionValid } = useAuth();
  const [currentGame, setCurrentGame] = useState<Game.CurrentGame | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitializingGame, setIsInitializingGame] = useState(false);

  const databaseService = GameDatabaseService.getInstance();

  useEffect(() => {
    if (!currentUser?.uid) return;

    const unsubscribe = databaseService.subscribeToCurrentGame(
      currentUser.uid,
      (gameData, error) => {
        setIsLoading(true);
        
        if (error) {
          console.error('Error loading game data:', error);
          setError('Error loading game data');
          setIsLoading(false);
          return;
        }

        try {
          if (gameData) {
            if (!gameData.gameState || !gameData.gameState.phase) {
              gameData.gameState = { ...DEFAULT_GAME_STATE };
            }
            
            if (!gameData.settings) {
              gameData.settings = { ...DEFAULT_SETTINGS };
            } else if (!gameData.settings.prizes) {
              gameData.settings.prizes = { ...DEFAULT_PRIZES };
            }
            
            if (!gameData.numberSystem) {
              gameData.numberSystem = { ...DEFAULT_NUMBER_SYSTEM };
            }
          }
          
          setCurrentGame(gameData);
          setError(null);
        } catch (err) {
          console.error('Error processing game data:', err);
          setError('Error processing game data');
        } finally {
          setIsLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, [currentUser?.uid]);

  const initializeNewGame = async () => {
    if (!currentUser?.uid) return;
    
    if (!isSubscriptionValid) {
      setError('Your subscription has expired. Please renew your subscription to create new games.');
      return;
    }
    
    setIsInitializingGame(true);
    try {
      let gameSettings = DEFAULT_SETTINGS;
      
      const defaultSettings = await databaseService.getDefaultSettings(currentUser.uid);
      if (defaultSettings) {
        console.log('Using default settings from previous game');
        gameSettings = defaultSettings;
        
        if (!gameSettings.prizes) {
          gameSettings.prizes = DEFAULT_PRIZES;
        }
        
        if (!gameSettings.maxTickets) {
          gameSettings.maxTickets = 90;
        }
      }
      
      const newGame: Game.CurrentGame = {
        settings: gameSettings,
        gameState: DEFAULT_GAME_STATE,
        numberSystem: DEFAULT_NUMBER_SYSTEM,
        startTime: Date.now(),
        activeTickets: {
          tickets: {},
          bookings: {}
        }
      };

      await databaseService.setCurrentGame(currentUser.uid, newGame);
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

    const typedGame = currentGame as Game.CurrentGame;

    switch (phase) {
      case GAME_PHASES.SETUP:
        return <GameSetup currentGame={typedGame} />;
      case GAME_PHASES.BOOKING:
        return <BookingPhase currentGame={typedGame} />;
      case GAME_PHASES.PLAYING:
        return <PlayingPhase currentGame={typedGame} />;
      default:
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
      {/* ADD THE DEBUG COMPONENT HERE - FIRST THING IN THE RETURN */}
      <DeepDebugAnalysis />
      
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

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
            {error}
          </div>
        )}
      </main>
    </div>
  );
}

export default Dashboard;
