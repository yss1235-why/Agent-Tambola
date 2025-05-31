// src/components/Settings/UserSettings.tsx - FIXED TypeScript compilation errors
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { AudioManager } from '../../utils/audioManager';
import { ref, get, update } from 'firebase/database';
import { database } from '../../lib/firebase';

interface UserPreferences {
  audio: {
    volume: number;
    useCustomAudio: boolean;
    numberCallDelay: number;
    announceWinners: boolean;
    enabled: boolean;
  };
  gameDefaults: {
    defaultTicketSet: number;
    maxTicketsPerPlayer: number;
    autoStartNumberCalling: boolean;
  };
  interface: {
    darkMode: boolean;
    compactView: boolean;
    showAnimations: boolean;
  };
}

// FIXED: Simple Firebase utilities with proper generic syntax
type ReadDataResult<T> = { success: boolean; data?: T; error?: string };

const readData = async function<T>(hostId: string, path: string): Promise<ReadDataResult<T>> {
  try {
    const dataRef = ref(database, `hosts/${hostId}/${path}`);
    const snapshot = await get(dataRef);
    
    if (snapshot.exists()) {
      return { success: true, data: snapshot.val() as T };
    } else {
      return { success: false, error: 'Data not found' };
    }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to read data' 
    };
  }
};

const setData = async (hostId: string, path: string, data: any): Promise<{ success: boolean; error?: string }> => {
  try {
    const dataRef = ref(database, `hosts/${hostId}/${path}`);
    await update(dataRef, data);
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to set data' 
    };
  }
};

