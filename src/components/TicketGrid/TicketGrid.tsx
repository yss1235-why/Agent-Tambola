// src/components/TicketGrid/TicketGrid.tsx

import React, { useState, useEffect, useCallback } from 'react';
import type { Game } from '../../types/game';
import { BookingManager } from '../../services';

interface TicketGridProps {
  className?: string;
}

export const TicketGrid: React.FC<TicketGridProps> = ({ className = '' }) => {
  const [tickets, setTickets] = useState<Game.Ticket[]>([]);
  const [selectedTickets, setSelectedTickets] = useState<string[]>([]);
  const [bookings, setBookings] = useState<Record<string, Game.Player>>({});
  const [activeTicket, setActiveTicket] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const bookingManager = BookingManager.getInstance();

  const loadTickets = useCallback(async () => {
    try {
      const allBookings = await bookingManager.getAllBookings();
      // Use explict type annotations for the accumulator and player
      const bookingMap = allBookings.reduce<Record<string, Game.Player>>((acc: Record<string, Game.Player>, player: Game.Player) => {
        player.tickets.forEach((ticketId: string) => {
          acc[ticketId] = player;
        });
        return acc;
      }, {});
      
      setBookings(bookingMap);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading tickets:', error);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const handleTicketSelect = (ticketId: string) => {
    setSelectedTickets(prev => {
      const isSelected = prev.includes(ticketId);
      if (isSelected) {
        return prev.filter(id => id !== ticketId);
      }
      return [...prev, ticketId];
    });
  };

  const handleTicketClick = (ticketId: string) => {
    if (bookings[ticketId]) {
      setActiveTicket(ticketId);
    } else {
      handleTicketSelect(ticketId);
    }
  };

  const handleBookingSubmit = async (playerData: {
    name: string;
    phoneNumber: string;
  }) => {
    try {
      await bookingManager.createBooking({
        playerName: playerData.name,
        phoneNumber: playerData.phoneNumber,
        tickets: selectedTickets
      });
      
      setSelectedTickets([]);
      loadTickets();
    } catch (error) {
      console.error('Error creating booking:', error);
      throw error;
    }
  };

  const handleBookingCancel = async (ticketId: string) => {
    try {
      await bookingManager.cancelBooking([ticketId]);
      setActiveTicket(null);
      loadTickets();
    } catch (error) {
      console.error('Error canceling booking:', error);
      throw error;
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg ${className}`}>
      <div className="p-6 border-b">
        <h2 className="text-xl font-semibold text-gray-800">Ticket Management</h2>
        <p className="text-gray-600 mt-1">Select tickets to create or manage bookings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
        <div className="lg:col-span-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-96">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-4">
              {tickets.map(ticket => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  isSelected={selectedTickets.includes(ticket.id)}
                  isBooked={!!bookings[ticket.id]}
                  playerName={bookings[ticket.id]?.name}
                  onClick={() => handleTicketClick(ticket.id)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          {activeTicket ? (
            <TicketDetails
              ticket={tickets.find(t => t.id === activeTicket)!}
              booking={bookings[activeTicket]}
              onClose={() => setActiveTicket(null)}
              onCancel={() => handleBookingCancel(activeTicket)}
            />
          ) : (
            <BookingForm
              selectedCount={selectedTickets.length}
              onSubmit={handleBookingSubmit}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// src/components/TicketGrid/TicketCard.tsx

interface TicketCardProps {
  ticket: Game.Ticket;
  isSelected: boolean;
  isBooked: boolean;
  playerName?: string;
  onClick: () => void;
}

const TicketCard: React.FC<TicketCardProps> = ({
  ticket,
  isSelected,
  isBooked,
  playerName,
  onClick
}) => {
  return (
    <button
      onClick={onClick}
      className={`
        relative w-full aspect-square rounded-lg border-2 
        transition-all duration-200 flex flex-col items-center 
        justify-center p-4 ${
          isBooked
            ? 'border-green-500 bg-green-50'
            : isSelected
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-200 hover:border-gray-300 bg-white'
        }
      `}
    >
      <div className="text-lg font-semibold">#{ticket.id}</div>
      {isBooked && (
        <div className="mt-2 text-sm text-green-600 truncate max-w-full">
          {playerName}
        </div>
      )}
    </button>
  );
};

// src/components/TicketGrid/BookingForm.tsx

interface BookingFormProps {
  selectedCount: number;
  onSubmit: (data: { name: string; phoneNumber: string }) => Promise<void>;
}

const BookingForm: React.FC<BookingFormProps> = ({ selectedCount, onSubmit }) => {
  const [formData, setFormData] = useState({ name: '', phoneNumber: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCount === 0) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(formData);
      setFormData({ name: '', phoneNumber: '' });
    } catch (error) {
      setError('Failed to create booking. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border p-6">
      <h3 className="text-lg font-medium text-gray-900">Create Booking</h3>
      <p className="mt-1 text-sm text-gray-600">
        {selectedCount} ticket{selectedCount !== 1 ? 's' : ''} selected
      </p>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Player Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Phone Number
          </label>
          <input
            type="tel"
            value={formData.phoneNumber}
            onChange={e => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting || selectedCount === 0}
          className={`
            w-full py-2 px-4 rounded-md text-white 
            ${isSubmitting || selectedCount === 0
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600'
            }
          `}
        >
          {isSubmitting ? 'Creating Booking...' : 'Create Booking'}
        </button>
      </form>
    </div>
  );
};

// src/components/TicketGrid/TicketDetails.tsx

interface TicketDetailsProps {
  ticket: Game.Ticket;
  booking: Game.Player;
  onClose: () => void;
  onCancel: () => void;
}

const TicketDetails: React.FC<TicketDetailsProps> = ({
  ticket,
  booking,
  onClose,
  onCancel
}) => {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleCancelClick = () => {
    setIsConfirming(true);
  };

  const handleConfirmCancel = async () => {
    try {
      await onCancel();
      onClose();
    } catch (error) {
      console.error('Error canceling booking:', error);
    }
  };

  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-medium text-gray-900">
            Ticket #{ticket.id}
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            Booking Details
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-500"
        >
          <span className="sr-only">Close</span>
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Player Name
          </label>
          <div className="mt-1 text-gray-900">{booking.name}</div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Phone Number
          </label>
          <div className="mt-1 text-gray-900">{booking.phoneNumber}</div>
        </div>

        {isConfirming ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Are you sure you want to cancel this booking?
            </p>
            <div className="flex space-x-4">
              <button
                onClick={handleConfirmCancel}
                className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
              >
                Confirm Cancel
              </button>
              <button
                onClick={() => setIsConfirming(false)}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Keep Booking
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleCancelClick}
            className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
          >
            Cancel Booking
          </button>
        )}
      </div>
    </div>
  );
};

export default TicketGrid;