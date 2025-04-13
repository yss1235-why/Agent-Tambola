import { useState, useEffect } from 'react';
import { Game } from '../../../../../types/game';
import { AlertTriangle, RotateCcw, Info } from 'lucide-react';

interface PrizeConfigurationProps {
  prizes: Game.Settings['prizes'];
  onUpdate: (prizes: Game.Settings['prizes']) => void;
}

interface PrizeToggleProps {
  label: string;
  checked: boolean;
  description?: string;
  icon?: React.ReactNode;
  importance?: 'standard' | 'primary' | 'secondary';
  onChange: () => void;
}

const DEFAULT_PRIZES: Game.Settings['prizes'] = {
  quickFive: true,
  topLine: true,
  middleLine: true,
  bottomLine: true,
  corners: true,
  starCorners: false,
  halfSheet: true,
  fullSheet: true,
  fullHouse: true,
  secondFullHouse: false,
};

function PrizeToggle({ 
  label, 
  checked, 
  description, 
  icon,
  importance = 'standard',
  onChange 
}: PrizeToggleProps) {
  const getBgColor = () => {
    if (!checked) return 'bg-white hover:bg-gray-50';
    
    switch(importance) {
      case 'primary': return 'bg-blue-50';
      case 'secondary': return 'bg-purple-50';
      default: return 'bg-green-50';
    }
  };
  
  const getBorderColor = () => {
    if (!checked) return 'border-gray-200';
    
    switch(importance) {
      case 'primary': return 'border-blue-300';
      case 'secondary': return 'border-purple-300';
      default: return 'border-green-300';
    }
  };

  return (
    <div 
      className={`relative flex items-start p-2 sm:p-3 rounded-lg border 
        transition-colors duration-200 ${getBgColor()} ${getBorderColor()}`}
    >
      <div className="min-w-0 flex-1">
        <label 
          className="flex items-center text-gray-700 cursor-pointer select-none touch-manipulation"
          htmlFor={`prize-${label.toLowerCase().replace(/\s+/g, '-')}`}
        >
          <input
            type="checkbox"
            id={`prize-${label.toLowerCase().replace(/\s+/g, '-')}`}
            checked={checked}
            onChange={onChange}
            className="h-5 w-5 rounded border-gray-300 text-blue-600 
              focus:ring-blue-500 mr-2 sm:mr-3"
          />
          <div>
            <div className="flex items-center">
              {icon && <span className="mr-1 sm:mr-2">{icon}</span>}
              <span className="text-sm sm:text-base font-medium">{label}</span>
            </div>
            {description && (
              <p className="text-gray-500 text-xs mt-0.5 sm:mt-1 line-clamp-2 sm:line-clamp-none">{description}</p>
            )}
          </div>
        </label>
      </div>
    </div>
  );
}

function PrizeConfiguration({ prizes, onUpdate }: PrizeConfigurationProps) {
  const [hasChanges, setHasChanges] = useState(false);
  const [hasValidationWarning, setHasValidationWarning] = useState(false);

  useEffect(() => {
    // Validate that at least one prize is enabled
    const hasActivePrize = Object.values(prizes).some(value => value === true);
    setHasValidationWarning(!hasActivePrize);
  }, [prizes]);

  const togglePrize = (key: keyof Game.Settings['prizes']) => {
    const updatedPrizes = {
      ...prizes,
      [key]: !prizes[key]
    };
    onUpdate(updatedPrizes);
    setHasChanges(true);
  };

  const resetToDefaults = () => {
    onUpdate(DEFAULT_PRIZES);
    setHasChanges(true);
  };

  const quickToggleAll = (enabled: boolean) => {
    const updatedPrizes = { ...prizes };
    Object.keys(updatedPrizes).forEach(key => {
      updatedPrizes[key as keyof Game.Settings['prizes']] = enabled;
    });
    onUpdate(updatedPrizes);
    setHasChanges(true);
  };

  // Define descriptions and importance for each prize type
  const prizeMetadata: Record<string, { description: string, importance: 'primary' | 'secondary' | 'standard' }> = {
    quickFive: { 
      description: 'First to complete any 5 numbers',
      importance: 'standard'
    },
    topLine: { 
      description: 'Complete the top row of numbers',
      importance: 'standard'
    },
    middleLine: { 
      description: 'Complete the middle row of numbers',
      importance: 'standard'
    },
    bottomLine: { 
      description: 'Complete the bottom row of numbers',
      importance: 'standard'
    },
    corners: { 
      description: 'Complete all four corner numbers',
      importance: 'standard'
    },
    starCorners: { 
      description: 'Complete all star-marked corners (advanced)',
      importance: 'secondary'
    },
    halfSheet: { 
      description: 'Complete three consecutive tickets',
      importance: 'standard'
    },
    fullSheet: { 
      description: 'Complete all six tickets in a sheet',
      importance: 'secondary'
    },
    fullHouse: { 
      description: 'Complete all numbers in a ticket',
      importance: 'primary'
    },
    secondFullHouse: { 
      description: 'Second player to complete all numbers',
      importance: 'secondary'
    }
  };

  return (
    <section className="bg-white rounded-lg p-6 shadow-sm border">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Prize Configuration</h3>
          <p className="text-gray-500 text-sm mt-1">
            Select the active prizes for this game
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => quickToggleAll(true)}
            className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 border border-blue-200 rounded-md hover:bg-blue-50"
          >
            Enable All
          </button>
          <button
            onClick={resetToDefaults}
            className="px-3 py-1 text-sm flex items-center text-gray-600 hover:text-gray-800 border border-gray-200 rounded-md hover:bg-gray-50"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Reset
          </button>
        </div>
      </div>

      {hasValidationWarning && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md flex items-start">
          <AlertTriangle className="w-5 h-5 text-yellow-500 mr-2 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-700">
            Warning: At least one prize type must be enabled for the game to function properly.
          </div>
        </div>
      )}
      
      <div className="mt-6">
        <div className="mb-3 flex items-center text-sm text-gray-600">
          <Info className="w-4 h-4 mr-1" />
          <span>Popular prizes marked in blue</span>
        </div>
        
        <div className="grid grid-cols-1 gap-2 sm:gap-3">
          {Object.keys(prizes).map((keyString) => {
            const key = keyString as keyof Game.Settings['prizes'];
            const metadata = prizeMetadata[keyString];
            
            return (
              <PrizeToggle
                key={keyString}
                label={keyString.replace(/([A-Z])/g, ' $1').trim()}
                checked={prizes[key]}
                description={metadata.description}
                importance={metadata.importance}
                onChange={() => togglePrize(key)}
              />
            );
          })}
        </div>
      </div>

      {hasChanges && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-sm text-blue-600">
            Prize configuration updated. Changes will be applied when you start the game.
          </p>
        </div>
      )}
    </section>
  );
}

export default PrizeConfiguration;