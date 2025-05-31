// src/components/GameControls.tsx - UPDATED to use Command Queue Pattern
// Simplified controls that send commands instead of complex operations

import React, { useState, useCallback, useEffect } from 'react';
import { Play, Pause, StopCircle, Volume2, VolumeX } from 'lucide-react';
import { useGame } from '../contexts/GameContext';

interface GameControlsProps {
  gameStatus: 'active' | 'paused';
  soundEnabled: boolean;
  delaySeconds: number;
  onStatusChange: (status: 'active' | 'paused') => void; // ADDED: Missing prop
  onSoundToggle: () => void;
  onDelayChange: (delay: number) => void;
  onGameEnd?: () => void; // Optional callback for UI navigation
  disableControls?: boolean;
}

function GameControls({
  gameStatus,
  soundEnabled,
  delaySeconds,
  onStatusChange, // ADDED: Now accepting this prop
  onSoundToggle,
  onDelayChange,
  onGameEnd,
  disableControls = false
}: GameControlsProps) {
  // Get command methods from context
  const { 
    updateGameStatus, 
    updateCallDelay, 
    updateSoundSettings, 
    completeGame,
    isProcessing 
  } = useGame();

  // Local UI state for immediate feedback
  const [localGameStatus, setLocalGameStatus] = useState(gameStatus);
  const [localSoundEnabled, setLocalSoundEnabled] = useState(soundEnabled);
  const [showEndGameConfirm, setShowEndGameConfirm] = useState(false);
  const [isEditingDelay, setIsEditingDelay] = useState(false);
  const [tempDelay, setTempDelay] = useState<number | string>(delaySeconds);
  const [commandInProgress, setCommandInProgress] = useState<string | null>(null);

  // Sync with props but allow optimistic updates
  useEffect(() => {
    if (!commandInProgress) {
      setLocalGameStatus(gameStatus);
    }
  }, [gameStatus, commandInProgress]);

  useEffect(() => {
    if (!commandInProgress) {
      setLocalSoundEnabled(soundEnabled);
    }
  }, [soundEnabled, commandInProgress]);

  useEffect(() => {
    setTempDelay(delaySeconds);
  }, [delaySeconds]);

  /**
   * Handle status change with optimistic updates
   */
  const handleStatusChange = useCallback(async () => {
    if (disableControls || isProcessing) return;

    const newStatus = localGameStatus === 'active' ? 'paused' : 'active';
    
    console.log(`🔄 Status change command: ${localGameStatus} → ${newStatus}`);
    
    // Optimistic update for immediate UI feedback
    setLocalGameStatus(newStatus);
    setCommandInProgress('status');
    
    try {
      // Send command (returns command ID)
      const commandId = updateGameStatus(newStatus, newStatus === 'active');
      console.log(`📤 Status command sent: ${commandId}`);
      
      // Call the prop callback
      onStatusChange(newStatus);
      
      // Clear command tracking after a delay
      setTimeout(() => {
        setCommandInProgress(null);
      }, 1000);
      
    } catch (error) {
      console.error('❌ Status command failed:', error);
      
      // Revert optimistic update on error
      setLocalGameStatus(gameStatus);
      setCommandInProgress(null);
    }
  }, [localGameStatus, gameStatus, updateGameStatus, onStatusChange, disableControls, isProcessing]);

  /**
   * Handle sound toggle with optimistic updates
   */
  const handleSoundToggle = useCallback(() => {
    if (disableControls) return;
    
    const newSoundEnabled = !localSoundEnabled;
    
    // Optimistic update
    setLocalSoundEnabled(newSoundEnabled);
    setCommandInProgress('sound');
    
    try {
      // Send command
      const commandId = updateSoundSettings(newSoundEnabled);
      console.log(`📤 Sound command sent: ${commandId}`);
      
      // Call the prop callback
      onSoundToggle();
      
      // Clear command tracking
      setTimeout(() => {
        setCommandInProgress(null);
      }, 500);
      
    } catch (error) {
      console.error('❌ Sound command failed:', error);
      
      // Revert on error
      setLocalSoundEnabled(soundEnabled);
      setCommandInProgress(null);
    }
  }, [localSoundEnabled, soundEnabled, updateSoundSettings, onSoundToggle, disableControls]);

  /**
   * Handle delay change
   */
  const handleDelaySubmit = useCallback(() => {
    const delayValue = typeof tempDelay === 'string' ? 
      (tempDelay === '' ? 3 : parseInt(tempDelay)) : tempDelay;
    
    const validDelay = Math.max(3, Math.min(20, delayValue));
    
    try {
      // Send command
      const commandId = updateCallDelay(validDelay);
      console.log(`📤 Delay command sent: ${commandId} (${validDelay}s)`);
      
      // Call the prop callback
      onDelayChange(validDelay);
      
      setIsEditingDelay(false);
      setTempDelay(validDelay);
      
    } catch (error) {
      console.error('❌ Delay command failed:', error);
      setTempDelay(delaySeconds);
    }
  }, [tempDelay, updateCallDelay, onDelayChange, delaySeconds]);

  /**
   * Handle end game
   */
  const handleEndGame = useCallback(() => {
    console.log('🏁 Ending game with command');
    
    try {
      // Send complete game command
      const commandId = completeGame('Manual end by host');
      console.log(`📤 End game command sent: ${commandId}`);
      
      setShowEndGameConfirm(false);
      
      // Call optional callback for UI navigation
      onGameEnd?.();
      
    } catch (error) {
      console.error('❌ End game command failed:', error);
    }
  }, [completeGame, onGameEnd]);

  // Determine button states
  const getStatusButtonText = () => {
    if (commandInProgress === 'status') {
      return localGameStatus === 'active' ? 'Pausing...' : 'Starting...';
    }
    return localGameStatus === 'active' ? 'Pause' : 'Start';
  };

  const getStatusButtonIcon = () => {
    if (commandInProgress === 'status') {
      return (
        <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
      );
    }
    return localGameStatus === 'active' ? 
      <Pause className="w-4 h-4 mr-2" /> : 
      <Play className="w-4 h-4 mr-2" />;
  };

  const getStatusButtonColor = () => {
    if (disableControls || commandInProgress === 'status') {
      return 'bg-gray-400 cursor-not-allowed';
    }
    return localGameStatus === 'active' ? 
      'bg-yellow-500 hover:bg-yellow-600' : 
      'bg-green-500 hover:bg-green-600';
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-center justify-between bg-gray-50 p-3 sm:p-4 rounded-lg">
        {/* Status Display */}
        <div className="flex items-center space-x-4 mb-3 sm:mb-0 w-full sm:w-auto">
          <span className="text-sm font-medium text-gray-500">Status:</span>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors duration-200 ${
              localGameStatus === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
            }`}
          >
            {localGameStatus === 'active' ? 'Active' : 'Paused'}
          </span>
          
          {disableControls && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
              Game Complete
            </span>
          )}
          
          {isProcessing && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              <div className="animate-spin h-3 w-3 mr-1 border border-blue-600 border-t-transparent rounded-full" />
              Processing...
            </span>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 w-full sm:w-auto">
          {/* Sound Toggle */}
          <button
            onClick={handleSoundToggle}
            disabled={disableControls || commandInProgress === 'sound'}
            className={`p-2 rounded-md bg-white border border-gray-300 transition-colors duration-150 ${
              disableControls || commandInProgress === 'sound' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'
            }`}
            title={`Sound ${localSoundEnabled ? 'On' : 'Off'}`}
          >
            {commandInProgress === 'sound' ? (
              <div className="animate-spin h-5 w-5 border-2 border-gray-400 border-t-transparent rounded-full" />
            ) : localSoundEnabled ? (
              <Volume2 className="w-5 h-5 text-blue-600" />
            ) : (
              <VolumeX className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {/* Delay Control */}
          {isEditingDelay ? (
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="3"
                max="20"
                value={tempDelay}
                onChange={(e) => {
                  const value = e.target.value;
                  setTempDelay(value === '' ? '' : parseInt(value) || 3);
                }}
                className="w-16 px-2 py-1 border rounded text-sm text-center"
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleDelaySubmit();
                  if (e.key === 'Escape') {
                    setTempDelay(delaySeconds);
                    setIsEditingDelay(false);
                  }
                }}
              />
              <button
                onClick={handleDelaySubmit}
                className="px-2 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
              >
                ✓
              </button>
              <button
                onClick={() => {
                  setTempDelay(delaySeconds);
                  setIsEditingDelay(false);
                }}
                className="px-2 py-1 text-sm border rounded hover:bg-gray-50 transition-colors"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditingDelay(true)}
              disabled={disableControls}
              className={`px-3 py-2 text-sm border rounded transition-colors ${
                disableControls ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'
              }`}
              title="Click to change delay"
            >
              {delaySeconds}s
            </button>
          )}

          {/* Main Control Button - Start/Pause */}
          <button
            onClick={handleStatusChange}
            disabled={disableControls || commandInProgress === 'status'}
            className={`px-4 py-2 rounded-md text-sm font-medium min-w-[100px] flex items-center justify-center text-white transition-all duration-200 ${getStatusButtonColor()}`}
            title={localGameStatus === 'active' ? 'Pause Game' : 'Start Game'}
          >
            {getStatusButtonIcon()}
            {getStatusButtonText()}
          </button>

          {/* End Game Button */}
          <button
            onClick={() => setShowEndGameConfirm(true)}
            disabled={isProcessing}
            className={`px-4 py-2 rounded-md text-sm font-medium bg-red-500 text-white min-w-[100px] flex items-center justify-center transition-colors duration-200 ${
              isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-600'
            }`}
            title="End Game"
          >
            <StopCircle className="w-4 h-4 mr-2" />
            End Game
          </button>
        </div>
      </div>

      {/* End Game Confirmation */}
      {showEndGameConfirm && (
        <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <StopCircle className="w-5 h-5 text-red-500 mt-0.5" />
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-red-800">
                Confirm End Game
              </h3>
              <p className="mt-1 text-sm text-red-700">
                Are you sure you want to end the game? This action cannot be undone and all progress will be saved to history.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={handleEndGame}
                  className="px-4 py-2 rounded-md text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
                >
                  Yes, End Game
                </button>
                <button
                  onClick={() => setShowEndGameConfirm(false)}
                  className="px-4 py-2 rounded-md text-sm font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Game Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <div className={`w-3 h-3 mt-1 rounded-full ${
              localGameStatus === 'active' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
            }`} />
          </div>
          <div className="ml-3 flex-1">
            <p className="text-sm font-medium text-blue-800">
              Auto Number Calling: {localGameStatus === 'active' ? 'Active' : 'Paused'}
            </p>
            <p className="mt-1 text-sm text-blue-700">
              {localGameStatus === 'active' 
                ? `Numbers are being called automatically every ${delaySeconds} seconds.`
                : 'Click Start to begin calling numbers automatically.'
              }
            </p>
            {isProcessing && (
              <p className="mt-1 text-sm text-blue-600 font-medium">
                📤 Commands are being processed...
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default GameControls;
