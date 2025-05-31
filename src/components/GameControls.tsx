// ===== COMPLETE FILE 4: src/components/GameControls.tsx =====

import React, { useState, useCallback, useEffect } from 'react';
import { Play, Pause, StopCircle, Volume2, VolumeX } from 'lucide-react';
import appConfig from '../config/appConfig';

interface GameControlsProps {
  gameStatus: 'active' | 'paused';
  soundEnabled: boolean;
  delaySeconds: number;
  onStatusChange: (status: 'active' | 'paused') => void;
  onSoundToggle: () => void;
  onDelayChange: (seconds: number) => void;
  onGameEnd: () => void;
  disableControls?: boolean;
}

function GameControls({
  gameStatus,
  soundEnabled,
  delaySeconds,
  onStatusChange,
  onSoundToggle,
  onDelayChange,
  onGameEnd,
  disableControls = false
}: GameControlsProps) {
  const [showEndGameConfirm, setShowEndGameConfirm] = useState(false);
  const [isEditingDelay, setIsEditingDelay] = useState(false);
  const [tempDelay, setTempDelay] = useState<number | string>(delaySeconds);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  
  // Update tempDelay when delaySeconds props changes
  useEffect(() => {
    setTempDelay(delaySeconds);
  }, [delaySeconds]);

  // Handle delay input and save it
  const handleDelaySubmit = useCallback(() => {
    const delayValue = typeof tempDelay === 'string' ? 
      (tempDelay === '' ? 3 : parseInt(tempDelay)) : tempDelay;
    
    const validDelay = Math.max(3, Math.min(20, delayValue));
    console.log(`⏱️ Submitting delay change to ${validDelay} seconds`);
    onDelayChange(validDelay);
    setIsEditingDelay(false);
  }, [tempDelay, onDelayChange]);

  // Handle the confirmation and actually end the game
  const handleEndGame = useCallback(() => {
    console.log('🏁 Confirming game end');
    onGameEnd();
    setShowEndGameConfirm(false);
  }, [onGameEnd]);

  // Handler for status change with loading state
  const handleStatusChange = useCallback(async () => {
    const newStatus = gameStatus === 'active' ? 'paused' : 'active';
    console.log(`🔄 Changing game status from ${gameStatus} to ${newStatus}`);
    
    setIsChangingStatus(true);
    
    try {
      await onStatusChange(newStatus);
      
      setTimeout(() => {
        setIsChangingStatus(false);
      }, 500);
    } catch (error) {
      console.error('❌ Error changing status:', error);
      setIsChangingStatus(false);
    }
  }, [gameStatus, onStatusChange]);

  // Determine if this is the initial start (not a resume)
  const isInitialStart = gameStatus === 'paused' && 
                         appConfig.gameDefaults.startInPausedState;

  const getStatusButtonText = () => {
    if (isChangingStatus) {
      return gameStatus === 'active' ? 'Pausing...' : 'Starting...';
    }
    
    if (gameStatus === 'active') {
      return 'Pause';
    }
    
    return isInitialStart ? 'Start' : 'Resume';
  };

  const getStatusButtonIcon = () => {
    if (gameStatus === 'active') {
      return <Pause className="w-4 h-4 mr-2" />;
    }
    return <Play className="w-4 h-4 mr-2" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-center justify-between bg-gray-50 p-3 sm:p-4 rounded-lg">
        <div className="flex items-center space-x-4 mb-3 sm:mb-0 w-full sm:w-auto">
          <span className="text-sm font-medium text-gray-500">Phase: Playing</span>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              gameStatus === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
            }`}
          >
            {gameStatus === 'active' ? 'Active' : 'Paused'}
          </span>
          {disableControls && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
              Controls Disabled
            </span>
          )}
          {isChangingStatus && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Updating...
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 w-full sm:w-auto">
          {/* Sound toggle button */}
          <button
            onClick={onSoundToggle}
            disabled={disableControls}
            className={`p-1.5 rounded-md bg-white border border-gray-300 hover:bg-gray-50
              ${disableControls ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={disableControls ? "Controls disabled - all prizes won or game completed" : "Toggle sound"}
          >
            {soundEnabled ? (
              <Volume2 className="w-5 h-5 text-gray-600" />
            ) : (
              <VolumeX className="w-5 h-5 text-gray-600" />
            )}
          </button>

          {/* Delay control */}
          {isEditingDelay ? (
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="3"
                max="20"
                value={tempDelay}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    setTempDelay('');
                  } else {
                    const parsedValue = parseInt(value);
                    if (!isNaN(parsedValue)) {
                      setTempDelay(parsedValue);
                    }
                  }
                }}
                className="w-16 px-2 py-1 border rounded text-sm"
                autoFocus
              />
              <button
                onClick={handleDelaySubmit}
                className="px-2 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setTempDelay(delaySeconds);
                  setIsEditingDelay(false);
                }}
                className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditingDelay(true)}
              disabled={disableControls}
              className={`px-2 py-1 text-sm border rounded hover:bg-gray-50
                ${disableControls ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={disableControls ? "Controls disabled - all prizes won or game completed" : "Change delay"}
            >
              {delaySeconds}s
            </button>
          )}

          {/* Play/Pause button */}
          <button
            onClick={handleStatusChange}
            disabled={disableControls || isChangingStatus}
            className={`px-4 py-2 rounded-md text-sm font-medium min-w-[100px] flex items-center justify-center
              ${gameStatus === 'active' 
                ? 'bg-yellow-500 text-white hover:bg-yellow-600' 
                : 'bg-green-500 text-white hover:bg-green-600'
              }
              ${(disableControls || isChangingStatus) ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={disableControls 
              ? "Controls disabled - all prizes won or game completed" 
              : (gameStatus === 'active' ? "Pause game" : "Start/Resume game")
            }
          >
            {isChangingStatus ? (
              <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              getStatusButtonIcon()
            )}
            {getStatusButtonText()}
          </button>

          {/* End Game button */}
          <button
            onClick={() => setShowEndGameConfirm(true)}
            disabled={isChangingStatus}
            className={`px-4 py-2 rounded-md text-sm font-medium bg-red-500 text-white hover:bg-red-600 min-w-[100px] flex items-center justify-center
              ${isChangingStatus ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <StopCircle className="w-4 h-4 mr-2" />
            End Game
          </button>
        </div>
      </div>

      {showEndGameConfirm && (
        <div className="mt-4 p-4 border border-red-200 bg-red-50 rounded-lg">
          <p className="text-red-700">
            Are you sure you want to end the game? This action cannot be undone.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={handleEndGame}
              className="px-4 py-2 rounded-md text-sm font-medium bg-red-500 text-white hover:bg-red-600 min-w-[120px] flex items-center justify-center"
            >
              <StopCircle className="w-4 h-4 mr-2" />
              Yes, End Game
            </button>
            <button
              onClick={() => setShowEndGameConfirm(false)}
              className="px-4 py-2 rounded-md text-sm font-medium bg-white border border-gray-300 hover:bg-gray-50 min-w-[100px]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Display info about auto calling */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-800 text-sm">
        <p className="font-medium">
          Auto Number Calling {gameStatus === 'active' ? 'is Active' : 'is Paused'}
          {isChangingStatus && ' (updating...)'}
        </p>
        <p className="mt-1">
          Numbers will be called automatically every {delaySeconds} seconds when the game is active.
          {gameStatus === 'paused' ? ' Click Start to begin calling numbers.' : ''}
        </p>
        <p className="mt-1">
          Press the {gameStatus === 'active' ? 'Pause' : 'Start'} button to {gameStatus === 'active' ? 'pause' : 'start'} the game.
        </p>
      </div>
    </div>
  );
}

export default GameControls;
