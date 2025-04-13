// src/components/Dashboard/GamePhases/PlayingPhase/components/NumberBoard.tsx
import React, { useMemo } from 'react';
import { Disc } from 'lucide-react';

interface NumberBoardProps {
  calledNumbers: number[];
  queue: number[];
  currentNumber: number | null;
  isProcessing: boolean;
  isGameComplete?: boolean;
  allPrizesWon?: boolean;
}

function NumberBoard({
  calledNumbers = [],
  queue = [],
  currentNumber = null,
  isProcessing,
  isGameComplete = false,
  allPrizesWon = false
}: NumberBoardProps) {
  const numbers = useMemo(() => {
    return Array.from({ length: 90 }, (_, i) => {
      const value = i + 1;
      let status = 'available';
      
      if (currentNumber === value) {
        status = 'current';
      } else if (calledNumbers.includes(value)) {
        status = 'called';
      } else if (queue.includes(value)) {
        status = 'queued';
      }
      
      return { value, status };
    });
  }, [calledNumbers, currentNumber, queue]);

  const getNumberStyles = (status: string) => {
    const baseClasses = "relative h-10 sm:h-12 w-full rounded-lg flex items-center justify-center font-medium transition-all duration-200 border touch-manipulation";
    
    switch (status) {
      case 'current':
        return `${baseClasses} bg-yellow-500 text-white font-bold shadow-lg scale-105 border-yellow-600`;
      case 'called':
        return `${baseClasses} bg-blue-500 text-white border-blue-600`;
      case 'queued':
        return `${baseClasses} bg-purple-100 text-purple-800 border-purple-300`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-600 border-gray-200 ${
          isGameComplete || allPrizesWon ? 'opacity-50' : ''
        }`;
    }
  };

  const getLastCallStamp = (index: number) => {
    const recentCallsCount = 5;
    const position = calledNumbers.length - calledNumbers.indexOf(index);
    
    if (position > 0 && position <= recentCallsCount) {
      return (
        <span className="absolute -top-1.5 -right-1.5 sm:-top-2 sm:-right-2 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-red-500 text-[10px] sm:text-xs text-white">
          {position}
        </span>
      );
    }
    
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Current Number Display (when available) */}
      {currentNumber && (
        <div className="flex justify-center items-center mb-4">
          <div className="relative p-1">
            <div className="absolute inset-0 rounded-full animate-ping bg-yellow-300 opacity-50"></div>
            <div className="relative flex items-center justify-center h-16 w-16 text-3xl font-bold bg-yellow-500 text-white rounded-full border-2 border-yellow-600">
              {currentNumber}
            </div>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-9 lg:grid-cols-10 gap-1 sm:gap-2">
        {numbers.map(({ value, status }) => (
          <div
            key={value}
            className={getNumberStyles(status)}
            title={`Number ${value} - ${status.charAt(0).toUpperCase() + status.slice(1)}`}
          >
            <span className="text-sm sm:text-base">{value}</span>
            {status === 'called' && getLastCallStamp(value)}
            {status === 'current' && (
              <Disc className="absolute -top-1 -right-1 h-4 w-4 text-yellow-300 animate-spin-slow" />
            )}
          </div>
        ))}
      </div>
      
      <div className="flex flex-wrap justify-center sm:justify-around text-xs sm:text-sm gap-3 sm:gap-4">
        <div className="flex items-center">
          <div className="w-4 h-4 rounded bg-yellow-500 mr-2" />
          <span>Current</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 rounded bg-blue-500 mr-2" />
          <span>Called</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 rounded bg-purple-100 border border-purple-300 mr-2" />
          <span>Queued</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 rounded bg-gray-100 border border-gray-200 mr-2" />
          <span>Available</span>
        </div>
      </div>
      
      {/* Called Numbers Summary */}
      <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
        <h4 className="text-xs sm:text-sm font-medium text-gray-700 mb-2">
          Last Called Numbers
        </h4>
        <div className="flex justify-center space-x-1.5 sm:space-x-2">
          {calledNumbers.slice(-5).reverse().map((num, idx) => (
            <div key={num} className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full 
              ${idx === 0 
                ? 'bg-yellow-500 text-white font-bold text-base sm:text-lg' 
                : 'bg-blue-100 text-blue-800 border border-blue-300 text-xs sm:text-sm'}`}
            >
              {num}
            </div>
          ))}
          {calledNumbers.length === 0 && (
            <div className="text-gray-500 text-xs sm:text-sm">No numbers called yet</div>
          )}
        </div>
      </div>
      
      {isGameComplete && (
        <div className="text-center text-sm text-gray-500">
          Game completed - number selection disabled
        </div>
      )}
      
      {allPrizesWon && !isGameComplete && (
        <div className="text-center text-sm text-red-500 font-medium">
          All prizes won - number selection disabled
        </div>
      )}
    </div>
  );
}

export default NumberBoard;