// src/components/Dashboard/GamePhases/GameSetup/components/TicketSetSelector.tsx
import { useState, useEffect } from 'react';
import { Game } from '../../../../../types/game';
import { AlertTriangle, HelpCircle } from 'lucide-react';

interface TicketSetSelectorProps {
  selectedSet: number;
  maxTickets: number;
  onUpdate: (updates: Partial<Game.Settings>) => void;
}

function TicketSetSelector({ selectedSet, maxTickets, onUpdate }: TicketSetSelectorProps) {
  const [error, setError] = useState<string | null>(null);
  const [localMaxTickets, setLocalMaxTickets] = useState<number>(maxTickets);
  const [showHelp, setShowHelp] = useState(false);

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

  // Validate and update when input loses focus
  const handleBlur = () => {
    if (localMaxTickets === 0) {
      setLocalMaxTickets(1);
      onUpdate({ maxTickets: 1 });
    }
  };

  // Recommended ticket counts based on player count
  const recommendedTickets = [
    { players: 'Up to 10 players', count: 30 },
    { players: '10-25 players', count: 90 },
    { players: '25-50 players', count: 180 },
    { players: '50+ players', count: 300 }
  ];

  return (
    <section className="bg-white rounded-lg p-6 shadow-sm border">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Ticket Set Selection</h3>
          <p className="text-gray-500 text-sm mt-1">
            Choose a ticket set and set the maximum number of tickets
          </p>
        </div>
        <button
          onClick={() => setShowHelp(!showHelp)}
          className="p-1 text-gray-400 hover:text-gray-600"
          aria-label="Toggle help"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
      </div>

      {showHelp && (
        <div className="mt-4 bg-blue-50 border border-blue-100 rounded-md p-3 text-sm text-blue-800">
          <p className="font-medium mb-2">Ticket Set Information:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Each set contains up to 600 unique tickets</li>
            <li>Set 1 & 2 have standard distributions of numbers</li>
            <li>Set 3 & 4 have more varied distributions for experienced players</li>
            <li>The "Maximum Tickets" setting limits how many tickets will be used from the selected set</li>
          </ul>
        </div>
      )}

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

        <div className="mt-4 border border-gray-100 rounded-md p-3 bg-gray-50">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Recommended Settings</h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {recommendedTickets.map(rec => (
              <div key={rec.players} className="flex justify-between">
                <span className="text-gray-600">{rec.players}:</span>
                <button
                  onClick={() => {
                    setLocalMaxTickets(rec.count);
                    onUpdate({ maxTickets: rec.count });
                    setError(null);
                  }}
                  className="text-blue-600 hover:text-blue-800"
                >
                  {rec.count} tickets
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default TicketSetSelector;