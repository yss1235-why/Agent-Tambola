// src/components/Dashboard/GamePhases/BookingPhase/components/BookingsList.tsx
import { useState } from 'react';
import { Game } from '../../../../../types/game';
import EditBookingForm from './EditBookingForm';

interface BookingsListProps {
  bookings: Record<string, Game.Booking>;
  onEditBooking: (ticketId: string, data: { name: string; phone: string }) => Promise<void>;
}

function BookingsList({ bookings, onEditBooking }: BookingsListProps) {
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEditSubmit = async (ticketId: string, data: { name: string; phone: string }) => {
    setIsSubmitting(true);
    try {
      await onEditBooking(ticketId, data);
      setEditingTicketId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const sortedBookings = Object.entries(bookings)
    .map(([ticketId, booking]) => ({
      ticketId,
      ...booking
    }))
    .sort((a, b) => parseInt(b.ticketId) - parseInt(a.ticketId));

  if (sortedBookings.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b">
          <h3 className="text-lg font-medium text-gray-900">Recent Bookings</h3>
        </div>
        <div className="p-8 text-center text-gray-500">
          No bookings recorded yet
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4 border-b">
        <h3 className="text-lg font-medium text-gray-900">Recent Bookings</h3>
        <p className="text-sm text-gray-600 mt-1">
          {sortedBookings.length} ticket{sortedBookings.length !== 1 ? 's' : ''} booked
        </p>
      </div>

      <div className="divide-y divide-gray-200 max-h-[400px] overflow-y-auto">
        {sortedBookings.map((booking) => (
          <div key={booking.ticketId} className="p-4">
            {editingTicketId === booking.ticketId ? (
              <EditBookingForm
                booking={booking}
                ticketId={booking.ticketId}
                onSubmit={handleEditSubmit}
                onCancel={() => setEditingTicketId(null)}
                isSubmitting={isSubmitting}
              />
            ) : (
              <div className="flex justify-between items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {booking.playerName}
                    </p>
                    <p className="ml-2 flex-shrink-0 text-sm text-gray-500">
                      {booking.ticketId}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {booking.phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')}
                  </p>
                </div>
                <button
                  onClick={() => setEditingTicketId(booking.ticketId)}
                  className="ml-4 text-sm text-blue-600 hover:text-blue-800"
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default BookingsList;