/**
 * Database Schema for Life Tracker Dashboard
 * This file defines the structure and relationships of data models in Firestore
 */

// User Profile Schema
export const USER_SCHEMA = {
  id: 'string', // UID from Firebase Auth
  name: 'string',
  email: 'string',
  createdAt: 'timestamp',
  lastLogin: 'timestamp',
  settings: {
    theme: 'string',
    dateFormat: 'string',
    autoRefresh: 'boolean',
    refreshInterval: 'number'
  }
};

// Goals Schema - Referenced by user
export const GOALS_SCHEMA = {
  userId: 'string', // Reference to user
  weeklyExercise: 'number',
  dailyMeditation: 'number',
  weeklyJournaling: 'number',
  dailySteps: 'number',
  weeklyRuns: 'number',
  weeklyStrengthTraining: 'number',
  updatedAt: 'timestamp',
  vo2maxTarget: { value: 45, targetDate: '' }
};

// Daily Log Schema
export const LOG_SCHEMA = {
  id: 'string', // Auto-generated document ID
  userId: 'string', // Reference to user
  date: 'timestamp',
  social: {
    interactions: 'number',
    satisfaction: 'number', // 1-10
    notes: 'string'
  },
  health: {
    exercise: 'boolean',
    exerciseDuration: 'number', // minutes
    exerciseType: 'string',
    sleep: 'number', // hours
    nutrition: 'number', // 1-10
    water: 'number', // glasses/oz
    meditation: 'boolean',
    meditationDuration: 'number', // minutes
    notes: 'string'
  },
  wellbeing: {
    mood: 'number', // 1-10
    energy: 'number', // 1-10
    stress: 'number', // 1-10
    productivity: 'number', // 1-10
    notes: 'string'
  },
  timestamp: 'timestamp' // Creation timestamp
};

// Journal Entry Schema
export const JOURNAL_SCHEMA = {
  id: 'string', // Auto-generated document ID
  userId: 'string', // Reference to user
  title: 'string',
  content: 'string',
  mood: 'number', // 1-10
  journalType: 'string', // e.g., "daily", "gratitude", "reflection"
  tags: 'array', // Array of strings
  timestamp: 'timestamp'
};

// Health Metrics Schema
export const HEALTH_METRIC_SCHEMA = {
  id: 'string', // Auto-generated document ID
  userId: 'string', // Reference to user
  date: 'timestamp',
  weight: 'number', // lbs or kg
  restingHeartRate: 'number', // bpm
  steps: 'number',
  caloriesBurned: 'number',
  exerciseData: {
    type: 'string',
    duration: 'number', // minutes
    distance: 'number', // miles or km
    heartRate: 'number', // avg bpm
    calories: 'number'
  },
  sleep: {
    duration: 'number', // hours
    quality: 'number', // 1-10
  },
  notes: 'string',
  source: 'string', // e.g., "manual", "strava", "fitbit"
  sourceId: 'string', // ID from external source if imported
  timestamp: 'timestamp' // Creation timestamp
};

// Project Schema
export const PROJECT_SCHEMA = {
  id: 'string', // Auto-generated document ID
  userId: 'string', // Reference to user
  title: 'string',
  description: 'string',
  goals: 'array', // Array of goal objects
  status: 'string', // "active", "completed", "on hold"
  progress: 'number', // 0-100
  startDate: 'timestamp',
  endDate: 'timestamp',
  createdAt: 'timestamp'
};

// Strava Connection Schema
export const STRAVA_CONNECTION_SCHEMA = {
  userId: 'string', // Reference to user
  isConnected: 'boolean',
  lastSync: 'timestamp',
  tokenData: {
    access_token: 'string',
    refresh_token: 'string',
    expires_at: 'number',
    athlete_id: 'string'
  }
};

// Strava Data Schema
export const STRAVA_DATA_SCHEMA = {
  userId: 'string', // Reference to user
  athlete: 'object',
  activities: 'array',
  summary: {
    totalActivities: 'number',
    totalDistance: 'number',
    totalElevation: 'number',
    totalDuration: 'number',
    totalCalories: 'number',
    activityCounts: 'object',
    weeklyStats: 'object'
  },
  lastSync: 'timestamp'
};

// Strava Imported Activities Schema
export const STRAVA_IMPORTED_SCHEMA = {
  userId: 'string', // Reference to user
  activityIds: 'array', // Array of imported activity IDs
  lastImport: 'timestamp'
};

// Collection paths with explicit relationships
export const COLLECTIONS = {
  USERS: 'users',
  USER_SETTINGS: 'settings',
  USER_GOALS: 'goals',
  LOGS: 'logs',
  JOURNAL: 'journal',
  HEALTH_METRICS: 'healthMetrics',
  PROJECTS: 'projects',
  STRAVA_CONNECTION: 'settings/strava',
  STRAVA_DATA: 'strava/data',
  STRAVA_IMPORTED: 'strava/imported'
};

// Define relationships between collections
export const RELATIONSHIPS = {
  USER_TO_LOGS: {
    from: COLLECTIONS.USERS,
    to: COLLECTIONS.LOGS,
    type: 'one-to-many',
    foreignKey: 'userId'
  },
  USER_TO_JOURNAL: {
    from: COLLECTIONS.USERS,
    to: COLLECTIONS.JOURNAL,
    type: 'one-to-many',
    foreignKey: 'userId'
  },
  USER_TO_HEALTH_METRICS: {
    from: COLLECTIONS.USERS,
    to: COLLECTIONS.HEALTH_METRICS,
    type: 'one-to-many',
    foreignKey: 'userId'
  },
  USER_TO_PROJECTS: {
    from: COLLECTIONS.USERS,
    to: COLLECTIONS.PROJECTS,
    type: 'one-to-many',
    foreignKey: 'userId'
  },
  USER_TO_STRAVA: {
    from: COLLECTIONS.USERS,
    to: COLLECTIONS.STRAVA_CONNECTION,
    type: 'one-to-one',
    foreignKey: 'userId'
  },
  STRAVA_TO_HEALTH_METRICS: {
    from: COLLECTIONS.STRAVA_DATA,
    to: COLLECTIONS.HEALTH_METRICS,
    type: 'one-to-many',
    foreignKey: 'sourceId'
  }
};