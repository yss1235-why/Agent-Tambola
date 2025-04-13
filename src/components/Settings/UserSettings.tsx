// src/components/Settings/UserSettings.tsx

import React, { useState, useEffect } from 'react';
import { ref, get, set } from 'firebase/database';
import { database } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { AudioManager } from '../../utils/audioManager';

interface UserPreferences {
  audio: {
    volume: number;
    useCustomAudio: boolean;
    numberCallDelay: number;
    announceWinners: boolean;
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
  notifications: {
    enableSound: boolean;
    enableDesktop: boolean;
    winClaimAlert: boolean;
  };
}

export const UserSettings: React.FC = () => {
  const { currentUser } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences>({
    audio: {
      volume: 1,
      useCustomAudio: true,
      numberCallDelay: 5,
      announceWinners: true
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
    },
    notifications: {
      enableSound: true,
      enableDesktop: true,
      winClaimAlert: true
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
      const prefsRef = ref(database, `hosts/${currentUser.uid}/preferences`);
      const snapshot = await get(prefsRef);
      
      if (snapshot.exists()) {
        setPreferences(snapshot.val());
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
      const prefsRef = ref(database, `hosts/${currentUser.uid}/preferences`);
      await set(prefsRef, preferences);
      
      // Update audio manager settings
      const audioManager = AudioManager.getInstance();
      audioManager.updateSettings({
        volume: preferences.audio.volume,
        useCustomAudio: preferences.audio.useCustomAudio,
        callDelay: preferences.audio.numberCallDelay * 1000
      });

      setMessage({
        text: 'Settings saved successfully',
        type: 'success'
      });
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
        {/* Audio Settings */}
        <section>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Audio Settings
          </h3>
          <div className="space-y-4">
            <div>
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
                  className="w-64"
                />
              </label>
            </div>

            <div>
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
                  className="rounded border-gray-300 text-blue-600 
                    focus:ring-blue-500"
                />
                <span className="ml-2 text-gray-700">
                  Use custom audio for number calls
                </span>
              </label>
            </div>

            <div>
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
                  className="w-20 rounded-md border-gray-300 shadow-sm
                    focus:border-blue-500 focus:ring-blue-500"
                />
              </label>
            </div>
          </div>
        </section>

        {/* Game Defaults */}
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
          </div>
        </section>

        {/* Interface Settings */}
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
            </div>
          </div>
        </section>

        {/* Notification Settings */}
        <section>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Notification Settings
          </h3>
          <div className="space-y-4">
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.notifications.enableDesktop}
                  onChange={e => setPreferences(prev => ({
                    ...prev,
                    notifications: {
                      ...prev.notifications,
                      enableDesktop: e.target.checked
                    }
                  }))}
                  className="rounded border-gray-300 text-blue-600 
                    focus:ring-blue-500"
                />
                <span className="ml-2 text-gray-700">
                  Enable desktop notifications
                </span>
              </label>
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.notifications.winClaimAlert}
                  onChange={e => setPreferences(prev => ({
                    ...prev,
                    notifications: {
                      ...prev.notifications,
                      winClaimAlert: e.target.checked
                    }
                  }))}
                  className="rounded border-gray-300 text-blue-600 
                    focus:ring-blue-500"
                />
                <span className="ml-2 text-gray-700">
                  Alert on win claims
                </span>
              </label>
            </div>
          </div>
        </section>

        {/* Save Button */}
        <div className="pt-6 border-t border-gray-200">
          {message && (
            <div className={`mb-4 p-4 rounded-md ${
              message.type === 'success' 
                ? 'bg-green-50 text-green-800' 
                : 'bg-red-50 text-red-800'
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
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserSettings;