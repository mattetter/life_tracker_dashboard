// Strava API integration service
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  Timestamp 
} from 'firebase/firestore';
import axios from 'axios';

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

// Strava API configuration
const STRAVA_CLIENT_ID = process.env.REACT_APP_STRAVA_CLIENT_ID || '';
const STRAVA_CLIENT_SECRET = process.env.REACT_APP_STRAVA_CLIENT_SECRET || '';
const STRAVA_REDIRECT_URI = process.env.REACT_APP_STRAVA_REDIRECT_URI || window.location.origin;
const STRAVA_API_BASE_URL = 'https://www.strava.com/api/v3';

class StravaService {
  constructor(userId) {
    this.userId = userId;
    this.isConnected = false;
    this.lastSync = null;
    this.activityData = null;
    this.tokenData = null;
  }
  
  // Check if user is connected to Strava
  async checkConnection() {
    if (!this.userId) return false;
    
    try {
      const docSnap = await getDoc(doc(db, 'users', this.userId, 'settings', 'strava'));
      
      if (docSnap.exists() && docSnap.data().isConnected) {
        this.isConnected = true;
        this.lastSync = docSnap.data().lastSync?.toDate() || null;
        this.tokenData = docSnap.data().tokenData || null;
        
        // Load stored data if available
        const dataSnap = await getDoc(doc(db, 'users', this.userId, 'strava', 'data'));
        if (dataSnap.exists()) {
          this.activityData = dataSnap.data();
        }
        
        // Check if token needs refresh
        if (this.tokenData && this.tokenData.expires_at * 1000 < Date.now()) {
          console.log('Token expired, refreshing...');
          await this.refreshToken();
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking Strava connection:', error);
      return false;
    }
  }
  
  // Get Strava authorization URL
  getAuthorizationUrl() {
    const scope = 'read,activity:read_all,profile:read_all';
    
    return `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${STRAVA_REDIRECT_URI}&approval_prompt=force&scope=${scope}`;
  }
  
  // Handle OAuth callback and exchange authorization code for tokens
  async handleCallback(code) {
    try {
      console.log('Exchanging authorization code for tokens');
      
      const response = await axios.post('https://www.strava.com/oauth/token', {
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code'
      });
      
      const tokenData = response.data;
      
      // Store token data
      this.isConnected = true;
      this.tokenData = tokenData;
      
      // Store in Firestore if user ID is available
      if (this.userId) {
        console.log('Storing token data in Firestore');
        await setDoc(doc(db, 'users', this.userId, 'settings', 'strava'), {
          isConnected: true,
          lastSync: Timestamp.now(),
          tokenData: tokenData
        });
      }
      
      // Fetch initial data
      await this.fetchData();
      return true;
    } catch (error) {
      console.error('Error exchanging authorization code:', error);
      throw error;
    }
  }
  
  // Refresh access token using refresh token
  async refreshToken() {
    if (!this.tokenData || !this.tokenData.refresh_token) {
      throw new Error('No refresh token available');
    }
    
    try {
      const response = await axios.post('https://www.strava.com/oauth/token', {
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        refresh_token: this.tokenData.refresh_token,
        grant_type: 'refresh_token'
      });
      
      // Update token data, keeping the refresh token if it's not in the response
      this.tokenData = {
        ...response.data,
        refresh_token: response.data.refresh_token || this.tokenData.refresh_token
      };
      
      // Update in Firestore
      if (this.userId) {
        await setDoc(doc(db, 'users', this.userId, 'settings', 'strava'), {
          isConnected: true,
          lastSync: Timestamp.now(),
          tokenData: this.tokenData
        }, { merge: true });
      }
      
      return this.tokenData;
    } catch (error) {
      console.error('Error refreshing token:', error);
      throw error;
    }
  }
  
  // Disconnect from Strava
  async disconnect() {
    try {
      if (this.tokenData && this.tokenData.access_token) {
        // Revoke access token
        await axios.post('https://www.strava.com/oauth/deauthorize', {
          access_token: this.tokenData.access_token
        });
      }
      
      // Update connection status in Firestore
      if (this.userId) {
        await setDoc(doc(db, 'users', this.userId, 'settings', 'strava'), {
          isConnected: false,
          tokenData: null
        });
      }
      
      this.isConnected = false;
      this.activityData = null;
      this.tokenData = null;
      return true;
    } catch (error) {
      console.error('Error disconnecting from Strava:', error);
      throw error;
    }
  }
  
  // Make authenticated API request to Strava
  async apiRequest(endpoint, method = 'GET', data = null) {
    if (!this.isConnected || !this.tokenData) {
      await this.checkConnection();
      if (!this.isConnected || !this.tokenData) {
        throw new Error('Not connected to Strava');
      }
    }
    
    // Check if token needs refresh
    if (this.tokenData.expires_at * 1000 < Date.now()) {
      await this.refreshToken();
    }
    
    try {
      const config = {
        method,
        url: `${STRAVA_API_BASE_URL}${endpoint}`,
        headers: {
          'Authorization': `Bearer ${this.tokenData.access_token}`
        }
      };
      
      if (data) {
        config.data = data;
      }
      
      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error('Error making Strava API request:', error);
      if (error.response && error.response.status === 401) {
        // Token might be expired, try to refresh and retry
        await this.refreshToken();
        
        // Retry the request with new token
        const retryConfig = {
          method,
          url: `${STRAVA_API_BASE_URL}${endpoint}`,
          headers: {
            'Authorization': `Bearer ${this.tokenData.access_token}`
          }
        };
        
        if (data) {
          retryConfig.data = data;
        }
        
        const retryResponse = await axios(retryConfig);
        return retryResponse.data;
      }
      throw error;
    }
  }
  
  // Fetch athlete profile
  async getAthlete() {
    return this.apiRequest('/athlete');
  }
  
  // Fetch data from Strava API
  async fetchData() {
    console.log('Fetching data from Strava');
    
    if (!this.isConnected) {
      console.log('Not connected to Strava, attempting to check connection');
      const isNowConnected = await this.checkConnection();
      if (!isNowConnected) {
        throw new Error('Not connected to Strava');
      }
      console.log('Successfully confirmed connection');
    }
    
    try {
      // Fetch athlete data
      const athlete = await this.getAthlete();
      
      // Set up date range (last 90 days by default)
      const endTime = new Date();
      const startTime = new Date();
      startTime.setDate(startTime.getDate() - 90);
      
      // Convert to epoch time
      const after = Math.floor(startTime.getTime() / 1000);
      const before = Math.floor(endTime.getTime() / 1000);
      
      // Fetch activities
      const activities = await this.apiRequest(`/athlete/activities?after=${after}&before=${before}&per_page=100`);
      
      // Fetch detailed stats for selected activities
      const detailedActivities = await Promise.all(
        activities.slice(0, 10).map(activity => 
          this.apiRequest(`/activities/${activity.id}`)
        )
      );
      
      // Organize data
      const processedData = {
        athlete: athlete,
        activities: activities,
        detailedActivities: detailedActivities,
        dateRange: {
          start: startTime,
          end: endTime
        },
        lastUpdated: new Date()
      };
      
      // Add summary stats
      processedData.summary = this.calculateSummaryStats(activities);
      
      // Save the data
      this.activityData = processedData;
      
      // Save to Firestore if authenticated
      if (this.userId) {
        await setDoc(doc(db, 'users', this.userId, 'settings', 'strava'), {
          isConnected: true,
          lastSync: Timestamp.now(),
          tokenData: this.tokenData
        });
        
        await setDoc(doc(db, 'users', this.userId, 'strava', 'data'), {
          ...this.activityData,
          lastSync: Timestamp.now(),
          athlete: this.activityData.athlete,
          activities: this.activityData.activities,
          detailedActivities: this.activityData.detailedActivities,
          summary: this.activityData.summary
        });
      }
      
      return this.activityData;
    } catch (error) {
      console.error('Error fetching Strava data:', error);
      throw error;
    }
  }
  
  // Calculate summary statistics
  calculateSummaryStats(activities) {
    if (!activities || activities.length === 0) {
      return {
        totalActivities: 0,
        totalDistance: 0,
        totalElevation: 0,
        totalDuration: 0,
        totalCalories: 0
      };
    }
    
    const summary = {
      totalActivities: activities.length,
      totalDistance: 0,
      totalElevation: 0,
      totalDuration: 0,
      totalCalories: 0,
      activityCounts: {},
      weeklyStats: {}
    };
    
    // Process each activity
    activities.forEach(activity => {
      // Add to totals
      summary.totalDistance += activity.distance || 0;
      summary.totalElevation += activity.total_elevation_gain || 0;
      summary.totalDuration += activity.moving_time || 0;
      summary.totalCalories += activity.calories || 0;
      
      // Count by activity type
      const type = activity.type || 'Other';
      summary.activityCounts[type] = (summary.activityCounts[type] || 0) + 1;
      
      // Group by week
      const activityDate = new Date(activity.start_date);
      const weekStart = new Date(activityDate);
      weekStart.setDate(activityDate.getDate() - activityDate.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!summary.weeklyStats[weekKey]) {
        summary.weeklyStats[weekKey] = {
          activities: 0,
          distance: 0,
          elevation: 0,
          duration: 0,
          calories: 0
        };
      }
      
      const weekStats = summary.weeklyStats[weekKey];
      weekStats.activities += 1;
      weekStats.distance += activity.distance || 0;
      weekStats.elevation += activity.total_elevation_gain || 0;
      weekStats.duration += activity.moving_time || 0;
      weekStats.calories += activity.calories || 0;
    });
    
    return summary;
  }
  
  // Get activity types from Strava
  getActivityTypes() {
    return [
      'AlpineSki', 'BackcountrySki', 'Canoeing', 'Crossfit', 'EBikeRide', 
      'Elliptical', 'Golf', 'Handcycle', 'Hike', 'IceSkate', 'InlineSkate', 
      'Kayaking', 'Kitesurf', 'NordicSki', 'Ride', 'RockClimbing', 'RollerSki', 
      'Rowing', 'Run', 'Sail', 'Skateboard', 'Snowboard', 'Snowshoe', 'Soccer', 
      'StairStepper', 'StandUpPaddling', 'Surfing', 'Swim', 'Velomobile', 'VirtualRide', 
      'VirtualRun', 'Walk', 'WeightTraining', 'Wheelchair', 'Windsurf', 'Workout', 'Yoga'
    ];
  }
  
  // Import Strava activities to health metrics
  async importToHealthMetrics(userId) {
    if (!this.activityData || !userId) {
      throw new Error('No activity data available or user not authenticated');
    }
    
    try {
      // Gather activities that can be imported
      const activities = this.activityData.activities || [];
      const importedMetrics = [];
      
      // Check existing imported data to avoid duplicates
      const existingMetricsSnap = await getDoc(doc(db, 'users', userId, 'strava', 'imported'));
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
        if (existingIds.has(activity.id.toString())) continue;
        
        // Convert to health metric format
        const metricData = {
          date: Timestamp.fromDate(new Date(activity.start_date)),
          source: 'strava',
          activityId: activity.id.toString(),
          activityType: activity.type,
          activityName: activity.name,
          duration: activity.moving_time, // in seconds
          distance: activity.distance, // in meters
          calories: activity.calories || 0,
          elevationGain: activity.total_elevation_gain || 0,
          averageSpeed: activity.average_speed || 0,
          maxSpeed: activity.max_speed || 0,
          averageHeartRate: activity.average_heartrate || 0,
          maxHeartRate: activity.max_heartrate || 0,
          notes: `Imported from Strava: ${activity.name}`,
          stravaData: {
            id: activity.id,
            external_id: activity.external_id,
            athleteId: activity.athlete.id,
            polyline: activity.map?.polyline || null,
            startCoords: activity.start_latlng,
            endCoords: activity.end_latlng
          }
        };
        
        // Add to Firestore health metrics collection
        await setDoc(doc(db, 'users', userId, 'healthMetrics', activity.id.toString()), metricData);
        importedMetrics.push(activity.id.toString());
      }
      
      // Update the list of imported metrics
      await setDoc(doc(db, 'users', userId, 'strava', 'imported'), {
        activityIds: Array.from(new Set([...Array.from(existingIds), ...importedMetrics])),
        lastImport: Timestamp.now()
      });
      
      return importedMetrics.length;
    } catch (error) {
      console.error('Error importing Strava data to health metrics:', error);
      throw error;
    }
  }
  
  // Get imported stats
  async getImportedStats(userId) {
    if (!userId) return { count: 0, lastImport: null };
    
    try {
      const importedSnap = await getDoc(doc(db, 'users', userId, 'strava', 'imported'));
      
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

export default StravaService;