// src/components/Dashboard/GamePhases/GameSetup/GameSetup.tsx - COMPLETELY FIXED
// Removed all incorrect HostProfile usage, uses only Game.Settings

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import { useGame } from '../../../../contexts/GameContext';
import { LoadingSpinner, Toast } from '@components';
import PrizeConfiguration from './components/PrizeConfiguration';
import TicketSetSelector from './components/TicketSetSelector';
import GameParameters from './components/GameParameters';
import { Game } from '../../../../types/game';
import { AlertTriangle, CheckCircle, Save, ChevronRight, Phone } from 'lucide-react';
import { loadTicketData, validateTicketData } from '../../../../utils/ticketLoader';

interface GameSetupProps {
  currentGame: Game.CurrentGame;
}

const GameSetup: React.FC<GameSetupProps> = ({ currentGame }) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  // Get command methods from game context
  const { 
    updateGameSettings, 
    startBookingPhase,
    isProcessing 
  } = useGame();
  
  const [settings, setSettings] = useState<Game.Settings>(currentGame.settings);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  const [hasMadeChanges, setHasMadeChanges] = useState(false);

  useEffect(() => {
    if (currentGame?.settings) {
      setSettings(currentGame.settings);
    }
  }, [currentGame]);

  const handleSettingsUpdate = (updates: Partial<Game.Settings>) => {
    setSettings(prev => ({
      ...prev,
      ...updates
    }));
    setHasMadeChanges(true);
  };

  const handlePrizeUpdate = (prizes: Game.Settings['prizes']) => {
    setSettings(prev => ({
      ...prev,
      prizes
    }));
    setHasMadeChanges(true);
  };

  const validateSettings = (): boolean => {
    const errors: string[] = [];
    
    const hasPrizes = Object.values(settings.prizes).some(value => value === true);
    if (!hasPrizes) {
      errors.push('At least one prize type must be enabled');
    }
    
    if (!settings.maxTickets || settings.maxTickets <= 0) {
      errors.push('Maximum tickets must be greater than 0');
    } else if (settings.maxTickets > 600) {
      errors.push('Maximum tickets cannot exceed 600');
    }
    
    if (!settings.callDelay || settings.callDelay < 3) {
      errors.push('Call delay must be at least 3 seconds');
    } else if (settings.callDelay > 10) {
      errors.push('Call delay cannot exceed 10 seconds');
    }
    
    if (!settings.hostPhone) {
      errors.push('Host phone number is required');
    } else {
      const digits = settings.hostPhone.replace(/(?!^\+)\D/g, '');
      const hasCountryCode = settings.hostPhone.startsWith('+');
      
      if (!hasCountryCode) {
        errors.push('Phone number must include country code (e.g., +91)');
      } else if (digits.length < 12) {
        errors.push('Phone number is too short (should be 10 digits after country code)');
      } else if (digits.length > 13) {
        errors.push('Phone number is too long (should be 10 digits after country code)');
      }
    }
    
    setValidationErrors(errors);
    return errors.length === 0;
  };

  /**
   * Save settings using command
   */
  const saveSettings = async () => {
    if (!currentUser?.uid) return;
    
    if (!validateSettings()) {
      setToastMessage('Please fix the validation errors before proceeding');
      setToastType('error');
      setShowToast(true);
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      console.log('💾 Saving settings with command');
      
      // Send command to update game settings
      const commandId = updateGameSettings(settings);
      console.log(`📤 Update settings command sent: ${commandId}`);
      
      setToastMessage('Settings saved successfully');
      setToastType('success');
      setShowToast(true);
      setHasMadeChanges(false);
      
    } catch (error) {
      console.error('❌ Error saving settings:', error);
      setToastMessage('Failed to save settings. Please try again.');
      setToastType('error');
      setShowToast(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Start booking phase using command
   */
  const handleStartBookingPhase = async () => {
    if (!currentUser?.uid) return;
    
    if (!validateSettings()) {
      setToastMessage('Please fix the validation errors before proceeding');
      setToastType('error');
      setShowToast(true);
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      console.log('🎫 Starting booking phase with command');
      
      // Load ticket data
      console.log('Loading ticket data...');
      const ticketData = await loadTicketData(
        settings.selectedTicketSet,
        settings.maxTickets
      );
      
      if (!validateTicketData(ticketData)) {
        throw new Error('Invalid ticket data structure. Please check the ticket data files.');
      }
      
      console.log(`Ticket data loaded successfully. Creating ${settings.maxTickets} tickets...`);
      
      // Create tickets object
      const tickets: Record<string, Game.Ticket> = {};
      for (let i = 1; i <= settings.maxTickets; i++) {
        const ticketId = i.toString();
        const ticketNumbers = ticketData[ticketId] || [[], [], []];
        
        tickets[ticketId] = {
          id: ticketId,
          status: 'available',
          sheetNumber: settings.selectedTicketSet,
          position: Math.ceil(i / 6),
          numbers: ticketNumbers
        };
      }
      
      // Send command to start booking phase
      const commandId = startBookingPhase(settings, tickets);
      console.log(`📤 Start booking phase command sent: ${commandId}`);
      
      setToastMessage('Moving to booking phase');
      setToastType('success');
      setShowToast(true);
      
      // Navigation will happen automatically when game state updates
      
    } catch (error) {
      console.error('❌ Error starting booking phase:', error);
      setToastMessage(`Failed to start booking phase: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setToastType('error');
      setShowToast(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex justify-between items-center border-b pb-4 mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Game Setup</h2>
            <p className="text-gray-600 mt-1">Configure game settings before starting</p>
          </div>
          
          <div className="flex items-center space-x-3">
            {hasMadeChanges && (
              <span className="text-sm text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
                Unsaved changes
              </span>
            )}
            {isProcessing && (
              <span className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded flex items-center">
                <div className="animate-spin h-3 w-3 border border-blue-600 border-t-transparent rounded-full mr-1" />
                Processing...
              </span>
            )}
            <button
              onClick={saveSettings}
              disabled={isSubmitting || !hasMadeChanges || isProcessing}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center
                ${isSubmitting || !hasMadeChanges || isProcessing
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
            >
              <Save className="w-4 h-4 mr-1" />
              {isSubmitting ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
        
        {validationErrors.length > 0 && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Please fix the following errors:
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <ul className="list-disc space-y-1 pl-5">
                    {validationErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div className="space-y-6">
          <TicketSetSelector
            selectedSet={settings.selectedTicketSet}
            maxTickets={settings.maxTickets}
            onUpdate={handleSettingsUpdate}
          />
          
          <div className="bg-white rounded-lg p-4 sm:p-6 shadow-sm border">
            <h3 className="text-base sm:text-lg font-medium text-gray-900">Host Contact</h3>
            <p className="text-gray-500 text-xs sm:text-sm mt-1">
              Enter host phone number for player assistance
            </p>
            
            <div className="mt-3 sm:mt-4">
              <label 
                htmlFor="hostPhone" 
                className="block text-sm font-medium text-gray-700"
              >
                Host Phone Number
              </label>
              <div className="mt-1 sm:mt-2 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="tel"
                  inputMode="tel"
                  id="hostPhone"
                  value={settings.hostPhone || '+91'}
                  onChange={(e) => {
                    let value = e.target.value;
                    
                    if (!value.startsWith('+')) {
                      value = '+' + value;
                    }
                    
                    handleSettingsUpdate({ hostPhone: value });
                  }}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-md 
                    focus:ring-blue-500 focus:border-blue-500 text-base"
                  placeholder="+91 9876543210"
                />
              </div>
              <p className="mt-1 sm:mt-2 text-xs text-gray-500">
                Include country code (e.g., +91) followed by 10-digit number
              </p>
            </div>
          </div>
          
          <GameParameters
            callDelay={settings.callDelay}
            onUpdate={handleSettingsUpdate}
          />
          
          <PrizeConfiguration
            prizes={settings.prizes}
            onUpdate={handlePrizeUpdate}
          />
        </div>
        
        <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-200 flex flex-col sm:flex-row sm:justify-end">
          <button
            onClick={handleStartBookingPhase}
            disabled={isSubmitting || validationErrors.length > 0 || isProcessing}
            className={`w-full sm:w-auto px-4 sm:px-6 py-4 sm:py-3 rounded-lg text-white font-medium flex items-center justify-center
              ${isSubmitting || validationErrors.length > 0 || isProcessing
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
              }`}
          >
            {isSubmitting || isProcessing ? (
              <span className="flex items-center">
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                {isSubmitting ? 'Setting up...' : 'Processing...'}
              </span>
            ) : (
              <>
                Continue to Booking Phase
                <ChevronRight className="w-5 h-5 ml-2" />
              </>
            )}
          </button>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Game Setup Guide
        </h3>
        
        <div className="space-y-4">
          <div className="flex">
            <div className="flex-shrink-0 mt-1">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <div className="ml-3">
              <h4 className="text-sm font-medium text-gray-900">Choose a Ticket Set</h4>
              <p className="mt-1 text-sm text-gray-600">
                Select one of the four available ticket sets. Each set contains unique tickets with
                different number distributions.
              </p>
            </div>
          </div>
          
          <div className="flex">
            <div className="flex-shrink-0 mt-1">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <div className="ml-3">
              <h4 className="text-sm font-medium text-gray-900">Set the Maximum Tickets</h4>
              <p className="mt-1 text-sm text-gray-600">
                Limit the number of tickets available for this game. Consider your expected
                player count when setting this value.
              </p>
            </div>
          </div>
          
          <div className="flex">
            <div className="flex-shrink-0 mt-1">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <div className="ml-3">
              <h4 className="text-sm font-medium text-gray-900">Adjust Call Delay</h4>
              <p className="mt-1 text-sm text-gray-600">
                Set the time between automatic number calls. Beginners may prefer a longer
                delay, while experienced players might enjoy a faster pace.
              </p>
            </div>
          </div>
          
          <div className="flex">
            <div className="flex-shrink-0 mt-1">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <div className="ml-3">
              <h4 className="text-sm font-medium text-gray-900">Configure Prizes</h4>
              <p className="mt-1 text-sm text-gray-600">
                Enable or disable the prize types for this game. At least one prize type
                must be enabled. Consider your audience when selecting prizes.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {showToast && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  );
};

export default GameSetup;
