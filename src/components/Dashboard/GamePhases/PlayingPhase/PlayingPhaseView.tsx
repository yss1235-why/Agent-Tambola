// src/components/Dashboard/GamePhases/PlayingPhase/PlayingPhaseView.tsx - CLEAN VERSION
// Removed instructional content

import { useState, useEffect } from 'react';
import { AlertCircle, Award, Check, Trophy } from 'lucide-react'; 
import { GameControls, LoadingSpinner, Toast } from '@components';
import NumberBoard from './components/NumberBoard';
import WinnerDisplay from './components/WinnerDisplay';
import { Game } from '../../../../types/game';

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

interface PlayingPhaseViewProps {
  currentGame: Game.CurrentGame | null;
  winners: Game.GameState['winners'];
  soundEnabled: boolean;
  callDelay: number;
  error: string | null;
  isGameComplete: boolean;
  isProcessing: boolean;
  queueNumbers: number[];
  allPrizesWon: boolean;
  onSoundToggle: () => void;
  onDelayChange: (delay: number) => void;
  onGameEnd: () => void;
  onStartNewGame: () => void;
  onErrorDismiss: () => void;
  onStatusChange: (status: 'active' | 'paused') => void;
}

function PlayingPhaseView({
  currentGame,
  winners,
  soundEnabled,
  callDelay,
  error,
  isGameComplete,
  isProcessing,
  queueNumbers,
  allPrizesWon,
  onSoundToggle,
  onDelayChange,
  onGameEnd,
  onStartNewGame,
  onErrorDismiss,
  onStatusChange
}: PlayingPhaseViewProps) {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning' | 'info'>('info');
  const [lastWinnerCount, setLastWinnerCount] = useState(0);
  const [gameStats, setGameStats] = useState({
    numbersLeft: 0,
    gameProgress: 0,
    ticketCount: 0,
    averageSpeed: 0 
  });

  const activeTickets = currentGame?.activeTickets || { tickets: {}, bookings: {} };
  const settings = currentGame?.settings || DEFAULT_SETTINGS;
  const gameState = currentGame?.gameState || { status: 'paused' };
  const numberSystem = currentGame?.numberSystem || { callDelay: 5, calledNumbers: [], queue: [], currentNumber: null };
  
  const hasActivePrizes = settings?.prizes ? Object.values(settings.prizes).some(isActive => isActive) : false;
  const hasBookedTickets = Object.keys(activeTickets?.bookings || {}).length > 0;

  useEffect(() => {
    if (currentGame) {
      const calledCount = numberSystem?.calledNumbers?.length || 0;
      const totalNumbers = 90;
      const ticketCount = Object.keys(activeTickets?.bookings || {}).length;
      
      const startTime = currentGame.startTime || Date.now();
      const currentTime = Date.now();
      const gameTimeSeconds = Math.max(1, (currentTime - startTime) / 1000);
      const averageSpeed = calledCount > 0 ? (gameTimeSeconds / calledCount).toFixed(1) : '0.0';
      
      setGameStats({
        numbersLeft: totalNumbers - calledCount,
        gameProgress: Math.round((calledCount / totalNumbers) * 100),
        ticketCount,
        averageSpeed: parseFloat(averageSpeed)
      });
    }
  }, [currentGame, numberSystem, activeTickets]);

  useEffect(() => {
    if (allPrizesWon && !isGameComplete) {
      setToastMessage('All prizes have been won! Game is ending automatically.');
      setToastType('success');
      setShowToast(true);
    }
  }, [allPrizesWon, isGameComplete]);

  useEffect(() => {
    if (currentGame && !isGameComplete && !allPrizesWon) {
      if (!hasActivePrizes) {
        setToastMessage('No active prizes configured. Prize detection is disabled.');
        setToastType('warning');
        setShowToast(true);
      } else if (!hasBookedTickets) {
        setToastMessage('No tickets have been booked. Prize detection is disabled.');
        setToastType('warning');
        setShowToast(true);
      }
    }
  }, [currentGame, hasActivePrizes, hasBookedTickets, isGameComplete, allPrizesWon]);

  useEffect(() => {
    if (!winners) return;
    
    const currentWinnerCount = Object.values(winners).reduce((acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0), 0);
    
    if (currentWinnerCount > lastWinnerCount && lastWinnerCount > 0) {
      setToastMessage('New prize claimed! 🎉');
      setToastType('success');
      setShowToast(true);
    }
    
    setLastWinnerCount(currentWinnerCount);
  }, [winners, lastWinnerCount]);

  const handleWinnerNotification = (prizeType: string, playerName: string) => {
    const message = prizeType.includes('+') 
      ? `${playerName} won multiple prizes: ${prizeType}! 🏆`
      : `${playerName} won ${prizeType}! 🏆`;
      
    setToastMessage(message);
    setToastType('success');
    setShowToast(true);
  };

  if (!currentGame) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  const enabledPrizes = Object.entries(settings.prizes || {})
    .filter(([_, isEnabled]) => isEnabled)
    .map(([prizeType]) => prizeType as keyof Game.Winners);

  const enabledPrizesCount = enabledPrizes.length;
  const wonPrizesCount = enabledPrizes.filter(prize => 
    winners[prize] && winners[prize].length > 0
  ).length;

  const gameStatus = gameState?.status === 'active' || gameState?.status === 'paused' 
    ? gameState.status 
    : 'paused';

  if (isGameComplete || allPrizesWon) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-green-100 p-3 rounded-full">
              <Check className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            {allPrizesWon ? 'All Prizes Won!' : 'Game Complete!'}
          </h2>
          <p className="mt-2 text-gray-600">
            {allPrizesWon 
              ? `The game has ended because all ${enabledPrizesCount} enabled prizes have been claimed.`
              : 'Here are the final results of the game.'}
          </p>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <WinnerDisplay
              winners={winners}
              tickets={activeTickets.tickets}
              bookings={activeTickets.bookings}
              prizes={settings.prizes}
              showAllPrizes={true}
            />
          </div>

          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <Trophy className="h-5 w-5 text-blue-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">Game Summary</h3>
                <div className="mt-2 text-sm text-blue-700 space-y-1">
                  <p>Numbers called: {numberSystem.calledNumbers?.length || 0} of 90</p>
                  <p>Prizes claimed: {wonPrizesCount} of {enabledPrizesCount}</p>
                  <p>Total tickets in play: {Object.keys(activeTickets.bookings || {}).length}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center pt-6">
            <button
              onClick={onStartNewGame}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Start New Game
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-red-400" />
              </div>
              <p className="ml-3 text-sm text-red-700">{error}</p>
            </div>
            <button onClick={onErrorDismiss} className="text-red-400 hover:text-red-500">
              <span className="sr-only">Dismiss</span>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {!hasActivePrizes && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 text-yellow-700">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Prize Configuration Warning</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>No prizes have been configured for this game. Prize detection is disabled.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {hasActivePrizes && !hasBookedTickets && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 text-yellow-700">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Booking Warning</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>No tickets have been booked for this game. Prize detection is disabled.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {hasActivePrizes && hasBookedTickets && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 text-blue-700">
          <div className="flex">
            <div className="flex-shrink-0">
              <Award className="h-5 w-5 text-blue-400" />
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-blue-800">Prize Progress</h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>{wonPrizesCount} of {enabledPrizesCount} prizes have been claimed</p>
                <div className="mt-2 w-full bg-blue-200 rounded-full h-2.5">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full" 
                    style={{ width: `${(wonPrizesCount / enabledPrizesCount) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <GameControls
        gameStatus={gameStatus}
        soundEnabled={soundEnabled}
        delaySeconds={callDelay}
        onStatusChange={onStatusChange}
        onSoundToggle={onSoundToggle}
        onDelayChange={onDelayChange}
        onGameEnd={onGameEnd}
        disableControls={isGameComplete || allPrizesWon}
      />

      {numberSystem.currentNumber && (
        <div className="bg-white rounded-lg shadow-sm border p-3 sm:p-4">
          <div className="text-center">
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">Current Number</h3>
            <div className="flex items-center justify-center">
              <div className="bg-yellow-500 text-white text-3xl sm:text-4xl font-bold rounded-full w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center shadow-lg">
                {numberSystem.currentNumber}
              </div>
            </div>
            <p className="mt-3 sm:mt-4 text-xs sm:text-sm text-gray-600">
              {gameStatus === 'active' 
                ? `Next number in ~${callDelay} seconds`
                : `Game paused. Press Start to resume.`}
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border p-3 sm:p-4">
        <NumberBoard
          calledNumbers={numberSystem.calledNumbers || []}
          queue={numberSystem.queue || []}
          currentNumber={numberSystem.currentNumber}
          isProcessing={isProcessing}
          isGameComplete={isGameComplete}
          allPrizesWon={allPrizesWon}
        />
      </div>
      
      <div className="bg-white rounded-lg shadow-sm border p-3 sm:p-4">
        <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2 sm:mb-4">Game Progress</h3>
        <div className="grid grid-cols-2 gap-2 sm:gap-4">
          <div className="p-2 sm:p-3 border rounded-lg bg-gray-50">
            <div className="text-xs sm:text-sm text-gray-500">Progress</div>
            <div className="mt-1 flex items-center">
              <div className="flex-1 bg-gray-200 rounded-full h-1.5 sm:h-2.5 mr-1 sm:mr-2">
                <div 
                  className="bg-blue-600 h-1.5 sm:h-2.5 rounded-full"
                  style={{ width: `${gameStats.gameProgress}%` }}
                ></div>
              </div>
              <span className="text-xs sm:text-sm font-medium text-gray-700">
                {gameStats.gameProgress}%
              </span>
            </div>
          </div>
          
          <div className="p-2 sm:p-3 border rounded-lg bg-gray-50">
            <div className="text-xs sm:text-sm text-gray-500">Numbers Left</div>
            <div className="text-base sm:text-lg font-semibold text-gray-700">{gameStats.numbersLeft}</div>
          </div>
          
          <div className="p-2 sm:p-3 border rounded-lg bg-gray-50">
            <div className="text-xs sm:text-sm text-gray-500">Active Tickets</div>
            <div className="text-base sm:text-lg font-semibold text-gray-700">{gameStats.ticketCount}</div>
          </div>
          
          <div className="p-2 sm:p-3 border rounded-lg bg-gray-50">
            <div className="text-xs sm:text-sm text-gray-500">Avg. Time/Number</div>
            <div className="text-base sm:text-lg font-semibold text-gray-700">{gameStats.averageSpeed}s</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-3 sm:p-6">
        <WinnerDisplay
          winners={winners}
          tickets={activeTickets.tickets}
          bookings={activeTickets.bookings}
          prizes={settings.prizes}
          showAllPrizes={false}
          onWinnerNotification={handleWinnerNotification}
        />
      </div>

      <div className="mt-8 bg-white rounded-lg shadow-sm border p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h4 className="text-sm font-medium text-gray-500">Called Numbers</h4>
            <p className="mt-2 text-3xl font-semibold text-gray-900">
              {numberSystem.calledNumbers?.length || 0}/90
            </p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-500">Active Tickets</h4>
            <p className="mt-2 text-3xl font-semibold text-gray-900">
              {Object.keys(activeTickets.bookings || {}).length}/
              {settings.maxTickets || 0}
            </p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-500">Prizes Claimed</h4>
            <p className="mt-2 text-3xl font-semibold text-gray-900">
              {wonPrizesCount}/{enabledPrizesCount}
            </p>
          </div>
        </div>
      </div>
      
      {showToast && (
        <Toast
          message={toastMessage}
          type={toastType}
          duration={5000}
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  );
}

export default PlayingPhaseView;
