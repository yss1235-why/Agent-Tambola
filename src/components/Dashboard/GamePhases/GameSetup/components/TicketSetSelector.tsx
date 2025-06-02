// src/components/Dashboard/GamePhases/GameSetup/components/TicketSetSelector.tsx - CLEAN VERSION
// Removed all instructional content

import { useState, useEffect } from 'react';
import { Game } from '../../../../../types/game';
import { AlertTriangle } from 'lucide-react';

interface TicketSetSelectorProps {
  selectedSet: number;
  maxTickets: number;
  onUpdate: (updates: Partial<Game.Settings>) => void;
}

function TicketSetSelector({ selectedSet, maxTickets, onUpdate }: TicketSetSelectorProps) {
  const [error, setError] = useState<string | null>(null);
  const [localMaxTickets, setLocalMaxTickets] = useState<number>(maxTickets);

  useEffect(() => {
    setLocalMaxTickets(maxTickets);
  }, [maxTickets]);

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
    onUpdate({ maxTickets: numValue });
  };

  const handleBlur = () => {
    if (localMaxTickets === 0) {
      setLocalMaxTickets(1);
      onUpdate({ maxTickets: 1 });
    }
  };

  return (
    <section className="bg-white rounded-lg p-6 shadow-sm border">
      <div>
        <h3 className="text-lg font-medium text-gray-900">Ticket Set Selection</h3>
        <p className="text-gray-500 text-sm mt-1">
          Choose a ticket set and set the maximum number of tickets
        </p>
      </div>

      <div className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:gap-4">
          {[1, 2, 3, 4].map((setNumber) => (
            <button
              key={setNumber}
              onClick={() => onUpdate({ selectedTicketSet: setNumber })}
              className={`p-3 sm:p-4 rounded-lg border-2 text-center transition-colors duration-200 ${
                selectedSet === setNumber
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="font-medium text-sm sm:text-base">Set {setNumber}</div>
              <div className="text-xs sm:text-sm text-gray-500">600 Tickets</div>
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
              className={`block w-full px-3 py-3 sm:py-2 border rounded-md shadow-sm 
                focus:ring-blue-500 focus:border-blue-500 text-base
                ${error ? 'border-red-300' : 'border-gray-300'}`}
              min="1"
              max="600"
            />
            <div className="mt-2 sm:mt-0 sm:ml-3 flex justify-between space-x-1 sm:space-x-2">
              {[90, 180, 300].map(count => (
                <button
                  key={count}
                  onClick={() => {
                    setLocalMaxTickets(count);
                    onUpdate({ maxTickets: count });
                    setError(null);
                  }}
                  className="flex-1 px-2 py-2 sm:py-1 text-xs font-medium text-blue-700 bg-blue-50 
                    border border-blue-200 rounded hover:bg-blue-100"
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
            <p className="mt-2 text-sm text-gray-500">
              Maximum allowed: 600 tickets
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export default TicketSetSelector;
