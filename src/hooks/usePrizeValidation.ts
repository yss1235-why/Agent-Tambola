// src/hooks/usePrizeValidation.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import { PrizeValidationService } from '../services/PrizeValidationService';
import type { Game } from '../types/game';
import type { PrizeValidationHookReturn } from '../types/hooks';

interface UsePrizeValidationProps {
  hostId: string;
  gameState?: Game.CurrentGame | null;
  onPrizeWon?: (prizeType: keyof Game.Winners, ticketIds: string[]) => void;
  onError?: (error: string) => void;
}

export function usePrizeValidation({
  hostId,
  gameState,
  onPrizeWon,
  onError
}: UsePrizeValidationProps): PrizeValidationHookReturn {
  const [isValidating, setIsValidating] = useState(false);
  const validationServiceRef = useRef<PrizeValidationService>(PrizeValidationService.getInstance());
  const lastValidationRef = useRef<number>(0);

  // Initialize prize validation service
  useEffect(() => {
    if (hostId) {
      validationServiceRef.current.initialize(hostId);
    }
    
    return () => {
      validationServiceRef.current.cleanup();
    };
  }, [hostId]);

  const validatePrizes = useCallback(async (calledNumbers: number[]): Promise<void> => {
    // Throttle validations to prevent excessive calls
    const now = Date.now();
    if (now - lastValidationRef.current < 1000) {
      return;
    }
    lastValidationRef.current = now;

    if (!gameState || !hostId || isValidating) {
      return;
    }

    // Don't validate if game is ended or all prizes won
    if (gameState.gameState?.allPrizesWon || gameState.gameState?.status === 'ended') {
      return;
    }

    setIsValidating(true);

    try {
      const tickets = gameState.activeTickets?.tickets || {};
      const bookings = gameState.activeTickets?.bookings || {};
      const currentWinners = gameState.gameState?.winners || {
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
      };
      const activePrizes = gameState.settings?.prizes || {};

      // Only validate if there are booked tickets and active prizes
      const hasBookedTickets = Object.keys(bookings).length > 0;
      const hasActivePrizes = Object.values(activePrizes).some(isActive => isActive);

      if (!hasBookedTickets || !hasActivePrizes) {
        return;
      }

      const validationResults = await validationServiceRef.current.validateAllPrizes(
        tickets,
        calledNumbers,
        currentWinners,
        activePrizes,
        bookings
      );

      // Process validation results and trigger callbacks
      Object.entries(validationResults).forEach(([prizeType, result]) => {
        if (result.isValid && result.winners.length > 0) {
          onPrizeWon?.(prizeType as keyof Game.Winners, result.winners);
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
