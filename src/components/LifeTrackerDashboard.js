import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, AreaChart, Area } from 'recharts';
import _ from 'lodash';

const LifeTrackerDashboard = () => {
  // Core state
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // Historical tracking state
  const [dateRange, setDateRange] = useState('30days'); // '7days', '30days', '90days', '365days', 'all'
  const [timeGrouping, setTimeGrouping] = useState('day'); // 'day', 'week', 'month'
  
  // Goals customization state
  const [showGoalSettings, setShowGoalSettings] = useState(false);
  const [goals, setGoals] = useState(() => {
    const savedGoals = localStorage.getItem('lifeTrackerGoals');
    return savedGoals ? JSON.parse(savedGoals) : {
      social: {
        familyContactDaysPerWeek: 3,
        friendContactDaysPerWeek: 2,
        katSmilePercentage: 70,
        katReviewsPerMonth: 4,
        newPhoneNumbersTarget: 5,
        newHangoutsTarget: 2
      },
      mentalHealth: {
        journalingPercentage: 60,
        meditationPercentage: 50,
        epicActivitiesPerMonth: 4
      },
      health: {
        strengthChallengeTarget: 400,
        sleepOnTimePercentage: 90
      },
      productivity: {
        languageDaysPercentage: 50,
        mathDaysPercentage: 50,
        codeDaysPercentage: 50,
        lessonsPerMonth: 4
      }
    };
  });
  
  // Auto-refresh state
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5); // minutes
  
  // Configuration for Google API
  const API_KEY = 'AIzaSyDI1YqGyGQundRDM6Gh7wpKpeP9Ki1Lo7I'; // You'll need to add your API key
  const CLIENT_ID = '230287780770-6cbb1fcm1tjco54ugku4kqn60d6sjbeu.apps.googleusercontent.com'; // You'll need to add your client ID
  const SPREADSHEET_ID = '1u-R5YdC4_Q5k7-lLMkZrM3BijEg0SpyJWyIQw2XUe7Q'; // The ID from your Google Sheet URL
  const SHEET_NAME = 'Form Responses 1'; // The name of your sheet
  const DISCOVERY_DOCS = ["https://sheets.googleapis.com/$discovery/rest?version=v4"];
  const SCOPES = "https://www.googleapis.com/auth/spreadsheets.readonly";

  // Save goals to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('lifeTrackerGoals', JSON.stringify(goals));
  }, [goals]);

  // Initialize the Google API client
  useEffect(() => {
    const loadGoogleAPI = () => {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.async = true;
      script.defer = true;
      script.onload = initClient;
      document.body.appendChild(script);
    };

    loadGoogleAPI();
  }, []);

  // Set up auto-refresh
  useEffect(() => {
    let intervalId;
    
    if (autoRefresh && isAuthenticated) {
      intervalId = setInterval(() => {
        fetchSheetData();
      }, refreshInterval * 60 * 1000); // Convert minutes to milliseconds
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [autoRefresh, refreshInterval, isAuthenticated]);

  const initClient = () => {
    setIsLoading(true);
    window.gapi.load('client:auth2', () => {
      window.gapi.client.init({
        apiKey: API_KEY,
        clientId: CLIENT_ID,
        discoveryDocs: DISCOVERY_DOCS,
        scope: SCOPES
      }).then(() => {
        // Listen for sign-in state changes
        window.gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);
        
        // Handle the initial sign-in state
        updateSigninStatus(window.gapi.auth2.getAuthInstance().isSignedIn.get());
        setIsLoading(false);
      }).catch(error => {
        setError('Error initializing Google API client: ' + error.details);
        setIsLoading(false);
      });
    });
  };

  const updateSigninStatus = (isSignedIn) => {
    setIsAuthenticated(isSignedIn);
    if (isSignedIn) {
      fetchSheetData();
    }
  };

  const handleAuthClick = () => {
    if (window.gapi.auth2.getAuthInstance().isSignedIn.get()) {
      window.gapi.auth2.getAuthInstance().signOut();
    } else {
      window.gapi.auth2.getAuthInstance().signIn();
    }
  };

  const fetchSheetData = () => {
    setIsLoading(true);
    window.gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:AZ` // This will fetch all columns
    }).then(response => {
      const range = response.result;
      if (range.values && range.values.length > 0) {
        // Process the data - first row contains headers
        const headers = range.values[0];
        const rows = range.values.slice(1);
        
        // Convert to array of objects with proper keys
        const processedData = rows.map(row => {
          const obj = {};
          headers.forEach((header, index) => {
            // Make sure we have a value for this cell
            if (index < row.length) {
              obj[header] = row[index];
            } else {
              obj[header] = '';
            }
          });
          
          // Parse timestamp to Date object
          const timestamp = new Date(obj.Timestamp);
          obj.date = timestamp;
          obj.formattedDate = `${timestamp.getMonth() + 1}/${timestamp.getDate()}/${timestamp.getFullYear()}`;
          
          // Extract year, month, week for better grouping
          obj.year = timestamp.getFullYear();
          obj.month = timestamp.getMonth() + 1;
          obj.week = getWeekNumber(timestamp);
          
          // Convert Yes/No to boolean equivalents for calculations
          Object.keys(obj).forEach(key => {
            if (obj[key] === 'Yes') obj[key] = 'Yes';
            else if (obj[key] === 'No') obj[key] = 'No';
            else if (key !== 'Timestamp' && !isNaN(Number(obj[key]))) {
              obj[key] = Number(obj[key]);
            }
          });
          
          return obj;
        });
        
        // Sort by date
        const sortedData = _.sortBy(processedData, 'date');
        setData(sortedData);
        setLastUpdated(new Date());
      }
      setIsLoading(false);
    }).catch(error => {
      setError('Error fetching sheet data: ' + error.result?.error?.message || 'Unknown error');
      setIsLoading(false);
    });
  };

  // Helper function to get week number
  const getWeekNumber = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  };

  // Filter data based on selected date range
  const getFilteredData = useCallback(() => {
    if (data.length === 0) return [];
    
    const now = new Date();
    let startDate;
    
    switch (dateRange) {
      case '7days':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        break;
      case '30days':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
        break;
      case '90days':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90);
        break;
      case '365days':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 365);
        break;
      case 'all':
      default:
        return data;
    }
    
    return data.filter(entry => new Date(entry.date) >= startDate);
  }, [data, dateRange]);

  // Group data by time period for historical charts
  const getGroupedHistoricalData = useCallback((metric) => {
    const filteredData = getFilteredData();
    if (filteredData.length === 0) return [];
    
    let groupKey;
    switch (timeGrouping) {
      case 'week':
        groupKey = entry => `${entry.year}-W${entry.week.toString().padStart(2, '0')}`;
        break;
      case 'month':
        groupKey = entry => `${entry.year}-${entry.month.toString().padStart(2, '0')}`;
        break;
      case 'day':
      default:
        groupKey = entry => entry.formattedDate;
    }
    
    // Group the data
    const groupedEntries = _.groupBy(filteredData, groupKey);
    
    // Calculate the metric for each group
    return Object.entries(groupedEntries).map(([period, entries]) => {
      const value = calculateMetricForEntries(entries, metric);
      return {
        period,
        value,
        count: entries.length
      };
    }).sort((a, b) => {
      // Sort by period
      return a.period.localeCompare(b.period);
    });
  }, [getFilteredData, timeGrouping]);

  // Calculate specific metric for a group of entries
  const calculateMetricForEntries = (entries, metric) => {
    switch (metric) {
      case 'family_contact':
        return (entries.filter(e => e.talk_fam === 'Yes').length / entries.length) * 100;
      case 'friend_contact':
        return (entries.filter(e => e.talk_old_friend === 'Yes').length / entries.length) * 100;
      case 'morning_journal':
        return (entries.filter(e => e.morning_journal === 'Yes').length / entries.length) * 100;
      case 'evening_journal':
        return (entries.filter(e => e.evening_journal === 'Yes').length / entries.length) * 100;
      case 'meditation':
        return (entries.filter(e => e.meditation === 'Yes').length / entries.length) * 100;
      case 'epic_activity':
        return (entries.filter(e => e.epic_activity === 'Yes').length / entries.length) * 100;
      case 'strength_total':
        const strengthEntries = entries.filter(e => e.strength === 'Yes');
        if (strengthEntries.length === 0) return 0;
        // Get the most recent strength entry for each period
        const latestStrength = strengthEntries[strengthEntries.length - 1];
        return (latestStrength.pushups || 0) + (latestStrength.rows || 0) + 
               (latestStrength.situps || 0) + (latestStrength.squats || 0);
      case 'sleep_on_time':
        return (entries.filter(e => e.bed_on_time === 'Yes').length / entries.length) * 100;
      case 'language':
        return (entries.filter(e => e.language === 'Yes').length / entries.length) * 100;
      case 'math':
        return (entries.filter(e => e.math === 'Yes').length / entries.length) * 100;
      case 'code':
        return (entries.filter(e => e.code === 'Yes').length / entries.length) * 100;
      case 'lessons':
        return (entries.filter(e => e.complete_lesson === 'Yes').length / entries.length) * 100;
      default:
        return 0;
    }
  };

  // Calculate days with family contact based on filtered data
  const calculateFamilyContactRate = useCallback(() => {
    const filteredData = getFilteredData();
    if (filteredData.length === 0) return { rate: 0, daysCount: 0, target: 0, progress: 0 };
    
    const daysWithFamilyContact = filteredData.filter(entry => entry.talk_fam === "Yes").length;
    const daysInPeriod = filteredData.length;
    const weeksInPeriod = daysInPeriod / 7;
    const targetDays = goals.social.familyContactDaysPerWeek * weeksInPeriod;
    
    return {
      rate: (daysWithFamilyContact / daysInPeriod) * 100,
      daysCount: daysWithFamilyContact,
      target: targetDays,
      progress: (daysWithFamilyContact / targetDays) * 100
    };
  }, [getFilteredData, goals.social.familyContactDaysPerWeek]);

  // Calculate friend contact rate based on filtered data
  const calculateFriendContactRate = useCallback(() => {
    const filteredData = getFilteredData();
    if (filteredData.length === 0) return { rate: 0, daysCount: 0, target: 0, progress: 0 };
    
    const daysWithFriendContact = filteredData.filter(entry => entry.talk_old_friend === "Yes").length;
    const daysInPeriod = filteredData.length;
    const weeksInPeriod = daysInPeriod / 7;
    const targetDays = goals.social.friendContactDaysPerWeek * weeksInPeriod;
    
    return {
      rate: (daysWithFriendContact / daysInPeriod) * 100,
      daysCount: daysWithFriendContact,
      target: targetDays,
      progress: (daysWithFriendContact / targetDays) * 100
    };
  }, [getFilteredData, goals.social.friendContactDaysPerWeek]);

  // Calculate journaling rate based on filtered data
  const calculateJournalingRate = useCallback(() => {
    const filteredData = getFilteredData();
    if (filteredData.length === 0) return { morningRate: 0, eveningRate: 0, bothRate: 0, totalRate: 0, progress: 0 };
    
    const morningJournalDays = filteredData.filter(entry => entry.morning_journal === "Yes").length;
    const eveningJournalDays = filteredData.filter(entry => entry.evening_journal === "Yes").length;
    const bothJournalDays = filteredData.filter(entry => 
      entry.morning_journal === "Yes" && entry.evening_journal === "Yes"
    ).length;
    
    const daysInPeriod = filteredData.length;
    const totalRate = ((morningJournalDays + eveningJournalDays) / (daysInPeriod * 2)) * 100;
    
    return {
      morningRate: (morningJournalDays / daysInPeriod) * 100,
      eveningRate: (eveningJournalDays / daysInPeriod) * 100,
      bothRate: (bothJournalDays / daysInPeriod) * 100,
      totalRate: totalRate,
      progress: (totalRate / goals.mentalHealth.journalingPercentage) * 100
    };
  }, [getFilteredData, goals.mentalHealth.journalingPercentage]);

  // Calculate meditation rate based on filtered data
  const calculateMeditationRate = useCallback(() => {
    const filteredData = getFilteredData();
    if (filteredData.length === 0) return { rate: 0, daysCount: 0, progress: 0 };
    
    const meditationDays = filteredData.filter(entry => entry.meditation === "Yes").length;
    const daysInPeriod = filteredData.length;
    const rate = (meditationDays / daysInPeriod) * 100;
    
    return {
      rate: rate,
      daysCount: meditationDays,
      progress: (rate / goals.mentalHealth.meditationPercentage) * 100
    };
  }, [getFilteredData, goals.mentalHealth.meditationPercentage]);

  // Calculate 400 challenge progress based on the most recent attempt
  const calculate400ChallengeProgress = useCallback(() => {
    const filteredData = getFilteredData();
    if (filteredData.length === 0) return { total: 0, progress: 0 };
    
    // Get the most recent entry where the 400 challenge was attempted
    const challengeEntries = filteredData.filter(entry => entry.strength === "Yes");
    if (challengeEntries.length === 0) return { total: 0, progress: 0 };
    
    const latestEntry = challengeEntries[challengeEntries.length - 1];
    
    // Sum up the exercises
    const pushups = latestEntry.pushups || 0;
    const rows = latestEntry.rows || 0;
    const situps = latestEntry.situps || 0;
    const squats = latestEntry.squats || 0;
    
    const total = pushups + rows + situps + squats;
    
    return {
      total: total,
      pushups: pushups,
      rows: rows,
      situps: situps,
      squats: squats,
      progress: (total / goals.health.strengthChallengeTarget) * 100
    };
  }, [getFilteredData, goals.health.strengthChallengeTarget]);

  // Calculate productivity metrics based on filtered data
  const calculateProductivityMetrics = useCallback(() => {
    const filteredData = getFilteredData();
    if (filteredData.length === 0) return {};
    
    const daysInPeriod = filteredData.length;
    
    const languageDays = filteredData.filter(entry => entry.language === "Yes").length;
    const mathDays = filteredData.filter(entry => entry.math === "Yes").length;
    const codeDays = filteredData.filter(entry => entry.code === "Yes").length;
    
    // Count lessons completed in the selected period
    const lessonsCompleted = filteredData.filter(entry => entry.complete_lesson === "Yes").length;
    
    // Calculate target lessons based on period length
    const monthsInPeriod = daysInPeriod / 30;
    const targetLessons = goals.productivity.lessonsPerMonth * monthsInPeriod;
    
    return {
      language: {
        rate: (languageDays / daysInPeriod) * 100,
        progress: (languageDays / daysInPeriod) * 100 / (goals.productivity.languageDaysPercentage / 100)
      },
      math: {
        rate: (mathDays / daysInPeriod) * 100,
        progress: (mathDays / daysInPeriod) * 100 / (goals.productivity.mathDaysPercentage / 100)
      },
      code: {
        rate: (codeDays / daysInPeriod) * 100,
        progress: (codeDays / daysInPeriod) * 100 / (goals.productivity.codeDaysPercentage / 100)
      },
      lessons: {
        count: lessonsCompleted,
        target: targetLessons,
        progress: (lessonsCompleted / targetLessons) * 100
      }
    };
  }, [getFilteredData, goals.productivity]);

  // Calculate sleep metrics based on filtered data
  const calculateSleepMetrics = useCallback(() => {
    const filteredData = getFilteredData();
    if (filteredData.length === 0) return {};
    
    const daysInPeriod = filteredData.length;
    
    const bedOnTimeDays = filteredData.filter(entry => entry.bed_on_time === "Yes").length;
    const upOnTimeDays = filteredData.filter(entry => entry.up_on_time === "Yes").length;
    
    return {
      bedOnTime: {
        rate: (bedOnTimeDays / daysInPeriod) * 100,
        progress: (bedOnTimeDays / daysInPeriod) * 100 / (goals.health.sleepOnTimePercentage / 100)
      },
      upOnTime: {
        rate: (upOnTimeDays / daysInPeriod) * 100
      },
      overall: {
        rate: ((bedOnTimeDays + upOnTimeDays) / (daysInPeriod * 2)) * 100
      }
    };
  }, [getFilteredData, goals.health.sleepOnTimePercentage]);

  // Function to get epic activity count based on filtered data
  const getEpicActivityCount = useCallback(() => {
    const filteredData = getFilteredData();
    if (filteredData.length === 0) return { count: 0, progress: 0 };
    
    const epicDays = filteredData.filter(entry => entry.epic_activity === "Yes").length;
    const monthsInPeriod = filteredData.length / 30;
    const targetEpicDays = goals.mentalHealth.epicActivitiesPerMonth * monthsInPeriod;
    
    return {
      count: epicDays,
      target: targetEpicDays,
      progress: (epicDays / targetEpicDays) * 100
    };
  }, [getFilteredData, goals.mentalHealth.epicActivitiesPerMonth]);

  // Calculate Kat-related metrics based on filtered data
  const calculateKatMetrics = useCallback(() => {
    const filteredData = getFilteredData();
    if (filteredData.length === 0) return {};
    
    const daysInPeriod = filteredData.length;
    const monthsInPeriod = daysInPeriod / 30;
    
    const smileDays = filteredData.filter(entry => entry.kat_smile === "Yes").length;
    const reviewDays = filteredData.filter(entry => entry.kat_review === "Yes").length;
    
    return {
      smile: {
        rate: (smileDays / daysInPeriod) * 100,
        progress: (smileDays / daysInPeriod) * 100 / (goals.social.katSmilePercentage / 100)
      },
      review: {
        count: reviewDays,
        target: goals.social.katReviewsPerMonth * monthsInPeriod,
        progress: (reviewDays / (goals.social.katReviewsPerMonth * monthsInPeriod)) * 100
      }
    };
  }, [getFilteredData, goals.social]);

  // Get new connections metrics based on filtered data
  const getNewConnectionsMetrics = useCallback(() => {
    const filteredData = getFilteredData();
    if (filteredData.length === 0) return {};
    
    // Count entries with "new_friends" as "Yes"
    const newFriendsEntries = filteredData.filter(entry => entry.new_friends === "Yes").length;
    
    // For phone numbers and hangouts, we'd need actual data that indicates these
    // Since we don't have this in the current schema, we'll estimate
    const newPeopleHangouts = filteredData.filter(entry => 
      entry.new_friends === "Yes" || 
      (entry.epic_activity === "Yes" && entry.vibes >= 3)
    ).length;
    
    return {
      phoneNumbers: {
        count: newFriendsEntries, // Using this as proxy
        target: goals.social.newPhoneNumbersTarget,
        progress: (newFriendsEntries / goals.social.newPhoneNumbersTarget) * 100
      },
      hangouts: {
        count: newPeopleHangouts,
        target: goals.social.newHangoutsTarget,
        progress: (newPeopleHangouts / goals.social.newHangoutsTarget) * 100
      }
    };
  }, [getFilteredData, goals.social]);

  // Compile all metrics for overview
  const getAllMetrics = useCallback(() => {
    return {
      social: {
        family: calculateFamilyContactRate(),
        friends: calculateFriendContactRate(),
        kat: calculateKatMetrics(),
        newConnections: getNewConnectionsMetrics()
      },
      mentalHealth: {
        journaling: calculateJournalingRate(),
        meditation: calculateMeditationRate(),
        epic: getEpicActivityCount()
      },
      health: {
        strength: calculate400ChallengeProgress(),
        sleep: calculateSleepMetrics()
      },
      productivity: calculateProductivityMetrics()
    };
  }, [
    calculateFamilyContactRate, 
    calculateFriendContactRate, 
    calculateKatMetrics, 
    getNewConnectionsMetrics,
    calculateJournalingRate,
    calculateMeditationRate,
    getEpicActivityCount,
    calculate400ChallengeProgress,
    calculateSleepMetrics,
    calculateProductivityMetrics
  ]);

  // Format for radar chart
  const prepareRadarData = useCallback(() => {
    const metrics = getAllMetrics();
    return [
      {
        subject: 'Social',
        A: (metrics.social.family.progress + 
            metrics.social.friends.progress + 
            metrics.social.kat.smile.progress + 
            metrics.social.kat.review.progress) / 4,
        fullMark: 100,
      },
      {
        subject: 'Mental Health',
        A: (metrics.mentalHealth.journaling.progress + 
            metrics.mentalHealth.meditation.progress + 
            metrics.mentalHealth.epic.progress) / 3,
        fullMark: 100,
      },
      {
        subject: 'Health',
        A: (metrics.health.strength.progress + 
            metrics.health.sleep.bedOnTime.progress) / 2,
        fullMark: 100,
      },
      {
        subject: 'Productivity',
        A: (metrics.productivity.language.progress + 
            metrics.productivity.math.progress + 
            metrics.productivity.code.progress + 
            metrics.productivity.lessons.progress) / 4,
        fullMark: 100,
      },
    ];
  }, [getAllMetrics]);

  const renderProgressBar = (label, value, target = 100) => {
    const progress = Math.min(100, (value / target) * 100);
    
    return (
      <div className="mb-4">
        <div className="flex justify-between mb-1">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-sm font-medium">{Math.round(value)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div 
            className={`h-2.5 rounded-full ${progress >= 100 ? 'bg-green-600' : progress >= 70 ? 'bg-blue-600' : progress >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`} 
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>
    );
  };

  const renderDateRangeSelector = () => {
    return (
      <div className="mb-6 flex flex-wrap justify-between items-center bg-white rounded-lg p-4 shadow">
        <div>
          <h3 className="text-lg font-semibold mb-2">Time Period</h3>
          <div className="flex space-x-2">
            <button 
              onClick={() => setDateRange('7days')} 
              className={`px-3 py-1 rounded ${dateRange === '7days' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            >
              7 Days
            </button>
            <button 
              onClick={() => setDateRange('30days')} 
              className={`px-3 py-1 rounded ${dateRange === '30days' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            >
              30 Days
            </button>
            <button 
              onClick={() => setDateRange('90days')} 
              className={`px-3 py-1 rounded ${dateRange === '90days' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            >
              90 Days
            </button>
            <button 
              onClick={() => setDateRange('365days')} 
              className={`px-3 py-1 rounded ${dateRange === '365days' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            >
              1 Year
            </button>
            <button 
              onClick={() => setDateRange('all')} 
              className={`px-3 py-1 rounded ${dateRange === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            >
              All Time
            </button>
          </div>
        </div>
        
        <div>
          <h3 className="text-lg font-semibold mb-2">Time Grouping</h3>
          <div className="flex space-x-2">
            <button 
              onClick={() => setTimeGrouping('day')} 
              className={`px-3 py-1 rounded ${timeGrouping === 'day' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            >
              Daily
            </button>
            <button 
              onClick={() => setTimeGrouping('week')} 
              className={`px-3 py-1 rounded ${timeGrouping === 'week' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            >
              Weekly
            </button>
            <button 
              onClick={() => setTimeGrouping('month')} 
              className={`px-3 py-1 rounded ${timeGrouping === 'month' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            >
              Monthly
            </button>
          </div>
        </div>
        
        <div>
          <button
            onClick={() => setShowGoalSettings(!showGoalSettings)}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            {showGoalSettings ? 'Hide Goal Settings' : 'Customize Goals'}
          </button>
        </div>
      </div>
    );
  };

  const renderGoalSettings = () => {
    if (!showGoalSettings) return null;
    
    return (
      <div className="mb-6 bg-white rounded-lg p-4 shadow">
        <h3 className="text-xl font-semibold mb-4">Customize Your Goals</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Social Goals */}
          <div>
            <h4 className="font-medium mb-3">Social Goals</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-1">Family Contact (days/week)</label>
                <input 
                  type="number" 
                  value={goals.social.familyContactDaysPerWeek} 
                  onChange={(e) => setGoals({
                    ...goals,
                    social: {
                      ...goals.social,
                      familyContactDaysPerWeek: Number(e.target.value)
                    }
                  })}
                  className="w-full px-3 py-2 border rounded"
                  min="0"
                  max="7"
                  step="0.5"
                />
              </div>
              
              <div>
                <label className="block text-sm mb-1">Friend Contact (days/week)</label>
                <input 
                  type="number" 
                  value={goals.social.friendContactDaysPerWeek} 
                  onChange={(e) => setGoals({
                    ...goals,
                    social: {
                      ...goals.social,
                      friendContactDaysPerWeek: Number(e.target.value)
                    }
                  })}
                  className="w-full px-3 py-2 border rounded"
                  min="0"
                  max="7"
                  step="0.5"
                />
              </div>
              
              <div>
                <label className="block text-sm mb-1">Make Kat Smile (% of days)</label>
                <input 
                  type="number" 
                  value={goals.social.katSmilePercentage} 
                  onChange={(e) => setGoals({
                    ...goals,
                    social: {
                      ...goals.social,
                      katSmilePercentage: Number(e.target.value)
                    }
                  })}
                  className="w-full px-3 py-2 border rounded"
                  min="0"
                  max="100"
                />
              </div>
              
              <div>
                <label className="block text-sm mb-1">Kat Reviews (per month)</label>
                <input 
                  type="number" 
                  value={goals.social.katReviewsPerMonth} 
                  onChange={(e) => setGoals({
                    ...goals,
                    social: {
                      ...goals.social,
                      katReviewsPerMonth: Number(e.target.value)
                    }
                  })}
                  className="w-full px-3 py-2 border rounded"
                  min="0"
                  step="0.5"
                />
              </div>
              
              <div>
                <label className="block text-sm mb-1">New Phone Numbers Target</label>
                <input 
                  type="number" 
                  value={goals.social.newPhoneNumbersTarget} 
                  onChange={(e) => setGoals({
                    ...goals,
                    social: {
                      ...goals.social,
                      newPhoneNumbersTarget: Number(e.target.value)
                    }
                  })}
                  className="w-full px-3 py-2 border rounded"
                  min="0"
                />
              </div>
              
              <div>
                <label className="block text-sm mb-1">New Hangouts Target</label>
                <input 
                  type="number" 
                  value={goals.social.newHangoutsTarget} 
                  onChange={(e) => setGoals({
                    ...goals,
                    social: {
                      ...goals.social,
                      newHangoutsTarget: Number(e.target.value)
                    }
                  })}
                  className="w-full px-3 py-2 border rounded"
                  min="0"
                />
              </div>
            </div>
          </div>
          
          {/* Mental Health Goals */}
          <div>
            <h4 className="font-medium mb-3">Mental Health Goals</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-1">Journaling (% target)</label>
                <input 
                  type="number" 
                  value={goals.mentalHealth.journalingPercentage} 
                  onChange={(e) => setGoals({
                    ...goals,
                    mentalHealth: {
                      ...goals.mentalHealth,
                      journalingPercentage: Number(e.target.value)
                    }
                  })}
                  className="w-full px-3 py-2 border rounded"
                  min="0"
                  max="100"
                />
              </div>
              
              <div>
                <label className="block text-sm mb-1">Meditation (% target)</label>
                <input 
                  type="number" 
                  value={goals.mentalHealth.meditationPercentage} 
                  onChange={(e) => setGoals({
                    ...goals,
                    mentalHealth: {
                      ...goals.mentalHealth,
                      meditationPercentage: Number(e.target.value)
                    }
                  })}
                  className="w-full px-3 py-2 border rounded"
                  min="0"
                  max="100"
                />
              </div>
              
              <div>
                <label className="block text-sm mb-1">Epic Activities (per month)</label>
                <input 
                  type="number" 
                  value={goals.mentalHealth.epicActivitiesPerMonth} 
                  onChange={(e) => setGoals({
                    ...goals,
                    mentalHealth: {
                      ...goals.mentalHealth,
                      epicActivitiesPerMonth: Number(e.target.value)
                    }
                  })}
                  className="w-full px-3 py-2 border rounded"
                  min="0"
                  step="0.5"
                />
              </div>
            </div>
          </div>
          
          {/* Health Goals */}
          <div>
            <h4 className="font-medium mb-3">Health Goals</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-1">Strength Challenge Target</label>
                <input 
                  type="number" 
                  value={goals.health.strengthChallengeTarget} 
                  onChange={(e) => setGoals({
                    ...goals,
                    health: {
                      ...goals.health,
                      strengthChallengeTarget: Number(e.target.value)
                    }
                  })}
                  className="w-full px-3 py-2 border rounded"
                  min="0"
                  step="10"
                />
              </div>
              
              <div>
                <label className="block text-sm mb-1">Sleep On Time (% target)</label>
                <input 
                  type="number" 
                  value={goals.health.sleepOnTimePercentage} 
                  onChange={(e) => setGoals({
                    ...goals,
                    health: {
                      ...goals.health,
                      sleepOnTimePercentage: Number(e.target.value)
                    }
                  })}
                  className="w-full px-3 py-2 border rounded"
                  min="0"
                  max="100"
                />
              </div>
            </div>
          </div>
          
          {/* Productivity Goals */}
          <div>
            <h4 className="font-medium mb-3">Productivity Goals</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-1">Language (% of days)</label>
                <input 
                  type="number" 
                  value={goals.productivity.languageDaysPercentage} 
                  onChange={(e) => setGoals({
                    ...goals,
                    productivity: {
                      ...goals.productivity,
                      languageDaysPercentage: Number(e.target.value)
                    }
                  })}
                  className="w-full px-3 py-2 border rounded"
                  min="0"
                  max="100"
                />
              </div>
              
              <div>
                <label className="block text-sm mb-1">Math (% of days)</label>
                <input 
                  type="number" 
                  value={goals.productivity.mathDaysPercentage} 
                  onChange={(e) => setGoals({
                    ...goals,
                    productivity: {
                      ...goals.productivity,
                      mathDaysPercentage: Number(e.target.value)
                    }
                  })}
                  className="w-full px-3 py-2 border rounded"
                  min="0"
                  max="100"
                />
              </div>
              
              <div>
                <label className="block text-sm mb-1">Coding (% of days)</label>
                <input 
                  type="number" 
                  value={goals.productivity.codeDaysPercentage} 
                  onChange={(e) => setGoals({
                    ...goals,
                    productivity: {
                      ...goals.productivity,
                      codeDaysPercentage: Number(e.target.value)
                    }
                  })}
                  className="w-full px-3 py-2 border rounded"
                  min="0"
                  max="100"
                />
              </div>
              
              <div>
                <label className="block text-sm mb-1">Lessons (per month)</label>
                <input 
                  type="number" 
                  value={goals.productivity.lessonsPerMonth} 
                  onChange={(e) => setGoals({
                    ...goals,
                    productivity: {
                      ...goals.productivity,
                      lessonsPerMonth: Number(e.target.value)
                    }
                  })}
                  className="w-full px-3 py-2 border rounded"
                  min="0"
                  step="0.5"
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* Auto-refresh settings */}
        <div className="mt-6 p-4 bg-gray-100 rounded">
          <h4 className="font-medium mb-3">Auto-Refresh Settings</h4>
          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input 
                type="checkbox" 
                checked={autoRefresh} 
                onChange={() => setAutoRefresh(!autoRefresh)}
                className="mr-2"
              />
              Enable Auto-Refresh
            </label>
            
            {autoRefresh && (
              <div className="flex items-center">
                <span className="mr-2">Refresh every</span>
                <input 
                  type="number" 
                  value={refreshInterval} 
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  className="w-16 px-2 py-1 border rounded"
                  min="1"
                  max="60"
                />
                <span className="ml-2">minutes</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderHistoricalChart = (metric, title, color = '#8884d8') => {
    const historicalData = getGroupedHistoricalData(metric);
    
    if (historicalData.length <= 1) {
      return (
        <div className="bg-white p-4 rounded-lg shadow text-center">
          <p>Not enough data for historical view</p>
        </div>
      );
    }
    
    return (
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={historicalData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip formatter={(value) => Math.round(value)} />
              <Area type="monotone" dataKey="value" stroke={color} fill={color} fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const renderOverview = () => {
    const metrics = getAllMetrics();
    const radarData = prepareRadarData();
    
    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Overall Progress</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} />
                  <Radar name="Progress" dataKey="A" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Key Metrics</h3>
            {renderProgressBar("Family Contact", metrics.social.family.progress)}
            {renderProgressBar("Friend Contact", metrics.social.friends.progress)}
            {renderProgressBar("Journaling", metrics.mentalHealth.journaling.progress)}
            {renderProgressBar("Meditation", metrics.mentalHealth.meditation.progress)}
            {renderProgressBar("Strength (400 Challenge)", metrics.health.strength.progress)}
            {renderProgressBar("Coding", metrics.productivity.code.progress)}
          </div>
        </div>
        
        <h3 className="text-xl font-semibold mb-4">Historical Trends</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {renderHistoricalChart('family_contact', 'Family Contact History', '#3b82f6')}
          {renderHistoricalChart('friend_contact', 'Friend Contact History', '#10b981')}
          {renderHistoricalChart('morning_journal', 'Morning Journal History', '#f59e0b')}
          {renderHistoricalChart('meditation', 'Meditation History', '#8b5cf6')}
        </div>
      </>
    );
  };

  const renderSocialTab = () => {
    const metrics = getAllMetrics().social;
    
    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Family & Friends</h3>
            {renderProgressBar("Family Contact", metrics.family.rate, 100)}
            <p className="text-sm text-gray-600 mb-4">{metrics.family.daysCount} days in selected period (Target: {Math.round(metrics.family.target)} days)</p>
            
            {renderProgressBar("Friend Contact", metrics.friends.rate, 100)}
            <p className="text-sm text-gray-600 mb-4">{metrics.friends.daysCount} days in selected period (Target: {Math.round(metrics.friends.target)} days)</p>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Kat Metrics</h3>
            {renderProgressBar("Make Kat Smile", metrics.kat.smile.rate, 100)}
            <p className="text-sm text-gray-600 mb-4">Target: Most days ({goals.social.katSmilePercentage}%)</p>
            
            {renderProgressBar("Kat Reviews", metrics.kat.review.count, metrics.kat.review.target)}
            <p className="text-sm text-gray-600 mb-4">Target: {goals.social.katReviewsPerMonth} per month</p>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <h3 className="text-lg font-semibold mb-4">New Connections</h3>
          {renderProgressBar("New Phone Numbers", metrics.newConnections.phoneNumbers.count, goals.social.newPhoneNumbersTarget)}
          <p className="text-sm text-gray-600 mb-4">Target: {goals.social.newPhoneNumbersTarget} by May</p>
          
          {renderProgressBar("Hangouts with New People", metrics.newConnections.hangouts.count, goals.social.newHangoutsTarget)}
          <p className="text-sm text-gray-600 mb-4">Target: {goals.social.newHangoutsTarget} by May</p>
        </div>
        
        <h3 className="text-xl font-semibold mb-4">Social Trends</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {renderHistoricalChart('family_contact', 'Family Contact History', '#3b82f6')}
          {renderHistoricalChart('friend_contact', 'Friend Contact History', '#10b981')}
        </div>
      </>
    );
  };

  const renderMentalHealthTab = () => {
    const metrics = getAllMetrics().mentalHealth;
    
    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Journaling</h3>
            {renderProgressBar("Morning Journal", metrics.journaling.morningRate, 100)}
            {renderProgressBar("Evening Journal", metrics.journaling.eveningRate, 100)}
            {renderProgressBar("Both Morning & Evening", metrics.journaling.bothRate, 100)}
            <p className="text-sm text-gray-600 mt-2">Target: >{goals.mentalHealth.journalingPercentage}% monthly rolling average</p>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Meditation/Prayer</h3>
            {renderProgressBar("Days with Meditation", metrics.meditation.rate, 100)}
            <p className="text-sm text-gray-600 mt-2">Target: >{goals.mentalHealth.meditationPercentage}% of days monthly rolling average</p>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <h3 className="text-lg font-semibold mb-4">Epic Activities</h3>
          {renderProgressBar("Epic Activities", metrics.epic.count, metrics.epic.target)}
          <p className="text-sm text-gray-600 mt-2">Target: At least {goals.mentalHealth.epicActivitiesPerMonth} per month</p>
        </div>
        
        <h3 className="text-xl font-semibold mb-4">Mental Health Trends</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {renderHistoricalChart('morning_journal', 'Morning Journal History', '#f59e0b')}
          {renderHistoricalChart('evening_journal', 'Evening Journal History', '#ef4444')}
          {renderHistoricalChart('meditation', 'Meditation History', '#8b5cf6')}
          {renderHistoricalChart('epic_activity', 'Epic Activities History', '#ec4899')}
        </div>
      </>
    );
  };

  const renderHealthTab = () => {
    const metrics = getAllMetrics().health;
    
    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Strength (400 Challenge)</h3>
            <div className="mb-6">
              <div className="flex justify-between mb-1">
                <span className="text-lg font-bold">Total: {metrics.strength.total}/{goals.health.strengthChallengeTarget}</span>
                <span className="text-lg font-bold">{Math.round(metrics.strength.progress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div className="bg-blue-600 h-4 rounded-full" style={{ width: `${metrics.strength.progress}%` }}></div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-medium">Pushups: {metrics.strength.pushups}</p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: `${(metrics.strength.pushups/100)*100}%` }}></div>
                </div>
              </div>
              <div>
                <p className="font-medium">Rows: {metrics.strength.rows}</p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-yellow-500 h-2 rounded-full" style={{ width: `${(metrics.strength.rows/100)*100}%` }}></div>
                </div>
              </div>
              <div>
                <p className="font-medium">Situps: {metrics.strength.situps}</p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-red-500 h-2 rounded-full" style={{ width: `${(metrics.strength.situps/100)*100}%` }}></div>
                </div>
              </div>
              <div>
                <p className="font-medium">Squats: {metrics.strength.squats}</p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${(metrics.strength.squats/100)*100}%` }}></div>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-4">Target: Complete {goals.health.strengthChallengeTarget} Challenge by May 1st</p>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Sleep</h3>
            {renderProgressBar("Bed On Time", metrics.sleep.bedOnTime.rate, 100)}
            {renderProgressBar("Up On Time", metrics.sleep.upOnTime.rate, 100)}
            <p className="text-sm text-gray-600 mt-2">Target: {goals.health.sleepOnTimePercentage}% within one hour of bedtime weekly average</p>
          </div>
        </div>
        
        <h3 className="text-xl font-semibold mb-4">Health Trends</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {renderHistoricalChart('strength_total', '400 Challenge Progress', '#3b82f6')}
          {renderHistoricalChart('sleep_on_time', 'Sleep On Time History', '#8b5cf6')}
        </div>
      </>
    );
  };

  const renderProductivityTab = () => {
    const metrics = getAllMetrics().productivity;
    
    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Language, Math & Coding</h3>
            {renderProgressBar("Language", metrics.language.rate, 100)}
            {renderProgressBar("Math", metrics.math.rate, 100)}
            {renderProgressBar("Coding", metrics.code.rate, 100)}
            <p className="text-sm text-gray-600 mt-2">Target: More than {goals.productivity.languageDaysPercentage}% of days monthly rolling average</p>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Lesson Completion</h3>
            {renderProgressBar("Lessons Completed", metrics.lessons.count, metrics.lessons.target)}
            <p className="text-sm text-gray-600 mt-2">Target: At least {goals.productivity.lessonsPerMonth} per month</p>
          </div>
        </div>
        
        <h3 className="text-xl font-semibold mb-4">Productivity Trends</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {renderHistoricalChart('language', 'Language Learning History', '#3b82f6')}
          {renderHistoricalChart('math', 'Math Study History', '#10b981')}
          {renderHistoricalChart('code', 'Coding History', '#f59e0b')}
          {renderHistoricalChart('lessons', 'Completed Lessons History', '#8b5cf6')}
        </div>
      </>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="text-center py-12">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
            <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">Loading...</span>
          </div>
          <p className="mt-4">Loading your data...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-12">
          <p className="text-red-500 mb-4">{error}</p>
          <button 
            onClick={initClient}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      );
    }

    if (!isAuthenticated) {
      return (
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-4">Connect to Google Sheets</h2>
          <p className="mb-6 text-gray-600">
            To view your Life Tracker Dashboard, connect to your Google Sheet.
          </p>
          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-4">Before connecting, please make sure:</p>
            <ul className="text-left inline-block">
              <li className="mb-2">1. You've set up the Google Sheets API in Google Cloud Console</li>
              <li className="mb-2">2. You've added your API Key and Client ID to the app configuration</li>
              <li className="mb-2">3. You've added the spreadsheet ID to the app configuration</li>
            </ul>
          </div>
          <button 
            onClick={handleAuthClick}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Connect to Google Sheets
          </button>
        </div>
      );
    }

    return (
      <>
        {renderDateRangeSelector()}
        {renderGoalSettings()}
        
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'social' && renderSocialTab()}
        {activeTab === 'mentalHealth' && renderMentalHealthTab()}
        {activeTab === 'health' && renderHealthTab()}
        {activeTab === 'productivity' && renderProductivityTab()}
      </>
    );
  };

  const renderHeader = () => {
    return (
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <h1 className="text-3xl font-bold mb-4 md:mb-0">Life Tracker Dashboard</h1>
        
        <div className="flex items-center">
          {isAuthenticated && (
            <>
              <div className="text-sm text-gray-500 mr-4">
                {lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString()}` : 'Not yet updated'}
              </div>
              <button 
                onClick={fetchSheetData} 
                className="mr-4 p-2 bg-gray-200 rounded-full hover:bg-gray-300"
                title="Refresh Data"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </>
          )}
          
          <button 
            onClick={handleAuthClick} 
            className={`px-4 py-2 ${isAuthenticated ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded`}
          >
            {isAuthenticated ? 'Disconnect' : 'Connect to Google Sheets'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {renderHeader()}
        
        {isAuthenticated && (
          <div className="mb-6">
            <div className="flex overflow-x-auto space-x-2 pb-2">
              <button 
                onClick={() => setActiveTab('overview')} 
                className={`px-4 py-2 rounded-lg ${activeTab === 'overview' ? 'bg-blue-600 text-white' : 'bg-white'}`}
              >
                Overview
              </button>
              <button 
                onClick={() => setActiveTab('social')} 
                className={`px-4 py-2 rounded-lg ${activeTab === 'social' ? 'bg-blue-600 text-white' : 'bg-white'}`}
              >
                Social
              </button>
              <button 
                onClick={() => setActiveTab('mentalHealth')} 
                className={`px-4 py-2 rounded-lg ${activeTab === 'mentalHealth' ? 'bg-blue-600 text-white' : 'bg-white'}`}
              >
                Mental Health
              </button>
              <button 
                onClick={() => setActiveTab('health')} 
                className={`px-4 py-2 rounded-lg ${activeTab === 'health' ? 'bg-blue-600 text-white' : 'bg-white'}`}
              >
                Health
              </button>
              <button 
                onClick={() => setActiveTab('productivity')} 
                className={`px-4 py-2 rounded-lg ${activeTab === 'productivity' ? 'bg-blue-600 text-white' : 'bg-white'}`}
              >
                Productivity
              </button>
            </div>
          </div>
        )}
        
        {renderContent()}
      </div>
    </div>
  );
};

export default LifeTrackerDashboard;