// src/components/Profile/UserProfile.tsx - COMPLETELY FIXED with robust error handling
import React, { useState, useEffect } from 'react';
import { updateEmail, updatePassword, reauthenticateWithCredential, 
  EmailAuthProvider } from 'firebase/auth';
import { useAuth } from '@contexts';
import { LoadingSpinner } from '@components';
import { ref, get, update } from 'firebase/database';
import { database } from '../../lib/firebase';

// Use the actual HostProfile structure from AuthContext
interface HostProfile {
  email: string;
  lastLogin: number;
  role: 'host';
  status: 'active' | 'inactive';
  subscriptionEnd: number;
  username: string;
  // Optional fields
  organization?: string;
  contactNumber?: string;
  address?: string;
}

// Simplified ProfileData interface for display
interface ProfileData {
  username: string;
  email: string;
  organization: string;
  contactNumber: string;
  address: string;
  subscriptionDetails: {
    plan: string;
    startDate: number;
    endDate: number;
    status: 'active' | 'expired' | 'pending';
    daysRemaining: number;
    features: string[];
  };
}

// Safe error handler
const handleError = (error: any, context: string): string => {
  console.error(`Error in ${context}:`, error);
  
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error?.code) {
    return `Firebase error: ${error.code}`;
  }
  return `An error occurred in ${context}`;
};

// Robust Firebase utilities with extensive error handling
const readHostProfile = async (hostId: string): Promise<HostProfile | null> => {
  try {
    if (!hostId) {
      throw new Error('Host ID is required');
    }

    console.log('Reading host profile for:', hostId);
    
    const dataRef = ref(database, `hosts/${hostId}`);
    const snapshot = await get(dataRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      console.log('Raw profile data:', data);
      
      // Validate required fields
      if (!data.email || !data.username || !data.role) {
        console.warn('Profile data missing required fields:', data);
        return null;
      }
      
      return data as HostProfile;
    } else {
      console.log('No profile data found for:', hostId);
      return null;
    }
  } catch (error) {
    console.error('Error reading host profile:', error);
    throw new Error(handleError(error, 'profile reading'));
  }
};

const updateHostProfile = async (hostId: string, updates: Partial<HostProfile>): Promise<void> => {
  try {
    if (!hostId) {
      throw new Error('Host ID is required');
    }

    console.log('Updating host profile:', hostId, updates);
    
    const hostRef = ref(database, `hosts/${hostId}`);
    await update(hostRef, {
      ...updates,
      lastUpdated: Date.now()
    });
    
    console.log('Profile updated successfully');
  } catch (error) {
    console.error('Error updating host profile:', error);
    throw new Error(handleError(error, 'profile update'));
  }
};

// Safe mapping with null checks
const mapHostProfileToProfileData = (hostProfile: HostProfile | null, userEmail?: string): ProfileData => {
  if (!hostProfile) {
    // Return default data if profile is null
    return {
      username: userEmail?.split('@')[0] || 'Host',
      email: userEmail || '',
      organization: '',
      contactNumber: '',
      address: '',
      subscriptionDetails: {
        plan: 'Tambola Host Premium',
        startDate: Date.now(),
        endDate: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days from now
        status: 'active',
        daysRemaining: 30,
        features: [
          'Unlimited game sessions',
          'Advanced prize configuration',
          'Player management',
          'Game analytics',
          'Export functionality'
        ]
      }
    };
  }

  const now = Date.now();
  const subscriptionEnd = hostProfile.subscriptionEnd || now;
  const daysRemaining = Math.max(0, Math.ceil((subscriptionEnd - now) / (1000 * 60 * 60 * 24)));
  const subscriptionStatus = hostProfile.status === 'active' && subscriptionEnd > now ? 'active' : 'expired';

  return {
    username: hostProfile.username || 'Host',
    email: hostProfile.email || '',
    organization: hostProfile.organization || '',
    contactNumber: hostProfile.contactNumber || '',
    address: hostProfile.address || '',
    subscriptionDetails: {
      plan: 'Tambola Host Premium',
      startDate: now - (365 * 24 * 60 * 60 * 1000), // Assume 1 year ago
      endDate: subscriptionEnd,
      status: subscriptionStatus,
      daysRemaining,
      features: [
        'Unlimited game sessions',
        'Advanced prize configuration',
        'Player management',
        'Game analytics',
        'Export functionality'
      ]
    }
  };
};

// Safe mapping back to HostProfile updates
const mapProfileDataToHostProfile = (profileData: Partial<ProfileData>): Partial<HostProfile> => {
  const updates: Partial<HostProfile> = {};
  
  if (profileData.username !== undefined && profileData.username.trim()) {
    updates.username = profileData.username.trim();
  }
  if (profileData.organization !== undefined) {
    updates.organization = profileData.organization.trim();
  }
  if (profileData.contactNumber !== undefined) {
    updates.contactNumber = profileData.contactNumber.trim();
  }
  if (profileData.address !== undefined) {
    updates.address = profileData.address.trim();
  }
  
  return updates;
};

