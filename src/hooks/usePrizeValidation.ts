// src/hooks/usePrizeValidation.ts - Updated for optimized validation
import { useState, useCallback } from 'react';
import { validateAllPrizes, ValidationContext } from '../utils/prizeValidation'; // Updated import
import type { Game } from '../types/game';
import type { PrizeValidationHookReturn } from '../types/hooks';

interface UsePrizeValidationProps {
  hostId: string;
  gameState?: Game.CurrentGame | null;
  onPrizeWon?: (prizeType: keyof Game.Winners, ticketIds: string[], playerName: string, prizeTypes: string[]) => void; // Updated callback
  onError?: (error: string) => void;
}

export function usePrizeValidation({
  hostId,
  gameState,
  onPrizeWon,
  onError
}: UsePrizeValidationProps): PrizeValidationHookReturn {
  const [isValidating, setIsValidating] = useState(false);

  const validatePrizes = useCallback(async (calledNumbers: number[]): Promise<void> => {
    if (!gameState || !hostId || isValidating) {
      return;
    }

    // Don't validate if game is ended or all prizes won
    if (gameState.gameState?.allPrizesWon || gameState.gameState?.status === 'ended') {
      return;
    }

    setIsValidating(true);

    try {
      const context: ValidationContext = {
        tickets: gameState.activeTickets?.tickets || {},
        bookings: gameState.activeTickets?.bookings || {},
        calledNumbers,
        currentWinners: gameState.gameState?.winners || {
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
        activePrizes: gameState.settings?.prizes || {}
      };

      // Only validate if there are booked tickets and active prizes
      const hasBookedTickets = Object.keys(context.bookings).length > 0;
      const hasActivePrizes = Object.values(context.activePrizes).some(isActive => isActive);

      if (!hasBookedTickets || !hasActivePrizes) {
        return;
      }

      console.log('🔍 Running optimized prize validation...');
      const validationResults = validateAllPrizes(context);

      // Process validation results and trigger callbacks
      validationResults.forEach(result => {
        if (result.isWinner && result.winningTickets.length > 0) {
          // Use the multiple prizes format
          const prizeTypes = result.allPrizeTypes || [result.prizeType.replace(/([A-Z])/g, ' $1').trim()];
          onPrizeWon?.(result.prizeType, result.winningTickets, result.playerName, prizeTypes);
        }
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Prize validation failed';
      onError?.(message);
    } finally {
      setIsValidating(false);
    }
  }, [gameState, hostId, isValidating, onPrizeWon, onError]);

  return {
    validatePrizes,
    isValidating
  };
}
