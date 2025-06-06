// src/components/Dashboard/GamePhases/GameSetup/components/GameParameters.tsx - CLEAN VERSION
// Removed all instructional content and recommendations

import { useState, useCallback, useEffect } from 'react';
import { Game } from '../../../../../types/game';
import { Clock, FastForward, Zap } from 'lucide-react';

interface GameParametersProps {
  callDelay: number;
  onUpdate: (updates: Partial<Game.Settings>) => void;
}

// Preset configurations for different game paces
const GAME_PACE_PRESETS = {
  beginner: {
    callDelay: 8,
    label: 'Beginner (8s)'
  },
  standard: {
    callDelay: 5,
    label: 'Standard (5s)'
  },
  advanced: {
    callDelay: 3,
    label: 'Advanced (3s)'
  }
};

function GameParameters({ callDelay, onUpdate }: GameParametersProps) {
  const [previewDelay, setPreviewDelay] = useState(callDelay);
  const [activePacePreset, setActivePacePreset] = useState<string | null>(null);

  useEffect(() => {
    setPreviewDelay(callDelay);
    
    const matchingPreset = Object.entries(GAME_PACE_PRESETS).find(
      ([_, preset]) => preset.callDelay === callDelay
    );
    
    setActivePacePreset(matchingPreset ? matchingPreset[0] : null);
  }, [callDelay]);

  const handleDelayChange = useCallback((value: number) => {
    setPreviewDelay(value);
    setActivePacePreset(null);
  }, []);

  const handleDelayChangeComplete = useCallback(() => {
    const validDelay = Math.min(10, Math.max(3, previewDelay));
    onUpdate({ callDelay: validDelay });
  }, [previewDelay, onUpdate]);

  const applyPreset = useCallback((presetKey: keyof typeof GAME_PACE_PRESETS) => {
    const preset = GAME_PACE_PRESETS[presetKey];
    setPreviewDelay(preset.callDelay);
    onUpdate({ callDelay: preset.callDelay });
    setActivePacePreset(presetKey);
  }, [onUpdate]);

  const getSpeedLabel = (delay: number): string => {
    if (delay <= 4) return 'Fast';
    if (delay <= 6) return 'Normal';
    if (delay <= 8) return 'Relaxed';
    return 'Slow';
  };

  return (
    <section className="bg-white rounded-lg p-6 shadow-sm border">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Game Parameters</h3>
          <p className="text-gray-500 text-sm mt-1">
            Configure game timing and control settings
          </p>
        </div>
        <div className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-sm font-medium">
          {getSpeedLabel(previewDelay)} ({previewDelay}s)
        </div>
      </div>

      <div className="mt-6 space-y-6">
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {Object.entries(GAME_PACE_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => applyPreset(key as keyof typeof GAME_PACE_PRESETS)}
              className={`px-2 py-1.5 sm:px-3 sm:py-2 rounded-md text-xs sm:text-sm font-medium flex items-center
                ${activePacePreset === key 
                  ? 'bg-blue-100 text-blue-800 border-2 border-blue-300' 
                  : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'}`}
            >
              {key === 'beginner' && <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />}
              {key === 'standard' && <FastForward className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />}
              {key === 'advanced' && <Zap className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />}
              <span className="truncate">
                {preset.label}
              </span>
            </button>
          ))}
        </div>

        <div>
          <label 
            htmlFor="callDelay"
            className="block text-sm font-medium text-gray-700"
          >
            Number Call Delay
          </label>
          <div className="mt-2">
            <div className="flex items-center gap-4">
              <input
                id="callDelay"
                type="range"
                min="3"
                max="10"
                step="0.5"
                value={previewDelay}
                onChange={(e) => handleDelayChange(parseFloat(e.target.value))}
                onMouseUp={handleDelayChangeComplete}
                onTouchEnd={handleDelayChangeComplete}
                className="flex-grow h-2 bg-gray-200 rounded-lg appearance-none 
                  cursor-pointer accent-blue-600"
              />
              <span className="w-16 px-2 py-1 text-sm text-gray-700 bg-gray-100 
                rounded-md text-center">
                {previewDelay}s
              </span>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1 px-1">
              <span>Fast</span>
              <span>Normal</span>
              <span>Slow</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default GameParameters;
