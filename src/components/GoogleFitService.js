// Google Fit API integration service
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  Timestamp 
} from 'firebase/firestore';

// Firebase configuration from main component
const firebaseConfig = {
  apiKey: "AIzaSyBHKkBufXHXSRFilD058dp-HsPdboSCY5Q",
  authDomain: "life-tracker-dashboard.firebaseapp.com",
  projectId: "life-tracker-dashboard",
  storageBucket: "life-tracker-dashboard.firebasestorage.app",
  messagingSenderId: "503693529929",
  appId: "1:503693529929:web:49f39138be913339ffc098"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// Google Fit API configuration
const GOOGLE_FIT_CLIENT_ID = process.env.REACT_APP_GOOGLE_FIT_CLIENT_ID || '';
const GOOGLE_FIT_SCOPES = [
  'https://www.googleapis.com/auth/fitness.activity.read',
  'https://www.googleapis.com/auth/fitness.body.read',
  'https://www.googleapis.com/auth/fitness.heart_rate.read',
  'https://www.googleapis.com/auth/fitness.sleep.read'
];

class GoogleFitService {
  constructor(userId) {
    this.userId = userId;
    this.isConnected = false;
    this.lastSync = null;
    this.fitnessData = null;
    this.tokenData = null;
    this.scope = GOOGLE_FIT_SCOPES.join(' ');
    
    // Load Google Fit API script
    this.loadGoogleFitApi();
  }
  
  // Load Google API client library
  loadGoogleFitApi() {
    // Check if script already exists
    if (document.getElementById('google-fit-api')) {
      this.initClient();
      return;
    }
    
    // Load the gapi script
    const scriptApi = document.createElement('script');
    scriptApi.id = 'google-fit-api';
    scriptApi.src = 'https://apis.google.com/js/api.js';
    scriptApi.onload = () => {
      // Once the basic API is loaded, load the client and auth2 libraries
      window.gapi.load('client:auth2', this.initClient.bind(this));
    };
    document.body.appendChild(scriptApi);
    
    // Also load the newer gsi (Google Sign-In) client
    // This may help with modern browsers and COOP issues
    const scriptGsi = document.createElement('script');
    scriptGsi.id = 'google-identity-services';
    scriptGsi.src = 'https://accounts.google.com/gsi/client';
    document.body.appendChild(scriptGsi);
  }
  
  // Initialize Google API client
  initClient() {
    if (!window.gapi) {
      console.log('GAPI not available yet, waiting...');
      setTimeout(() => this.initClient(), 1000);
      return;
    }
    
    // Check if client ID has been configured
    if (!GOOGLE_FIT_CLIENT_ID || GOOGLE_FIT_CLIENT_ID === 'your-google-fit-client-id.apps.googleusercontent.com') {
      console.error('Google Fit client ID not configured. Please set up OAuth credentials.');
      return;
    }
    
    console.log('Initializing Google API client with clientId:', GOOGLE_FIT_CLIENT_ID);
    
    // Initialize with more conservative options to avoid COOP issues
    const clientOptions = {
      clientId: GOOGLE_FIT_CLIENT_ID,
      scope: this.scope,
      fetch_basic_profile: false,
      cookie_policy: 'single_host_origin'
    };
    
    window.gapi.client.init(clientOptions)
      .then(() => {
        console.log('Google API client initialized successfully');
        // Check if auth2 is loaded
        if (!window.gapi.auth2) {
          console.log('Loading auth2 module...');
          window.gapi.load('auth2', () => {
            console.log('Auth2 module loaded, initializing...');
            window.gapi.auth2.init({
              client_id: GOOGLE_FIT_CLIENT_ID,
              scope: this.scope
            }).then(() => {
              console.log('Auth2 initialized successfully');
              // Check if user is already signed in
              if (this.userId) {
                console.log('User ID available, checking connection status');
                this.checkConnection();
              }
            }).catch(err => {
              console.error('Error initializing auth2:', err);
            });
          });
        } else {
          console.log('Auth2 already loaded, checking connection');
          // Check if user is already signed in
          if (this.userId) {
            this.checkConnection();
          }
        }
      })
      .catch(error => {
        console.error('Error initializing Google Fit API:', error);
        // Handle specific OAuth errors
        if (error.error === 'idpiframe_initialization_failed' || 
            (error.details && error.details.includes('invalid_client'))) {
          console.error('OAuth client ID invalid or not properly configured.');
        }
      });
  }
  
  // Check if user is connected to Google Fit
  async checkConnection() {
    if (!this.userId) return false;
    
    try {
      const docSnap = await getDoc(doc(db, 'users', this.userId, 'settings', 'googleFit'));
      
      if (docSnap.exists() && docSnap.data().isConnected) {
        this.isConnected = true;
        this.lastSync = docSnap.data().lastSync?.toDate() || null;
        this.tokenData = docSnap.data().tokenData || null;
        
        // Load stored data if available
        const dataSnap = await getDoc(doc(db, 'users', this.userId, 'googleFit', 'data'));
        if (dataSnap.exists()) {
          this.fitnessData = dataSnap.data();
        }
        
        // Also check if we're signed in with Google API
        if (window.gapi && window.gapi.auth2) {
          try {
            const googleAuth = window.gapi.auth2.getAuthInstance();
            const isSignedIn = googleAuth.isSignedIn.get();
            console.log('Google API signed in status:', isSignedIn);
            
            // If we're not signed in but have connection data, we might need to refresh
            if (!isSignedIn && this.tokenData) {
              console.log('Session expired, attempting to re-authenticate silently');
              // Try to reconnect silently
              await googleAuth.signIn({prompt: 'none'});
            }
          } catch (err) {
            console.warn('Error checking Google API sign-in status:', err);
            // Continue with saved connection status
          }
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking Google Fit connection:', error);
      return false;
    }
  }
  
  // Authorize and connect to Google Fit
  async connect() {
    console.log('Connect method called');
    if (!window.gapi || !window.gapi.auth2) {
      console.error('Google API client not loaded');
      throw new Error('Google API client not loaded');
    }
    
    try {
      console.log('Checking for existing auth instance');
      const googleAuth = window.gapi.auth2.getAuthInstance();
      console.log('Auth instance exists, checking if already signed in');
      const isSignedIn = googleAuth.isSignedIn.get();
      console.log('Already signed in:', isSignedIn);
      
      if (isSignedIn) {
        console.log('User is already signed in, getting auth response');
        const currentUser = googleAuth.currentUser.get();
        const authResponse = currentUser.getAuthResponse();
        console.log('Auth response:', authResponse);
        
        // Store token data
        const tokenData = {
          accessToken: authResponse.access_token,
          idToken: authResponse.id_token,
          expiresAt: authResponse.expires_at
        };
        
        // Save to instance
        this.isConnected = true;
        this.tokenData = tokenData;
        
        // Store in Firestore if user ID is available
        if (this.userId) {
          console.log('Storing token data in Firestore');
          await setDoc(doc(db, 'users', this.userId, 'settings', 'googleFit'), {
            isConnected: true,
            lastSync: Timestamp.now(),
            tokenData: tokenData
          });
        }
        
        console.log('Successfully connected with existing session');
        return true;
      }
      
      console.log('Need to sign in, setting up auth promise');
      // Use a Promise-based approach with a timeout to handle COOP issues
      const authPromise = new Promise((resolve, reject) => {
        // Configure sign-in options
        const signInOptions = {
          prompt: 'consent',
          scope: this.scope,
          ux_mode: 'popup'  // Use popup mode which is more reliable
        };
        console.log('Sign-in options:', signInOptions);
        
        // Set a timeout to catch COOP silent failures
        const authTimeout = setTimeout(() => {
          reject(new Error('Authentication timed out. Please try again.'));
        }, 60000);  // 60 second timeout
        
        // Start the sign-in flow
        googleAuth.signIn(signInOptions)
          .then(result => {
            clearTimeout(authTimeout);
            resolve(result);
          })
          .catch(err => {
            clearTimeout(authTimeout);
            reject(err);
          });
      });
      
      // Await the authentication process
      const googleUser = await authPromise;
      
      // Check if user actually granted permissions
      if (!googleUser) {
        throw new Error('Failed to authenticate with Google');
      }
      
      // Get auth response
      const authResponse = googleUser.getAuthResponse();
      const tokenData = {
        accessToken: authResponse.access_token,
        idToken: authResponse.id_token,
        expiresAt: authResponse.expires_at
      };
      
      // Store token data in Firestore
      if (this.userId) {
        await setDoc(doc(db, 'users', this.userId, 'settings', 'googleFit'), {
          isConnected: true,
          lastSync: Timestamp.now(),
          tokenData: tokenData
        });
      }
      
      this.isConnected = true;
      this.tokenData = tokenData;
      
      // Fetch initial data
      await this.fetchData();
      return true;
    } catch (error) {
      console.error('Error connecting to Google Fit:', error);
      // Improve error handling for COOP issues
      if (error.error === 'popup_closed_by_user') {
        throw new Error('Authentication popup was closed. Please try again.');
      } else if (error.error === 'popup_blocked_by_browser') {
        throw new Error('Authentication popup was blocked. Please allow popups for this site and try again.');
      } else if (error.error === 'immediate_failed') {
        throw new Error('Authentication could not proceed silently. Please try again.');
      } else if (error.message) {
        throw new Error(error.message);
      } else if (typeof error === 'object') {
        // Handle generic Object errors
        throw new Error('Authentication failed. Try using a different browser or disabling extensions.');
      } else {
        throw error;
      }
    }
  }
  
  // Disconnect from Google Fit
  async disconnect() {
    if (!window.gapi || !window.gapi.auth2) {
      console.error('Google API client not loaded');
      throw new Error('Google API client not loaded');
    }
    
    try {
      const googleAuth = window.gapi.auth2.getAuthInstance();
      await googleAuth.signOut();
      
      // Update connection status in Firestore
      if (this.userId) {
        await setDoc(doc(db, 'users', this.userId, 'settings', 'googleFit'), {
          isConnected: false
        });
      }
      
      this.isConnected = false;
      this.fitnessData = null;
      return true;
    } catch (error) {
      console.error('Error disconnecting from Google Fit:', error);
      throw error;
    }
  }
  
  // Fetch data from Google Fit API
  async fetchData() {
    console.log('fetchData called, isConnected:', this.isConnected);
    console.log('gapi available:', !!window.gapi);
    
    if (!this.isConnected) {
      console.log('Not connected to Google Fit, attempting to check connection');
      const isNowConnected = await this.checkConnection();
      if (!isNowConnected) {
        throw new Error('Not connected to Google Fit');
      }
      console.log('Successfully confirmed connection');
    }
    
    if (!window.gapi) {
      throw new Error('Google API not loaded');
    }
    
    try {
      console.log('Starting to fetch Google Fit data...');
      // Set up date range (last 30 days)
      const endTime = new Date();
      const startTime = new Date();
      startTime.setDate(startTime.getDate() - 30);
      
      // Convert to milliseconds for Google Fit API
      const endTimeMillis = endTime.getTime();
      const startTimeMillis = startTime.getTime();
      console.log('Date range:', startTime, 'to', endTime);
      
      // Load Fitness API if not already loaded
      if (!window.gapi.client.fitness) {
        console.log('Loading Fitness API...');
        await window.gapi.client.load('https://www.googleapis.com/discovery/v1/apis/fitness/v1/rest');
        console.log('Fitness API loaded successfully');
      } else {
        console.log('Fitness API already loaded');
      }
      
      // Collect all the data types we want to fetch
      const dataTypes = [
        {
          name: 'steps',
          dataTypeName: 'com.google.step_count.delta',
          aggregateDataTypeName: 'com.google.step_count.delta'
        },
        {
          name: 'heartRate',
          dataTypeName: 'com.google.heart_rate.bpm',
          aggregateDataTypeName: 'com.google.heart_rate.summary'
        },
        {
          name: 'calories',
          dataTypeName: 'com.google.calories.expended',
          aggregateDataTypeName: 'com.google.calories.expended'
        },
        {
          name: 'distance',
          dataTypeName: 'com.google.distance.delta',
          aggregateDataTypeName: 'com.google.distance.delta'
        },
        {
          name: 'weight',
          dataTypeName: 'com.google.weight',
          aggregateDataTypeName: 'com.google.weight.summary'
        },
        {
          name: 'activeMinutes',
          dataTypeName: 'com.google.active_minutes',
          aggregateDataTypeName: 'com.google.active_minutes'
        }
      ];
      
      // Build aggregate data request
      const requestBody = {
        aggregateBy: dataTypes.map(type => ({
          dataTypeName: type.dataTypeName
        })),
        bucketByTime: { durationMillis: 86400000 }, // Daily buckets
        startTimeMillis: startTimeMillis,
        endTimeMillis: endTimeMillis
      };
      
      console.log('Sending aggregate request to Google Fit API with body:', JSON.stringify(requestBody));
      
      // Make the API request
      const response = await window.gapi.client.fitness.users.dataset.aggregate({
        userId: 'me',
        resource: requestBody
      });
      
      console.log('Received response from Google Fit API');
      
      // Process the response
      const processedData = this.processAggregateResponse(response.result, dataTypes);
      console.log('Processed data:', processedData);
      
      // Add sleep data if available
      try {
        const sleepData = await this.fetchSleepData(startTimeMillis, endTimeMillis);
        processedData.sleep = sleepData;
      } catch (sleepError) {
        console.warn('Error fetching sleep data:', sleepError);
        processedData.sleep = [];
      }
      
      // Add activity data
      try {
        const activityData = await this.fetchActivityData(startTimeMillis, endTimeMillis);
        processedData.activities = activityData;
      } catch (activityError) {
        console.warn('Error fetching activity data:', activityError);
        processedData.activities = [];
      }
      
      // Save the data
      this.fitnessData = {
        ...processedData,
        lastUpdated: new Date()
      };
      
      // Save to Firestore if authenticated
      if (this.userId) {
        await setDoc(doc(db, 'users', this.userId, 'settings', 'googleFit'), {
          isConnected: true,
          lastSync: Timestamp.now(),
          tokenData: this.tokenData
        });
        
        await setDoc(doc(db, 'users', this.userId, 'googleFit', 'data'), {
          ...this.fitnessData,
          lastSync: Timestamp.now()
        });
      }
      
      return this.fitnessData;
    } catch (error) {
      console.error('Error fetching Google Fit data:', error);
      throw error;
    }
  }
  
  // Process the aggregate response
  processAggregateResponse(response, dataTypes) {
    const result = {
      steps: [],
      heartRate: [],
      calories: [],
      distance: [],
      weight: [],
      activeMinutes: [],
      dateRange: {
        start: new Date(parseInt(response.startTimeMillis, 10)),
        end: new Date(parseInt(response.endTimeMillis, 10))
      }
    };
    
    // Process each bucket (day)
    response.bucket.forEach(bucket => {
      const bucketDate = new Date(parseInt(bucket.startTimeMillis, 10));
      const dateStr = bucketDate.toISOString().split('T')[0];
      
      // Process each data type
      bucket.dataset.forEach(dataset => {
        const dataSourceId = dataset.dataSourceId;
        const dataType = this.getDataTypeFromSource(dataSourceId, dataTypes);
        
        if (!dataType) return;
        
        let value = 0;
        
        // Process each point
        dataset.point.forEach(point => {
          if (point.value && point.value.length > 0) {
            // Different data types have different value formats
            switch (dataType) {
              case 'steps':
              case 'calories':
              case 'distance':
              case 'activeMinutes':
                value += point.value[0].intVal || point.value[0].fpVal || 0;
                break;
              case 'heartRate':
              case 'weight':
                // For these, we want the average
                value = point.value[0].fpVal || 0;
                break;
              default:
                break;
            }
          }
        });
        
        // Add to result
        if (value > 0) {
          result[dataType].push({
            date: dateStr,
            value: value,
            rawDate: bucketDate
          });
        }
      });
    });
    
    // Calculate some summary data
    result.summary = {
      totalSteps: result.steps.reduce((sum, day) => sum + day.value, 0),
      avgDailySteps: result.steps.length > 0 ? result.steps.reduce((sum, day) => sum + day.value, 0) / result.steps.length : 0,
      totalCalories: result.calories.reduce((sum, day) => sum + day.value, 0),
      totalDistance: result.distance.reduce((sum, day) => sum + day.value, 0),
      totalActiveMinutes: result.activeMinutes.reduce((sum, day) => sum + day.value, 0),
      avgHeartRate: result.heartRate.length > 0 ? result.heartRate.reduce((sum, hr) => sum + hr.value, 0) / result.heartRate.length : 0,
      latestWeight: result.weight.length > 0 ? result.weight[result.weight.length - 1].value : null
    };
    
    return result;
  }
  
  // Helper to get data type from data source ID
  getDataTypeFromSource(dataSourceId, dataTypes) {
    for (const type of dataTypes) {
      if (dataSourceId.includes(type.dataTypeName)) {
        return type.name;
      }
    }
    return null;
  }
  
  // Fetch sleep data separately
  async fetchSleepData(startTimeMillis, endTimeMillis) {
    if (!window.gapi.client.fitness) {
      await window.gapi.client.load('https://www.googleapis.com/discovery/v1/apis/fitness/v1/rest');
    }
    
    // Request sleep data
    const response = await window.gapi.client.fitness.users.sessions.list({
      userId: 'me',
      startTime: new Date(startTimeMillis).toISOString(),
      endTime: new Date(endTimeMillis).toISOString(),
      activityType: 72 // Sleep
    });
    
    if (!response.result.session) {
      return [];
    }
    
    // Process sleep sessions
    return response.result.session.map(session => {
      const startDate = new Date(session.startTimeMillis * 1);
      const endDate = new Date(session.endTimeMillis * 1);
      const durationMinutes = Math.round((endDate - startDate) / (1000 * 60));
      
      return {
        id: session.id,
        start: startDate,
        end: endDate,
        duration: durationMinutes,
        name: session.name || 'Sleep',
        date: startDate.toISOString().split('T')[0]
      };
    });
  }
  
  // Fetch activity data separately
  async fetchActivityData(startTimeMillis, endTimeMillis) {
    if (!window.gapi.client.fitness) {
      await window.gapi.client.load('https://www.googleapis.com/discovery/v1/apis/fitness/v1/rest');
    }
    
    // Request for activity sessions
    // Skip sleep (72) as we handle that separately
    const response = await window.gapi.client.fitness.users.sessions.list({
      userId: 'me',
      startTime: new Date(startTimeMillis).toISOString(),
      endTime: new Date(endTimeMillis).toISOString()
    });
    
    if (!response.result.session) {
      return [];
    }
    
    // Process activity sessions
    return response.result.session
      .filter(session => session.activityType !== 72) // Filter out sleep
      .map(session => {
        const startDate = new Date(session.startTimeMillis * 1);
        const endDate = new Date(session.endTimeMillis * 1);
        const durationMinutes = Math.round((endDate - startDate) / (1000 * 60));
        
        return {
          id: session.id,
          type: session.activityType,
          start: startDate,
          end: endDate,
          duration: durationMinutes,
          name: session.name || this.getActivityName(session.activityType),
          activityName: this.getActivityName(session.activityType),
          date: startDate.toISOString().split('T')[0]
        };
      });
  }
  
  // Helper to get activity name from activity type
  getActivityName(activityType) {
    const activityMap = {
      7: 'Walking',
      8: 'Running',
      1: 'Biking',
      9: 'Aerobics',
      10: 'Badminton',
      11: 'Baseball',
      12: 'Basketball',
      13: 'Biathlon',
      14: 'Handbiking',
      15: 'Mountain biking',
      16: 'Road biking',
      17: 'Spinning',
      18: 'Stationary biking',
      19: 'Utility biking',
      20: 'Boxing',
      21: 'Calisthenics',
      22: 'Circuit training',
      23: 'Cricket',
      24: 'Dancing',
      25: 'Elliptical',
      26: 'Fencing',
      27: 'Football (American)',
      28: 'Football (Australian)',
      29: 'Football (Soccer)',
      30: 'Frisbee',
      31: 'Gardening',
      32: 'Golf',
      33: 'Gymnastics',
      34: 'Handball',
      35: 'Hiking',
      36: 'Hockey',
      37: 'Horseback riding',
      38: 'Housework',
      39: 'Jumping rope',
      40: 'Kayaking',
      41: 'Kettlebell training',
      42: 'Kickboxing',
      43: 'Kitesurfing',
      44: 'Martial arts',
      45: 'Meditation',
      46: 'Mixed martial arts',
      47: 'P90X exercises',
      48: 'Paragliding',
      49: 'Pilates',
      50: 'Polo',
      51: 'Racquetball',
      52: 'Rock climbing',
      53: 'Rowing',
      54: 'Rowing machine',
      55: 'Rugby',
      56: 'Jogging',
      57: 'Running on sand',
      58: 'Running (treadmill)',
      59: 'Sailing',
      60: 'Scuba diving',
      61: 'Skateboarding',
      62: 'Skating',
      63: 'Cross skating',
      64: 'Roller skating',
      65: 'Skiing',
      66: 'Cross-country skiing',
      67: 'Downhill skiing',
      68: 'Snowboarding',
      69: 'Snowmobile',
      70: 'Snowshoeing',
      71: 'Squash',
      73: 'Stair climbing',
      74: 'Stair-climbing machine',
      75: 'Stand-up paddleboarding',
      76: 'Strength training',
      77: 'Surfing',
      78: 'Swimming',
      79: 'Swimming (pool)',
      80: 'Swimming (open water)',
      81: 'Table tennis',
      82: 'Team sports',
      83: 'Tennis',
      84: 'Treadmill (walking or running)',
      85: 'Volleyball',
      86: 'Volleyball (beach)',
      87: 'Volleyball (indoor)',
      88: 'Wakeboarding',
      89: 'Walking (fitness)',
      90: 'Nording walking',
      91: 'Walking (treadmill)',
      92: 'Waterpolo',
      93: 'Weightlifting',
      94: 'Wheelchair',
      95: 'Windsurfing',
      96: 'Yoga',
      97: 'Zumba',
      100: 'Diving',
      101: 'Ergometer',
      102: 'Ice skating',
      103: 'Indoor skating',
      104: 'Curling',
      105: 'Other',
      108: 'High intensity interval training',
      109: 'Stretching',
      110: 'Weightlifting',
      111: 'Wheelchair',
      112: 'Crossfit',
      113: 'HIIT',
      114: 'Interval Training',
      115: 'Walking (stroller)',
      116: 'Elevator',
      117: 'Escalator',
      118: 'Archery',
      119: 'Softball'
    };
    
    return activityMap[activityType] || 'Activity';
  }
  
  // Import Google Fit data to health metrics
  async importToHealthMetrics(userId) {
    if (!this.fitnessData || !userId) {
      throw new Error('No fitness data available or user not authenticated');
    }
    
    try {
      // Gather activities that can be imported
      const activities = this.fitnessData.activities || [];
      const weight = this.fitnessData.weight || [];
      const heartRate = this.fitnessData.heartRate || [];
      const importedMetrics = [];
      
      // Check existing imported data to avoid duplicates
      const existingMetricsSnap = await getDoc(doc(db, 'users', userId, 'googleFit', 'imported'));
      const existingIds = new Set();
      
      if (existingMetricsSnap.exists()) {
        const existing = existingMetricsSnap.data();
        if (existing.activityIds) {
          existing.activityIds.forEach(id => existingIds.add(id));
        }
      }
      
      // Import activities
      for (const activity of activities) {
        // Skip if already imported
        if (existingIds.has(activity.id)) continue;
        
        // Convert to health metric format
        const metricData = {
          date: Timestamp.fromDate(new Date(activity.start)),
          source: 'googleFit',
          activityId: activity.id,
          activityType: activity.activityName,
          activityName: activity.name,
          duration: activity.duration * 60, // Convert to seconds
          notes: `Imported from Google Fit: ${activity.name}`,
        };
        
        // Calculate distance and calories if data available for this day
        const activityDate = activity.date;
        const distanceData = this.fitnessData.distance.find(d => d.date === activityDate);
        if (distanceData) {
          metricData.distance = distanceData.value; // in meters
        }
        
        const caloriesData = this.fitnessData.calories.find(c => c.date === activityDate);
        if (caloriesData) {
          metricData.calories = caloriesData.value;
        }
        
        // Get heart rate if available
        const heartRateData = heartRate.find(hr => hr.date === activityDate);
        if (heartRateData) {
          metricData.averageHR = heartRateData.value;
        }
        
        // Add to Firestore health metrics collection
        await setDoc(doc(db, 'users', userId, 'healthMetrics', activity.id), metricData);
        importedMetrics.push(activity.id);
      }
      
      // Import weight measurements
      for (const weightMeasurement of weight) {
        const weightId = `weight-${weightMeasurement.date}`;
        
        // Skip if already imported
        if (existingIds.has(weightId)) continue;
        
        // Convert to health metric format
        const metricData = {
          date: Timestamp.fromDate(new Date(weightMeasurement.rawDate)),
          source: 'googleFit',
          activityId: weightId,
          weight: weightMeasurement.value, // in kg, might need to convert
          notes: 'Weight measurement imported from Google Fit',
        };
        
        // Add to Firestore health metrics collection
        await setDoc(doc(db, 'users', userId, 'healthMetrics', weightId), metricData);
        importedMetrics.push(weightId);
      }
      
      // Update the list of imported metrics
      await setDoc(doc(db, 'users', userId, 'googleFit', 'imported'), {
        activityIds: Array.from(new Set([...Array.from(existingIds), ...importedMetrics])),
        lastImport: Timestamp.now()
      });
      
      return importedMetrics.length;
    } catch (error) {
      console.error('Error importing Google Fit data to health metrics:', error);
      throw error;
    }
  }
  
  // Get imported stats
  async getImportedStats(userId) {
    if (!userId) return { count: 0, lastImport: null };
    
    try {
      const importedSnap = await getDoc(doc(db, 'users', userId, 'googleFit', 'imported'));
      
      if (importedSnap.exists()) {
        const data = importedSnap.data();
        return {
          count: data.activityIds ? data.activityIds.length : 0,
          lastImport: data.lastImport ? data.lastImport.toDate() : null
        };
      }
      
      return { count: 0, lastImport: null };
    } catch (error) {
      console.error('Error getting imported stats:', error);
      return { count: 0, lastImport: null };
    }
  }
}

export default GoogleFitService;