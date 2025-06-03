// src/components/Dashboard/GamePhases/GameSetup/components/TicketSetSelector.tsx - IMPROVED
// Added better user feedback and prevented rapid changes

import { useState, useEffect, useRef } from 'react';
import { Game } from '../../../../../types/game';
import { AlertTriangle, Clock } from 'lucide-react';

interface TicketSetSelectorProps {
  selectedSet: number;
  maxTickets: number;
  onUpdate: (updates: Partial<Game.Settings>) => void;
}

function TicketSetSelector({ selectedSet, maxTickets, onUpdate }: TicketSetSelectorProps) {
  const [error, setError] = useState<string | null>(null);
  const [localMaxTickets, setLocalMaxTickets] = useState<number>(maxTickets);
  const [isChanging, setIsChanging] = useState(false);
  const updateTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    setLocalMaxTickets(maxTickets);
  }, [maxTickets]);

  // IMPROVED: Debounced update to prevent rapid changes
  const debouncedUpdate = (updates: Partial<Game.Settings>) => {
    setIsChanging(true);
    
    // Clear existing timeout
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    // Set new timeout
    updateTimeoutRef.current = setTimeout(() => {
      onUpdate(updates);
      setIsChanging(false);
    }, 500); // 500ms debounce
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  const handleMaxTicketsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    if (value === '') {
      setLocalMaxTickets(0);
      return;
    }

    const numValue = parseInt(value);
    if (isNaN(numValue)) {
      setError('Please enter a valid number');
      return;
    }
    
    if (numValue > 600) {
      setError('Maximum allowed tickets is 600');
      return;
    }

    if (numValue < 0) {
      setError('Number of tickets cannot be negative');
      return;
    }

    setError(null);
    setLocalMaxTickets(numValue);
    
    // Use debounced update
    debouncedUpdate({ maxTickets: numValue });
  };

  const handleSetSelection = (setNumber: number) => {
    if (setNumber !== selectedSet) {
      setIsChanging(true);
      debouncedUpdate({ selectedTicketSet: setNumber });
    }
  };

  const handleBlur = () => {
    if (localMaxTickets === 0) {
      setLocalMaxTickets(1);
      debouncedUpdate({ maxTickets: 1 });
    }
  };

  const handleQuickSelect = (count: number) => {
    setLocalMaxTickets(count);
    setError(null);
    debouncedUpdate({ maxTickets: count });
  };

  return (
    <section className="bg-white rounded-lg p-6 shadow-sm border">
      <div>
        <h3 className="text-lg font-medium text-gray-900">Ticket Set Selection</h3>
        <p className="text-gray-500 text-sm mt-1">
          Choose a ticket set and set the maximum number of tickets
        </p>
        
        {/* IMPROVED: Show when changes are being processed */}
        {isChanging && (
          <div className="mt-2 flex items-center text-sm text-blue-600">
            <Clock className="w-4 h-4 mr-1 animate-pulse" />
            <span>Processing ticket structure changes...</span>
          </div>
        )}
      </div>

      <div className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:gap-4">
          {[1, 2, 3, 4].map((setNumber) => (
            <button
              key={setNumber}
              onClick={() => handleSetSelection(setNumber)}
              disabled={isChanging}
              className={`p-3 sm:p-4 rounded-lg border-2 text-center transition-colors duration-200 
                ${isChanging ? 'opacity-50 cursor-not-allowed' : ''} ${
                selectedSet === setNumber
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="font-medium text-sm sm:text-base">Set {setNumber}</div>
              <div className="text-xs sm:text-sm text-gray-500">600 Tickets</div>
              {selectedSet === setNumber && (
                <div className="text-xs text-blue-600 mt-1">Selected</div>
              )}
            </button>
          ))}
        </div>

        <div className="mt-6">
          <label 
            htmlFor="maxTickets" 
            className="block text-sm font-medium text-gray-700"
          >
            Maximum Tickets
          </label>
          <div className="mt-2 flex flex-col sm:flex-row sm:items-center">
            <input
              id="maxTickets"
              type="number"
              inputMode="numeric"
              value={localMaxTickets || ''}
              onChange={handleMaxTicketsChange}
              onBlur={handleBlur}
              disabled={isChanging}
              className={`block w-full px-3 py-3 sm:py-2 border rounded-md shadow-sm 
                focus:ring-blue-500 focus:border-blue-500 text-base
                ${isChanging ? 'bg-gray-50 cursor-not-allowed' : ''}
                ${error ? 'border-red-300' : 'border-gray-300'}`}
              min="1"
              max="600"
            />
            <div className="mt-2 sm:mt-0 sm:ml-3 flex justify-between space-x-1 sm:space-x-2">
              {[90, 180, 300].map(count => (
                <button
                  key={count}
                  onClick={() => handleQuickSelect(count)}
                  disabled={isChanging}
                  className={`flex-1 px-2 py-2 sm:py-1 text-xs font-medium text-blue-700 bg-blue-50 
                    border border-blue-200 rounded hover:bg-blue-100 transition-colors
                    ${isChanging ? 'opacity-50 cursor-not-allowed' : ''}
                    ${localMaxTickets === count ? 'bg-blue-100 border-blue-300' : ''}`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>
          {error ? (
            <p className="mt-2 text-sm text-red-600 flex items-center">
              <AlertTriangle className="w-4 h-4 mr-1" />
              {error}
            </p>
          ) : (
            <div className="mt-2">
              <p className="text-sm text-gray-500">
                Maximum allowed: 600 tickets
              </p>
              {isChanging && (
                <p className="text-sm text-blue-600">
                  Ticket structure will update in a moment...
                </p>
              )}
            </div>
          )}
        </div>

        {/* IMPROVED: Show current configuration clearly */}
        <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
          <div className="text-sm">
            <span className="font-medium text-gray-700">Current Configuration:</span>
            <div className="mt-1 text-gray-600">
              <div>Set {selectedSet} with {localMaxTickets} tickets</div>
              <div className="text-xs text-gray-500 mt-1">
                Changes will regenerate the ticket structure automatically
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default TicketSetSelector;
