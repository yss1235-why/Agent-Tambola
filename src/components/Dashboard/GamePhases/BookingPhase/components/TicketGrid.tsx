// src/components/Dashboard/GamePhases/BookingPhase/components/TicketGrid.tsx
// UPDATED: 10 column responsive layout with compact design
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
      p-1 sm:p-2 md:p-3 rounded border-2 transition-all duration-200
      flex flex-col items-center justify-center
      min-h-[2.5rem] sm:min-h-[3rem] md:min-h-[4rem]
      min-w-[2.5rem] sm:min-w-[3rem] md:min-w-[4rem]
      text-center relative overflow-hidden
    `;

    switch (status) {
      case 'booked':
        return `${baseClasses} border-green-300 bg-green-50 cursor-not-allowed`;
      case 'selected':
        return `${baseClasses} border-blue-500 bg-blue-50 cursor-pointer hover:bg-blue-100 ring-1 ring-blue-300`;
      default:
        return `${baseClasses} border-gray-200 hover:border-gray-300 cursor-pointer hover:bg-gray-50`;
    }
  };

  // Helper function to truncate player names for small displays
  const getDisplayName = (name: string, ticketStatus: string) => {
    if (ticketStatus !== 'booked') return '';
    
    // Very short names for mobile, longer for larger screens
    if (name.length <= 4) return name;
    if (name.length <= 6) return name.slice(0, 4) + '..';
    return name.slice(0, 3) + '..';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-3 sm:p-4 border-b">
        <h3 className="text-base sm:text-lg font-medium text-gray-900">Available Tickets</h3>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center space-x-3 sm:space-x-6">
            <div className="flex items-center space-x-1 sm:space-x-2">
              <div className="w-3 h-3 sm:w-4 sm:h-4 bg-white border-2 border-gray-200 rounded" />
              <span className="text-xs sm:text-sm text-gray-600">Available</span>
            </div>
            <div className="flex items-center space-x-1 sm:space-x-2">
              <div className="w-3 h-3 sm:w-4 sm:h-4 bg-blue-50 border-2 border-blue-500 rounded" />
              <span className="text-xs sm:text-sm text-gray-600">Selected</span>
            </div>
            <div className="flex items-center space-x-1 sm:space-x-2">
              <div className="w-3 h-3 sm:w-4 sm:h-4 bg-green-50 border-2 border-green-300 rounded" />
              <span className="text-xs sm:text-sm text-gray-600">Booked</span>
            </div>
          </div>
          <div className="text-xs sm:text-sm text-gray-600">
            Total: {ticketList.length}
          </div>
        </div>
      </div>

      {/* UPDATED: 10 column responsive grid with better spacing */}
      <div className="grid grid-cols-10 sm:grid-cols-12 md:grid-cols-15 lg:grid-cols-20 xl:grid-cols-25 gap-1 sm:gap-2 p-2 sm:p-3 md:p-4">
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
              title={
                isBooked && booking?.playerName 
                  ? `Ticket ${ticketId} - ${booking.playerName} (${booking.phoneNumber})`
                  : `Ticket ${ticketId} - ${status}`
              }
            >
              {/* Ticket Number - Always visible */}
              <span className="text-xs sm:text-sm md:text-base font-bold text-gray-900 leading-none">
                {ticketId}
              </span>
              
              {/* Player Name - Only on booked tickets, responsive sizing */}
              {isBooked && booking?.playerName && (
                <>
                  {/* Mobile view - very compact */}
                  <span className="block sm:hidden text-[8px] text-gray-600 leading-none mt-0.5 truncate w-full px-0.5">
                    {getDisplayName(booking.playerName, status)}
                  </span>
                  
                  {/* Tablet view - slightly larger */}
                  <span className="hidden sm:block md:hidden text-[9px] text-gray-600 leading-none mt-0.5 truncate w-full px-1">
                    {booking.playerName.slice(0, 5)}{booking.playerName.length > 5 ? '..' : ''}
                  </span>
                  
                  {/* Desktop view - more space */}
                  <span className="hidden md:block text-[10px] text-gray-600 leading-none mt-1 truncate w-full px-1">
                    {booking.playerName.slice(0, 8)}{booking.playerName.length > 8 ? '..' : ''}
                  </span>
                </>
              )}
              
              {/* Selection indicator for selected tickets */}
              {status === 'selected' && (
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full ring-1 ring-white"></div>
              )}
              
              {/* Booked indicator */}
              {status === 'booked' && (
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full ring-1 ring-white"></div>
              )}
            </button>
          );
        })}
      </div>

      {/* Empty state */}
      {ticketList.length === 0 && (
        <div className="p-6 sm:p-8 text-center text-gray-500">
          No tickets available in the current set
        </div>
      )}

      {/* Ticket summary at bottom */}
      <div className="px-3 sm:px-4 py-2 sm:py-3 border-t bg-gray-50 text-xs sm:text-sm">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">
            Selected: <span className="font-medium text-blue-600">{selectedTickets.length}</span>
          </span>
          <span className="text-gray-600">
            Available: <span className="font-medium text-green-600">
              {ticketList.length - Object.keys(bookings).length}
            </span> / {ticketList.length}
          </span>
        </div>
      </div>
    </div>
  );
}

export default TicketGrid;
