// src/lib/firebase.ts

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  sendPasswordResetEmail,
  confirmPasswordReset,
  EmailAuthProvider,
  reauthenticateWithCredential
} from 'firebase/auth';
import { 
  getDatabase, 
  ref, 
  set, 
  get,
  remove,
  query,
  orderByChild,
  equalTo,
  push,
  update
} from 'firebase/database';
import { getAnalytics, logEvent } from 'firebase/analytics';
import appConfig from '../config/appConfig';

// Initialize Firebase using configuration from appConfig
const firebaseConfig = appConfig.firebaseConfig;

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
const auth = getAuth(app);
const database = getDatabase(app);
const analytics = getAnalytics(app);

// Authentication functions
export const signInHost = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    logEvent(analytics, 'login', {
      method: 'email'
    });
    return userCredential.user;
  } catch (error) {
    console.error('Error signing in:', error);
    throw error;
  }
};

export const signOut = async () => {
  try {
    await firebaseSignOut(auth);
    logEvent(analytics, 'logout');
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

export const resetPassword = async (email: string) => {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
};

export const confirmPasswordChange = async (code: string, newPassword: string) => {
  try {
    await confirmPasswordReset(auth, code, newPassword);
  } catch (error) {
    console.error('Error confirming password reset:', error);
    throw error;
  }
};

export const reauthenticateUser = async (password: string) => {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('No user logged in');

  const credential = EmailAuthProvider.credential(user.email, password);
  try {
    await reauthenticateWithCredential(user, credential);
  } catch (error) {
    console.error('Error reauthenticating user:', error);
    throw error;
  }
};

// Database functions
export const createHost = async (userId: string, hostData: any) => {
  try {
    const hostRef = ref(database, `hosts/${userId}`);
    await set(hostRef, {
      ...hostData,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  } catch (error) {
    console.error('Error creating host:', error);
    throw error;
  }
};

export const updateHost = async (userId: string, updates: any) => {
  try {
    const updates_with_timestamp = {
      ...updates,
      updatedAt: Date.now()
    };
    const hostRef = ref(database, `hosts/${userId}`);
    await update(hostRef, updates_with_timestamp);
  } catch (error) {
    console.error('Error updating host:', error);
    throw error;
  }
};

export const getHost = async (userId: string) => {
  try {
    const hostRef = ref(database, `hosts/${userId}`);
    const snapshot = await get(hostRef);
    return snapshot.val();
  } catch (error) {
    console.error('Error fetching host:', error);
    throw error;
  }
};

// Game management functions
export const createGame = async (userId: string, gameData: any) => {
  try {
    const gameRef = ref(database, `hosts/${userId}/games`);
    const newGameRef = push(gameRef);
    await set(newGameRef, {
      ...gameData,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'created'
    });
    return newGameRef.key;
  } catch (error) {
    console.error('Error creating game:', error);
    throw error;
  }
};

export const updateGame = async (userId: string, gameId: string, updates: any) => {
  try {
    const updates_with_timestamp = {
      ...updates,
      updatedAt: Date.now()
    };
    const gameRef = ref(database, `hosts/${userId}/games/${gameId}`);
    await update(gameRef, updates_with_timestamp);
  } catch (error) {
    console.error('Error updating game:', error);
    throw error;
  }
};

export const deleteGame = async (userId: string, gameId: string) => {
  try {
    const gameRef = ref(database, `hosts/${userId}/games/${gameId}`);
    await remove(gameRef);
  } catch (error) {
    console.error('Error deleting game:', error);
    throw error;
  }
};

// Settings functions
export const updateSettings = async (userId: string, settings: any) => {
  try {
    const settingsRef = ref(database, `hosts/${userId}/settings`);
    await update(settingsRef, {
      ...settings,
      updatedAt: Date.now()
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    throw error;
  }
};

export const getSettings = async (userId: string) => {
  try {
    const settingsRef = ref(database, `hosts/${userId}/settings`);
    const snapshot = await get(settingsRef);
    return snapshot.val();
  } catch (error) {
    console.error('Error fetching settings:', error);
    throw error;
  }
};

// Analytics functions
export const logGameEvent = (eventName: string, params?: Record<string, any>) => {
  try {
    logEvent(analytics, eventName, params);
  } catch (error) {
    console.error('Error logging event:', error);
  }
};

// Auth state observer
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// Export global app configuration
export { appConfig };

// Export Firebase instances
export { app, auth, database, analytics };