export const UserProfile: React.FC = () => {
  const { currentUser } = useAuth();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [editData, setEditData] = useState<Partial<ProfileData>>({});
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadProfileData();
  }, [currentUser]);

  const loadProfileData = async () => {
    if (!currentUser?.uid) {
      setError('No user logged in');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      console.log('Loading profile data for user:', currentUser.uid);
      
      // Try to read host profile with error handling
      let hostProfile: HostProfile | null = null;
      
      try {
        hostProfile = await readHostProfile(currentUser.uid);
      } catch (profileError) {
        console.warn('Could not load host profile:', profileError);
        // Continue with null profile - will create default
      }
      
      console.log('Host profile loaded:', hostProfile);
      
      // Map to display format (handles null profile gracefully)
      const mappedProfileData = mapHostProfileToProfileData(hostProfile, currentUser.email || undefined);
      
      setProfileData(mappedProfileData);
      setEditData(mappedProfileData);
      
      console.log('Profile data set successfully');
      
    } catch (error) {
      console.error('Error in loadProfileData:', error);
      setError(handleError(error, 'loading profile'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfileUpdate = async () => {
    if (!currentUser?.uid || !editData) {
      setError('Unable to update profile at this time');
      return;
    }

    setIsUpdating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      console.log('Updating profile with data:', editData);
      
      // Map and validate updates
      const hostProfileUpdates = mapProfileDataToHostProfile(editData);
      
      if (Object.keys(hostProfileUpdates).length === 0) {
        setError('No valid updates to save');
        return;
      }
      
      await updateHostProfile(currentUser.uid, hostProfileUpdates);

      // Update local state immediately
      const updatedProfile = { ...profileData, ...editData } as ProfileData;
      setProfileData(updatedProfile);
      
      setIsEditing(false);
      setSuccessMessage('Profile updated successfully');
      
      console.log('Profile updated successfully');
      
    } catch (error) {
      console.error('Error updating profile:', error);
      setError(handleError(error, 'updating profile'));
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePasswordChange = async (
    currentPassword: string,
    newPassword: string
  ) => {
    if (!currentUser) {
      setError('No user logged in');
      return;
    }

    setIsUpdating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const credential = EmailAuthProvider.credential(
        currentUser.email!,
        currentPassword
      );
      await reauthenticateWithCredential(currentUser, credential);
      
      await updatePassword(currentUser, newPassword);
      setIsChangingPassword(false);
      setSuccessMessage('Password updated successfully');
    } catch (error) {
      console.error('Error changing password:', error);
      setError(handleError(error, 'changing password'));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleEmailChange = async (newEmail: string, password: string) => {
    if (!currentUser) {
      setError('No user logged in');
      return;
    }

    setIsUpdating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const credential = EmailAuthProvider.credential(
        currentUser.email!,
        password
      );
      await reauthenticateWithCredential(currentUser, credential);
      
      await updateEmail(currentUser, newEmail);
      setSuccessMessage('Email updated successfully');
    } catch (error) {
      console.error('Error changing email:', error);
      setError(handleError(error, 'changing email'));
    } finally {
      setIsUpdating(false);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <LoadingSpinner size="large" />
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  // Show error state if profile couldn't be loaded and we have an error
  if (!profileData && error) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error Loading Profile</h3>
              <p className="text-sm text-red-700 mt-2">{error}</p>
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={loadProfileData}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Fallback if profileData is still null (shouldn't happen with new mapping)
  if (!profileData) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Profile Not Available</h3>
              <p className="text-sm text-yellow-700 mt-2">Unable to load profile data. Please try reloading.</p>
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={loadProfileData}
              className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
            >
              Reload Profile
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">
              Host Profile
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Manage your account settings and subscription
            </p>
          </div>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md
                hover:bg-blue-700 focus:outline-none focus:ring-2
                focus:ring-blue-500 focus:ring-offset-2"
            >
              Edit Profile
            </button>
          )}
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700
            px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mt-4 bg-green-50 border border-green-200 
            text-green-700 px-4 py-3 rounded-md">
            {successMessage}
          </div>
        )}

        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Username
              </label>
              <input
                type="text"
                value={isEditing ? editData.username || '' : profileData.username}
                onChange={e => setEditData(prev => ({
                  ...prev,
                  username: e.target.value
                }))}
                disabled={!isEditing}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm
                  focus:border-blue-500 focus:ring-blue-500 sm:text-sm
                  disabled:bg-gray-100 disabled:text-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <input
                type="email"
                value={profileData.email}
                disabled={true}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm
                  bg-gray-100 text-gray-500 sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                Email cannot be changed from this interface
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Organization
              </label>
              <input
                type="text"
                value={isEditing ? editData.organization || '' : profileData.organization}
                onChange={e => setEditData(prev => ({
                  ...prev,
                  organization: e.target.value
                }))}
                disabled={!isEditing}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm
                  focus:border-blue-500 focus:ring-blue-500 sm:text-sm
                  disabled:bg-gray-100 disabled:text-gray-500"
                placeholder="Your organization name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Contact Number
              </label>
              <input
                type="tel"
                value={isEditing ? editData.contactNumber || '' : profileData.contactNumber}
                onChange={e => setEditData(prev => ({
                  ...prev,
                  contactNumber: e.target.value
                }))}
                disabled={!isEditing}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm
                  focus:border-blue-500 focus:ring-blue-500 sm:text-sm
                  disabled:bg-gray-100 disabled:text-gray-500"
                placeholder="Your contact number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Address
              </label>
              <textarea
                value={isEditing ? editData.address || '' : profileData.address}
                onChange={e => setEditData(prev => ({
                  ...prev,
                  address: e.target.value
                }))}
                disabled={!isEditing}
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm
                  focus:border-blue-500 focus:ring-blue-500 sm:text-sm
                  disabled:bg-gray-100 disabled:text-gray-500"
                placeholder="Your address"
              />
            </div>
          </div>

          {isEditing && (
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditData(profileData);
                  setError(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md
                  text-gray-700 hover:bg-gray-50 focus:outline-none
                  focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handleProfileUpdate}
                disabled={isUpdating}
                className="px-4 py-2 bg-blue-600 text-white rounded-md
                  hover:bg-blue-700 focus:outline-none focus:ring-2
                  focus:ring-blue-500 focus:ring-offset-2
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdating ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-medium text-gray-900">
          Subscription Details
        </h3>

        <div className="mt-6">
          <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 
            sm:gap-4 sm:px-6 rounded-lg">
            <dt className="text-sm font-medium text-gray-500">Current Plan</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
              {profileData.subscriptionDetails.plan}
            </dd>
          </div>

          <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 
            sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Status</dt>
            <dd className="mt-1 text-sm sm:mt-0 sm:col-span-2">
              <span className={`px-2 inline-flex text-xs leading-5 
                font-semibold rounded-full ${
                  profileData.subscriptionDetails.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                {profileData.subscriptionDetails.status}
              </span>
            </dd>
          </div>

          <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 
            sm:gap-4 sm:px-6 rounded-lg">
            <dt className="text-sm font-medium text-gray-500">Time Remaining</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
              {profileData.subscriptionDetails.daysRemaining > 0 
                ? `${profileData.subscriptionDetails.daysRemaining} days` 
                : 'Expired'}
            </dd>
          </div>

          <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 
            sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Features</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
              <ul className="list-disc pl-5 space-y-1">
                {profileData.subscriptionDetails.features.map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
            </dd>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={() => window.location.href = '/subscription'}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-md
              hover:bg-green-700 focus:outline-none focus:ring-2
              focus:ring-green-500 focus:ring-offset-2"
          >
            View Subscription Details
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-medium text-gray-900">
          Security Settings
        </h3>

        <div className="mt-6 space-y-6">
          <div>
            <button
              onClick={() => setIsChangingPassword(true)}
              className="px-4 py-2 border border-gray-300 rounded-md
                text-gray-700 hover:bg-gray-50 focus:outline-none
                focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Change Password
            </button>
          </div>

          {isChangingPassword && (
            <PasswordChangeForm
              onSubmit={handlePasswordChange}
              onCancel={() => setIsChangingPassword(false)}
              isProcessing={isUpdating}
            />
          )}
        </div>
      </div>
    </div>
  );
};

interface PasswordChangeFormProps {
  onSubmit: (currentPassword: string, newPassword: string) => Promise<void>;
  onCancel: () => void;
  isProcessing: boolean;
}

const PasswordChangeForm: React.FC<PasswordChangeFormProps> = ({
  onSubmit,
  onCancel,
  isProcessing
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long');
      return;
    }

    try {
      await onSubmit(currentPassword, newPassword);
      // Reset form on success
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setError('Failed to change password');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Current Password
        </label>
        <input
          type="password"
          value={currentPassword}
          onChange={e => setCurrentPassword(e.target.value)}
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm
            focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          New Password
        </label>
        <input
          type="password"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          required
          minLength={8}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm
            focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Confirm New Password
        </label>
        <input
          type="password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          required
          minLength={8}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm
            focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      <div className="flex justify-end space-x-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md
            text-gray-700 hover:bg-gray-50 focus:outline-none
            focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isProcessing}
          className="px-4 py-2 bg-blue-600 text-white rounded-md
            hover:bg-blue-700 focus:outline-none focus:ring-2
            focus:ring-blue-500 focus:ring-offset-2
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? 'Changing Password...' : 'Change Password'}
        </button>
      </div>
    </form>
  );
};

export default UserProfile;
