// src/components/Dashboard/GamePhases/BookingPhase/BookingPhase.tsx - COMPLETE FIXED VERSION
// Updated to properly handle going back to setup phase with complete ticket reset

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
  const [isReturningToSetup, setIsReturningToSetup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning' | 'info'>('info');

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
      setToastType('success');
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
      setToastType('success');
      setShowToast(true);
      
    } catch (err) {
      console.error('❌ Error updating booking:', err);
      setError(handleApiError(err, 'Failed to update booking. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * IMPROVED: Return to setup phase with complete ticket reset
   */
  const handleBackToSetup = async () => {
    if (!currentUser?.uid) return;

    setIsReturningToSetup(true);
    setError(null);

    try {
      console.log('⬅️ Returning to setup phase with complete ticket reset');
      
      // Show immediate feedback to user
      setToastMessage('Returning to setup phase. This will clear all bookings and allow ticket changes.');
      setToastType('info');
      setShowToast(true);
      
      // Import and use database service directly for immediate action
      const { GameDatabaseService } = await import('../../../../services/GameDatabaseService');
      const dbService = GameDatabaseService.getInstance();
      
      // IMPROVED: Complete reset with better structure
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
        // IMPROVED: Completely clear ticket structure for proper regeneration
        tickets: {},  // Empty object - forces complete regeneration
        bookings: {}, // Clear all bookings
        players: {},  // Clear all players
        
        // Reset booking metrics
        metrics: {
          startTime: Date.now(),
          lastBookingTime: Date.now(),
          totalBookings: 0,
          totalPlayers: 0
        },
        
        // Reset number system
        numberSystem: {
          callDelay: currentGame?.settings?.callDelay || 5,
          currentNumber: null,
          calledNumbers: [],
          queue: []
        }
      });
      
      console.log('✅ Successfully returned to setup phase with complete reset');
      
      // Show success message with explanation
      setToastMessage('Returned to setup phase successfully! You can now change ticket numbers and they will regenerate automatically.');
      setToastType('success');
      setShowToast(true);
      
      // The game state will update automatically via Firebase subscription
      // which will trigger navigation to setup phase in Dashboard.tsx
      
    } catch (err) {
      console.error('❌ Error returning to setup:', err);
      setError(handleApiError(err, 'Failed to return to setup phase. Please try again.'));
      
      // Show error feedback
      setToastMessage('Failed to return to setup phase. Please try again.');
      setToastType('error');
      setShowToast(true);
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

  /**
   * Handle start new game
   */
  const handleStartNewGame = async () => {
    navigate('/dashboard', { replace: true });
  };

  /**
   * Handle error dismiss
   */
  const handleErrorDismiss = () => {
    setError(null);
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
            {/* IMPROVED: Show current ticket configuration */}
            <div className="mt-2 flex items-center space-x-4 text-sm">
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                Set {gameData.settings.selectedTicketSet}
              </span>
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full">
                {gameData.settings.maxTickets} tickets
              </span>
              <span className="text-gray-600">
                {Object.keys(gameData.activeTickets?.bookings || {}).length} booked
              </span>
            </div>
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
                bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center transition-colors
                ${isProcessing || isReturningToSetup || isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isReturningToSetup ? (
                <>
                  <div className="animate-spin h-3 w-3 border border-gray-600 border-t-transparent rounded-full mr-2" />
                  Returning...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Setup
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
            <button 
              onClick={handleErrorDismiss}
              className="text-red-400 hover:text-red-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* IMPROVED: Better information panel */}
      {Object.keys(gameData.activeTickets?.bookings || {}).length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                Ready to Book Tickets
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>You have {gameData.settings.maxTickets} tickets available from Set {gameData.settings.selectedTicketSet}.</p>
                <p className="mt-1">Select tickets below and fill in player details to create bookings.</p>
              </div>
            </div>
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

          {/* IMPROVED: Better start game button */}
          <div className="pt-6 border-t">
            <div className="space-y-4">
              {Object.keys(gameData.activeTickets?.bookings || {}).length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-green-800">
                        Ready to Start
                      </h3>
                      <div className="mt-1 text-sm text-green-700">
                        <p>{Object.keys(gameData.activeTickets?.bookings || {}).length} tickets booked. You can start the game now!</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <button
                onClick={handleStartGame}
                disabled={
                  Object.keys(gameData.activeTickets?.bookings || {}).length === 0 || 
                  isProcessing ||
                  isSubmitting ||
                  isReturningToSetup
                }
                className={`w-full px-6 py-3 rounded-lg font-medium transition-all duration-200
                  ${Object.keys(gameData.activeTickets?.bookings || {}).length === 0 || 
                    isProcessing || isSubmitting || isReturningToSetup
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-500 text-white hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transform hover:scale-105'
                  }`}
              >
                {isProcessing || isSubmitting || isReturningToSetup ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                    Processing...
                  </span>
                ) : Object.keys(gameData.activeTickets?.bookings || {}).length === 0 ? (
                  <span className="flex items-center justify-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Book tickets to start game
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.01M15 10h1.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Start Game ({Object.keys(gameData.activeTickets?.bookings || {}).length} tickets)
                  </span>
                )}
              </button>
              
              {Object.keys(gameData.activeTickets?.bookings || {}).length === 0 && (
                <p className="text-sm text-gray-500 text-center">
                  Select tickets and create bookings to enable game start
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {showToast && (
        <Toast
          message={toastMessage}
          type={toastType}
          duration={toastType === 'error' ? 8000 : 5000}
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  );
};

export default BookingPhase;
