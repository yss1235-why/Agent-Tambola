// src/components/Dashboard/GamePhases/BookingPhase/BookingPhase.tsx

import React, { useState, useEffect } from 'react';
import { ref, update, onValue } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import { database } from '../../../../lib/firebase';
import { LoadingSpinner, Toast } from '@components';
import TicketGrid from './components/TicketGrid';
import BookingForm from './components/BookingForm';
import BookingsList from './components/BookingsList';
import { Game, GAME_PHASES, GAME_STATUSES } from '../../../../types/game';
import { handleApiError } from '@utils/errorHandler';

interface TicketBookingData {
  name: string;
  phone: string;
}

interface BookingPhaseProps {
  currentGame: Game.CurrentGame;
}

const BookingPhase: React.FC<BookingPhaseProps> = ({ currentGame }) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [gameData, setGameData] = useState<Game.CurrentGame | null>(null);
  const [selectedTickets, setSelectedTickets] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    // Initialize with the provided currentGame prop
    if (currentGame) {
      setGameData(currentGame);
      setIsLoading(false);
    }

    const loadCurrentGame = async () => {
      if (!currentUser?.uid) {
        setIsLoading(false);
        return;
      }

      const gameRef = ref(database, `hosts/${currentUser.uid}/currentGame`);
      const unsubscribe = onValue(gameRef, (snapshot) => {
        try {
          if (snapshot.exists()) {
            const gameData = snapshot.val() as Game.CurrentGame;
            if (!gameData.activeTickets?.tickets) {
              setError('No tickets found in the game');
              return;
            }
            setGameData(gameData);
            setError(null);
          } else {
            setError('No active game found');
            navigate('/dashboard');
          }
        } catch (err) {
          console.error('Error processing game data:', err);
          setError(handleApiError(err, 'Error loading game data'));
        } finally {
          setIsLoading(false);
        }
      });

      // Return a function that doesn't throw an error
      return () => {
        unsubscribe();
      };
    };

    // Only load from Firebase if currentGame is not provided
    if (!currentGame) {
      loadCurrentGame();
    }
  }, [currentUser?.uid, navigate, currentGame]);

  const handleTicketSelect = (ticketId: string, isSelected: boolean) => {
    setSelectedTickets(prev =>
      isSelected 
        ? [...prev, ticketId]
        : prev.filter(id => id !== ticketId)
    );
  };

  const handleBookingSubmit = async (playerData: TicketBookingData) => {
    if (!currentUser?.uid || !gameData || selectedTickets.length === 0) {
      setError('Unable to process booking at this time');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const timestamp = Date.now();
      const playerId = `player_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
      const updates: Record<string, any> = {};

      // Update player information
      updates[`hosts/${currentUser.uid}/currentGame/players/${playerId}`] = {
        id: playerId,
        name: playerData.name,
        phoneNumber: playerData.phone,
        tickets: selectedTickets,
        bookingTime: timestamp,
        totalTickets: selectedTickets.length
      };

      // Update ticket bookings
      selectedTickets.forEach(ticketId => {
        updates[`hosts/${currentUser.uid}/currentGame/activeTickets/bookings/${ticketId}`] = {
          number: parseInt(ticketId),
          playerName: playerData.name,
          phoneNumber: playerData.phone,
          playerId,
          status: 'booked',
          timestamp
        };

        updates[`hosts/${currentUser.uid}/currentGame/activeTickets/tickets/${ticketId}/status`] = 'booked';
      });

      // Update booking metrics
      updates[`hosts/${currentUser.uid}/currentGame/bookingMetrics`] = {
        lastBookingTime: timestamp,
        totalBookings: (gameData.bookingMetrics?.totalBookings || 0) + selectedTickets.length,
        totalPlayers: (gameData.bookingMetrics?.totalPlayers || 0) + 1
      };

      await update(ref(database), updates);
      setSelectedTickets([]);
      setToastMessage(`Successfully booked ${selectedTickets.length} ticket(s)`);
      setShowToast(true);
    } catch (err) {
      console.error('Error booking tickets:', err);
      setError(handleApiError(err, 'Failed to book tickets. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Added this function to handle booking editing
  const handleEditBooking = async (ticketId: string, data: { name: string; phone: string }) => {
    if (!currentUser?.uid) {
      setError('Unable to update booking at this time');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const bookingManager = BookingManager.getInstance();
      bookingManager.initialize(currentUser.uid);
      
      await bookingManager.updateBooking(ticketId, {
        playerName: data.name,
        phoneNumber: data.phone
      });
      
      setToastMessage('Booking updated successfully');
      setShowToast(true);
    } catch (err) {
      console.error('Error updating booking:', err);
      setError(handleApiError(err, 'Failed to update booking. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToSetup = async () => {
    if (!currentUser?.uid) return;

    try {
      await update(ref(database, `hosts/${currentUser.uid}/currentGame/gameState`), {
        phase: GAME_PHASES.SETUP,
        status: GAME_STATUSES.SETUP
      });
      navigate('/dashboard');
    } catch (err) {
      console.error('Error returning to setup:', err);
      setError(handleApiError(err, 'Failed to return to setup phase.'));
    }
  };

  const startGame = async () => {
    if (!currentUser?.uid || !gameData) {
      setError('Unable to start game at this time');
      return;
    }

    try {
      // Prepare updates for the game state - FULLY DEFINED TO AVOID PARTIAL UPDATES
      const updates = {
        'gameState': {
          phase: GAME_PHASES.PLAYING,    // Set to playing phase (3)
          status: GAME_STATUSES.PAUSED,  // Start paused so user can manually start
          isAutoCalling: false,
          soundEnabled: true,
          winners: gameData.gameState?.winners || {
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
          },
          allPrizesWon: false  // Ensure this is explicitly set to false
        },
        'numberSystem': {
          callDelay: gameData.settings.callDelay || 5,
          currentNumber: null,
          calledNumbers: [],
          queue: []
        }
      };

      console.log("Starting game with updates:", updates);

      // Update Firebase
      await update(ref(database, `hosts/${currentUser.uid}/currentGame`), updates);
      
      // Navigate to playing phase
      navigate('/playing-phase');
    } catch (err) {
      console.error('Error starting game:', err);
      setError(handleApiError(err, 'Failed to start the game.'));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!gameData) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-800">No Active Game</h2>
        <p className="mt-2 text-gray-600">Please return to dashboard to start a new game.</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          Return to Dashboard
        </button>
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
          <button
            onClick={handleBackToSetup}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 
              bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center"
          >
            Back to Setup
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
          {error}
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
            isSubmitting={isSubmitting}
            onSubmit={handleBookingSubmit}
          />

          <BookingsList 
            bookings={gameData.activeTickets?.bookings || {}}
            onEditBooking={handleEditBooking} // Updated to use the handleEditBooking function
          />

          <div className="pt-6 border-t">
            <button
              onClick={startGame}
              disabled={Object.keys(gameData.activeTickets?.bookings || {}).length === 0}
              className="w-full px-6 py-3 bg-green-500 text-white rounded-lg 
                hover:bg-green-600 focus:outline-none focus:ring-2 
                focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50
                disabled:cursor-not-allowed"
            >
              {Object.keys(gameData.activeTickets?.bookings || {}).length === 0 
                ? 'Book tickets to start game'
                : 'Start Game'
              }
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
