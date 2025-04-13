// src/components/Dashboard/GamePhases/BookingPhase/components/TicketGrid.tsx
import { useMemo } from 'react';
import { Game } from '../../../../../types/game';

interface TicketGridProps {
  tickets: Record<string, Game.Ticket>;
  bookings: Record<string, Game.Booking>;
  selectedTickets: string[];
  onTicketSelect: (ticketId: string, isSelected: boolean) => void;
}

function TicketGrid({ 
  tickets, 
  bookings, 
  selectedTickets, 
  onTicketSelect 
}: TicketGridProps) {
  const ticketList = useMemo(() => {
    // Only display tickets that exist in the tickets object
    const availableTickets = Object.keys(tickets || {});
    return availableTickets.sort((a, b) => parseInt(a) - parseInt(b));
  }, [tickets]);

  const getTicketStatus = (ticketId: string) => {
    if (ticketId in bookings) return 'booked';
    if (selectedTickets.includes(ticketId)) return 'selected';
    return 'available';
  };

  const getTicketClasses = (status: 'booked' | 'selected' | 'available') => {
    const baseClasses = `
      p-4 rounded-lg border-2 transition-all duration-200
      flex flex-col items-center justify-center space-y-1
    `;

    switch (status) {
      case 'booked':
        return `${baseClasses} border-green-300 bg-green-50 cursor-not-allowed`;
      case 'selected':
        return `${baseClasses} border-blue-500 bg-blue-50 cursor-pointer hover:bg-blue-100`;
      default:
        return `${baseClasses} border-gray-200 hover:border-gray-300 cursor-pointer hover:bg-gray-50`;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4 border-b">
        <h3 className="text-lg font-medium text-gray-900">Available Tickets</h3>
        <div className="flex items-center justify-between">
          <div className="mt-2 flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-white border-2 border-gray-200 rounded" />
              <span className="text-sm text-gray-600">Available</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-blue-50 border-2 border-blue-500 rounded" />
              <span className="text-sm text-gray-600">Selected</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-green-50 border-2 border-green-300 rounded" />
              <span className="text-sm text-gray-600">Booked</span>
            </div>
          </div>
          <div className="text-sm text-gray-600">
            Total Tickets: {ticketList.length}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4">
        {ticketList.map((ticketId) => {
          const status = getTicketStatus(ticketId);
          const isBooked = status === 'booked';
          const booking = bookings[ticketId];

          return (
            <button
              key={ticketId}
              onClick={() => !isBooked && onTicketSelect(ticketId, !selectedTickets.includes(ticketId))}
              disabled={isBooked}
              className={getTicketClasses(status)}
            >
              <span className="text-lg font-semibold text-gray-900">
                {ticketId}
              </span>
              {isBooked && booking?.playerName && (
                <span className="text-xs text-gray-600 truncate max-w-full px-2">
                  {booking.playerName}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {ticketList.length === 0 && (
        <div className="p-8 text-center text-gray-500">
          No tickets available in the current set
        </div>
      )}
    </div>
  );
}

export default TicketGrid;