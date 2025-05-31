// src/config/appConfig.ts - Secure configuration with hardcoded host UID
// Central configuration file for the Tambola Host System

const appConfig = {
  // Host Configuration - SECURITY: Only this specific UID can access the game data
  hostUID: "yaeHFN8qEWRBoBNq4yRuSjgY2w43", // Your designated host UID
  
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
  
  // Game Settings - Simplified for new validation system
  gameDefaults: {
    callDelay: 5, // Default delay between number calls in seconds
    defaultTicketSet: 1, // Default ticket set selection
    maxTicketsPerGame: 90, // Maximum tickets allowed per game
    autoCallingOnly: true, // No manual calling - simplified approach
    startInPausedState: true, // Game starts paused by default
    
    // Prize validation settings
    prizeValidation: {
      enabled: true, // Enable prize validation
      immediateValidation: true, // Validate prizes immediately when numbers are called
      debugMode: false, // Enable debug logging for validation (development only)
    },
    
    // Sheet prize configuration
    sheetPrizes: {
      enforceConsecutiveTickets: true, // Enforce consecutive ticket rules for sheet prizes
      minimumNumbersPerTicket: 2, // Minimum numbers required per ticket for sheet prizes
      validatePlayerOwnership: true, // Ensure all tickets in sheet belong to same player
    }
  },
  
  // Audio Settings - Simplified configuration
  audioSettings: {
    enabled: true, // Enable audio by default
    useCustomAudio: true, // Use custom phrases for number calls
    volume: 1.0, // Default volume level
    
    // Audio behavior settings
    announceNumbers: true, // Announce called numbers
    announcePrizes: true, // Play sounds when prizes are won
    muteDuringPause: false, // Continue audio even when game is paused
  },
  
  // Validation Settings - New section for prize validation
  validationSettings: {
    // Individual prize validation rules
    quickFive: {
      enabled: true,
      minimumNumbers: 5,
      description: "First to complete any 5 numbers"
    },
    
    lineValidation: {
      enabled: true,
      requireCompleteRow: true,
      description: "Complete all numbers in a row"
    },
    
    cornerValidation: {
      enabled: true,
      requireAllCorners: true,
      description: "Complete all four corner numbers"
    },
    
    fullHouseValidation: {
      enabled: true,
      requireAllNumbers: true,
      description: "Complete all numbers on ticket"
    },
    
    sheetValidation: {
      enabled: true,
      enforceSheetBoundaries: true,
      minimumTicketsForHalfSheet: 3,
      minimumTicketsForFullSheet: 6,
      description: "Complete consecutive tickets within sheet boundaries"
    }
  },
  
  // Database Settings - Simplified for new system
  databaseSettings: {
    realtimeUpdates: true, // Enable real-time Firebase updates
    batchUpdates: true, // Use batch updates for better performance
    
    // Validation-related database settings
    immediateWinnerUpdates: true, // Update winners immediately in database
    trackValidationHistory: false, // Disable complex validation tracking
    cacheValidationResults: false, // Disable validation caching for simplicity
  },
  
  // Development and Debug Settings
  debugSettings: {
    enableConsoleLogging: true, // Enable console logging
    logPrizeValidation: true, // Log prize validation events
    logNumberCalling: true, // Log number calling events
    logGameStateChanges: true, // Log game state changes
    showDebugPanel: process.env.NODE_ENV === 'development', // Show debug panel in development
  },
  
  // Performance Settings - Simplified
  performanceSettings: {
    validationThrottling: false, // Disable throttling for immediate validation
    enableOptimizations: true, // Enable basic performance optimizations
    maxConcurrentValidations: 1, // Process one validation at a time for predictability
  },
  
  // Error Handling Settings
  errorHandling: {
    retryFailedValidations: false, // Don't retry failed validations - fail fast
    showDetailedErrors: process.env.NODE_ENV === 'development', // Show detailed errors in development
    logErrorsToConsole: true, // Log errors to console
    gracefulDegradation: true, // Continue game even if non-critical features fail
  },
  
  // Export and Reporting Settings - Simplified
  exportSettings: {
    enableWinnerExport: true, // Enable winner list export
    enableGameHistory: true, // Enable game history
    defaultExportFormat: 'csv', // Default export format
    includeTimestamps: true, // Include timestamps in exports
  },
  
  // Contact Information
  supportEmail: "support@example.com",
  
  // Feature Flags - Control which features are enabled
  features: {
    prizeValidation: true, // Enable prize validation
    audioAnnouncements: true, // Enable audio announcements
    winnerNotifications: true, // Enable winner notifications
    gameHistory: true, // Enable game history tracking
    exportFunctionality: true, // Enable export functionality
    debugMode: process.env.NODE_ENV === 'development', // Enable debug mode in development
  }
};

export default appConfig;
