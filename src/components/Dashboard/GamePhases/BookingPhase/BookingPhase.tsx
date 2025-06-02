// src/components/Dashboard/GamePhases/BookingPhase/BookingPhase.tsx - FIXED VERSION
// Updated to properly handle going back to setup phase

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import { useGame } from '../../../../contexts/GameContext';
import { LoadingSpinner, Toast } from '@components';
import TicketGrid from './components/TicketGrid';
import BookingForm from './components/BookingForm';
import BookingsList from './components/BookingsList';
import { Game, GAME_PHASES } from '../../../../types/game';

interface TicketBookingData {
  name: string;
  phone: string;
}

interface BookingPhaseProps {
  currentGame: Game.CurrentGame;
}

// Simple error handler replacement
const handleApiError = (error: any, defaultMessage: string): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return defaultMessage;
};

const BookingPhase: React.FC<BookingPhaseProps> = ({ currentGame }) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  // Get command methods from game context
  const { 
    createBooking, 
    updateBooking, 
    startPlayingPhase,
    isProcessing 
  } = useGame();
  
  const [gameData, setGameData] = useState<Game.CurrentGame | null>(null);
  const [selectedTickets, setSelectedTickets] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReturningToSetup, setIsReturningToSetup] = useState(false); // NEW: Separate state for back to setup
  const [error, setError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    if (currentGame) {
      setGameData(currentGame);
      
      if (!currentGame.activeTickets?.tickets) {
        setError('No tickets found in the game');
        return;
      }
      
      setError(null);
    }
  }, [currentGame]);

  const handleTicketSelect = (ticketId: string, isSelected: boolean) => {
    setSelectedTickets(prev =>
      isSelected 
        ? [...prev, ticketId]
        : prev.filter(id => id !== ticketId)
    );
  };

  /**
   * Handle booking submission using command
   */
  const handleBookingSubmit = async (playerData: TicketBookingData) => {
    if (!currentUser?.uid || !gameData || selectedTickets.length === 0) {
      setError('Unable to process booking at this time');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      console.log('🎫 Creating booking with command');
      
      // Send command to create booking
      const commandId = createBooking(playerData.name, playerData.phone, selectedTickets);
      console.log(`📤 Create booking command sent: ${commandId}`);
      
      // Clear selected tickets immediately for UI responsiveness
      setSelectedTickets([]);
      
      setToastMessage(`Successfully booked ${selectedTickets.length} ticket(s)`);
      setShowToast(true);
      
    } catch (err) {
      console.error('❌ Error booking tickets:', err);
      setError(handleApiError(err, 'Failed to book tickets. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle booking edit using command
   */
  const handleEditBooking = async (ticketId: string, data: { name: string; phone: string }) => {
    if (!currentUser?.uid || !gameData) {
      setError('Unable to update booking at this time');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      console.log('✏️ Updating booking with command');
      
      // Send command to update booking
      const commandId = updateBooking(ticketId, data.name, data.phone);
      console.log(`📤 Update booking command sent: ${commandId}`);
      
      setToastMessage('Booking updated successfully');
      setShowToast(true);
      
    } catch (err) {
      console.error('❌ Error updating booking:', err);
      setError(handleApiError(err, 'Failed to update booking. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * FIXED: Return to setup phase using direct database update
   */
  const handleBackToSetup = async () => {
    if (!currentUser?.uid) return;

    setIsReturningToSetup(true);
    setError(null);

    try {
      console.log('⬅️ Returning to setup phase');
      
      // Import and use database service directly
      const { GameDatabaseService } = await import('../../../../services/GameDatabaseService');
      const dbService = GameDatabaseService.getInstance();
      
      // Update both phase and status, clear bookings
      await dbService.batchUpdateGameData(currentUser.uid, {
        gameState: {
          phase: 1 as const,  // Back to setup phase
          status: 'setup' as const,  // Setup status
          isAutoCalling: false,
          soundEnabled: currentGame?.gameState?.soundEnabled || true,
          winners: {
            quickFive: [], topLine: [], middleLine: [], bottomLine: [],
            corners: [], starCorners: [], halfSheet: [], fullSheet: [],
            fullHouse: [], secondFullHouse: []
          },
          allPrizesWon: false
        },
        // Clear all bookings and reset to available
        bookings: {},
        // Reset tickets to available (keep the ticket data)
        tickets: Object.fromEntries(
          Object.keys(currentGame?.activeTickets?.tickets || {}).map(ticketId => [
            ticketId, 
            { status: 'available' }
          ])
        ),
        // Reset booking metrics
        metrics: {
          startTime: Date.now(),
          lastBookingTime: Date.now(),
          totalBookings: 0,
          totalPlayers: 0
        },
        // Clear players
        players: {},
        // Reset number system
        numberSystem: {
          callDelay: currentGame?.settings?.callDelay || 5,
          currentNumber: null,
          calledNumbers: [],
          queue: []
        }
      });
      
      console.log('✅ Successfully returned to setup phase');
      
      // Show success message
      setToastMessage('Returned to setup phase. All bookings have been cleared.');
      setShowToast(true);
      
      // The game state will update automatically via Firebase subscription
      // which will trigger navigation to setup phase in Dashboard.tsx
      
    } catch (err) {
      console.error('❌ Error returning to setup:', err);
      setError(handleApiError(err, 'Failed to return to setup phase. Please try again.'));
    } finally {
      setIsReturningToSetup(false);
    }
  };

  /**
   * Start the playing phase using command
   */
  const handleStartGame = async () => {
    if (!currentUser?.uid || !gameData) {
      setError('Unable to start game at this time');
      return;
    }

    try {
      console.log('🎮 Starting playing phase with command');
      
      // Send command to start playing phase
      const commandId = startPlayingPhase();
      console.log(`📤 Start playing phase command sent: ${commandId}`);
      
      // Navigation will happen automatically when game state updates
      
    } catch (err) {
      console.error('❌ Error starting game:', err);
      setError(handleApiError(err, 'Failed to start the game.'));
    }
  };

  if (!gameData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <LoadingSpinner size="large" />
          <p className="mt-4 text-gray-600">Loading game data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="border-b pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-800">Ticket Booking</h2>
            <p className="text-gray-600 mt-1">
              Managing {gameData.settings.maxTickets} available tickets
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {(isProcessing || isReturningToSetup) && (
              <span className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded flex items-center">
                <div className="animate-spin h-3 w-3 border border-blue-600 border-t-transparent rounded-full mr-1" />
                {isReturningToSetup ? 'Returning to setup...' : 'Processing...'}
              </span>
            )}
            <button
              onClick={handleBackToSetup}
              disabled={isProcessing || isReturningToSetup || isSubmitting}
              className={`px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 
                bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center
                ${isProcessing || isReturningToSetup || isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isReturningToSetup ? (
                <>
                  <div className="animate-spin h-3 w-3 border border-gray-600 border-t-transparent rounded-full mr-2" />
                  Returning...
                </>
              ) : (
                'Back to Setup'
              )}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <TicketGrid
            tickets={gameData.activeTickets?.tickets || {}}
            bookings={gameData.activeTickets?.bookings || {}}
            selectedTickets={selectedTickets}
            onTicketSelect={handleTicketSelect}
          />
        </div>

        <div className="space-y-6">
          <BookingForm
            selectedCount={selectedTickets.length}
            isSubmitting={isSubmitting || isProcessing || isReturningToSetup}
            onSubmit={handleBookingSubmit}
          />

          <BookingsList 
            bookings={gameData.activeTickets?.bookings || {}}
            onEditBooking={handleEditBooking}
          />

          <div className="pt-6 border-t">
            <button
              onClick={handleStartGame}
              disabled={
                Object.keys(gameData.activeTickets?.bookings || {}).length === 0 || 
                isProcessing ||
                isSubmitting ||
                isReturningToSetup
              }
              className={`w-full px-6 py-3 rounded-lg font-medium
                ${Object.keys(gameData.activeTickets?.bookings || {}).length === 0 || 
                  isProcessing || isSubmitting || isReturningToSetup
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-500 text-white hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2'
                }`}
            >
              {isProcessing || isSubmitting || isReturningToSetup ? (
                <span className="flex items-center justify-center">
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                  Processing...
                </span>
              ) : Object.keys(gameData.activeTickets?.bookings || {}).length === 0 ? (
                'Book tickets to start game'
              ) : (
                'Start Game'
              )}
            </button>
          </div>
        </div>
      </div>

      {showToast && (
        <Toast
          message={toastMessage}
          type="success"
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  );
};

export default BookingPhase;
