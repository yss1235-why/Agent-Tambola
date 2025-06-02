// src/contexts/AuthContext.tsx - FIXED: Proper profile structure and error handling
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  User, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  Auth, 
  getAuth,
  onAuthStateChanged
} from 'firebase/auth';
import { ref, get, update } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import { LoadingSpinner } from '@components';
import { app, database } from '@lib/firebase';

// FIXED: Proper HostProfile interface with optional fields
interface HostProfile {
  email: string;
  lastLogin: number;
  role: 'host';
  status: 'active' | 'inactive';
  subscriptionEnd: number;
  username: string;
  // Optional profile fields
  organization?: string;
  contactNumber?: string;
  address?: string;
  createdAt?: number;
  updatedAt?: number;
}

interface AuthState {
  currentUser: User | null;
  isSubscriptionValid: boolean;
  userProfile: HostProfile | null;
  isLoading: boolean;
  error: string | null;
}

interface AuthContextType extends AuthState {
  signInHost: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
  updateProfile: (updates: Partial<HostProfile>) => Promise<void>;
  checkSubscriptionValidity: () => boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const auth: Auth = getAuth(app);

interface AuthProviderProps {
  children: ReactNode;
}

// FIXED: Robust data reading with proper error handling
const readHostProfile = async (hostId: string): Promise<HostProfile | null> => {
  try {
    console.log('Reading host profile for:', hostId);
    
    const dataRef = ref(database, `hosts/${hostId}`);
    const snapshot = await get(dataRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      console.log('Host profile found:', data);
      
      // FIXED: Validate required fields and provide defaults
      const hostProfile: HostProfile = {
        email: data.email || '',
        lastLogin: data.lastLogin || Date.now(),
        role: data.role || 'host',
        status: data.status || 'inactive',
        subscriptionEnd: data.subscriptionEnd || 0,
        username: data.username || data.email?.split('@')[0] || 'Host',
        // Optional fields
        organization: data.organization || '',
        contactNumber: data.contactNumber || '',
        address: data.address || '',
        createdAt: data.createdAt || Date.now(),
        updatedAt: data.updatedAt || Date.now()
      };
      
      return hostProfile;
    } else {
      console.warn('No host profile found for:', hostId);
      return null;
    }
  } catch (error) {
    console.error('Error reading host profile:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to read profile');
  }
};

const updateHostData = async (hostId: string, updates: Partial<HostProfile>): Promise<void> => {
  try {
    console.log('Updating host data for:', hostId, updates);
    
    const hostRef = ref(database, `hosts/${hostId}`);
    const updateData = {
      ...updates,
      updatedAt: Date.now()
    };
    
    await update(hostRef, updateData);
    console.log('Host data updated successfully');
  } catch (error) {
    console.error('Error updating host data:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to update profile');
  }
};

export function AuthProvider({ children }: AuthProviderProps) {
  const navigate = useNavigate();
  const [state, setState] = useState<AuthState>({
    currentUser: null,
    isSubscriptionValid: false,
    userProfile: null,
    isLoading: true,
    error: null,
  });

  const checkSubscriptionValidity = (): boolean => {
    if (!state.userProfile) {
      console.log('No user profile available for subscription check');
      return false;
    }
    
    const isValid = state.userProfile.status === 'active' && 
                  state.userProfile.subscriptionEnd > Date.now();
    
    console.log('Subscription validity check:', {
      status: state.userProfile.status,
      subscriptionEnd: state.userProfile.subscriptionEnd,
      now: Date.now(),
      isValid
    });
    
    return isValid;
  };

  // FIXED: Load user profile with proper error handling
  const loadUserProfile = async (user: User) => {
    try {
      console.log('Loading user profile for:', user.uid);
      
      const profile = await readHostProfile(user.uid);
      
      if (profile) {
        const isValid = profile.status === 'active' && 
                       profile.subscriptionEnd > Date.now();
        
        setState(prev => ({
          ...prev,
          currentUser: user,
          userProfile: profile,
          isSubscriptionValid: isValid,
          isLoading: false,
          error: null,
        }));
        
        console.log('User profile loaded successfully:', {
          username: profile.username,
          status: profile.status,
          subscriptionValid: isValid
        });
      } else {
        // FIXED: Handle missing profile gracefully
        console.warn('Host profile not found, user may need to be set up');
        
        setState(prev => ({
          ...prev,
          currentUser: user,
          userProfile: null,
          isSubscriptionValid: false,
          isLoading: false,
          error: 'Host profile not found. Please contact support.',
        }));
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      setState(prev => ({
        ...prev,
        currentUser: user,
        userProfile: null,
        isSubscriptionValid: false,
        isLoading: false,
        error: 'Failed to load profile data',
      }));
    }
  };

  // FIXED: Auth state change handler with better error handling
  useEffect(() => {
    console.log('Setting up auth state listener');
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('Auth state changed:', user ? `User: ${user.email}` : 'No user');
      
      if (user) {
        await loadUserProfile(user);
      } else {
        setState(prev => ({
          ...prev,
          currentUser: null,
          userProfile: null,
          isSubscriptionValid: false,
          isLoading: false,
          error: null,
        }));
      }
    });

    return () => {
      console.log('Cleaning up auth state listener');
      unsubscribe();
    };
  }, []);

