// src/components/Dashboard/GamePhases/GameSetup/GameSetup.tsx - FIXED
// Fixed auto-refresh issue and proper ticket regeneration

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import { useGame } from '../../../../contexts/GameContext';
import { LoadingSpinner, Toast } from '@components';
import PrizeConfiguration from './components/PrizeConfiguration';
import TicketSetSelector from './components/TicketSetSelector';
import GameParameters from './components/GameParameters';
import { Game } from '../../../../types/game';
import { AlertTriangle, Save, ChevronRight, Phone, RefreshCw, CheckCircle, Loader } from 'lucide-react';
import { loadTicketData, validateTicketData } from '../../../../utils/ticketLoader';
import { GameDatabaseService } from '../../../../services/GameDatabaseService';

interface GameSetupProps {
  currentGame: Game.CurrentGame;
}

const GameSetup: React.FC<GameSetupProps> = ({ currentGame }) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const { 
    updateGameSettings, 
    startBookingPhase,
    regenerateTickets,
    isProcessing 
  } = useGame();
  
  const [settings, setSettings] = useState<Game.Settings>(currentGame.settings);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingDefaults, setIsLoadingDefaults] = useState(true);
  const [isRegeneratingTickets, setIsRegeneratingTickets] = useState(false);
  const [settingsLoadedFrom, setSettingsLoadedFrom] = useState<'database' | 'game' | 'defaults'>('defaults');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  const [hasMadeChanges, setHasMadeChanges] = useState(false);
  
  // FIXED: Track previous values more reliably
  const previousSettings = useRef<{
    maxTickets: number;
    selectedTicketSet: number;
  }>({
    maxTickets: currentGame.settings.maxTickets,
    selectedTicketSet: currentGame.settings.selectedTicketSet
  });
  
  const hasInitialized = useRef(false);
  const regenerationTimeoutRef = useRef<NodeJS.Timeout>();

  // Load default settings with better tracking and messaging
  useEffect(() => {
    const loadDefaultSettings = async () => {
      if (!currentUser?.uid) return;
      
      try {
        setIsLoadingDefaults(true);
        
        const dbService = GameDatabaseService.getInstance();
        const defaultSettings = await dbService.getDefaultSettings(currentUser.uid);
        
        if (defaultSettings) {
          console.log('📁 Loaded default settings:', {
            source: 'Previous game preferences',
            hostPhone: defaultSettings.hostPhone ? 'Found' : 'Not found',
            callDelay: defaultSettings.callDelay,
            selectedTicketSet: defaultSettings.selectedTicketSet,
            maxTickets: defaultSettings.maxTickets,
            enabledPrizes: Object.entries(defaultSettings.prizes || {}).filter(([_, enabled]) => enabled).length
          });
          
          const mergedSettings: Game.Settings = {
            ...defaultSettings,
            ...currentGame.settings,
            hostPhone: currentGame.settings.hostPhone || defaultSettings.hostPhone || '+91',
            prizes: Object.keys(currentGame.settings.prizes || {}).length > 0 
              ? currentGame.settings.prizes 
              : defaultSettings.prizes
          };
          
          setSettings(mergedSettings);
          setSettingsLoadedFrom('database');
          
          // FIXED: Update refs with loaded values
          previousSettings.current = {
            maxTickets: mergedSettings.maxTickets,
            selectedTicketSet: mergedSettings.selectedTicketSet
          };
          
          const preservedItems = [];
          if (defaultSettings.hostPhone && defaultSettings.hostPhone !== '+91') {
            preservedItems.push('host phone');
          }
          
          const prizesLoaded = Object.entries(defaultSettings.prizes || {}).filter(([_, enabled]) => enabled).length;
          if (prizesLoaded > 0) {
            preservedItems.push(`${prizesLoaded} prize selections`);
          }
          
          if (defaultSettings.maxTickets !== 90) {
            preservedItems.push(`${defaultSettings.maxTickets} max tickets`);
          }
          
          if (defaultSettings.callDelay !== 5) {
            preservedItems.push(`${defaultSettings.callDelay}s call delay`);
          }
          
          if (preservedItems.length > 0) {
            setToastMessage(`Settings preserved from previous game: ${preservedItems.join(', ')}`);
            setToastType('info');
            setShowToast(true);
          }
          
        } else {
          console.log('📁 No default settings found, using current game settings');
          setSettings(currentGame.settings);
          setSettingsLoadedFrom('game');
          
          // FIXED: Update refs with current game values
          previousSettings.current = {
            maxTickets: currentGame.settings.maxTickets,
            selectedTicketSet: currentGame.settings.selectedTicketSet
          };
        }
      } catch (error) {
        console.error('❌ Error loading default settings:', error);
        setSettings(currentGame.settings);
        setSettingsLoadedFrom('defaults');
        
        // FIXED: Update refs with current game values
        previousSettings.current = {
          maxTickets: currentGame.settings.maxTickets,
          selectedTicketSet: currentGame.settings.selectedTicketSet
        };
      } finally {
        setIsLoadingDefaults(false);
        hasInitialized.current = true;
      }
    };
    
    loadDefaultSettings();
  }, [currentUser?.uid, currentGame.settings]);

  // FIXED: Debounced ticket regeneration to prevent auto-refresh
  const debouncedRegenerateTickets = useCallback(async (newMaxTickets: number, newSelectedTicketSet: number) => {
    // Clear any existing timeout
    if (regenerationTimeoutRef.current) {
      clearTimeout(regenerationTimeoutRef.current);
    }
    
    // Set a new timeout for regeneration
    regenerationTimeoutRef.current = setTimeout(async () => {
      if (!currentUser?.uid || currentGame?.gameState?.phase !== 1 || isRegeneratingTickets || isProcessing) {
        return;
      }
      
      console.log('🎫 Debounced ticket regeneration triggered:', {
        maxTickets: newMaxTickets,
        selectedTicketSet: newSelectedTicketSet,
        previousMaxTickets: previousSettings.current.maxTickets,
        previousSelectedTicketSet: previousSettings.current.selectedTicketSet
      });
      
      try {
        setIsRegeneratingTickets(true);
        
        console.log(`🎫 Regenerating tickets: ${newMaxTickets} tickets from set ${newSelectedTicketSet}`);
        
        // Send regenerate tickets command
        const commandId = regenerateTickets(newSelectedTicketSet, newMaxTickets);
        console.log(`📤 Regenerate tickets command sent: ${commandId}`);
        
        // Update previous values
        previousSettings.current = {
          maxTickets: newMaxTickets,
          selectedTicketSet: newSelectedTicketSet
        };
        
        // Show feedback to user
        setToastMessage(`Updating to ${newMaxTickets} tickets from set ${newSelectedTicketSet}...`);
        setToastType('info');
        setShowToast(true);
        
      } catch (error) {
        console.error('❌ Error regenerating tickets:', error);
        setToastMessage('Failed to update ticket structure. Please try again.');
        setToastType('error');
        setShowToast(true);
      } finally {
        setIsRegeneratingTickets(false);
      }
    }, 1000); // 1 second debounce
  }, [currentUser?.uid, currentGame?.gameState?.phase, isRegeneratingTickets, isProcessing, regenerateTickets]);

  // FIXED: More intelligent ticket regeneration logic
  useEffect(() => {
    // Only check for changes after initialization and when not loading
    if (!hasInitialized.current || isLoadingDefaults || currentGame?.gameState?.phase !== 1) {
      return;
    }
    
    // Check if ticket-related settings have actually changed
    const maxTicketsChanged = settings.maxTickets !== previousSettings.current.maxTickets;
    const ticketSetChanged = settings.selectedTicketSet !== previousSettings.current.selectedTicketSet;
    
    if (maxTicketsChanged || ticketSetChanged) {
      console.log('🎫 Ticket settings changed, scheduling regeneration:', {
        maxTicketsChanged: maxTicketsChanged ? `${previousSettings.current.maxTickets} → ${settings.maxTickets}` : 'no change',
        ticketSetChanged: ticketSetChanged ? `${previousSettings.current.selectedTicketSet} → ${settings.selectedTicketSet}` : 'no change'
      });
      
      // Use debounced regeneration to prevent rapid fire
      debouncedRegenerateTickets(settings.maxTickets, settings.selectedTicketSet);
    }
  }, [settings.maxTickets, settings.selectedTicketSet, hasInitialized.current, isLoadingDefaults, currentGame?.gameState?.phase, debouncedRegenerateTickets]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (regenerationTimeoutRef.current) {
        clearTimeout(regenerationTimeoutRef.current);
      }
    };
  }, []);

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

  // Save both current game settings AND default settings
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
      
      // Save current game settings
      const commandId = updateGameSettings(settings);
      console.log(`📤 Update settings command sent: ${commandId}`);
      
      // ALSO save as default settings for future games
      try {
        const dbService = GameDatabaseService.getInstance();
        await dbService.saveDefaultSettings(currentUser.uid, settings);
        console.log('💾 Default settings saved for future games');
      } catch (defaultError) {
        console.warn('⚠️ Failed to save default settings (non-critical):', defaultError);
      }
      
      setToastMessage('Settings saved and will be remembered for future games');
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
      
      // First, save current settings as defaults for future games
      try {
        const dbService = GameDatabaseService.getInstance();
        await dbService.saveDefaultSettings(currentUser.uid, settings);
        console.log('💾 Settings saved as defaults for future games');
      } catch (defaultError) {
        console.warn('⚠️ Failed to save default settings (non-critical):', defaultError);
      }
      
      console.log('Loading ticket data...');
      const ticketData = await loadTicketData(
        settings.selectedTicketSet,
        settings.maxTickets
      );
      
      if (!validateTicketData(ticketData)) {
        throw new Error('Invalid ticket data structure. Please check the ticket data files.');
      }
      
      console.log(`Ticket data loaded successfully. Creating ${settings.maxTickets} tickets...`);
      
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
      
      const commandId = startBookingPhase(settings, tickets);
      console.log(`📤 Start booking phase command sent: ${commandId}`);
      
      setToastMessage('Moving to booking phase with current settings');
      setToastType('success');
      setShowToast(true);
      
    } catch (error) {
      console.error('❌ Error starting booking phase:', error);
      setToastMessage(`Failed to start booking phase: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setToastType('error');
      setShowToast(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading state while loading defaults
  if (isLoadingDefaults) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <LoadingSpinner size="large" />
          <p className="mt-4 text-gray-600">Loading your saved settings...</p>
          <p className="mt-2 text-sm text-gray-500">
            Restoring prize selections and game preferences
          </p>
        </div>
      </div>
    );
  }

  // Function to get settings source description
  const getSettingsSourceInfo = () => {
    switch (settingsLoadedFrom) {
      case 'database':
        return {
          icon: <CheckCircle className="w-4 h-4 text-green-600" />,
          text: 'Settings loaded from previous games',
          color: 'text-green-600'
        };
      case 'game':
        return {
          icon: <RefreshCw className="w-4 h-4 text-blue-600" />,
          text: 'Using current game settings',
          color: 'text-blue-600'
        };
      default:
        return {
          icon: <AlertTriangle className="w-4 h-4 text-yellow-600" />,
          text: 'Using default settings',
          color: 'text-yellow-600'
        };
    }
  };

  const sourceInfo = getSettingsSourceInfo();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex justify-between items-center border-b pb-4 mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Game Setup</h2>
            <p className="text-gray-600 mt-1">Configure game settings before starting</p>
            
            {/* Settings source indicator */}
            <div className="flex items-center mt-2 text-sm">
              {sourceInfo.icon}
              <span className={`ml-2 ${sourceInfo.color}`}>
                {sourceInfo.text}
              </span>
            </div>
            
            {/* FIXED: Better ticket regeneration indicator */}
            {isRegeneratingTickets && (
              <div className="flex items-center mt-2 text-sm text-blue-600">
                <Loader className="w-4 h-4 animate-spin mr-2" />
                <span>Updating ticket structure to {settings.maxTickets} tickets...</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-3">
            {hasMadeChanges && (
              <span className="text-sm text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
                Unsaved changes
              </span>
            )}
            {(isProcessing || isRegeneratingTickets) && (
              <span className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded flex items-center">
                <div className="animate-spin h-3 w-3 border border-blue-600 border-t-transparent rounded-full mr-1" />
                {isRegeneratingTickets ? 'Updating tickets...' : 'Processing...'}
              </span>
            )}
            <button
              onClick={saveSettings}
              disabled={isSubmitting || !hasMadeChanges || isProcessing || isRegeneratingTickets}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center
                ${isSubmitting || !hasMadeChanges || isProcessing || isRegeneratingTickets
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
            >
              <Save className="w-4 h-4 mr-1" />
              {isSubmitting ? 'Saving...' : 'Save & Remember Settings'}
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
        
        {/* FIXED: Show current ticket configuration */}
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <CheckCircle className="h-5 w-5 text-blue-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                Current Ticket Configuration
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>
                  <strong>{settings.maxTickets} tickets</strong> from <strong>Set {settings.selectedTicketSet}</strong>
                </p>
                <p className="mt-1">
                  {isRegeneratingTickets 
                    ? "Tickets are being updated and will be ready for booking phase."
                    : "These settings will be applied when you proceed to booking phase."
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="space-y-6">
          <TicketSetSelector
            selectedSet={settings.selectedTicketSet}
            maxTickets={settings.maxTickets}
            onUpdate={handleSettingsUpdate}
          />
          
          <div className="bg-white rounded-lg p-4 sm:p-6 shadow-sm border">
            <h3 className="text-base sm:text-lg font-medium text-gray-900">Host Contact</h3>
            
            <div className="mt-3 sm:mt-4">
              <label 
                htmlFor="hostPhone" 
                className="block text-sm font-medium text-gray-700"
              >
                Host Phone Number
                {settings.hostPhone && settings.hostPhone !== '+91' && settingsLoadedFrom === 'database' && (
                  <span className="text-green-600 text-xs ml-2">(preserved from previous game)</span>
                )}
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
              <p className="mt-1 text-xs text-gray-500">
                This will be saved and automatically filled for future games
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
            disabled={isSubmitting || validationErrors.length > 0 || isProcessing || isRegeneratingTickets}
            className={`w-full sm:w-auto px-4 sm:px-6 py-4 sm:py-3 rounded-lg text-white font-medium flex items-center justify-center
              ${isSubmitting || validationErrors.length > 0 || isProcessing || isRegeneratingTickets
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
              }`}
          >
            {isSubmitting || isProcessing || isRegeneratingTickets ? (
              <span className="flex items-center">
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                {isSubmitting ? 'Setting up...' : isRegeneratingTickets ? 'Updating tickets...' : 'Processing...'}
              </span>
            ) : (
              <>
                Continue to Booking Phase ({settings.maxTickets} tickets)
                <ChevronRight className="w-5 h-5 ml-2" />
              </>
            )}
          </button>
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
