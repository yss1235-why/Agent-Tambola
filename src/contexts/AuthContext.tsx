// src/contexts/AuthContext.tsx - FIXED to remove deleted utils import
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

interface HostProfile {
  email: string;
  lastLogin: number;
  role: 'host';
  status: 'active' | 'inactive';
  subscriptionEnd: number;
  username: string;
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const auth: Auth = getAuth(app);

interface AuthProviderProps {
  children: ReactNode;
}

// FIXED: Simple Firebase utilities to replace deleted firebaseUtils
const readData = async <T>(hostId: string, path: string): Promise<{ success: boolean; data?: T; error?: string }> => {
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

const updateData = async (hostId: string, updates: any): Promise<{ success: boolean; error?: string }> => {
  try {
    const hostRef = ref(database, `hosts/${hostId}`);
    await update(hostRef, updates);
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update data' 
    };
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
    if (!state.userProfile) return false;
    
    const isValid = state.userProfile.status === 'active' && 
                  state.userProfile.subscriptionEnd > Date.now();
    
    return isValid;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const result = await readData<HostProfile>(user.uid, '');
          
          if (result.success && result.data) {
            const profile = result.data;
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
          } else {
            setState(prev => ({
              ...prev,
              currentUser: user,
              userProfile: null,
              isSubscriptionValid: false,
              isLoading: false,
              error: null,
            }));
          }
        } catch (error) {
          console.error('Error fetching host profile:', error);
          setState(prev => ({
            ...prev,
            currentUser: user,
            isLoading: false,
            error: 'Error fetching host profile',
          }));
        }
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

    return () => unsubscribe();
  }, []);

  const updateLastLogin = async (userId: string): Promise<void> => {
    try {
      const result = await updateData(userId, {
        lastLogin: Date.now()
      });
      
      if (!result.success) {
        console.error('Error updating last login:', result.error);
      }
    } catch (error) {
      console.error('Error updating last login:', error);
    }
  };

  const signInHost = async (email: string, password: string): Promise<void> => {
    try {
      setState(prev => ({ ...prev, error: null, isLoading: true }));
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      const profileResult = await readData<HostProfile>(
        userCredential.user.uid, 
        ''
      );
      
      if (!profileResult.success || !profileResult.data) {
        await firebaseSignOut(auth);
        throw new Error('Host profile not found');
      }
      
      const profile = profileResult.data;
      const isValid = profile.status === 'active' && 
                     profile.subscriptionEnd > Date.now();

      await updateLastLogin(userCredential.user.uid);

      setState(prev => ({
        ...prev,
        currentUser: userCredential.user,
        userProfile: profile,
        isSubscriptionValid: isValid,
        isLoading: false,
        error: null,
      }));

      if (isValid) {
        navigate('/dashboard');
      } else {
        navigate('/subscription');
      }
    } catch (error) {
      console.error('Host sign in error:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error 
          ? error.message 
          : 'An error occurred during sign in',
        isLoading: false,
      }));
      throw error;
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      setState(prev => ({ ...prev, error: null, isLoading: true }));
      await firebaseSignOut(auth);
      navigate('/login');
    } catch (error) {
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
      setState(prev => ({ ...prev, isLoading: true }));
      
      const result = await updateData(state.currentUser.uid, updates);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update profile');
      }

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
    } catch (error) {
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

  const clearError = () => {
    setState(prev => ({ ...prev, error: null }));
  };

  if (state.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
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
