// src/components/Dashboard/GamePhases/BookingPhase/BookingPhase.tsx - COMMAND-BASED VERSION
// Updated to use the proper returnToSetup command

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
  
  // Get command methods from game context (including new returnToSetup)
  const { 
    createBooking, 
    updateBooking, 
    startPlayingPhase,
    returnToSetup, // NEW: Return to setup command
    isProcessing 
  } = useGame();
  
  const [gameData, setGameData] = useState<Game.CurrentGame | null>(null);
  const [selectedTickets, setSelectedTickets] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
   * NEW: Return to setup phase using proper command
   */
  const handleBackToSetup = async () => {
    if (!currentUser?.uid) return;

    try {
      console.log('⬅️ Returning to setup phase with command');
      
      // Ask user if they want to clear bookings (default: yes)
      const shouldClearBookings = window.confirm(
        'Do you want to clear all existing bookings when returning to setup?\n\n' +
        'Click "OK" to clear bookings (recommended)\n' +
        'Click "Cancel" to keep existing bookings'
      );
      
      // Send command to return to setup
      const commandId = returnToSetup(shouldClearBookings);
      console.log(`📤 Return to setup command sent: ${commandId}`);
      
      // Show success message
      setToastMessage(
        shouldClearBookings 
          ? 'Returning to setup phase. All bookings will be cleared.'
          : 'Returning to setup phase. Existing bookings will be preserved.'
      );
      setShowToast(true);
      
      // Navigation will happen automatically when game state updates
      
    } catch (err) {
      console.error('❌ Error returning to setup:', err);
      setError(handleApiError(err, 'Failed to return to setup phase. Please try again.'));
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
            {isProcessing && (
              <span className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded flex items-center">
                <div className="animate-spin h-3 w-3 border border-blue-600 border-t-transparent rounded-full mr-1" />
                Processing...
              </span>
            )}
            <button
              onClick={handleBackToSetup}
              disabled={isProcessing || isSubmitting}
              className={`px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 
                bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center
                ${isProcessing || isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Back to Setup
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
            isSubmitting={isSubmitting || isProcessing}
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
                isSubmitting
              }
              className={`w-full px-6 py-3 rounded-lg font-medium
                ${Object.keys(gameData.activeTickets?.bookings || {}).length === 0 || 
                  isProcessing || isSubmitting
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-500 text-white hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2'
                }`}
            >
              {isProcessing || isSubmitting ? (
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
