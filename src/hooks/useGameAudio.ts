// src/hooks/useGameAudio.ts
import { useState, useCallback, useEffect, useRef } from 'react';
import { AudioManager } from '../utils/audioManager';
import type { Game } from '../types/game';
import type { AudioHookReturn } from '../types/hooks';

interface UseGameAudioProps {
  gameState?: Game.CurrentGame | null;
  onError?: (error: string) => void;
}

export function useGameAudio({
  gameState,
  onError
}: UseGameAudioProps): AudioHookReturn {
  const [isEnabled, setIsEnabled] = useState(true);
  const audioManagerRef = useRef<AudioManager>(AudioManager.getInstance());

  // Initialize audio manager
  useEffect(() => {
    audioManagerRef.current.initialize().catch(error => {
      onError?.(`Failed to initialize audio: ${error.message}`);
    });
  }, [onError]);

  // Sync with game state
  useEffect(() => {
    if (gameState?.gameState?.soundEnabled !== undefined) {
      setIsEnabled(gameState.gameState.soundEnabled);
      audioManagerRef.current.setEnabled(gameState.gameState.soundEnabled);
    }
  }, [gameState?.gameState?.soundEnabled]);

  const announceNumber = useCallback(async (number: number): Promise<void> => {
    if (!isEnabled) return;

    try {
      await audioManagerRef.current.announceNumber(number);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to announce number';
      onError?.(message);
    }
  }, [isEnabled, onError]);

  const playPrizeWinSound = useCallback(async (prizeType: keyof Game.Winners): Promise<void> => {
    if (!isEnabled) return;

    try {
      await audioManagerRef.current.playPrizeWinEffect(prizeType);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to play prize win sound';
      onError?.(message);
    }
  }, [isEnabled, onError]);

  const setVolume = useCallback((volume: number) => {
    const validVolume = Math.min(Math.max(0, volume), 1);
    audioManagerRef.current.setVolume(validVolume);
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    setIsEnabled(enabled);
    audioManagerRef.current.setEnabled(enabled);
  }, []);

  return {
    announceNumber,
    playPrizeWinSound,
    setVolume,
    setEnabled,
    isEnabled
  };
}