export const UserSettings: React.FC = () => {
  const { currentUser } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences>({
    audio: {
      volume: 1,
      useCustomAudio: true,
      numberCallDelay: 5,
      announceWinners: true,
      enabled: true
    },
    gameDefaults: {
      defaultTicketSet: 1,
      maxTicketsPerPlayer: 6,
      autoStartNumberCalling: false
    },
    interface: {
      darkMode: false,
      compactView: false,
      showAnimations: true
    }
  });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    if (!currentUser) return;

    try {
      const result = await readData<UserPreferences>(
        currentUser.uid, 
        'preferences'
      );
      
      if (result.success && result.data) {
        setPreferences(result.data);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
      setMessage({
        text: 'Failed to load preferences',
        type: 'error'
      });
    }
  };

  const savePreferences = async () => {
    if (!currentUser) return;

    setIsSaving(true);
    try {
      const result = await setData(
        currentUser.uid, 
        'preferences', 
        preferences
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to save preferences');
      }
      
      const audioManager = AudioManager.getInstance();
      audioManager.updateSettings({
        volume: preferences.audio.volume,
        useCustomAudio: preferences.audio.useCustomAudio,
        enabled: preferences.audio.enabled
      });

      setMessage({
        text: 'Settings saved successfully',
        type: 'success'
      });
      
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving preferences:', error);
      setMessage({
        text: 'Failed to save settings',
        type: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-2xl font-semibold text-gray-800">User Settings</h2>
        <p className="mt-1 text-gray-600">
          Configure your game preferences and system settings
        </p>
      </div>

      <div className="p-6 space-y-8">
        <section>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Audio Settings
          </h3>
          <div className="space-y-4">
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.audio.enabled}
                  onChange={e => setPreferences(prev => ({
                    ...prev,
                    audio: {
                      ...prev.audio,
                      enabled: e.target.checked
                    }
                  }))}
                  className="rounded border-gray-300 text-blue-600 
                    focus:ring-blue-500"
                />
                <span className="ml-2 text-gray-700">
                  Enable audio announcements
                </span>
              </label>
            </div>

            <div className={preferences.audio.enabled ? '' : 'opacity-50'}>
              <label className="flex items-center justify-between">
                <span className="text-gray-700">Volume</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={preferences.audio.volume}
                  onChange={e => setPreferences(prev => ({
                    ...prev,
                    audio: {
                      ...prev.audio,
                      volume: parseFloat(e.target.value)
                    }
                  }))}
                  disabled={!preferences.audio.enabled}
                  className="w-64"
                />
              </label>
              <div className="text-right text-sm text-gray-500 mt-1">
                {Math.round(preferences.audio.volume * 100)}%
              </div>
            </div>

            <div className={preferences.audio.enabled ? '' : 'opacity-50'}>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.audio.useCustomAudio}
                  onChange={e => setPreferences(prev => ({
                    ...prev,
                    audio: {
                      ...prev.audio,
                      useCustomAudio: e.target.checked
                    }
                  }))}
                  disabled={!preferences.audio.enabled}
                  className="rounded border-gray-300 text-blue-600 
                    focus:ring-blue-500"
                />
                <span className="ml-2 text-gray-700">
                  Use custom phrases for number calls
                </span>
              </label>
              <p className="ml-6 text-sm text-gray-500">
                e.g., "22. Two Little Ducks" instead of just "22"
              </p>
            </div>

            <div className={preferences.audio.enabled ? '' : 'opacity-50'}>
              <label className="flex items-center justify-between">
                <span className="text-gray-700">Number call delay (seconds)</span>
                <input
                  type="number"
                  min="3"
                  max="10"
                  value={preferences.audio.numberCallDelay}
                  onChange={e => setPreferences(prev => ({
                    ...prev,
                    audio: {
                      ...prev.audio,
                      numberCallDelay: parseInt(e.target.value)
                    }
                  }))}
                  disabled={!preferences.audio.enabled}
                  className="w-20 rounded-md border-gray-300 shadow-sm
                    focus:border-blue-500 focus:ring-blue-500"
                />
              </label>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Game Defaults
          </h3>
          <div className="space-y-4">
            <div>
              <label className="flex items-center justify-between">
                <span className="text-gray-700">Default ticket set</span>
                <select
                  value={preferences.gameDefaults.defaultTicketSet}
                  onChange={e => setPreferences(prev => ({
                    ...prev,
                    gameDefaults: {
                      ...prev.gameDefaults,
                      defaultTicketSet: parseInt(e.target.value)
                    }
                  }))}
                  className="rounded-md border-gray-300 shadow-sm
                    focus:border-blue-500 focus:ring-blue-500"
                >
                  {[1, 2, 3, 4].map(num => (
                    <option key={num} value={num}>Set {num}</option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <label className="flex items-center justify-between">
                <span className="text-gray-700">Max tickets per player</span>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={preferences.gameDefaults.maxTicketsPerPlayer}
                  onChange={e => setPreferences(prev => ({
                    ...prev,
                    gameDefaults: {
                      ...prev.gameDefaults,
                      maxTicketsPerPlayer: parseInt(e.target.value)
                    }
                  }))}
                  className="w-20 rounded-md border-gray-300 shadow-sm
                    focus:border-blue-500 focus:ring-blue-500"
                />
              </label>
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.gameDefaults.autoStartNumberCalling}
                  onChange={e => setPreferences(prev => ({
                    ...prev,
                    gameDefaults: {
                      ...prev.gameDefaults,
                      autoStartNumberCalling: e.target.checked
                    }
                  }))}
                  className="rounded border-gray-300 text-blue-600 
                    focus:ring-blue-500"
                />
                <span className="ml-2 text-gray-700">
                  Auto-start number calling when game begins
                </span>
              </label>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Interface Settings
          </h3>
          <div className="space-y-4">
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.interface.darkMode}
                  onChange={e => setPreferences(prev => ({
                    ...prev,
                    interface: {
                      ...prev.interface,
                      darkMode: e.target.checked
                    }
                  }))}
                  className="rounded border-gray-300 text-blue-600 
                    focus:ring-blue-500"
                />
                <span className="ml-2 text-gray-700">Enable dark mode</span>
              </label>
              <p className="ml-6 text-sm text-gray-500">
                Dark mode is coming soon
              </p>
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.interface.compactView}
                  onChange={e => setPreferences(prev => ({
                    ...prev,
                    interface: {
                      ...prev.interface,
                      compactView: e.target.checked
                    }
                  }))}
                  className="rounded border-gray-300 text-blue-600 
                    focus:ring-blue-500"
                />
                <span className="ml-2 text-gray-700">Use compact view</span>
              </label>
              <p className="ml-6 text-sm text-gray-500">
                Show more information in less space
              </p>
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.interface.showAnimations}
                  onChange={e => setPreferences(prev => ({
                    ...prev,
                    interface: {
                      ...prev.interface,
                      showAnimations: e.target.checked
                    }
                  }))}
                  className="rounded border-gray-300 text-blue-600 
                    focus:ring-blue-500"
                />
                <span className="ml-2 text-gray-700">Show animations</span>
              </label>
              <p className="ml-6 text-sm text-gray-500">
                Enable smooth transitions and animations
              </p>
            </div>
          </div>
        </section>

        <div className="pt-6 border-t border-gray-200">
          {message && (
            <div className={`mb-4 p-4 rounded-md ${
              message.type === 'success' 
                ? 'bg-green-50 text-green-800 border border-green-200' 
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {message.text}
            </div>
          )}

          <button
            onClick={savePreferences}
            disabled={isSaving}
            className={`
              w-full px-4 py-2 border border-transparent rounded-md shadow-sm
              text-sm font-medium text-white
              ${isSaving
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              }
            `}
          >
            {isSaving ? 'Saving Settings...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserSettings;
