// src/config/appConfig.ts
// Central configuration file for the Tambola Host System

const appConfig = {
  // Host Configuration
  hostUID: "SMRyGxVTVRcDOcvi9wtfO8rzkjf1", // Replace with your actual host UID
  
  // Application Information
  appTitle: "Jo's & Nim's",
  appShortName: "Jo's & Nim's",
  companyName: "Jo's & Nim's",
  
  // Firebase Configuration (should match your firebase.ts file)
  firebaseConfig: {
    apiKey: "AIzaSyCH2WtQ2y3ln8ToHcapIsEMIXJ78Hsg7Bg",
    authDomain: "tambola-74046.firebaseapp.com",
    databaseURL: "https://tambola-74046-default-rtdb.firebaseio.com",
    projectId: "tambola-74046",
    storageBucket: "tambola-74046.firebasestorage.app",
    messagingSenderId: "310265084192",
    appId: "1:310265084192:web:c044bf9b83c444f4a2ff45",
    measurementId: "G-MP72F136BH"
  },
  
  // UI Configuration
  uiSettings: {
    primaryColor: "#0ea5e9", // Default tailwind blue-500
    accentColor: "#10B981", // Default tailwind green-500
    darkMode: false,
  },
  
  // Game Settings
  gameDefaults: {
    callDelay: 5, // Default delay between number calls in seconds
    defaultTicketSet: 1,
    maxTicketsPerGame: 90,
    autoCallingOnly: true, // No manual calling
    startInPausedState: true, // Game starts paused by default
  },
  
  // Audio Settings
  audioSettings: {
    useCustomAudio: true,
    volume: 1.0,
  },
  
  // Contact Information
  supportEmail: "support@example.com",
};

export default appConfig;