  const updateLastLogin = async (userId: string): Promise<void> => {
    try {
      await updateHostData(userId, {
        lastLogin: Date.now()
      });
      console.log('Last login updated for:', userId);
    } catch (error) {
      console.error('Error updating last login:', error);
      // Don't throw here, it's not critical
    }
  };

  const signInHost = async (email: string, password: string): Promise<void> => {
    try {
      console.log('Attempting to sign in host:', email);
      
      setState(prev => ({ ...prev, error: null, isLoading: true }));
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('Firebase authentication successful');
      
      // FIXED: Profile loading is now handled by the auth state change listener
      // But we'll also update last login here
      await updateLastLogin(userCredential.user.uid);
      
      // Navigation will be handled after profile loads in the auth state listener
      
    } catch (error) {
      console.error('Host sign in error:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'An error occurred during sign in';
      
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
      }));
      throw error;
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      console.log('Signing out user');
      setState(prev => ({ ...prev, error: null, isLoading: true }));
      
      await firebaseSignOut(auth);
      
      // State will be updated by the auth state change listener
      navigate('/login');
    } catch (error) {
      console.error('Sign out error:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error 
          ? error.message 
          : 'An error occurred during sign out',
        isLoading: false,
      }));
      throw error;
    }
  };

  const updateProfile = async (updates: Partial<HostProfile>): Promise<void> => {
    if (!state.currentUser?.uid) {
      throw new Error('No authenticated user');
    }

    try {
      console.log('Updating profile:', updates);
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      await updateHostData(state.currentUser.uid, updates);

      const newProfile = { ...state.userProfile, ...updates } as HostProfile;
      const isValid = newProfile.status === 'active' && 
                    newProfile.subscriptionEnd > Date.now();

      setState(prev => ({
        ...prev,
        userProfile: newProfile,
        isSubscriptionValid: isValid,
        isLoading: false,
        error: null,
      }));
      
      console.log('Profile updated successfully');
    } catch (error) {
      console.error('Profile update error:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error 
          ? error.message 
          : 'Failed to update profile',
        isLoading: false,
      }));
      throw error;
    }
  };

  // FIXED: Add refresh profile method
  const refreshProfile = async (): Promise<void> => {
    if (!state.currentUser) {
      throw new Error('No authenticated user');
    }

    console.log('Refreshing profile data');
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    await loadUserProfile(state.currentUser);
  };

  const clearError = () => {
    setState(prev => ({ ...prev, error: null }));
  };

  // FIXED: Navigation logic based on subscription status
  useEffect(() => {
    if (state.currentUser && state.userProfile && !state.isLoading) {
      console.log('Checking navigation for authenticated user');
      
      if (state.isSubscriptionValid) {
        console.log('Subscription valid, navigating to dashboard');
        navigate('/dashboard');
      } else {
        console.log('Subscription invalid, navigating to subscription page');
        navigate('/subscription');
      }
    }
  }, [state.currentUser, state.userProfile, state.isSubscriptionValid, state.isLoading, navigate]);

  // FIXED: Better loading state with error handling
  if (state.isLoading && !state.currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="large" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const value = {
    ...state,
    signInHost,
    signOut,
    clearError,
    updateProfile,
    checkSubscriptionValidity,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
