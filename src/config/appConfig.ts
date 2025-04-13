// src/config/appConfig.ts
// Central configuration file for the Tambola Host System

const appConfig = {
  // Host Configuration
  hostUID: "Xa94GGCM9LOJF59EFA8jJLyjW2v2", // Replace with your actual host UID
  
  // Application Information
  appTitle: "Jo's & Nim's",
  appShortName: "Jo's & Nim's",
  companyName: "Jo's & Nim's",
  
  // Firebase Configuration
  firebaseConfig: {
    apiKey: "AIzaSyCvP2xYmtArCRGYo-5sN3blRZ_f7DChbLA",
    authDomain: "tambola-b13dc.firebaseapp.com",
    databaseURL: "https://tambola-b13dc-default-rtdb.firebaseio.com",
    projectId: "tambola-b13dc",
    storageBucket: "tambola-b13dc.firebasestorage.app",
    messagingSenderId: "368426861678",
    appId: "1:368426861678:web:27d907f113cb4f9f84d27f",
    measurementId: "G-BRPR34NXX5"
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
