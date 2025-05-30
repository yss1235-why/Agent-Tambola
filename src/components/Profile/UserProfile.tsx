// src/components/Profile/UserProfile.tsx - Updated
import React, { useState, useEffect } from 'react';
import { updateEmail, updatePassword, reauthenticateWithCredential, 
  EmailAuthProvider } from 'firebase/auth';
import { useAuth } from '@contexts';
import { LoadingSpinner } from '@components';
import { handleApiError } from '@utils/errorHandler';
import { FirebaseUtils } from '../../utils/firebaseUtils';

interface ProfileData {
  username: string;
  organization: string;
  contactNumber: string;
  address: string;
  subscriptionDetails: {
    plan: string;
    startDate: number;
    endDate: number;
    status: 'active' | 'expired' | 'pending';
    features: string[];
  };
}

export const UserProfile: React.FC = () => {
  const { currentUser } = useAuth();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [editData, setEditData] = useState<Partial<ProfileData>>({});
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const firebaseUtils = FirebaseUtils.getInstance();

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    if (!currentUser?.uid) return;

    try {
      const result = await firebaseUtils.readData<any>(currentUser.uid, 'profile');
      
      if (result.success && result.data) {
        setProfileData(result.data);
        setEditData(result.data);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      setError('Failed to load profile data');
    }
  };

  const handleProfileUpdate = async () => {
    if (!currentUser?.uid || !editData) return;

    setIsUpdating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const updatedProfile = {
        ...profileData,
        ...editData,
        lastUpdated: Date.now()
      };

      const result = await firebaseUtils.updateData(currentUser.uid, {
        profile: updatedProfile
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to update profile');
      }

      setProfileData(updatedProfile as ProfileData);
      setIsEditing(false);
      setSuccessMessage('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      setError(handleApiError(error, 'Failed to update profile'));
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePasswordChange = async (
    currentPassword: string,
    newPassword: string
  ) => {
    if (!currentUser) return;

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
      setError(handleApiError(error, 'Failed to change password. Please verify your current password.'));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleEmailChange = async (newEmail: string, password: string) => {
    if (!currentUser) return;

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
      setError(handleApiError(error, 'Failed to change email. Please verify your password.'));
    } finally {
      setIsUpdating(false);
    }
  };

  if (!profileData) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  const daysRemaining = Math.ceil(
    (profileData.subscriptionDetails.endDate - Date.now()) / (1000 * 60 * 60 * 24)
  );

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
              />
            </div>
          </div>

          {isEditing && (
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditData(profileData);
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
              {daysRemaining} days
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
            onClick={() => window.location.href = '/subscription/renew'}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-md
              hover:bg-green-700 focus:outline-none focus:ring-2
              focus:ring-green-500 focus:ring-offset-2"
          >
            Renew Subscription
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
