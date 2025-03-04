import React, { useState, useEffect, useCallback } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
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
  const [dateRange] = useState('all'); // Using 'all' as default to show all data
  
  // Goals customization state
  const [showGoalSettings, setShowGoalSettings] = useState(false);
  const [goals, setGoals] = useState(() => {
    const savedGoals = localStorage.getItem('lifeTrackerGoals');
    return savedGoals ? JSON.parse(savedGoals) : {
      social: {
        familyContactDaysPerWeek: {
          value: 3,
          description: "Talk to family at least 3 days per week",
          targetDate: "rolling", // Monthly rolling average
          category: "Maintain connections"
        },
        friendContactDaysPerWeek: {
          value: 2,
          description: "Talk to old friends at least 2 days per week",
          targetDate: "rolling", // Monthly rolling average
          category: "Maintain connections"
        },
        katSmilePercentage: {
          value: 70,
          description: "Did something nice for Kat most days",
          targetDate: "rolling", // No specific deadline
          category: "Kat"
        },
        katReviewsPerMonth: {
          value: 4,
          description: "Do a review with Kat at least once per week",
          targetDate: "rolling", // Weekly 
          category: "Kat"
        },
        newPhoneNumbersTarget: {
          value: 5,
          description: "Get 5 new phone numbers by May",
          targetDate: "2025-05-01", // By May 2025
          category: "Make friends"
        },
        newHangoutsTarget: {
          value: 2,
          description: "Hang out with at least 2 new people by May",
          targetDate: "2025-05-01", // By May 2025
          category: "Make friends"
        }
      },
      wellbeing: {
        journalingPercentage: {
          value: 60,
          description: "Journal morning and night >60% of days",
          targetDate: "rolling", // Monthly rolling average
          category: "Journaling"
        },
        meditationPercentage: {
          value: 50,
          description: "Meditation/prayer >50% of days",
          targetDate: "rolling", // Monthly rolling average
          category: "Meditation/Prayer"
        },
        epicActivitiesPerMonth: {
          value: 4,
          description: "Something epic at least once per week",
          targetDate: "rolling", // Monthly rolling average
          category: "Do epic shit"
        }
      },
      health: {
        strengthChallengeTarget: {
          value: 400,
          description: "400 challenge by May 1st",
          targetDate: "2025-05-01", // By May 1st 2025
          category: "Strength"
        },
        ax1Target: {
          value: 100,
          description: "Finish AX1 by Jan 1 2026",
          targetDate: "2026-01-01", // By Jan 1st 2026
          category: "Strength"
        },
        climbBoulderTarget: {
          value: 6,
          description: "Climb v6 boulder by April 1st",
          targetDate: "2025-04-01", // By April 1st 2025
          category: "Climbing"
        },
        climbOutsideTarget: {
          value: 12,
          description: "Climb 5.12 outside by 2027",
          targetDate: "2027-01-01", // By 2027
          category: "Climbing"
        },
        run10KTarget56: {
          value: 56,
          description: "Run 56 minute 10K by June",
          targetDate: "2025-06-01", // By June 2025
          category: "Running"
        },
        run10KTarget52: {
          value: 52,
          description: "Run a 52 minute 10K by 2026",
          targetDate: "2026-01-01", // By 2026
          category: "Running"
        },
        vo2MaxTarget: {
          value: 53,
          description: "VO2 max above 53 in Denver by 2026",
          targetDate: "2026-01-01", // By 2026
          category: "Running"
        },
        cholesterolTarget: {
          value: 150,
          description: "Cholesterol < 150 by end of year",
          targetDate: "2025-12-31", // By end of 2025
          category: "Direct metrics"
        },
        hdlTarget: {
          value: 60,
          description: "HDL > 60 by end of year",
          targetDate: "2025-12-31", // By end of 2025
          category: "Direct metrics"
        },
        bpTarget: {
          value: "120/80",
          description: "BP monthly rolling average < 120/80",
          targetDate: "2025-12-31", // By 2025
          category: "Direct metrics"
        },
        sleepOnTimePercentage: {
          value: 90,
          description: "90% within one hour of bedtime weekly average by 2025",
          targetDate: "2025-12-31", // By 2025
          category: "Sleep"
        }
      },
      productivity: {
        languageDaysPercentage: {
          value: 50,
          description: "Language practice >50% of days",
          targetDate: "rolling", // Monthly rolling average
          category: "Learning"
        },
        mathDaysPercentage: {
          value: 50,
          description: "Math practice >50% of days",
          targetDate: "rolling", // Monthly rolling average
          category: "Learning"
        },
        codeDaysPercentage: {
          value: 50,
          description: "Coding practice >50% of days",
          targetDate: "rolling", // Monthly rolling average
          category: "Learning"
        },
        lessonsPerMonth: {
          value: 4,
          description: "Complete at least one lesson per week",
          targetDate: "rolling", // Monthly rolling average
          category: "Learning"
        }
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

  // Initialize the Google API client with new Google Identity Services
  useEffect(() => {
    // For browser debugging
    window.clearToken = () => {
      localStorage.removeItem('gapi_token');
      console.log("Token cleared from localStorage");
    };
    
    const loadGoogleAPI = async () => {
      console.log("Starting Google API loading process");
      
      // First load the gapi.client for API calls
      const gapiScript = document.createElement('script');
      gapiScript.src = 'https://apis.google.com/js/api.js';
      gapiScript.async = true;
      gapiScript.defer = true;
      document.body.appendChild(gapiScript);
      
      // Wait for gapi to load
      await new Promise((resolve) => {
        gapiScript.onload = () => {
          console.log("GAPI script loaded");
          resolve();
        };
      });
      
      // Now load the new Google Identity Services
      const gisScript = document.createElement('script');
      gisScript.src = 'https://accounts.google.com/gsi/client';
      gisScript.async = true;
      gisScript.defer = true;
      document.body.appendChild(gisScript);
      
      gisScript.onload = () => {
        console.log("GIS script loaded");
        initClient();
      };
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

  const initClient = async () => {
    setIsLoading(true);
    try {
      console.log("Initializing client...");
      
      // Initialize gapi.client
      await new Promise((resolve, reject) => {
        window.gapi.load('client', {
          callback: () => {
            console.log("GAPI client loaded");
            resolve();
          },
          onerror: (err) => {
            console.error("Error loading GAPI client:", err);
            reject(err);
          }
        });
      });
      
      // Initialize the client with API key and discoveryDocs
      console.log("Initializing GAPI client with API key and discovery docs");
      await window.gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: DISCOVERY_DOCS,
      });
      console.log("GAPI client initialized successfully");
      
      // Let's directly go for auth - don't try to restore from localStorage
      // It seems that approach wasn't working correctly
      
      // Initialize Google Identity Services
      console.log("Setting up token client");
      window.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse) => {
          console.log("Token client callback received", 
                    tokenResponse.error ? "with error" : "successfully");
          
          if (tokenResponse.error) {
            console.error("Auth error details:", tokenResponse);
            setError('Error authenticating: ' + tokenResponse.error);
            setIsAuthenticated(false);
          } else {
            console.log("Authentication successful");
            setIsAuthenticated(true);
            
            // First check if we can load the Sheets API
            if (window.gapi.client.getToken() && !window.gapi.client.sheets) {
              console.log("Loading sheets API...");
              window.gapi.client.load('sheets', 'v4')
                .then(() => {
                  console.log("Sheets API loaded, fetching data");
                  fetchSheetData();
                })
                .catch(err => {
                  console.error("Error loading sheets API:", err);
                  setError('Error loading Google Sheets API: ' + err.message);
                });
            } else {
              console.log("Sheets API already available, fetching data");
              fetchSheetData();
            }
          }
          setIsLoading(false);
        }
      });
      
      // Check if we're already signed in
      console.log("Checking for existing authentication");
      const hasToken = window.gapi.client.getToken() !== null;
      console.log("Has existing token:", hasToken);
      
      if (hasToken) {
        console.log("User is already authenticated");
        setIsAuthenticated(true);
        
        // Make sure sheets API is loaded
        if (!window.gapi.client.sheets) {
          console.log("Loading sheets API for existing session...");
          await window.gapi.client.load('sheets', 'v4');
          console.log("Sheets API loaded for existing session");
        }
        
        fetchSheetData();
      } else {
        console.log("No existing authentication, user will need to sign in");
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Init client error:", error);
      setError('Error initializing Google API client: ' + error.message);
      setIsLoading(false);
    }
  };

  const handleAuthClick = () => {
    if (window.gapi.client.getToken() !== null) {
      // User is signed in, so sign out
      window.google.accounts.oauth2.revoke(window.gapi.client.getToken().access_token, () => {
        window.gapi.client.setToken(null);
        localStorage.removeItem('gapi_token');
        setIsAuthenticated(false);
        setData([]);
      });
    } else {
      // User is not signed in, so sign in
      window.tokenClient.requestAccessToken();
    }
  };

  const fetchSheetData = () => {
    console.log("Fetching sheet data...");
    setIsLoading(true);
    
    // Safety check
    if (!window.gapi?.client?.getToken || !window.gapi?.client?.sheets) {
      console.error("Cannot fetch data: Google API not properly initialized");
      console.log("GAPI client state:", window.gapi?.client ? "exists" : "missing");
      console.log("Sheets API state:", window.gapi?.client?.sheets ? "exists" : "missing");
      console.log("GetToken function state:", window.gapi?.client?.getToken ? "exists" : "missing");
      
      setError('API initialization error: Please reload the page and reconnect');
      setIsLoading(false);
      return;
    }
    
    // Token check
    if (!window.gapi.client.getToken()) {
      console.error("Cannot fetch data: No authentication token");
      setError('Authentication required: Please connect to Google Sheets');
      setIsLoading(false);
      return;
    }
    
    console.log(`Requesting data from spreadsheet: ${SPREADSHEET_ID}, sheet: ${SHEET_NAME}`);
    
    window.gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:AZ` // This will fetch all columns
    }).then(response => {
      console.log("Received sheet data response");
      
      const range = response.result;
      if (range.values && range.values.length > 0) {
        // Process the data - first row contains headers
        const headers = range.values[0];
        const rows = range.values.slice(1);
        
        console.log(`Successfully loaded ${rows.length} data rows from sheet`);
        
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
        
        // Clear any previous errors
        setError(null);
      } else {
        console.warn("No data found in the sheet or empty response");
        console.log("Response content:", range);
        setError('No data found in the spreadsheet or invalid format.');
      }
      setIsLoading(false);
    }).catch(error => {
      console.error("Sheet data fetch error:", error);
      console.log("Error details:", JSON.stringify(error, null, 2));
      
      // Check if it's an authentication error
      if (error.status === 401 || error.status === 403 || 
          (error.result && error.result.error && 
           (error.result.error.status === 'UNAUTHENTICATED' || 
            error.result.error.status === 'PERMISSION_DENIED'))) {
            
        console.log("Authentication error detected, resetting auth state");
        setIsAuthenticated(false);
        setError('Authentication error: Please reconnect to Google Sheets');
      } else {
        setError('Error fetching sheet data: ' + (error.result?.error?.message || error.message || 'Unknown error'));
      }
      
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
    const allData = data; // Use all data regardless of date range
    if (allData.length === 0) return [];
    
    // We'll group by month for a cleaner view of long-term trends
    const groupKey = entry => `${entry.year}-${entry.month.toString().padStart(2, '0')}`;
    
    // Group the data
    const groupedEntries = _.groupBy(allData, groupKey);
    
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
  }, [data]);

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
      case 'epic_activity': {
        // Some entries may have a number in epic_activity (column label is "hours_soc_media")
        // and others have "Yes"/"No", so handle both
        const epicCount = entries.filter(e => {
          return e.epic_activity === 'Yes' || 
                 (e.epic_activity && e.epic_activity !== 'No' && parseInt(e.epic_activity) > 0);
        }).length;
        return (epicCount / entries.length) * 100;
      }
      case 'strength_total': {
        // Check for entries that have the "400" column as "Yes" or strength as "Yes"
        const strengthEntries = entries.filter(e => e['400'] === 'Yes' || e.strength === 'Yes');
        if (strengthEntries.length === 0) return 0;
        
        // Get the most recent strength entry for the period
        const latestStrength = strengthEntries[strengthEntries.length - 1];
        const total = (
          parseInt(latestStrength.pushups || 0) + 
          parseInt(latestStrength.rows || 0) + 
          parseInt(latestStrength.situps || 0) + 
          parseInt(latestStrength.squats || 0)
        );
        
        // Handle NaN case
        return isNaN(total) ? 0 : total;
      }
      case 'sleep_on_time':
        return (entries.filter(e => e.bed_on_time === 'Yes').length / entries.length) * 100;
      case 'language': {
        // Handle both "Yes"/"No" and presence of data in the language column
        const langCount = entries.filter(e => {
          return e.language === 'Yes' || 
                 (e.language && e.language !== 'No' && e.language !== '');
        }).length;
        return (langCount / entries.length) * 100;
      }
      case 'math':
        return (entries.filter(e => e.math === 'Yes').length / entries.length) * 100;
      case 'code':
        return (entries.filter(e => e.code === 'Yes').length / entries.length) * 100;
      case 'lessons':
        return (entries.filter(e => e.complete_lesson === 'Yes').length / entries.length) * 100;
      case 'vibes': {
        // Calculate average vibes (assuming it's a numeric field)
        const validEntries = entries.filter(e => e.vibes && !isNaN(parseInt(e.vibes)));
        if (validEntries.length === 0) return 0;
        
        const total = validEntries.reduce((sum, entry) => sum + parseInt(entry.vibes), 0);
        return total / validEntries.length;
      }
      case 'cardio': {
        // Calculate percentage of days with cardio
        return (entries.filter(e => e.cardio === 'Yes').length / entries.length) * 100;
      }
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
      progress: (totalRate / goals.wellbeing.journalingPercentage) * 100
    };
  }, [getFilteredData, goals.wellbeing.journalingPercentage]);

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
      progress: (rate / goals.wellbeing.meditationPercentage) * 100
    };
  }, [getFilteredData, goals.wellbeing.meditationPercentage]);

  // Calculate 400 challenge progress based on the most recent attempt
  const calculate400ChallengeProgress = useCallback(() => {
    const filteredData = getFilteredData();
    if (filteredData.length === 0) return { total: 0, progress: 0 };
    
    // Get the most recent entry where the 400 challenge was attempted
    const challengeEntries = filteredData.filter(entry => entry.strength === "Yes");
    if (challengeEntries.length === 0) return { total: 0, progress: 0 };
    
    const latestEntry = challengeEntries[challengeEntries.length - 1];
    
    // Get the individual exercises (not cumulative)
    const pushups = parseInt(latestEntry.pushups || 0);
    const rows = parseInt(latestEntry.rows || 0);
    const situps = parseInt(latestEntry.situps || 0);
    const squats = parseInt(latestEntry.squats || 0);
    
    const total = pushups + rows + situps + squats;
    
    return {
      total: total,
      pushups: pushups,
      rows: rows,
      situps: situps,
      squats: squats,
      progress: (total / goals.health.strengthChallengeTarget.value) * 100
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
    const targetEpicDays = goals.wellbeing.epicActivitiesPerMonth * monthsInPeriod;
    
    return {
      count: epicDays,
      target: targetEpicDays,
      progress: (epicDays / targetEpicDays) * 100
    };
  }, [getFilteredData, goals.wellbeing.epicActivitiesPerMonth]);

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

  // Calculate vibes metrics based on filtered data
  const calculateVibesMetrics = useCallback(() => {
    const filteredData = getFilteredData();
    if (filteredData.length === 0) return { average: 0, count: 0 };
    
    // Filter entries with valid vibes data
    const validEntries = filteredData.filter(entry => 
      entry.vibes && !isNaN(parseInt(entry.vibes))
    );
    
    if (validEntries.length === 0) return { average: 0, count: 0 };
    
    // Calculate total and average
    const total = validEntries.reduce((sum, entry) => sum + parseInt(entry.vibes), 0);
    const average = total / validEntries.length;
    
    return {
      average: average,
      count: validEntries.length
    };
  }, [getFilteredData]);
  
  // Calculate cardio metrics based on filtered data
  const calculateCardioMetrics = useCallback(() => {
    const filteredData = getFilteredData();
    if (filteredData.length === 0) return { rate: 0, count: 0 };
    
    const cardioEntries = filteredData.filter(entry => entry.cardio === 'Yes');
    const rate = (cardioEntries.length / filteredData.length) * 100;
    
    // Calculate total miles
    const totalMiles = cardioEntries.reduce((sum, entry) => {
      const miles = parseFloat(entry.miles || 0);
      return sum + (isNaN(miles) ? 0 : miles);
    }, 0);
    
    return {
      rate: rate,
      count: cardioEntries.length,
      totalMiles: totalMiles,
      averageMiles: cardioEntries.length > 0 ? totalMiles / cardioEntries.length : 0
    };
  }, [getFilteredData]);

  // Compile all metrics for overview
  const getAllMetrics = useCallback(() => {
    return {
      social: {
        family: calculateFamilyContactRate(),
        friends: calculateFriendContactRate(),
        kat: calculateKatMetrics(),
        newConnections: getNewConnectionsMetrics(),
        vibes: calculateVibesMetrics()
      },
      wellbeing: {
        journaling: calculateJournalingRate(),
        meditation: calculateMeditationRate(),
        epic: getEpicActivityCount()
      },
      health: {
        strength: calculate400ChallengeProgress(),
        sleep: calculateSleepMetrics(),
        cardio: calculateCardioMetrics()
      },
      productivity: calculateProductivityMetrics()
    };
  }, [
    calculateFamilyContactRate, 
    calculateFriendContactRate, 
    calculateKatMetrics, 
    getNewConnectionsMetrics,
    calculateVibesMetrics,
    calculateJournalingRate,
    calculateMeditationRate,
    getEpicActivityCount,
    calculate400ChallengeProgress,
    calculateSleepMetrics,
    calculateCardioMetrics,
    calculateProductivityMetrics
  ]);

  // Helper function to safely access nested properties
  const safeGet = (obj, path, defaultValue = 0) => {
    try {
      const parts = path.split('.');
      let result = obj;
      for (const part of parts) {
        if (result === undefined || result === null) return defaultValue;
        result = result[part];
      }
      return result === undefined || result === null || isNaN(result) ? defaultValue : result;
    } catch (e) {
      console.warn(`Error accessing path ${path}:`, e);
      return defaultValue;
    }
  };

  // Function to calculate projections for each goal
  const calculateProjections = useCallback(() => {
    const metrics = getAllMetrics();
    const now = new Date();
    const projections = {};
    
    // Helper to calculate days between two dates
    const daysBetween = (date1, date2) => {
      return Math.round(Math.abs((date1 - date2) / (24 * 60 * 60 * 1000)));
    };
    
    // Helper to parse date from string
    const parseDate = (dateStr) => {
      if (!dateStr || dateStr === 'rolling') return null;
      return new Date(dateStr);
    };
    
    // Process each category of goals
    Object.entries(goals).forEach(([category, categoryGoals]) => {
      projections[category] = {};
      
      Object.entries(categoryGoals).forEach(([goalKey, goalData]) => {
        const targetDate = parseDate(goalData.targetDate);
        
        // Skip goals without a target date
        if (!targetDate) {
          projections[category][goalKey] = {
            isRolling: true,
            targetValue: goalData.value,
            description: goalData.description,
            category: goalData.category
          };
          return;
        }
        
        const daysUntilTarget = daysBetween(now, targetDate);
        let currentValue = 0;
        let rateOfProgress = 0;
        let daysOfData = 30; // Default to a month
        let projectedCompletion = null;
        let isOnTrack = false;
        
        // Get current value based on goal type
        switch(goalKey) {
          case 'strengthChallengeTarget':
            currentValue = safeGet(metrics, 'health.strength.total', 0);
            break;
          case 'newPhoneNumbersTarget':
            currentValue = safeGet(metrics, 'social.newConnections.phoneNumbers.count', 0);
            break;
          case 'newHangoutsTarget':
            currentValue = safeGet(metrics, 'social.newConnections.hangouts.count', 0);
            break;
          default:
            // For rolling metrics, we use the progress value directly
            if (goalData.targetDate === 'rolling') {
              switch(category) {
                case 'social':
                  if (goalKey === 'familyContactDaysPerWeek') {
                    currentValue = safeGet(metrics, 'social.family.daysCount', 0);
                  } else if (goalKey === 'friendContactDaysPerWeek') {
                    currentValue = safeGet(metrics, 'social.friends.daysCount', 0);
                  } else if (goalKey === 'katSmilePercentage') {
                    currentValue = safeGet(metrics, 'social.kat.smile.rate', 0);
                  } else if (goalKey === 'katReviewsPerMonth') {
                    currentValue = safeGet(metrics, 'social.kat.review.count', 0);
                  }
                  break;
                case 'wellbeing':
                  if (goalKey === 'journalingPercentage') {
                    currentValue = safeGet(metrics, 'wellbeing.journaling.totalRate', 0);
                  } else if (goalKey === 'meditationPercentage') {
                    currentValue = safeGet(metrics, 'wellbeing.meditation.rate', 0);
                  } else if (goalKey === 'epicActivitiesPerMonth') {
                    currentValue = safeGet(metrics, 'wellbeing.epic.count', 0);
                  }
                  break;
                case 'productivity':
                  if (goalKey === 'languageDaysPercentage') {
                    currentValue = safeGet(metrics, 'productivity.language.rate', 0);
                  } else if (goalKey === 'mathDaysPercentage') {
                    currentValue = safeGet(metrics, 'productivity.math.rate', 0);
                  } else if (goalKey === 'codeDaysPercentage') {
                    currentValue = safeGet(metrics, 'productivity.code.rate', 0);
                  } else if (goalKey === 'lessonsPerMonth') {
                    currentValue = safeGet(metrics, 'productivity.lessons.count', 0);
                  }
                  break;
                case 'health':
                  if (goalKey === 'sleepOnTimePercentage') {
                    currentValue = safeGet(metrics, 'health.sleep.bedOnTime.rate', 0);
                  }
                  break;
              }
              
              projections[category][goalKey] = {
                isRolling: true,
                targetValue: goalData.value,
                currentValue: currentValue,
                description: goalData.description,
                category: goalData.category,
                progress: (currentValue / goalData.value) * 100
              };
              return;
            }
        }
        
        // Calculate rate of progress - if we have at least 2 data points
        const historicalData = getFilteredData();
        if (historicalData.length >= 2) {
          daysOfData = daysBetween(
            new Date(historicalData[0].date), 
            new Date(historicalData[historicalData.length - 1].date)
          );
          
          // Use specific calculations for different goal types
          if (daysOfData > 0) {
            // Different rate calculations by goal type
            switch(goalKey) {
              case 'strengthChallengeTarget':
                // For strength, use recent gains or average workout increases
                const strengthEntries = historicalData.filter(e => e['400'] === 'Yes' || e.strength === 'Yes');
                if (strengthEntries.length >= 2) {
                  const firstStrength = strengthEntries[0];
                  const lastStrength = strengthEntries[strengthEntries.length - 1];
                  const firstTotal = 
                    (parseInt(firstStrength.pushups || 0) || 0) + 
                    (parseInt(firstStrength.rows || 0) || 0) + 
                    (parseInt(firstStrength.situps || 0) || 0) + 
                    (parseInt(firstStrength.squats || 0) || 0);
                  
                  const lastTotal = 
                    (parseInt(lastStrength.pushups || 0) || 0) + 
                    (parseInt(lastStrength.rows || 0) || 0) + 
                    (parseInt(lastStrength.situps || 0) || 0) + 
                    (parseInt(lastStrength.squats || 0) || 0);
                  
                  const strengthDays = daysBetween(
                    new Date(firstStrength.date), 
                    new Date(lastStrength.date)
                  );
                  
                  if (strengthDays > 0) {
                    rateOfProgress = (lastTotal - firstTotal) / strengthDays;
                  }
                }
                break;
                
              case 'newPhoneNumbersTarget':
              case 'newHangoutsTarget':
                // For counting metrics, use count divided by days
                rateOfProgress = currentValue / daysOfData;
                break;
                
              default:
                // Default rate of progress
                rateOfProgress = 0;
            }
          }
        }
        
        // Calculate projected completion date for non-rolling goals
        if (rateOfProgress > 0) {
          const remainingProgress = goalData.value - currentValue;
          const daysToComplete = Math.ceil(remainingProgress / rateOfProgress);
          projectedCompletion = new Date(now.getTime() + (daysToComplete * 24 * 60 * 60 * 1000));
          
          // Check if on track
          isOnTrack = projectedCompletion <= targetDate;
        } else {
          // If no progress rate, project using available time and remaining work
          const targetValue = goalData.value;
          const neededRate = (targetValue - currentValue) / daysUntilTarget;
          // Consider on track if needed rate is very low or we've already met the goal
          isOnTrack = neededRate <= 0.1 || currentValue >= targetValue;
        }
        
        projections[category][goalKey] = {
          currentValue: currentValue,
          targetValue: goalData.value,
          targetDate: targetDate,
          daysUntilTarget: daysUntilTarget,
          rateOfProgress: rateOfProgress,
          projectedCompletion: projectedCompletion,
          isOnTrack: isOnTrack,
          description: goalData.description,
          category: goalData.category,
          progress: (currentValue / goalData.value) * 100
        };
      });
    });
    
    return projections;
  }, [getAllMetrics, getFilteredData, goals]);

  // New function for goal-centric data organization
  const organizeGoalsByCategory = useCallback(() => {
    const projections = calculateProjections();
    const organizedGoals = {};
    
    // First pass - collect goals by their category
    Object.entries(projections).forEach(([mainType, typeGoals]) => {
      Object.entries(typeGoals).forEach(([goalKey, goalData]) => {
        const category = goalData.category;
        
        if (!organizedGoals[category]) {
          organizedGoals[category] = [];
        }
        
        organizedGoals[category].push({
          id: goalKey,
          mainType: mainType,
          ...goalData
        });
      });
    });
    
    return organizedGoals;
  }, [calculateProjections]);


  const renderProgressBar = (label, value, target = 100) => {
    // Add null checks
    const safeValue = (value === undefined || value === null || isNaN(value)) ? 0 : value;
    const safeTarget = (target === undefined || target === null || isNaN(target)) ? 100 : target;
    const progress = Math.min(100, (safeValue / safeTarget) * 100);
    
    return (
      <div className="mb-4">
        <div className="flex justify-between mb-1">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-sm font-medium">{Math.round(safeValue)}%</span>
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

  const renderDashboardHeader = () => {
    return null;
  };
  
  const renderDashboardFooter = () => {
    return (
      <div className="mt-6 bg-white rounded-lg p-4 shadow border border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            {lastUpdated && (
              <div className="text-xs text-gray-500">
                Last updated: {lastUpdated.toLocaleString()}
              </div>
            )}
          </div>
          <button
            onClick={() => setShowGoalSettings(!showGoalSettings)}
            className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
          >
            {showGoalSettings ? 'Hide Goal Settings' : 'Customize Goals'}
          </button>
        </div>
      </div>
    );
  };

  // Helper function to update a goal value
  const updateGoalValue = (category, goalKey, newValue) => {
    setGoals(prevGoals => {
      const updatedGoals = { ...prevGoals };
      updatedGoals[category][goalKey].value = newValue;
      return updatedGoals;
    });
  };
  
  // Helper to update goal target date
  const updateGoalDate = (category, goalKey, newDate) => {
    setGoals(prevGoals => {
      const updatedGoals = { ...prevGoals };
      updatedGoals[category][goalKey].targetDate = newDate;
      return updatedGoals;
    });
  };

  // Render goal settings
  const renderGoalSettings = () => {
    if (!showGoalSettings) return null;

    // Organize goals by their actual categories
    const categorizedGoals = {};
    
    // Process each category type
    Object.entries(goals).forEach(([mainType, typeGoals]) => {
      Object.entries(typeGoals).forEach(([goalKey, goalData]) => {
        const category = goalData.category;
        
        if (!categorizedGoals[category]) {
          categorizedGoals[category] = [];
        }
        
        categorizedGoals[category].push({
          id: goalKey,
          mainType,
          ...goalData
        });
      });
    });
    
    return (
      <div className="mb-6 bg-white rounded-lg p-4 shadow border border-gray-200">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold">Customize Your Goals</h3>
          <button
            onClick={() => setShowGoalSettings(false)}
            className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm"
          >
            Close
          </button>
        </div>
        
        {/* Display goals by their category */}
        {Object.entries(categorizedGoals).map(([category, categoryGoals]) => (
          <div key={category} className="mb-8">
            <h4 className="font-medium text-lg mb-4 pb-2 border-b">{category}</h4>
            
            <div className="space-y-4">
              {categoryGoals.map(goal => (
                <div key={goal.id} className="p-3 border rounded bg-gray-50">
                  <div className="font-medium mb-2">{goal.description}</div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm mb-1">Target Value</label>
                      <input 
                        type="number" 
                        value={goal.value} 
                        onChange={(e) => updateGoalValue(
                          goal.mainType, 
                          goal.id, 
                          Number(e.target.value)
                        )}
                        className="w-full px-3 py-2 border rounded"
                        min="0"
                        step={goal.id.includes("Percentage") ? "5" : "1"}
                      />
                    </div>
                    
                    {goal.targetDate !== "rolling" && (
                      <div>
                        <label className="block text-sm mb-1">Target Date</label>
                        <input 
                          type="date" 
                          value={goal.targetDate ? goal.targetDate.split('T')[0] : ""}
                          onChange={(e) => updateGoalDate(
                            goal.mainType, 
                            goal.id, 
                            e.target.value
                          )}
                          className="w-full px-3 py-2 border rounded"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        
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
    
    // Format the x-axis labels for better readability
    const formatXAxis = (period) => {
      // For YYYY-MM format, convert to MMM YY
      const parts = period.split('-');
      if (parts.length === 2) {
        const year = parts[0];
        const month = parseInt(parts[1], 10);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[month - 1]} ${year.slice(2)}`;
      }
      return period;
    };
    
    return (
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={historicalData} margin={{ top: 5, right: 20, bottom: 30, left: 0 }}>
              <defs>
                <linearGradient id={`gradient-${metric}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.8}/>
                  <stop offset="95%" stopColor={color} stopOpacity={0.2}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="period" 
                tickFormatter={formatXAxis} 
                tick={{ fontSize: 12, fill: '#666' }}
                angle={-45}
                textAnchor="end"
                height={50}
              />
              <YAxis 
                domain={[0, 100]} 
                tick={{ fontSize: 12, fill: '#666' }}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip 
                formatter={(value) => [`${Math.round(value)}%`, title]} 
                labelFormatter={formatXAxis}
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  borderRadius: '5px',
                  padding: '10px',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.15)'
                }}
              />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke={color} 
                fill={`url(#gradient-${metric})`} 
                strokeWidth={2}
                activeDot={{ r: 6, strokeWidth: 0, fill: color }}
                isAnimationActive={true}
                animationDuration={1000}
                animationEasing="ease"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  // New component for rendering a goal progress bar
  const GoalProgressBar = ({ goal }) => {
    // Handle different types of goals
    const isRolling = goal.isRolling;
    const progress = goal.progress || 0;
    
    // Format date if available
    const formatDate = (date) => {
      if (!date) return 'N/A';
      return new Date(date).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    };
    
    return (
      <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm mb-3">
        <div className="flex justify-between items-start mb-2">
          <h4 className="text-md font-medium">{goal.description}</h4>
          <div className="text-sm text-right">
            {!isRolling && (
              <div className={`font-bold ${goal.isOnTrack ? 'text-green-600' : 'text-red-500'}`}>
                {goal.isOnTrack ? 'On Track' : 'Off Track'}
              </div>
            )}
          </div>
        </div>
        
        <div className="mb-2">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm">
              Current: {goal.currentValue !== undefined ? Math.round(goal.currentValue) : '?'}
            </span>
            <span className="text-sm">
              Target: {goal.targetValue}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className={`h-2.5 rounded-full ${
                progress >= 100 ? 'bg-green-500' : 
                progress >= 75 ? 'bg-blue-500' : 
                progress >= 50 ? 'bg-yellow-500' : 
                progress >= 25 ? 'bg-orange-500' : 
                'bg-red-500'
              }`} 
              style={{ width: `${Math.min(100, progress)}%` }}
            ></div>
          </div>
        </div>
        
        {!isRolling && (
          <div className="text-xs text-gray-600 mt-1">
            <div className="flex justify-between">
              <span>Target date: {formatDate(goal.targetDate)}</span>
              <span>{Math.round(goal.daysUntilTarget)} days left</span>
            </div>
            {goal.projectedCompletion && (
              <div className="flex justify-between mt-1">
                <span>Projected completion: </span>
                <span className={goal.isOnTrack ? "text-green-600" : "text-red-500"}>
                  {formatDate(goal.projectedCompletion)}
                </span>
              </div>
            )}
            {goal.rateOfProgress > 0 && (
              <div className="mt-1">
                Current rate: {goal.rateOfProgress.toFixed(2)} per day
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // New component for a category of goals
  const GoalCategory = ({ title, goals }) => {
    return (
      <div className="mb-8">
        <h3 className="text-xl font-semibold mb-4 border-b pb-2">{title}</h3>
        <div>
          {goals.map(goal => (
            <GoalProgressBar key={goal.id} goal={goal} />
          ))}
        </div>
      </div>
    );
  };

  const renderOverview = () => {
    const metrics = getAllMetrics();
    
    // Calculate average progress for each area
    const calculateAreaProgress = (area) => {
      let progress = 0;
      let count = 0;
      
      if (area === 'social') {
        progress += safeGet(metrics, 'social.family.progress', 0);
        progress += safeGet(metrics, 'social.friends.progress', 0);
        progress += safeGet(metrics, 'social.kat.smile.progress', 0);
        progress += safeGet(metrics, 'social.kat.review.progress', 0);
        progress += safeGet(metrics, 'social.newConnections.phoneNumbers.progress', 0);
        progress += safeGet(metrics, 'social.newConnections.hangouts.progress', 0);
        count = 6;
      } else if (area === 'wellbeing') {
        progress += safeGet(metrics, 'wellbeing.journaling.progress', 0);
        progress += safeGet(metrics, 'wellbeing.meditation.progress', 0);
        progress += safeGet(metrics, 'wellbeing.epic.progress', 0);
        count = 3;
      } else if (area === 'health') {
        progress += safeGet(metrics, 'health.strength.progress', 0);
        progress += safeGet(metrics, 'health.sleep.bedOnTime.progress', 0);
        count = 2;
      } else if (area === 'productivity') {
        progress += safeGet(metrics, 'productivity.language.progress', 0);
        progress += safeGet(metrics, 'productivity.math.progress', 0);
        progress += safeGet(metrics, 'productivity.code.progress', 0);
        progress += safeGet(metrics, 'productivity.lessons.progress', 0);
        count = 4;
      }
      
      return count > 0 ? progress / count : 0;
    };
    
    const socialProgress = calculateAreaProgress('social');
    const wellbeingProgress = calculateAreaProgress('wellbeing');
    const healthProgress = calculateAreaProgress('health');
    const productivityProgress = calculateAreaProgress('productivity');
    
    return (
      <div className="p-4">
        <h2 className="text-2xl font-bold mb-6">Life Balance Dashboard</h2>
        
        {/* Progress bars for each life area */}
        <div className="bg-white rounded-lg p-4 shadow-sm mb-6">
          <h3 className="text-lg font-semibold mb-4">Life Areas Progress</h3>
          
          <div className="space-y-5">
            <div>
              <div className="flex justify-between mb-1">
                <span className="font-medium">Social</span>
                <span>{Math.round(socialProgress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="h-3 rounded-full" 
                  style={{ 
                    width: `${Math.min(100, socialProgress)}%`,
                    backgroundColor: '#3B82F6' // blue-500
                  }}
                ></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between mb-1">
                <span className="font-medium">Wellbeing</span>
                <span>{Math.round(wellbeingProgress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="h-3 rounded-full" 
                  style={{ 
                    width: `${Math.min(100, wellbeingProgress)}%`,
                    backgroundColor: '#8B5CF6' // purple-500
                  }}
                ></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between mb-1">
                <span className="font-medium">Health</span>
                <span>{Math.round(healthProgress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="h-3 rounded-full" 
                  style={{ 
                    width: `${Math.min(100, healthProgress)}%`,
                    backgroundColor: '#10B981' // emerald-500
                  }}
                ></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between mb-1">
                <span className="font-medium">Productivity</span>
                <span>{Math.round(productivityProgress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="h-3 rounded-full" 
                  style={{ 
                    width: `${Math.min(100, productivityProgress)}%`,
                    backgroundColor: '#F59E0B' // amber-500
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Summary metrics */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Overall Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-600">Goals On Track</div>
              <div className="text-2xl font-bold text-green-600">
                {Math.round(
                  (socialProgress >= 50 ? 1 : 0) + 
                  (wellbeingProgress >= 50 ? 1 : 0) + 
                  (healthProgress >= 50 ? 1 : 0) + 
                  (productivityProgress >= 50 ? 1 : 0)
                )}
                <span className="text-sm text-gray-500">/4</span>
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Overall Balance</div>
              <div className="text-2xl font-bold text-blue-600">
                {Math.round((socialProgress + wellbeingProgress + healthProgress + productivityProgress) / 4)}%
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSocialTab = () => {
    const metrics = getAllMetrics().social;
    const organizedGoals = organizeGoalsByCategory();
    const socialGoals = Object.entries(organizedGoals)
      .filter(([category]) => category === "Maintain connections" || category === "Kat" || category === "Make friends")
      .reduce((acc, [category, goals]) => {
        acc[category] = goals;
        return acc;
      }, {});
    
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
            {renderProgressBar("Did Something Nice for Kat", metrics.kat.smile.rate, 100)}
            <p className="text-sm text-gray-600 mb-4">Target: Most days ({goals.social.katSmilePercentage.value}%)</p>
            
            {renderProgressBar("Kat Reviews", metrics.kat.review.count, metrics.kat.review.target)}
            <p className="text-sm text-gray-600 mb-4">Target: {goals.social.katReviewsPerMonth.value} per month</p>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <h3 className="text-lg font-semibold mb-4">New Connections</h3>
          {renderProgressBar("New Phone Numbers", metrics.newConnections.phoneNumbers.count, goals.social.newPhoneNumbersTarget.value)}
          <p className="text-sm text-gray-600 mb-4">Target: {goals.social.newPhoneNumbersTarget.value} by May</p>
          
          {renderProgressBar("Hangouts with New People", metrics.newConnections.hangouts.count, goals.social.newHangoutsTarget.value)}
          <p className="text-sm text-gray-600 mb-4">Target: {goals.social.newHangoutsTarget.value} by May</p>
        </div>
        
        {/* Display detailed goals for Social */}
        {Object.entries(socialGoals).map(([category, goals]) => (
          <GoalCategory key={category} title={category} goals={goals} />
        ))}
        
        <h3 className="text-xl font-semibold mb-4">Social Trends</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {renderHistoricalChart('family_contact', 'Family Contact History', '#3b82f6')}
          {renderHistoricalChart('friend_contact', 'Friend Contact History', '#10b981')}
        </div>
      </>
    );
  };


  const renderHealthTab = () => {
    const metrics = getAllMetrics().health;
    const organizedGoals = organizeGoalsByCategory();
    const healthGoals = Object.entries(organizedGoals)
      .filter(([category]) => category === "Strength" || category === "Climbing" || category === "Running" || 
                            category === "Direct metrics" || category === "Sleep")
      .reduce((acc, [category, goals]) => {
        acc[category] = goals;
        return acc;
      }, {});
    
    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Strength (400 Challenge)</h3>
            <div className="mb-6">
              <div className="flex justify-between mb-1">
                <span className="text-lg font-bold">Total: {metrics.strength.total}/{goals.health.strengthChallengeTarget.value}</span>
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
            <p className="text-sm text-gray-600 mt-4">Target: Complete {goals.health.strengthChallengeTarget.value} Challenge by May 1st</p>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Sleep</h3>
            {renderProgressBar("Bed On Time", metrics.sleep.bedOnTime.rate, 100)}
            {renderProgressBar("Up On Time", metrics.sleep.upOnTime.rate, 100)}
            <p className="text-sm text-gray-600 mt-2">Target: {goals.health.sleepOnTimePercentage.value}% within one hour of bedtime weekly average</p>
          </div>
        </div>
        
        {/* Display detailed goals for Health */}
        {Object.entries(healthGoals).map(([category, goals]) => (
          <GoalCategory key={category} title={category} goals={goals} />
        ))}
        
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
    const organizedGoals = organizeGoalsByCategory();
    const productivityGoals = Object.entries(organizedGoals)
      .filter(([category]) => category === "Learning")
      .reduce((acc, [category, goals]) => {
        acc[category] = goals;
        return acc;
      }, {});
    
    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Language, Math & Coding</h3>
            {renderProgressBar("Language", metrics.language.rate, 100)}
            {renderProgressBar("Math", metrics.math.rate, 100)}
            {renderProgressBar("Coding", metrics.code.rate, 100)}
            <p className="text-sm text-gray-600 mt-2">Target: More than {goals.productivity.languageDaysPercentage.value}% of days monthly rolling average</p>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Lesson Completion</h3>
            {renderProgressBar("Lessons Completed", metrics.lessons.count, metrics.lessons.target)}
            <p className="text-sm text-gray-600 mt-2">Target: At least {goals.productivity.lessonsPerMonth.value} per month</p>
          </div>
        </div>
        
        {/* Display detailed goals for Productivity */}
        {Object.entries(productivityGoals).map(([category, goals]) => (
          <GoalCategory key={category} title={category} goals={goals} />
        ))}
        
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

  // New function to render the wellbeing tab
  const renderWellbeingTab = () => {
    const metrics = getAllMetrics().wellbeing;
    const organizedGoals = organizeGoalsByCategory();
    const wellbeingGoals = Object.entries(organizedGoals)
      .filter(([category]) => category === "Journaling" || category === "Meditation/Prayer" || category === "Do epic shit")
      .reduce((acc, [category, goals]) => {
        acc[category] = goals;
        return acc;
      }, {});
    
    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Journaling</h3>
            {renderProgressBar("Morning Journal", metrics.journaling.morningRate, 100)}
            {renderProgressBar("Evening Journal", metrics.journaling.eveningRate, 100)}
            {renderProgressBar("Both Morning & Evening", metrics.journaling.bothRate, 100)}
            <p className="text-sm text-gray-600 mt-2">Target: >{goals.wellbeing.journalingPercentage.value}% monthly rolling average</p>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Meditation/Prayer</h3>
            {renderProgressBar("Days with Meditation", metrics.meditation.rate, 100)}
            <p className="text-sm text-gray-600 mt-2">Target: >{goals.wellbeing.meditationPercentage.value}% of days monthly rolling average</p>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <h3 className="text-lg font-semibold mb-4">Epic Activities</h3>
          {renderProgressBar("Epic Activities", metrics.epic.count, metrics.epic.target)}
          <p className="text-sm text-gray-600 mt-2">Target: At least {goals.wellbeing.epicActivitiesPerMonth.value} per month</p>
        </div>
        
        {/* Display detailed goals for Wellbeing */}
        {Object.entries(wellbeingGoals).map(([category, goals]) => (
          <GoalCategory key={category} title={category} goals={goals} />
        ))}
        
        <h3 className="text-xl font-semibold mb-4">Wellbeing Trends</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {renderHistoricalChart('morning_journal', 'Morning Journal History', '#f59e0b')}
          {renderHistoricalChart('evening_journal', 'Evening Journal History', '#ef4444')}
          {renderHistoricalChart('meditation', 'Meditation History', '#8b5cf6')}
          {renderHistoricalChart('epic_activity', 'Epic Activities History', '#ec4899')}
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
        {renderDashboardHeader()}
        {renderGoalSettings()}
        
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'social' && renderSocialTab()}
        {activeTab === 'wellbeing' && renderWellbeingTab()}
        {activeTab === 'health' && renderHealthTab()}
        {activeTab === 'productivity' && renderProductivityTab()}
        
        {renderDashboardFooter()}
      </>
    );
  };

  const renderHeader = () => {
    return (
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 rounded-lg shadow-lg mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
          <h1 className="text-2xl font-bold mb-4 md:mb-0">Life Goals Dashboard</h1>
          
          <div className="flex items-center">
            {isAuthenticated && (
              <button 
                onClick={fetchSheetData} 
                className="mr-4 p-2 bg-white bg-opacity-20 rounded-full hover:bg-opacity-30 transition-all"
                title="Refresh Data"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
            
            <button 
              onClick={handleAuthClick} 
              className={`px-4 py-2 rounded text-sm font-medium ${
                isAuthenticated 
                  ? 'bg-white bg-opacity-20 hover:bg-opacity-30' 
                  : 'bg-white text-indigo-600 hover:bg-opacity-90'
              }`}
            >
              {isAuthenticated ? 'Disconnect' : 'Connect to Google Sheets'}
            </button>
          </div>
        </div>
        
        {/* Optional description */}
        {isAuthenticated && (
          <div className="mt-2 text-sm text-white text-opacity-80">
            Track your progress toward life goals with projections based on your current pace.
          </div>
        )}
      </div>
    );
  };

  // Tab navigation component
  const renderTabs = () => {
    if (!isAuthenticated) return null;
    
    const tabs = [
      { id: 'overview', label: 'Overview' },
      { id: 'health', label: 'Health' },
      { id: 'wellbeing', label: 'Wellbeing' },
      { id: 'social', label: 'Social' },
      { id: 'productivity', label: 'Productivity' }
    ];
    
    return (
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-1" aria-label="Tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-5 border-b-2 text-center text-sm font-medium ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {renderHeader()}
        
        {isAuthenticated && renderTabs()}
        {renderContent()}
      </div>
    </div>
  );
};

export default LifeTrackerDashboard;