import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import _ from 'lodash';
import { initializeApp } from 'firebase/app';
import StravaService from './StravaService';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  createUserWithEmailAndPassword,
  onAuthStateChanged
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  Timestamp,
  setDoc,
  getDoc,
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';

// Firebase configuration
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
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const LifeTrackerDashboard = () => {
  // Core state
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [dateRange, setDateRange] = useState('all'); // Using 'all' as default to show all data
  
  // Projects state
  const [projects, setProjects] = useState([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  
  // Health metrics state
  const [healthMetrics, setHealthMetrics] = useState([]);
  const [isLoadingHealthMetrics, setIsLoadingHealthMetrics] = useState(false);
  
  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showSignUp, setShowSignUp] = useState(false);
  
  // Goals state (with fixed default values)
  const [goals, setGoals] = useState({
    social: {
      familyContactDaysPerWeek: { value: 3 },
      friendContactDaysPerWeek: { value: 2 },
      katSmilePercentage: { value: 70 },
      katReviewsPerMonth: { value: 4 },
      newPhoneNumbersTarget: { value: 5 },
      newHangoutsTarget: { value: 2 }
    },
    wellbeing: {
      journalingPercentage: { value: 60 },
      meditationPercentage: { value: 50 },
      epicActivitiesPerMonth: { value: 4 }
    },
    health: {
      strengthChallengeTarget: { value: 400 },
      sleepOnTimePercentage: { value: 90 }
    },
    productivity: {
      languageDaysPercentage: { value: 50 },
      mathDaysPercentage: { value: 50 },
      codeDaysPercentage: { value: 50 },
      lessonsPerMonth: { value: 4 }
    }
  });
  
  // Auto-refresh state
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5); // minutes
  
  // Export state
  const [isExporting, setIsExporting] = useState(false);
  
  // We'll implement a mock for Garmin Connect instead of using the node library
  // which doesn't work well in browser environments

  // No longer saving goals to localStorage or Firestore

  // Check authentication state on component mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("User is signed in:", user.uid);
        setIsAuthenticated(true);
        fetchFirestoreData();
      } else {
        console.log("User is signed out");
        setIsAuthenticated(false);
        setData([]);
      }
    });
    
    // Cleanup subscription
    return () => unsubscribe();
  }, []);

  // No longer loading user goals from Firestore

  // Set up auto-refresh for Firestore data
  useEffect(() => {
    let intervalId;
    
    if (autoRefresh && isAuthenticated) {
      intervalId = setInterval(() => {
        fetchFirestoreData();
      }, refreshInterval * 60 * 1000); // Convert minutes to milliseconds
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [autoRefresh, refreshInterval, isAuthenticated]);

  // Firebase authentication handlers
  const handleSignIn = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setIsAuthenticated(true);
      setError(null);
    } catch (error) {
      console.error("Error signing in:", error);
      setError(`Error signing in: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      setIsAuthenticated(true);
      setError(null);
      
      // No longer setting goals in Firestore
    } catch (error) {
      console.error("Error signing up:", error);
      setError(`Error signing up: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setIsAuthenticated(false);
      setData([]);
    } catch (error) {
      console.error("Error signing out:", error);
      setError(`Error signing out: ${error.message}`);
    }
  };

  // Function to add a new daily log entry
  const addDailyLog = async (logData) => {
    if (!isAuthenticated || !auth.currentUser) {
      setError('You must be signed in to add entries');
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Add timestamp and standardize data format
      const newLog = {
        ...logData,
        timestamp: Timestamp.now(),
        userId: auth.currentUser.uid,
      };
      
      // Add the document to the logs collection
      await addDoc(collection(db, 'users', auth.currentUser.uid, 'logs'), newLog);
      
      // Refresh data
      fetchFirestoreData();
    } catch (error) {
      console.error("Error adding log entry:", error);
      setError(`Error adding log: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Function to add a journal entry
  const addJournalEntry = async (journalData) => {
    if (!isAuthenticated || !auth.currentUser) {
      setError('You must be signed in to add journal entries');
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Add timestamp and standardize data format
      const newEntry = {
        ...journalData,
        timestamp: Timestamp.now(),
        userId: auth.currentUser.uid,
      };
      
      // Add the document to the journal collection
      await addDoc(collection(db, 'users', auth.currentUser.uid, 'journal'), newEntry);
      
      // No need to refresh all data since journal entries are separate
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error adding journal entry:", error);
      setError(`Error adding journal: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Render Daily Log Tab with Journal functionality
  const renderDailyLogTab = () => {
    return (
      <div className="p-4">
        <h2 className="text-2xl font-bold mb-6 text-gray-100">Daily Activity Log</h2>
        <p className="mb-6 text-gray-400">
          Track your daily activities and progress toward your goals.
        </p>
        
        {/* Daily Log Form */}
        <div className="mb-8">
          <DailyLogForm />
        </div>
        
        {/* Journal Entry Form */}
        <div className="mt-10 pt-6 border-t border-gray-700">
          <h2 className="text-2xl font-bold mb-6 text-gray-100">Journal</h2>
          <div className="bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700 mb-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-100">New Journal Entry</h3>
            <JournalEntryForm onSubmit={addJournalEntry} onSuccess={fetchJournalEntries} />
          </div>
        </div>
        
        {/* Journal entries list */}
        <div className="mt-8">
          <h3 className="text-xl font-semibold mb-4 text-gray-200">Journal Entries</h3>
          
          {isLoadingJournal ? (
            <div className="text-center py-6">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-blue-400 border-r-transparent"></div>
              <p className="mt-2 text-gray-400">Loading journal entries...</p>
            </div>
          ) : journalEntries.length === 0 ? (
            <p className="text-gray-400 py-4">No journal entries yet. Start journaling above!</p>
          ) : (
            <div className="space-y-6">
              {journalEntries.map(entry => (
                <div key={entry.id} className="bg-gray-800 p-5 rounded-lg shadow border border-gray-700">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm text-gray-400">
                      {entry.date.toLocaleString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    <span className="px-2 py-1 bg-blue-900 text-blue-200 text-xs rounded-full">
                      {entry.journalType}
                    </span>
                  </div>
                  
                  {entry.title && (
                    <h4 className="text-lg font-medium mb-2 text-gray-100">{entry.title}</h4>
                  )}
                  
                  <div className="prose max-w-none text-gray-300">
                    {entry.content.split('\n').map((paragraph, i) => (
                      <p key={i} className="mb-2">{paragraph}</p>
                    ))}
                  </div>
                  
                  {entry.mood && (
                    <div className="mt-3 text-sm text-gray-400">
                      Energy Level: {entry.mood}/10
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };
  
  // Journal entries state (moved to component level)
  const [journalEntries, setJournalEntries] = useState([]);
  const [isLoadingJournal, setIsLoadingJournal] = useState(false);
  
  // Fetch journal entries from Firestore
  const fetchJournalEntries = useCallback(async () => {
    if (!isAuthenticated || !auth.currentUser) return;
    
    setIsLoadingJournal(true);
    try {
      const q = query(
        collection(db, 'users', auth.currentUser.uid, 'journal'),
        orderBy('timestamp', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const entries = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().timestamp.toDate()
      }));
      
      setJournalEntries(entries);
    } catch (error) {
      console.error("Error fetching journal entries:", error);
    } finally {
      setIsLoadingJournal(false);
    }
  }, [isAuthenticated, auth.currentUser]);
  
  // Load journal entries when tab changes to daily log
  useEffect(() => {
    if (isAuthenticated && auth.currentUser && activeTab === 'dailylog') {
      fetchJournalEntries();
    }
  }, [isAuthenticated, activeTab, fetchJournalEntries]);
  
  // Fetch projects from Firestore
  const fetchProjects = useCallback(async () => {
    if (!isAuthenticated || !auth.currentUser) return;
    
    setIsLoadingProjects(true);
    try {
      const q = query(
        collection(db, 'users', auth.currentUser.uid, 'projects'),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const fetchedProjects = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        endDate: doc.data().endDate?.toDate() || null,
        goals: doc.data().goals || []
      }));
      
      setProjects(fetchedProjects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      setError(`Error fetching projects: ${error.message}`);
    } finally {
      setIsLoadingProjects(false);
    }
  }, [isAuthenticated]);
  
  // Fetch health metrics from Firestore
  const fetchHealthMetrics = useCallback(async () => {
    if (!isAuthenticated || !auth.currentUser) return;
    
    setIsLoadingHealthMetrics(true);
    try {
      const q = query(
        collection(db, 'users', auth.currentUser.uid, 'healthMetrics'),
        orderBy('date', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const fetchedMetrics = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate() || new Date()
      }));
      
      setHealthMetrics(fetchedMetrics);
    } catch (error) {
      console.error("Error fetching health metrics:", error);
      setError(`Error fetching health metrics: ${error.message}`);
    } finally {
      setIsLoadingHealthMetrics(false);
    }
  }, [isAuthenticated, auth.currentUser]);
  
  // Add health metric
  const addHealthMetric = async (metricData) => {
    if (!isAuthenticated || !auth.currentUser) {
      setError('You must be signed in to add health metrics');
      return;
    }
    
    try {
      setIsLoading(true);
      console.log("Adding health metric with data:", metricData);
      
      // Handle cardio exercise data specially
      let enhancedMetricData = {...metricData};
      
      // If this is an exercise entry, add needed fields
      if (metricData.activity_type && 
          ['running', 'cycling', 'swimming', 'climbing', 'walking', 'hiking'].includes(metricData.activity_type)) {
        console.log("Adding exercise data");
        // Mark it as a cardio exercise
        enhancedMetricData.cardio = 'Yes';
        
        // Make sure it has required fields with defaults
        if (!enhancedMetricData.duration) enhancedMetricData.duration = 30;
        if (!enhancedMetricData.heart_rate) enhancedMetricData.heart_rate = 130;
      }
      
      // Add timestamp and standardize data format
      const newMetric = {
        ...enhancedMetricData,
        date: Timestamp.now(),
        userId: auth.currentUser.uid,
      };
      
      console.log("Saving health metric to Firestore:", newMetric);
      
      // Add the document to the healthMetrics collection
      const docRef = await addDoc(collection(db, 'users', auth.currentUser.uid, 'healthMetrics'), newMetric);
      console.log("Health metric saved with ID:", docRef.id);
      
      // Refresh health metrics
      fetchHealthMetrics();
    } catch (error) {
      console.error("Error adding health metric:", error);
      setError(`Error adding health metric: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Load projects when tab changes to overview
  useEffect(() => {
    if (isAuthenticated && auth.currentUser && activeTab === 'overview') {
      fetchProjects();
    }
  }, [isAuthenticated, activeTab, fetchProjects]);
  
  // Fetch health metrics when health tab is active
  useEffect(() => {
    if (isAuthenticated && auth.currentUser && activeTab === 'health') {
      fetchHealthMetrics();
    }
  }, [isAuthenticated, auth.currentUser, activeTab, fetchHealthMetrics]);
  
  // Function to add a new project
  const addProject = async (projectData) => {
    if (!isAuthenticated || !auth.currentUser) {
      setError('You must be signed in to add projects');
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Add timestamp and standardize data format
      const newProject = {
        ...projectData,
        createdAt: Timestamp.now(),
        userId: auth.currentUser.uid,
        goals: projectData.goals || []
      };
      
      // Add the document to the projects collection
      await addDoc(collection(db, 'users', auth.currentUser.uid, 'projects'), newProject);
      
      // Refresh projects
      fetchProjects();
    } catch (error) {
      console.error("Error adding project:", error);
      setError(`Error adding project: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Function to update a project
  const updateProject = async (projectId, updatedData) => {
    if (!isAuthenticated || !auth.currentUser) {
      setError('You must be signed in to update projects');
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Update the document in the projects collection
      await setDoc(
        doc(db, 'users', auth.currentUser.uid, 'projects', projectId), 
        updatedData, 
        { merge: true }
      );
      
      // Refresh projects
      fetchProjects();
    } catch (error) {
      console.error("Error updating project:", error);
      setError(`Error updating project: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Function to delete a project
  const deleteProject = async (projectId) => {
    if (!isAuthenticated || !auth.currentUser) {
      setError('You must be signed in to delete projects');
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Delete the document from the projects collection
      await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'projects', projectId));
      
      // Refresh projects
      fetchProjects();
    } catch (error) {
      console.error("Error deleting project:", error);
      setError(`Error deleting project: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  
  // Journal Entry Form component
  const JournalEntryForm = ({ onSubmit, onSuccess }) => {
    const [journalData, setJournalData] = useState({
      title: '',
      content: '',
      mood: '5',
      journalType: 'Daily'
    });
    
    const handleChange = (e) => {
      const { name, value } = e.target;
      setJournalData(prev => ({
        ...prev,
        [name]: value
      }));
    };
    
    const handleSubmit = async (e) => {
      e.preventDefault();
      await onSubmit(journalData);
      
      // Reset form
      setJournalData({
        title: '',
        content: '',
        mood: '5',
        journalType: 'Daily'
      });
      
      // Refresh entries
      if (onSuccess) onSuccess();
    };
    
    return (
      <div className="bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700">
        <h3 className="text-lg font-semibold mb-4 text-gray-100">New Journal Entry</h3>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="title" className="block text-sm font-medium mb-1 text-gray-300">
              Title (Optional)
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={journalData.title}
              onChange={handleChange}
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400"
              placeholder="What's on your mind today?"
            />
          </div>
          
          <div className="mb-4">
            <label htmlFor="content" className="block text-sm font-medium mb-1 text-gray-300">
              Journal Entry
            </label>
            <textarea
              id="content"
              name="content"
              value={journalData.content}
              onChange={handleChange}
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400"
              rows={6}
              required
              placeholder="Write your thoughts here..."
            ></textarea>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="mood" className="block text-sm font-medium mb-1 text-gray-300">
                Energy Level (0-10)
              </label>
              <select
                id="mood"
                name="mood"
                value={journalData.mood}
                onChange={handleChange}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
              >
                <option value="0">0 - Completely Drained</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5 - Average</option>
                <option value="6">6</option>
                <option value="7">7</option>
                <option value="8">8</option>
                <option value="9">9</option>
                <option value="10">10 - Fully Energized</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="journalType" className="block text-sm font-medium mb-1 text-gray-300">
                Entry Type
              </label>
              <select
                id="journalType"
                name="journalType"
                value={journalData.journalType}
                onChange={handleChange}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
              >
                <option value="Morning">Morning</option>
                <option value="Evening">Evening</option>
                <option value="Daily">Daily</option>
                <option value="Gratitude">Gratitude</option>
                <option value="Reflection">Reflection</option>
              </select>
            </div>
          </div>
          
          <button
            type="submit"
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md"
            disabled={isLoading}
          >
            {isLoading ? "Saving..." : "Save Journal Entry"}
          </button>
        </form>
      </div>
    );
  };
  
  // New component for creating a daily log entry
  const DailyLogForm = () => {
    // Default form state with common fields
    const [formData, setFormData] = useState({
      // Basic Fields
      // Social Fields
      talked_on_phone_friend: "No",
      talked_on_phone_family: "No",
      talked_on_phone_new: "No",
      texted_friend: "No",
      texted_family: "No",
      texted_new: "No",
      made_plans_friend: "No",
      made_plans_family: "No",
      made_plans_new: "No",
      hung_out_friend: "No",
      hung_out_family: "No",
      hung_out_new: "No",
      kat_smile: "No",
      kat_nice: "No",
      kat_review: "No",
      kat_meaningful: "No",
      
      // Wellbeing Fields
      morning_journal: "No",
      evening_journal: "No",
      meditation: "No",
      epic_activity: "No",
      epic_rating: 3,
      vibes: 5,
      
      // Productivity Fields
      focused_time: "0",
      reading_time: "0",
      internet_time: "0",
      
      // Health Fields
      cardio: "No",
      strength: "No",
      bed_on_time: "No",
      up_on_time: "No",
      
      // Exercise Fields
      miles: 0,
      duration: 30,
      heart_rate: 130,
      activity_type: "running",
      
      // Numeric Fields
      pushups: 0,
      rows: 0,
      situps: 0,
      squats: 0
    });
    
    // State for tracking if sections are expanded
    const [expandedSections, setExpandedSections] = useState({
      talked_on_phone: false,
      texted: false,
      made_plans: false,
      hung_out: false,
      kat: false
    });
    
    const handleChange = (e) => {
      const { name, value, type, checked } = e.target;
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? (checked ? "Yes" : "No") : value
      }));
    };
    
    const handleExpandSection = (section) => {
      setExpandedSections(prev => ({
        ...prev,
        [section]: !prev[section]
      }));
    };
    
    const handleSubmit = async (e) => {
      e.preventDefault();
      await addDailyLog(formData);
      // Reset form after submission
      setFormData({
        // Social Fields
        talked_on_phone_friend: "No",
        talked_on_phone_family: "No",
        talked_on_phone_new: "No",
        texted_friend: "No",
        texted_family: "No",
        texted_new: "No",
        made_plans_friend: "No",
        made_plans_family: "No",
        made_plans_new: "No",
        hung_out_friend: "No",
        hung_out_family: "No",
        hung_out_new: "No",
        kat_smile: "No",
        kat_nice: "No",
        kat_review: "No",
        kat_meaningful: "No",
        
        // Wellbeing Fields
        morning_journal: "No",
        evening_journal: "No",
        meditation: "No",
        epic_activity: "No",
        epic_rating: 3,
        vibes: 5,
        
        // Productivity Fields
        focused_time: "0",
        reading_time: "0",
        internet_time: "0",
        
        // Health Fields
        cardio: "No",
        strength: "No",
        bed_on_time: "No",
        up_on_time: "No",
        
        // Exercise Fields
        miles: 0,
        duration: 30,
        heart_rate: 130,
        activity_type: "running",
        
        // Numeric Fields
        pushups: 0,
        rows: 0,
        situps: 0,
        squats: 0
      });
      
      // Reset expanded sections
      setExpandedSections({
        talked_on_phone: false,
        texted: false,
        made_plans: false,
        hung_out: false,
        kat: false
      });
    };
    
    return (
      <div className="bg-gray-800 p-6 rounded-lg shadow-md mb-6 border border-gray-700">
        <h3 className="text-xl font-semibold mb-4 text-gray-100">Add Daily Log Entry</h3>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Social Section */}
            <div className="bg-blue-900 p-4 rounded-md border border-blue-800">
              <h4 className="font-medium text-blue-100 mb-3">Social</h4>
              
              <div className="space-y-4">
                {/* Talked on the phone category */}
                <div className="border-b border-blue-800 pb-2">
                  <button 
                    type="button"
                    onClick={() => handleExpandSection('talked_on_phone')}
                    className="flex items-center justify-between w-full text-left text-gray-200 hover:text-white focus:outline-none"
                  >
                    <span>Talked on the phone with:</span>
                    <span className="text-lg">{expandedSections.talked_on_phone ? '−' : '+'}</span>
                  </button>
                  
                  {expandedSections.talked_on_phone && (
                    <div className="mt-2 ml-4 space-y-2">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="talked_on_phone_friend"
                          name="talked_on_phone_friend"
                          checked={formData.talked_on_phone_friend === "Yes"}
                          onChange={handleChange}
                          className="mr-2"
                        />
                        <label htmlFor="talked_on_phone_friend" className="text-gray-200">Friend</label>
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="talked_on_phone_family"
                          name="talked_on_phone_family"
                          checked={formData.talked_on_phone_family === "Yes"}
                          onChange={handleChange}
                          className="mr-2"
                        />
                        <label htmlFor="talked_on_phone_family" className="text-gray-200">Family</label>
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="talked_on_phone_new"
                          name="talked_on_phone_new"
                          checked={formData.talked_on_phone_new === "Yes"}
                          onChange={handleChange}
                          className="mr-2"
                        />
                        <label htmlFor="talked_on_phone_new" className="text-gray-200">Someone new</label>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Texted category */}
                <div className="border-b border-blue-800 pb-2">
                  <button 
                    type="button"
                    onClick={() => handleExpandSection('texted')}
                    className="flex items-center justify-between w-full text-left text-gray-200 hover:text-white focus:outline-none"
                  >
                    <span>Texted with:</span>
                    <span className="text-lg">{expandedSections.texted ? '−' : '+'}</span>
                  </button>
                  
                  {expandedSections.texted && (
                    <div className="mt-2 ml-4 space-y-2">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="texted_friend"
                          name="texted_friend"
                          checked={formData.texted_friend === "Yes"}
                          onChange={handleChange}
                          className="mr-2"
                        />
                        <label htmlFor="texted_friend" className="text-gray-200">Friend</label>
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="texted_family"
                          name="texted_family"
                          checked={formData.texted_family === "Yes"}
                          onChange={handleChange}
                          className="mr-2"
                        />
                        <label htmlFor="texted_family" className="text-gray-200">Family</label>
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="texted_new"
                          name="texted_new"
                          checked={formData.texted_new === "Yes"}
                          onChange={handleChange}
                          className="mr-2"
                        />
                        <label htmlFor="texted_new" className="text-gray-200">Someone new</label>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Made plans category */}
                <div className="border-b border-blue-800 pb-2">
                  <button 
                    type="button"
                    onClick={() => handleExpandSection('made_plans')}
                    className="flex items-center justify-between w-full text-left text-gray-200 hover:text-white focus:outline-none"
                  >
                    <span>Made plans with:</span>
                    <span className="text-lg">{expandedSections.made_plans ? '−' : '+'}</span>
                  </button>
                  
                  {expandedSections.made_plans && (
                    <div className="mt-2 ml-4 space-y-2">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="made_plans_friend"
                          name="made_plans_friend"
                          checked={formData.made_plans_friend === "Yes"}
                          onChange={handleChange}
                          className="mr-2"
                        />
                        <label htmlFor="made_plans_friend" className="text-gray-200">Friend</label>
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="made_plans_family"
                          name="made_plans_family"
                          checked={formData.made_plans_family === "Yes"}
                          onChange={handleChange}
                          className="mr-2"
                        />
                        <label htmlFor="made_plans_family" className="text-gray-200">Family</label>
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="made_plans_new"
                          name="made_plans_new"
                          checked={formData.made_plans_new === "Yes"}
                          onChange={handleChange}
                          className="mr-2"
                        />
                        <label htmlFor="made_plans_new" className="text-gray-200">Someone new</label>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Hung out category */}
                <div className="border-b border-blue-800 pb-2">
                  <button 
                    type="button"
                    onClick={() => handleExpandSection('hung_out')}
                    className="flex items-center justify-between w-full text-left text-gray-200 hover:text-white focus:outline-none"
                  >
                    <span>Hung out with:</span>
                    <span className="text-lg">{expandedSections.hung_out ? '−' : '+'}</span>
                  </button>
                  
                  {expandedSections.hung_out && (
                    <div className="mt-2 ml-4 space-y-2">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="hung_out_friend"
                          name="hung_out_friend"
                          checked={formData.hung_out_friend === "Yes"}
                          onChange={handleChange}
                          className="mr-2"
                        />
                        <label htmlFor="hung_out_friend" className="text-gray-200">Friend</label>
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="hung_out_family"
                          name="hung_out_family"
                          checked={formData.hung_out_family === "Yes"}
                          onChange={handleChange}
                          className="mr-2"
                        />
                        <label htmlFor="hung_out_family" className="text-gray-200">Family</label>
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="hung_out_new"
                          name="hung_out_new"
                          checked={formData.hung_out_new === "Yes"}
                          onChange={handleChange}
                          className="mr-2"
                        />
                        <label htmlFor="hung_out_new" className="text-gray-200">Someone new</label>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Kat category */}
                <div className="border-b border-blue-800 pb-2">
                  <button 
                    type="button"
                    onClick={() => handleExpandSection('kat')}
                    className="flex items-center justify-between w-full text-left text-gray-200 hover:text-white focus:outline-none"
                  >
                    <span>Kat:</span>
                    <span className="text-lg">{expandedSections.kat ? '−' : '+'}</span>
                  </button>
                  
                  {expandedSections.kat && (
                    <div className="mt-2 ml-4 space-y-2">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="kat_smile"
                          name="kat_smile"
                          checked={formData.kat_smile === "Yes"}
                          onChange={handleChange}
                          className="mr-2"
                        />
                        <label htmlFor="kat_smile" className="text-gray-200">Made her smile</label>
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="kat_nice"
                          name="kat_nice"
                          checked={formData.kat_nice === "Yes"}
                          onChange={handleChange}
                          className="mr-2"
                        />
                        <label htmlFor="kat_nice" className="text-gray-200">Did something nice for her</label>
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="kat_meaningful"
                          name="kat_meaningful"
                          checked={formData.kat_meaningful === "Yes"}
                          onChange={handleChange}
                          className="mr-2"
                        />
                        <label htmlFor="kat_meaningful" className="text-gray-200">Hung out meaningfully</label>
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="kat_review"
                          name="kat_review"
                          checked={formData.kat_review === "Yes"}
                          onChange={handleChange}
                          className="mr-2"
                        />
                        <label htmlFor="kat_review" className="text-gray-200">Did review with her</label>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Wellbeing Section */}
            <div className="bg-purple-900 p-4 rounded-md border border-purple-800">
              <h4 className="font-medium text-purple-100 mb-3">Wellbeing</h4>
              
              <div className="space-y-3">
                <div>
                  <label htmlFor="vibes" className="block mb-1 text-gray-200">Overall Vibes (0-10)</label>
                  <select
                    id="vibes"
                    name="vibes"
                    value={formData.vibes}
                    onChange={handleChange}
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                  >
                    <option value="0">0 - Terrible</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5 - Average</option>
                    <option value="6">6</option>
                    <option value="7">7</option>
                    <option value="8">8</option>
                    <option value="9">9</option>
                    <option value="10">10 - Amazing</option>
                  </select>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="morning_journal"
                    name="morning_journal"
                    checked={formData.morning_journal === "Yes"}
                    onChange={handleChange}
                    className="mr-2"
                  />
                  <label htmlFor="morning_journal" className="text-gray-200">Morning Journal</label>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="evening_journal"
                    name="evening_journal"
                    checked={formData.evening_journal === "Yes"}
                    onChange={handleChange}
                    className="mr-2"
                  />
                  <label htmlFor="evening_journal" className="text-gray-200">Evening Journal</label>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="meditation"
                    name="meditation"
                    checked={formData.meditation === "Yes"}
                    onChange={handleChange}
                    className="mr-2"
                  />
                  <label htmlFor="meditation" className="text-gray-200">Meditation/Prayer</label>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="epic_activity"
                    name="epic_activity"
                    checked={formData.epic_activity === "Yes"}
                    onChange={handleChange}
                    className="mr-2"
                  />
                  <label htmlFor="epic_activity" className="text-gray-200">Did something epic</label>
                </div>
                
                {formData.epic_activity === "Yes" && (
                  <div>
                    <label htmlFor="epic_rating" className="block mb-1 text-gray-200">How epic? (1-5)</label>
                    <select
                      id="epic_rating"
                      name="epic_rating"
                      value={formData.epic_rating}
                      onChange={handleChange}
                      className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                    >
                      <option value="1">1 - Somewhat epic</option>
                      <option value="2">2</option>
                      <option value="3">3 - Pretty epic</option>
                      <option value="4">4</option>
                      <option value="5">5 - Legendary</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
            
            {/* Health Section */}
            <div className="bg-green-900 p-4 rounded-md border border-green-800">
              <h4 className="font-medium text-green-100 mb-3">Health</h4>
              
              <div className="space-y-3">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="cardio"
                    name="cardio"
                    checked={formData.cardio === "Yes"}
                    onChange={handleChange}
                    className="mr-2"
                  />
                  <label htmlFor="cardio" className="text-gray-200">Did cardio today</label>
                </div>
                
                {formData.cardio === "Yes" && (
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="miles" className="block mb-1 text-gray-200">Miles</label>
                      <input
                        type="number"
                        id="miles"
                        name="miles"
                        step="0.1"
                        min="0"
                        value={formData.miles}
                        onChange={handleChange}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                      />
                    </div>
                    <div>
                      <label htmlFor="duration" className="block mb-1 text-gray-200">Duration (minutes)</label>
                      <input
                        type="number"
                        id="duration"
                        name="duration"
                        step="1"
                        min="0"
                        value={formData.duration || ""}
                        onChange={handleChange}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                      />
                    </div>
                    <div>
                      <label htmlFor="heart_rate" className="block mb-1 text-gray-200">Avg Heart Rate (BPM)</label>
                      <input
                        type="number"
                        id="heart_rate"
                        name="heart_rate"
                        step="1"
                        min="0"
                        value={formData.heart_rate || ""}
                        onChange={handleChange}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                      />
                    </div>
                    <div>
                      <label htmlFor="activity_type" className="block mb-1 text-gray-200">Activity Type</label>
                      <select
                        id="activity_type"
                        name="activity_type"
                        value={formData.activity_type || "running"}
                        onChange={handleChange}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                      >
                        <option value="running">Running</option>
                        <option value="walking">Walking</option>
                        <option value="cycling">Cycling</option>
                        <option value="swimming">Swimming</option>
                        <option value="hiking">Hiking</option>
                        <option value="climbing">Climbing</option>
                        <option value="weightlifting">Weightlifting</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="strength"
                    name="strength"
                    checked={formData.strength === "Yes"}
                    onChange={handleChange}
                    className="mr-2"
                  />
                  <label htmlFor="strength" className="text-gray-200">Did strength training</label>
                </div>
                
                {formData.strength === "Yes" && (
                  <div className="space-y-2">
                    <div>
                      <label htmlFor="pushups" className="block mb-1 text-gray-200">Pushups</label>
                      <input
                        type="number"
                        id="pushups"
                        name="pushups"
                        min="0"
                        value={formData.pushups}
                        onChange={handleChange}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="rows" className="block mb-1 text-gray-200">Rows</label>
                      <input
                        type="number"
                        id="rows"
                        name="rows"
                        min="0"
                        value={formData.rows}
                        onChange={handleChange}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="situps" className="block mb-1 text-gray-200">Situps</label>
                      <input
                        type="number"
                        id="situps"
                        name="situps"
                        min="0"
                        value={formData.situps}
                        onChange={handleChange}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="squats" className="block mb-1 text-gray-200">Squats</label>
                      <input
                        type="number"
                        id="squats"
                        name="squats"
                        min="0"
                        value={formData.squats}
                        onChange={handleChange}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                      />
                    </div>
                  </div>
                )}
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="bed_on_time"
                    name="bed_on_time"
                    checked={formData.bed_on_time === "Yes"}
                    onChange={handleChange}
                    className="mr-2"
                  />
                  <label htmlFor="bed_on_time" className="text-gray-200">Bed on time</label>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="up_on_time"
                    name="up_on_time"
                    checked={formData.up_on_time === "Yes"}
                    onChange={handleChange}
                    className="mr-2"
                  />
                  <label htmlFor="up_on_time" className="text-gray-200">Up on time</label>
                </div>
              </div>
            </div>
            
            {/* Productivity Section */}
            <div className="bg-amber-900 p-4 rounded-md border border-amber-800">
              <h4 className="font-medium text-amber-100 mb-3">Productivity</h4>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="focused_time" className="block mb-1 text-gray-200">Focused Productive Time</label>
                  <select
                    id="focused_time"
                    name="focused_time"
                    value={formData.focused_time}
                    onChange={handleChange}
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                  >
                    <option value="0">None</option>
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="90">1.5 hours</option>
                    <option value="120">2 hours</option>
                    <option value="180">3 hours</option>
                    <option value="240">4 hours</option>
                    <option value="300">5 hours</option>
                    <option value="360">6+ hours</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="reading_time" className="block mb-1 text-gray-200">Reading Time</label>
                  <select
                    id="reading_time"
                    name="reading_time"
                    value={formData.reading_time}
                    onChange={handleChange}
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                  >
                    <option value="0">None</option>
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="90">1.5 hours</option>
                    <option value="120">2 hours</option>
                    <option value="180">3+ hours</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="internet_time" className="block mb-1 text-gray-200">Mindless Internet Use</label>
                  <select
                    id="internet_time"
                    name="internet_time"
                    value={formData.internet_time}
                    onChange={handleChange}
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                  >
                    <option value="0">None</option>
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="90">1.5 hours</option>
                    <option value="120">2 hours</option>
                    <option value="180">3 hours</option>
                    <option value="240">4+ hours</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-6 text-center">
            <button 
              type="submit" 
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              disabled={isLoading}
            >
              {isLoading ? "Saving..." : "Save Daily Log"}
            </button>
          </div>
        </form>
      </div>
    );
  };

  // Fetch data from Firestore
  const fetchFirestoreData = async () => {
    if (!isAuthenticated || !auth.currentUser) {
      console.log("User authentication status:", isAuthenticated ? "Authenticated but no user" : "Not authenticated");
      console.log("Current auth state:", auth.currentUser ? "User present" : "No user");
      // Set empty data instead of returning
      setData([]);
      setLastUpdated(new Date());
      return;
    }
    
    console.log("Fetching data for authenticated user:", auth.currentUser.uid);
    
    setIsLoading(true);
    
    try {
      // Query logs collection, ordered by timestamp
      const q = query(
        collection(db, 'users', auth.currentUser.uid, 'logs'),
        orderBy('timestamp', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      
      // Process the data
      const processedData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        const timestamp = data.timestamp.toDate();
        
        return {
          id: doc.id,
          ...data,
          date: timestamp,
          formattedDate: `${timestamp.getMonth() + 1}/${timestamp.getDate()}/${timestamp.getFullYear()}`,
          year: timestamp.getFullYear(),
          month: timestamp.getMonth() + 1,
          week: getWeekNumber(timestamp),
        };
      });
      
      // Sort by date
      const sortedData = _.sortBy(processedData, 'date');
      setData(sortedData);
      setLastUpdated(new Date());
      setError(null);
    } catch (error) {
      console.error("Error fetching data from Firestore:", error);
      setError(`Error fetching data: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
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
    if (!data || data.length === 0) return [];
    
    console.log("Total data entries before filtering:", data.length);
    
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
        console.log("Showing all data entries:", data.length);
        return data;
    }
    
    // Improved date handling
    const filteredResults = data.filter(entry => {
      // Check if entry has a date field
      if (!entry || !entry.date) {
        return false;
      }
      
      // Ensure date is a proper Date object for comparison
      let entryDate;
      try {
        // Handle different date formats
        entryDate = entry.date instanceof Date 
          ? entry.date 
          : (typeof entry.date === 'object' && entry.date.toDate) 
            ? entry.date.toDate() 
            : new Date(entry.date);
      } catch (error) {
        console.error("Error converting date:", error, entry.date);
        return false;
      }
      
      return entryDate >= startDate;
    });
    
    console.log(`Data entries after filtering by date (${dateRange}):`, filteredResults.length);
    return filteredResults;
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
  
  // Calculate cardio metrics based on health metrics data
  const calculateCardioMetrics = useCallback(() => {
    try {
      // Default return value for safety
      const defaultMetrics = { 
        rate: 0, 
        count: 0, 
        totalMiles: 0, 
        averageMiles: 0,
        weeklyLoad: 0,
        recentLoads: [],
        exerciseLoads: []
      };
      
      // First check if we have health metrics data
      if (!healthMetrics || healthMetrics.length === 0) {
        console.log("No health metrics available for cardio calculation");
        // Fall back to using log entries if available
        if (!getFilteredData) {
          console.warn("getFilteredData function is not available");
          return defaultMetrics;
        }
        
        const filteredData = getFilteredData();
        if (!filteredData || filteredData.length === 0) {
          return defaultMetrics;
        }
        
        // Filter cardio entries from log data as fallback
        const cardioEntries = filteredData.filter(entry => {
          return entry && 
            (entry.cardio === 'Yes' || 
             entry.cardio === 'yes' ||
             entry.cardio === true ||
             entry.cardio === 1 ||
             entry.strength === 'Yes' ||
             entry.strength === 'yes' ||
             entry.strength === true ||
             entry.activity_type === 'running' ||
             entry.activity_type === 'cycling' ||
             entry.activity_type === 'swimming' ||
             entry.activity_type === 'climbing');
        });
        
        console.log("Cardio entries found in logs:", cardioEntries.length);
        // Process log entries (same as before)
        if (!cardioEntries || cardioEntries.length === 0) {
          return defaultMetrics;
        }
        
        const rate = (cardioEntries.length / filteredData.length) * 100;
        
        // Calculate total miles from log entries
        const totalMiles = cardioEntries.reduce((sum, entry) => {
          if (!entry) return sum;
          
          // Handle multiple possible field names for miles
          const miles = parseFloat(
            entry.miles || 
            entry.distance || 
            entry.distanceInMiles || 
            entry.run_distance || 
            0
          );
          
          return sum + (isNaN(miles) ? 0 : miles);
        }, 0);
        
        // Continue with log-based exercise loads calculation
        const exerciseLoads = cardioEntries.map(entry => {
          if (!entry) return null;
          
          const duration = parseFloat(
            entry.duration || 
            entry.durationInMinutes || 
            entry.exercise_duration || 
            entry.workout_duration || 
            0
          );
          
          const heartRate = parseFloat(
            entry.heart_rate || 
            entry.heartRate || 
            entry.bpm || 
            entry.avg_heart_rate || 
            entry.avgHeartRate || 
            0
          );
          
          const activity = 
            entry.activity_type || 
            entry.activityType || 
            entry.exercise_type || 
            entry.workout_type || 
            'exercise';
          
          const defaultDuration = 30;
          const defaultHeartRate = 130;
          
          return {
            date: entry.date ? new Date(entry.date) : new Date(),
            load: ((isNaN(duration) ? defaultDuration : duration) * 
                  (isNaN(heartRate) ? defaultHeartRate : heartRate)) / 100,
            activity: activity,
            duration: isNaN(duration) ? defaultDuration : duration,
            heartRate: isNaN(heartRate) ? defaultHeartRate : heartRate,
            id: entry.id || `cardio-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            source: 'log'
          };
        }).filter(load => load !== null);
        
        // Calculate weekly load from logs
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const weeklyLoads = exerciseLoads.filter(load => load && load.date >= oneWeekAgo);
        const weeklyLoadSum = weeklyLoads.reduce((sum, entry) => sum + (entry ? entry.load : 0), 0);
        
        return {
          rate: rate,
          count: cardioEntries.length,
          totalMiles: totalMiles,
          averageMiles: cardioEntries.length > 0 ? totalMiles / cardioEntries.length : 0,
          exerciseLoads: exerciseLoads,
          weeklyLoad: weeklyLoadSum,
          recentLoads: weeklyLoads,
          source: 'logs'
        };
      }
      
      // If we have health metrics, use them instead
      console.log("Using health metrics for cardio calculation, count:", healthMetrics.length);
      
      // Filter health metrics for cardio activities
      const cardioMetrics = healthMetrics.filter(metric => {
        return metric && (
          // Include all metrics with activity type that indicates cardio
          (metric.activityType && [
            'running', 'cycling', 'swimming', 'walking', 'hiking', 
            'climbing', 'Run', 'Ride', 'Swim', 'Walk', 'Hike'
          ].includes(metric.activityType)) ||
          // Or those explicitly marked as cardio
          metric.cardio === 'Yes' ||
          // Or those from Strava which would be cardio
          (metric.source === 'strava' && metric.activityType)
        );
      });
      
      if (!cardioMetrics || cardioMetrics.length === 0) {
        console.log("No cardio metrics found in health data, falling back to logs");
        // Fall back to logs calculation (recursive call without health metrics)
        const tempHealthMetrics = healthMetrics;
        healthMetrics = []; // Clear temporarily to force fallback
        const result = calculateCardioMetrics();
        healthMetrics = tempHealthMetrics; // Restore
        return result;
      }
      
      console.log("Cardio metrics found:", cardioMetrics.length);
      
      // Calculate total miles or distance
      const totalMiles = cardioMetrics.reduce((sum, metric) => {
        if (!metric) return sum;
        
        // Handle distance (meters from Strava) or miles from logs
        let distance = 0;
        
        if (metric.distance) {
          // If from Strava, convert meters to miles
          if (metric.source === 'strava') {
            distance = metric.distance / 1609.34; // meters to miles
          } else {
            // If it's already in miles or another format
            distance = parseFloat(metric.distance) || 0;
            // Check if we need to convert from meters
            if (distance > 1000) { // Likely in meters
              distance = distance / 1609.34;
            }
          }
        } else if (metric.miles) {
          // Direct miles value
          distance = parseFloat(metric.miles) || 0;
        }
        
        return sum + (isNaN(distance) ? 0 : distance);
      }, 0);
      
      // Process health metrics into exercise loads
      const exerciseLoads = cardioMetrics.map(metric => {
        if (!metric) return null;
        
        // Convert date from Firestore timestamp if needed
        let metricDate;
        if (metric.date && typeof metric.date.toDate === 'function') {
          metricDate = metric.date.toDate();
        } else if (metric.date instanceof Date) {
          metricDate = metric.date;
        } else {
          metricDate = new Date(metric.date || Date.now());
        }
        
        // Handle duration in various formats
        let duration = 0;
        if (metric.duration) {
          duration = parseFloat(metric.duration);
          // If from Strava, duration is in seconds, convert to minutes
          if (metric.source === 'strava' && duration > 500) { // Likely in seconds
            duration = duration / 60;
          }
        } else {
          duration = 30; // Default
        }
        
        // Handle heart rate in various formats
        let heartRate = 0;
        if (metric.averageHeartRate) {
          heartRate = parseFloat(metric.averageHeartRate);
        } else if (metric.heart_rate) {
          heartRate = parseFloat(metric.heart_rate);
        } else if (metric.heartRate) {
          heartRate = parseFloat(metric.heartRate);
        } else {
          heartRate = 130; // Default
        }
        
        // Get activity type
        const activity = metric.activityType || metric.activity_type || 'exercise';
        
        // Calculate load based on duration and heart rate
        const load = (duration * heartRate) / 100;
        
        return {
          date: metricDate,
          load: load,
          activity: activity,
          duration: duration,
          heartRate: heartRate,
          id: metric.id || `health-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          source: metric.source || 'health',
          // Include additional data if available
          distance: metric.distance ? 
            (metric.source === 'strava' ? metric.distance / 1609.34 : metric.distance) : 
            (metric.miles || 0),
          calories: metric.calories || 0,
          elevationGain: metric.elevationGain || 0
        };
      }).filter(load => load !== null);
      
      // Sort by date
      exerciseLoads.sort((a, b) => b.date - a.date);
      
      // Calculate weekly load
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const weeklyLoads = exerciseLoads.filter(load => load && load.date >= oneWeekAgo);
      const weeklyLoadSum = weeklyLoads.reduce((sum, entry) => sum + (entry ? entry.load : 0), 0);
      
      // Calculate rate (percentage of days with cardio)
      // Get unique dates with cardio activities
      const uniqueDates = new Set(cardioMetrics.map(metric => {
        let date;
        if (metric.date && typeof metric.date.toDate === 'function') {
          date = metric.date.toDate();
        } else if (metric.date instanceof Date) {
          date = metric.date;
        } else {
          date = new Date(metric.date || Date.now());
        }
        return date.toISOString().split('T')[0];
      }));
      
      // Estimate a rate based on how many days in the last 30 had cardio
      const daysInPeriod = 30; // Assume 30 day period
      const rate = (uniqueDates.size / daysInPeriod) * 100;
      
      return {
        rate: rate,
        count: cardioMetrics.length,
        totalMiles: totalMiles,
        averageMiles: cardioMetrics.length > 0 ? totalMiles / cardioMetrics.length : 0,
        exerciseLoads: exerciseLoads,
        weeklyLoad: weeklyLoadSum,
        recentLoads: weeklyLoads,
        source: 'health metrics'
      };
    } catch (error) {
      console.error("Error calculating cardio metrics:", error);
      // Return safe default values to prevent crashes
      return { 
        rate: 0, 
        count: 0, 
        totalMiles: 0, 
        averageMiles: 0,
        weeklyLoad: 0,
        recentLoads: [],
        exerciseLoads: []
      };
    }
  }, [getFilteredData, healthMetrics]);

  // Compile all metrics for overview
  const getAllMetrics = useCallback(() => {
    // If no data, return default empty metrics
    if (!data || data.length === 0) {
      return {
        social: {
          family: { rate: 0, daysCount: 0, target: 0, progress: 0 },
          friends: { rate: 0, daysCount: 0, target: 0, progress: 0 },
          kat: { smile: { rate: 0, progress: 0 }, review: { count: 0, target: 0, progress: 0 } },
          newConnections: { phoneNumbers: { count: 0, target: 0, progress: 0 }, hangouts: { count: 0, target: 0, progress: 0 } },
          vibes: { average: 0, count: 0 }
        },
        wellbeing: {
          journaling: { morningRate: 0, eveningRate: 0, bothRate: 0, totalRate: 0, progress: 0 },
          meditation: { rate: 0, daysCount: 0, progress: 0 },
          epic: { count: 0, target: 0, progress: 0 }
        },
        health: {
          strength: { total: 0, pushups: 0, rows: 0, situps: 0, squats: 0, progress: 0 },
          sleep: { bedOnTime: { rate: 0, progress: 0 }, upOnTime: { rate: 0 }, overall: { rate: 0 } },
          cardio: { rate: 0, count: 0, totalMiles: 0, averageMiles: 0, weeklyLoad: 0, recentLoads: [] }
        },
        productivity: {
          language: { rate: 0, progress: 0 },
          math: { rate: 0, progress: 0 },
          code: { rate: 0, progress: 0 },
          lessons: { count: 0, target: 0, progress: 0 }
        }
      };
    }

    // Otherwise calculate metrics from data
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

  // Function for goal organization - simplified version that doesn't use categories
  const organizeGoalsByCategory = useCallback(() => {
    return {}; // Return empty object as we're no longer customizing goals
  }, []);


  const renderProgressBar = (label, value, target = 100) => {
    try {
      // Add more robust null checks
      const safeValue = (value === undefined || value === null || isNaN(value)) ? 0 : value;
      const safeTarget = (target === undefined || target === null || isNaN(target)) ? 100 : target;
      const progress = Math.min(100, Math.max(0, (safeValue / safeTarget) * 100));
      
      return (
        <div className="mb-4">
          <div className="flex justify-between mb-1">
            <span className="text-sm font-medium text-gray-200">{label || 'Progress'}</span>
            <span className="text-sm font-medium text-gray-200">{Math.round(safeValue)}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2.5">
            <div 
              className={`h-2.5 rounded-full ${progress >= 100 ? 'bg-green-500' : progress >= 70 ? 'bg-blue-500' : progress >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`} 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      );
    } catch (error) {
      console.error(`Error rendering progress bar for ${label}:`, error);
      // Fallback render for error cases
      return (
        <div className="mb-4">
          <div className="flex justify-between mb-1">
            <span className="text-sm font-medium text-gray-200">{label || 'Progress'}</span>
            <span className="text-sm font-medium text-gray-200">0%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2.5">
            <div className="h-2.5 rounded-full bg-red-500" style={{ width: '0%' }}></div>
          </div>
        </div>
      );
    }
  };

  const renderDashboardHeader = () => {
    return null;
  };
  
  const renderDashboardFooter = () => {
    return (
      <div className="mt-6 bg-gray-800 rounded-lg p-4 shadow border border-gray-700">
        <div className="flex justify-between items-center">
          <div>
            {lastUpdated && (
              <div className="text-xs text-gray-400">
                Last updated: {lastUpdated.toLocaleString()}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // No longer needed helper functions for goal customization

  // Goal settings rendering removed

  const renderHistoricalChart = (metric, title, color = '#8884d8') => {
    try {
      // Get data safely with error handling
      const historicalData = getGroupedHistoricalData ? getGroupedHistoricalData(metric) : [];
      
      if (!historicalData || historicalData.length <= 1) {
        return (
          <div className="bg-gray-800 p-4 rounded-lg shadow border border-gray-700 text-center">
            <p className="text-gray-300">Not enough data for historical view</p>
          </div>
        );
      }
      
      // Format the x-axis labels for better readability
      const formatXAxis = (period) => {
        // Provide default case for null/undefined
        if (!period) return '';
        
        // For YYYY-MM format, convert to MMM YY
        const parts = period.split('-');
        if (parts.length === 2) {
          const year = parts[0];
          const month = parseInt(parts[1], 10);
          if (isNaN(month) || month < 1 || month > 12) return period;
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          return `${months[month - 1]} ${year.slice(2)}`;
        }
        return period;
      };
      
      return (
        <div className="bg-gray-800 p-4 rounded-lg shadow border border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-200">{title || 'Historical Data'}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historicalData} margin={{ top: 5, right: 20, bottom: 30, left: 0 }}>
                <defs>
                  <linearGradient id={`gradient-${metric}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={color} stopOpacity={0.2}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis 
                  dataKey="period" 
                  tickFormatter={formatXAxis} 
                  tick={{ fontSize: 12, fill: '#bbb' }}
                  angle={-45}
                  textAnchor="end"
                  height={50}
                />
                <YAxis 
                  domain={[0, 100]} 
                  tick={{ fontSize: 12, fill: '#bbb' }}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip 
                  formatter={(value) => [`${Math.round(value)}%`, title]} 
                  labelFormatter={formatXAxis}
                  contentStyle={{
                    backgroundColor: 'rgba(45, 55, 72, 0.9)',
                    borderRadius: '5px',
                    padding: '10px',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                    color: '#ddd',
                    border: '1px solid #555'
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
    } catch (error) {
      console.error(`Error rendering historical chart for ${metric}:`, error);
      return (
        <div className="bg-gray-800 p-4 rounded-lg shadow border border-gray-700 text-center">
          <p className="text-gray-300">Unable to display chart</p>
        </div>
      );
    }
  };

  // GoalCategory component simplified to return empty div
  const GoalCategory = () => {
    return null;
  };
  
  // Render Strava Tab
  const renderStravaTab = () => {
    return (
      <div className="p-4">
        <h2 className="text-2xl font-bold mb-6 text-gray-100">Strava Integration</h2>
        
        {isStravaConnected ? (
          <div>
            <div className="bg-orange-900 text-orange-100 p-4 rounded-lg mb-6 flex justify-between items-center">
              <div>
                <p className="font-medium">Connected to Strava</p>
                {stravaData?.lastUpdated && (
                  <p className="text-sm text-orange-300 mt-1">
                    Last updated: {new Date(stravaData.lastUpdated).toLocaleString()}
                  </p>
                )}
                {stravaData?.athlete && (
                  <p className="text-sm text-orange-300 mt-1">
                    Athlete: {stravaData.athlete.firstname} {stravaData.athlete.lastname}
                  </p>
                )}
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={fetchStravaData}
                  disabled={isLoadingStrava}
                  className="px-4 py-2 bg-orange-700 hover:bg-orange-600 rounded-lg text-white text-sm"
                >
                  {isLoadingStrava ? "Syncing..." : "Sync Now"}
                </button>
                
                <button
                  onClick={importStravaData}
                  disabled={isLoading || isLoadingStrava}
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-600 rounded-lg text-white text-sm"
                >
                  {isLoading ? "Importing..." : "Import to Health Metrics"}
                </button>
                
                <button
                  onClick={() => {
                    if (window.confirm("Are you sure you want to disconnect from Strava?")) {
                      disconnectFromStrava();
                    }
                  }}
                  className="px-4 py-2 bg-red-700 hover:bg-red-600 rounded-lg text-white text-sm"
                >
                  Disconnect
                </button>
              </div>
            </div>
            
            {isLoadingStrava ? (
              <div className="text-center py-10">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-orange-500 border-r-transparent"></div>
                <p className="mt-4 text-gray-400">Fetching your Strava data...</p>
              </div>
            ) : stravaData ? (
              <div className="space-y-6">
                {/* Activities Summary */}
                <div className="bg-gray-800 rounded-lg shadow p-4 border border-gray-700">
                  <h3 className="text-xl font-semibold mb-4 text-gray-200">Activities</h3>
                  
                  {stravaData.activities && stravaData.activities.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-700">
                        <thead className="bg-gray-900">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Activity</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Type</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Distance</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Duration</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Elevation</th>
                          </tr>
                        </thead>
                        <tbody className="bg-gray-800 divide-y divide-gray-700">
                          {stravaData.activities.map((activity, index) => (
                            <tr key={activity.id || index} className={index % 2 === 0 ? 'bg-gray-750' : 'bg-gray-800'}>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300">
                                {new Date(activity.start_date).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300">
                                {activity.name}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300">
                                {activity.type}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300">
                                {(activity.distance / 1000).toFixed(2)} km
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300">
                                {Math.floor(activity.moving_time / 60)} min
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300">
                                {activity.total_elevation_gain} m
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-gray-400">No activity data available.</p>
                  )}
                </div>
                
                {/* Activity Stats Summary */}
                {stravaData.summary && (
                  <div className="bg-gray-800 rounded-lg shadow p-4 border border-gray-700">
                    <h3 className="text-xl font-semibold mb-4 text-gray-200">Activity Summary</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="bg-gray-700 p-4 rounded-lg">
                        <div className="text-sm text-gray-400">Total Activities</div>
                        <div className="text-2xl font-bold text-gray-100">{stravaData.summary.totalActivities}</div>
                      </div>
                      
                      <div className="bg-gray-700 p-4 rounded-lg">
                        <div className="text-sm text-gray-400">Total Distance</div>
                        <div className="text-2xl font-bold text-gray-100">{(stravaData.summary.totalDistance / 1000).toFixed(1)} km</div>
                      </div>
                      
                      <div className="bg-gray-700 p-4 rounded-lg">
                        <div className="text-sm text-gray-400">Total Elevation</div>
                        <div className="text-2xl font-bold text-gray-100">{stravaData.summary.totalElevation.toFixed(0)} m</div>
                      </div>
                      
                      <div className="bg-gray-700 p-4 rounded-lg">
                        <div className="text-sm text-gray-400">Total Duration</div>
                        <div className="text-2xl font-bold text-gray-100">
                          {Math.floor(stravaData.summary.totalDuration / 3600)}h {Math.floor((stravaData.summary.totalDuration % 3600) / 60)}m
                        </div>
                      </div>
                    </div>
                    
                    {/* Activity type breakdown if available */}
                    {stravaData.summary.activityCounts && Object.keys(stravaData.summary.activityCounts).length > 0 && (
                      <div className="mt-6">
                        <h4 className="text-lg font-medium mb-3 text-gray-300">Activity Types</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {Object.entries(stravaData.summary.activityCounts).map(([type, count]) => (
                            <div key={type} className="bg-gray-750 p-2 rounded text-center">
                              <div className="text-sm font-medium text-gray-300">{type}</div>
                              <div className="text-lg text-gray-100">{count}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-10">
                <p className="text-gray-400">No Strava data available. Try syncing.</p>
                <button
                  onClick={fetchStravaData}
                  className="mt-4 px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg text-white"
                >
                  Sync with Strava
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
            <h3 className="text-xl font-semibold mb-4 text-gray-200">Connect to Strava</h3>
            <p className="text-gray-400 mb-6">
              Connect your Strava account to automatically sync your activities, routes, and performance stats.
            </p>
            
            <div className="text-center">
              {process.env.REACT_APP_STRAVA_CLIENT_ID && 
               process.env.REACT_APP_STRAVA_CLIENT_ID !== '' ? (
                <>
                  <button
                    onClick={connectToStrava}
                    disabled={isLoadingStrava || !stravaService}
                    className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-md flex items-center justify-center mx-auto"
                  >
                    {isLoadingStrava ? (
                      <>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-t-transparent"></div>
                        Connecting...
                      </>
                    ) : (
                      <>
                        <svg className="mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                        </svg>
                        Connect to Strava
                      </>
                    )}
                  </button>
                  
                  <p className="mt-4 text-xs text-gray-500">
                    You'll be redirected to Strava to authorize access to your activities.
                    Your data is stored securely and only used within this app.
                  </p>
                </>
              ) : (
                <div className="bg-yellow-800 p-4 rounded-lg text-yellow-100 max-w-lg mx-auto">
                  <h4 className="font-bold mb-2">Strava Setup Required</h4>
                  <p className="mb-2">Strava integration requires additional setup:</p>
                  <ol className="list-decimal pl-5 mb-3 text-left text-sm space-y-1">
                    <li>Create an application on Strava API portal</li>
                    <li>Configure your API keys in the Settings</li>
                    <li>Set up the callback URL for authentication</li>
                    <li>Add your client ID and secret to the .env file</li>
                  </ol>
                  <p className="text-sm">Follow the instructions in the README for detailed setup.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };
  
  
  // GoalProgressBar component removed
  
  // Health Metric Form component
  const HealthMetricForm = () => {
    const [showForm, setShowForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formType, setFormType] = useState('health'); // 'health' or 'exercise'
    const [metricFormData, setMetricFormData] = useState({
      weight: '',
      systolic: '',
      diastolic: '',
      ldl: '',
      hdl: '',
      notes: '',
      source: 'manual'
    });
    
    const [exerciseFormData, setExerciseFormData] = useState({
      activity_type: 'running',
      duration: '30',
      miles: '',
      heart_rate: '130',
      notes: '',
      source: 'manual',
      cardio: 'Yes' // This ensures it's recognized as exercise data
    });
    
    const handleMetricChange = (e) => {
      const { name, value } = e.target;
      setMetricFormData(prev => ({
        ...prev,
        [name]: value
      }));
    };
    
    const handleExerciseChange = (e) => {
      const { name, value } = e.target;
      setExerciseFormData(prev => ({
        ...prev,
        [name]: value
      }));
    };
    
    const handleFormTypeChange = (type) => {
      setFormType(type);
    };
    
    const handleMetricSubmit = async (e) => {
      e.preventDefault();
      
      // Use appropriate form data based on selected form type
      const formData = formType === 'health' ? metricFormData : exerciseFormData;
      
      // Form validation - require at least one field to be filled
      const hasData = Object.entries(formData).some(([key, value]) => {
        return !['source', 'notes', 'cardio'].includes(key) && value !== '';
      });
      
      if (!hasData) {
        setError(`Please fill in at least one ${formType} field`);
        return;
      }
      
      try {
        setIsSubmitting(true);
        await addHealthMetric(formData);
        
        // Reset form
        if (formType === 'health') {
          setMetricFormData({
            weight: '',
            systolic: '',
            diastolic: '',
            ldl: '',
            hdl: '',
            notes: '',
            source: 'manual'
          });
        } else {
          setExerciseFormData({
            activity_type: 'running',
            duration: '30',
            miles: '',
            heart_rate: '130',
            notes: '',
            source: 'manual',
            cardio: 'Yes'
          });
        }
        
        // Refresh health metrics data
        fetchHealthMetrics();
        
        setShowForm(false);
      } catch (err) {
        console.error("Error submitting health metric:", err);
        setError(`Failed to save ${formType} data: ${err.message}`);
      } finally {
        setIsSubmitting(false);
      }
    };
    
    return (
      <>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-100">Health Metrics</h2>
          <div className="flex space-x-2">
            <button
              onClick={() => {
                setFormType('exercise');
                setShowForm(!showForm);
              }}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white"
              disabled={isSubmitting}
            >
              {showForm && formType === 'exercise' ? 'Cancel' : 'Add Exercise'}
            </button>
            <button
              onClick={() => {
                setFormType('health');
                setShowForm(!showForm);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white"
              disabled={isSubmitting}
            >
              {showForm && formType === 'health' ? 'Cancel' : 'Add Health Metric'}
            </button>
          </div>
        </div>
        
        {showForm && (
          <div className="bg-gray-800 p-4 rounded-lg shadow border border-gray-700 mb-6">
            <div className="flex mb-4 border-b border-gray-700">
              <button
                onClick={() => handleFormTypeChange('health')}
                className={`px-4 py-2 rounded-t-lg ${
                  formType === 'health' 
                    ? 'bg-blue-600 text-white font-medium' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Health Measurements
              </button>
              <button
                onClick={() => handleFormTypeChange('exercise')}
                className={`px-4 py-2 rounded-t-lg ${
                  formType === 'exercise' 
                    ? 'bg-green-600 text-white font-medium' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Exercise Data
              </button>
            </div>
            
            {formType === 'health' ? (
              <>
                <h3 className="text-lg font-semibold mb-4 text-gray-200">Add Health Measurement</h3>
                
                <form onSubmit={handleMetricSubmit}>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label htmlFor="weight" className="block text-sm font-medium mb-1 text-gray-300">
                        Weight (lbs)
                      </label>
                      <input
                        type="number"
                        id="weight"
                        name="weight"
                        value={metricFormData.weight}
                        onChange={handleMetricChange}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                        step="0.1"
                        min="0"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="systolic" className="block text-sm font-medium mb-1 text-gray-300">
                        Systolic BP
                      </label>
                      <input
                        type="number"
                        id="systolic"
                        name="systolic"
                        value={metricFormData.systolic}
                        onChange={handleMetricChange}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                        min="0"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="diastolic" className="block text-sm font-medium mb-1 text-gray-300">
                        Diastolic BP
                      </label>
                      <input
                        type="number"
                        id="diastolic"
                        name="diastolic"
                        value={metricFormData.diastolic}
                        onChange={handleMetricChange}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                        min="0"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="ldl" className="block text-sm font-medium mb-1 text-gray-300">
                        LDL (mg/dL)
                      </label>
                      <input
                        type="number"
                        id="ldl"
                        name="ldl"
                        value={metricFormData.ldl}
                        onChange={handleMetricChange}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                        min="0"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="hdl" className="block text-sm font-medium mb-1 text-gray-300">
                        HDL (mg/dL)
                      </label>
                      <input
                        type="number"
                        id="hdl"
                        name="hdl"
                        value={metricFormData.hdl}
                        onChange={handleMetricChange}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                        min="0"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="source" className="block text-sm font-medium mb-1 text-gray-300">
                        Source
                      </label>
                      <select
                        id="source"
                        name="source"
                        value={metricFormData.source}
                        onChange={handleMetricChange}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                      >
                        <option value="manual">Manual Entry</option>
                        <option value="doctor">Doctor Visit</option>
                        <option value="lab">Lab Test</option>
                        <option value="device">Device Measurement</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <label htmlFor="notes" className="block text-sm font-medium mb-1 text-gray-300">
                      Notes (optional)
                    </label>
                    <textarea
                      id="notes"
                      name="notes"
                      value={metricFormData.notes}
                      onChange={handleMetricChange}
                      className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                      rows={2}
                    ></textarea>
                  </div>
                  
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-md mr-3"
                      disabled={isSubmitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-t-transparent"></div>
                          Saving...
                        </>
                      ) : (
                        "Save Health Metric"
                      )}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold mb-4 text-gray-200">Add Exercise Data</h3>
                
                <form onSubmit={handleMetricSubmit}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label htmlFor="activity_type" className="block text-sm font-medium mb-1 text-gray-300">
                        Activity Type
                      </label>
                      <select
                        id="activity_type"
                        name="activity_type"
                        value={exerciseFormData.activity_type}
                        onChange={handleExerciseChange}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                      >
                        <option value="running">Running</option>
                        <option value="cycling">Cycling</option>
                        <option value="swimming">Swimming</option>
                        <option value="walking">Walking</option>
                        <option value="hiking">Hiking</option>
                        <option value="climbing">Climbing</option>
                        <option value="weightlifting">Weightlifting</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    
                    <div>
                      <label htmlFor="duration" className="block text-sm font-medium mb-1 text-gray-300">
                        Duration (minutes)
                      </label>
                      <input
                        type="number"
                        id="duration"
                        name="duration"
                        value={exerciseFormData.duration}
                        onChange={handleExerciseChange}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                        min="0"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="miles" className="block text-sm font-medium mb-1 text-gray-300">
                        Distance (miles)
                      </label>
                      <input
                        type="number"
                        id="miles"
                        name="miles"
                        value={exerciseFormData.miles}
                        onChange={handleExerciseChange}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                        step="0.1"
                        min="0"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="heart_rate" className="block text-sm font-medium mb-1 text-gray-300">
                        Avg. Heart Rate (BPM)
                      </label>
                      <input
                        type="number"
                        id="heart_rate"
                        name="heart_rate"
                        value={exerciseFormData.heart_rate}
                        onChange={handleExerciseChange}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                        min="0"
                      />
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <label htmlFor="exerciseNotes" className="block text-sm font-medium mb-1 text-gray-300">
                      Notes (optional)
                    </label>
                    <textarea
                      id="exerciseNotes"
                      name="notes"
                      value={exerciseFormData.notes}
                      onChange={handleExerciseChange}
                      className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                      rows={2}
                    ></textarea>
                  </div>
                  
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-md mr-3"
                      disabled={isSubmitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md flex items-center"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-t-transparent"></div>
                          Saving...
                        </>
                      ) : (
                        "Save Exercise"
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        )}
      </>
    );
  };
  
  // Helper function to group activities by type
  const groupActivitiesByType = (activities) => {
    if (!activities || !Array.isArray(activities) || activities.length === 0) {
      return {};
    }
    
    const groupedActivities = {};
    
    activities.forEach(activity => {
      if (!activity) return;
      
      let type = activity.activity || activity.activityType || 'Other';
      // Normalize activity type
      type = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
      
      if (!groupedActivities[type]) {
        groupedActivities[type] = {
          count: 0,
          totalDistance: 0,
          totalDuration: 0,
          activities: []
        };
      }
      
      groupedActivities[type].count++;
      groupedActivities[type].totalDistance += parseFloat(activity.distance || 0);
      groupedActivities[type].totalDuration += parseFloat(activity.duration || 0);
      groupedActivities[type].activities.push(activity);
    });
    
    return groupedActivities;
  };

  const renderHealthTab = () => {
    const metrics = getAllMetrics()?.health || {};
    const organizedGoals = organizeGoalsByCategory() || {};
    const healthGoals = {};
    
    // Group activities by type for summary
    const exerciseLoads = metrics?.health?.cardio?.exerciseLoads || [];
    const activitySummary = groupActivitiesByType(exerciseLoads);
    
    return (
      <>
        <HealthMetricForm />
        
        {/* Loading indicator */}
        {isLoadingHealthMetrics && (
          <div className="bg-gray-800 p-4 rounded-lg shadow border border-gray-700 mb-6">
            <div className="flex justify-center items-center py-6">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
              <p className="ml-4 text-gray-300">Loading health metrics...</p>
            </div>
          </div>
        )}
        
        {/* Activity summary section */}
        <div className="mb-6">
          <div className="bg-gray-800 p-4 rounded-lg shadow border border-gray-700">
            <h3 className="text-lg font-semibold mb-3 text-gray-200">Activity Summary</h3>
            
            {Object.keys(activitySummary).length > 0 ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-gray-700 p-3 rounded-lg">
                    <div className="text-sm text-gray-400">Total Activities</div>
                    <div className="text-xl font-bold text-gray-100">{exerciseLoads.length}</div>
                  </div>
                  
                  <div className="bg-gray-700 p-3 rounded-lg">
                    <div className="text-sm text-gray-400">Total Distance</div>
                    <div className="text-xl font-bold text-gray-100">
                      {exerciseLoads.reduce((sum, activity) => sum + parseFloat(activity.distance || 0), 0).toFixed(1)} mi
                    </div>
                  </div>
                  
                  <div className="bg-gray-700 p-3 rounded-lg">
                    <div className="text-sm text-gray-400">Total Duration</div>
                    <div className="text-xl font-bold text-gray-100">
                      {Math.round(exerciseLoads.reduce((sum, activity) => sum + parseFloat(activity.duration || 0), 0))} min
                    </div>
                  </div>
                  
                  <div className="bg-gray-700 p-3 rounded-lg">
                    <div className="text-sm text-gray-400">Activity Types</div>
                    <div className="text-xl font-bold text-gray-100">{Object.keys(activitySummary).length}</div>
                  </div>
                </div>
                
                {/* Activity type breakdown */}
                <div>
                  <h4 className="text-sm font-medium mb-2 text-gray-400">Activities by Type</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {Object.entries(activitySummary)
                      .sort(([, a], [, b]) => b.count - a.count)
                      .slice(0, 6)
                      .map(([type, data]) => (
                        <div key={type} className="bg-gray-750 rounded p-2 flex justify-between items-center">
                          <div className="font-medium text-gray-300">{type}</div>
                          <div>
                            <span className="text-sm bg-gray-700 px-2 py-0.5 rounded text-gray-300">{data.count}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-gray-400 py-4">No activity data available. Add exercise activities or import from Strava.</p>
            )}
          </div>
        </div>
        
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-100">Exercise Load</h2>
            <div className="relative inline-block">
              <select 
                className="bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-2 appearance-none pr-8"
                onChange={(e) => setDateRange(e.target.value)}
                value={dateRange}
              >
                <option value="7days">7 Days</option>
                <option value="30days">30 Days</option>
                <option value="90days">3 Months</option>
                <option value="all">All Time</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                </svg>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-800 p-4 rounded-lg shadow border border-gray-700">
              <h3 className="text-lg font-semibold mb-2 text-gray-200">Weekly Load</h3>
              <div className="text-3xl font-bold text-white mb-1">
                {Math.round(metrics?.health?.cardio?.weeklyLoad || 0)}
              </div>
              <p className="text-gray-400 text-sm">Training load in the past 7 days</p>
            </div>
            
            <div className="bg-gray-800 p-4 rounded-lg shadow border border-gray-700">
              <h3 className="text-lg font-semibold mb-2 text-gray-200">Recent Activities</h3>
              <div className="text-3xl font-bold text-white mb-1">
                {metrics?.health?.cardio?.recentLoads?.length || 0}
              </div>
              <p className="text-gray-400 text-sm">Workouts in the selected period</p>
            </div>
            
            <div className="bg-gray-800 p-4 rounded-lg shadow border border-gray-700">
              <h3 className="text-lg font-semibold mb-2 text-gray-200">Average Intensity</h3>
              <div className="text-3xl font-bold text-white mb-1">
                {metrics?.health?.cardio?.recentLoads?.length > 0 && Array.isArray(metrics.health.cardio.recentLoads)
                  ? Math.round(
                      metrics.health.cardio.recentLoads.reduce(
                        (sum, load) => sum + (load?.heartRate || 0), 
                        0
                      ) / metrics.health.cardio.recentLoads.length
                    ) 
                  : '-'}
              </div>
              <p className="text-gray-400 text-sm">Average heart rate (BPM)</p>
            </div>
          </div>
          
          {/* Recent exercise loads */}
          <div className="bg-gray-800 p-4 rounded-lg shadow border border-gray-700 mb-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-200">Recent Exercise Activities</h3>
            
            {metrics?.health?.cardio?.recentLoads?.length > 0 && Array.isArray(metrics.health.cardio.recentLoads) ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                  <thead className="bg-gray-900">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Activity</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Duration</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Distance</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Heart Rate</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Load</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Source</th>
                    </tr>
                  </thead>
                  <tbody className="bg-gray-800 divide-y divide-gray-700">
                    {metrics.health.cardio.recentLoads.map((load, index) => {
                      // Skip invalid loads
                      if (!load) return null;
                      
                      return (
                        <tr key={load.id || `load-${index}`}>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300">
                            {load.date ? (
                              typeof load.date.toLocaleDateString === 'function' 
                                ? load.date.toLocaleDateString()
                                : new Date(load.date).toLocaleDateString()
                            ) : 'N/A'}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300 capitalize">
                            {load.activity || 'N/A'}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300">
                            {load.duration || 0} min
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300">
                            {load.distance ? `${load.distance.toFixed(2)} mi` : '-'}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300">
                            {load.heartRate || 0} BPM
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300 font-medium">
                            {Math.round(load.load || 0)}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm">
                            {load.source === 'strava' ? (
                              <span className="bg-orange-900 text-orange-300 px-2 py-0.5 rounded-full text-xs">
                                Strava
                              </span>
                            ) : load.source === 'googleFit' ? (
                              <span className="bg-blue-900 text-blue-300 px-2 py-0.5 rounded-full text-xs">
                                Google Fit
                              </span>
                            ) : (
                              <span className="bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full text-xs">
                                Manual
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-400 text-center py-4">No exercise data available for the selected period</p>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-gray-800 p-4 rounded-lg shadow border border-gray-700">
            <h3 className="text-lg font-semibold mb-4 text-gray-200">Strength (400 Challenge)</h3>
            <div className="mb-6">
              <div className="flex justify-between mb-1">
                <span className="text-lg font-bold text-gray-200">
                  Total: {metrics?.strength?.total || 0}/{goals?.health?.strengthChallengeTarget?.value || 400}
                </span>
                <span className="text-lg font-bold text-gray-200">
                  {Math.round(metrics?.strength?.progress || 0)}%
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-4 border border-gray-600">
                <div 
                  className="bg-blue-600 h-4 rounded-full" 
                  style={{ width: `${metrics?.strength?.progress || 0}%` }}
                ></div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-medium text-gray-300">
                  Pushups: {metrics?.strength?.pushups || 0}
                </p>
                <div className="w-full bg-gray-700 rounded-full h-2 border border-gray-600">
                  <div 
                    className="bg-green-500 h-2 rounded-full" 
                    style={{ width: `${((metrics?.strength?.pushups || 0)/100)*100}%` }}
                  ></div>
                </div>
              </div>
              <div>
                <p className="font-medium text-gray-300">
                  Rows: {metrics?.strength?.rows || 0}
                </p>
                <div className="w-full bg-gray-700 rounded-full h-2 border border-gray-600">
                  <div 
                    className="bg-yellow-500 h-2 rounded-full" 
                    style={{ width: `${((metrics?.strength?.rows || 0)/100)*100}%` }}
                  ></div>
                </div>
              </div>
              <div>
                <p className="font-medium text-gray-300">
                  Situps: {metrics?.strength?.situps || 0}
                </p>
                <div className="w-full bg-gray-700 rounded-full h-2 border border-gray-600">
                  <div 
                    className="bg-red-500 h-2 rounded-full" 
                    style={{ width: `${((metrics?.strength?.situps || 0)/100)*100}%` }}
                  ></div>
                </div>
              </div>
              <div>
                <p className="font-medium text-gray-300">
                  Squats: {metrics?.strength?.squats || 0}
                </p>
                <div className="w-full bg-gray-700 rounded-full h-2 border border-gray-600">
                  <div 
                    className="bg-purple-500 h-2 rounded-full" 
                    style={{ width: `${((metrics?.strength?.squats || 0)/100)*100}%` }}
                  ></div>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-400 mt-4">
              Target: Complete {goals?.health?.strengthChallengeTarget?.value || 400} Challenge by May 1st
            </p>
          </div>
          
          <div className="bg-gray-800 p-4 rounded-lg shadow border border-gray-700">
            <h3 className="text-lg font-semibold mb-4 text-gray-200">Sleep</h3>
            {renderProgressBar("Bed On Time", metrics?.sleep?.bedOnTime?.rate || 0, 100)}
            {renderProgressBar("Up On Time", metrics?.sleep?.upOnTime?.rate || 0, 100)}
            <p className="text-sm text-gray-400 mt-2">
              Target: {goals?.health?.sleepOnTimePercentage?.value || 90}% within one hour of bedtime weekly average
            </p>
          </div>
        </div>
        
        {/* Display detailed goals for Health */}
        {Object.entries(healthGoals).map(([category, goals]) => (
          <GoalCategory key={category} title={category} goals={goals} />
        ))}
        
        <h3 className="text-xl font-semibold mb-4 text-gray-200">Health Trends</h3>
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
    const productivityGoals = {};
    
    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-gray-800 p-4 rounded-lg shadow border border-gray-700">
            <h3 className="text-lg font-semibold mb-4 text-gray-200">Language, Math & Coding</h3>
            {renderProgressBar("Language", metrics.language.rate, 100)}
            {renderProgressBar("Math", metrics.math.rate, 100)}
            {renderProgressBar("Coding", metrics.code.rate, 100)}
            <p className="text-sm text-gray-400 mt-2">Target: More than {goals.productivity.languageDaysPercentage.value}% of days monthly rolling average</p>
          </div>
          
          <div className="bg-gray-800 p-4 rounded-lg shadow border border-gray-700">
            <h3 className="text-lg font-semibold mb-4 text-gray-200">Lesson Completion</h3>
            {renderProgressBar("Lessons Completed", metrics.lessons.count, metrics.lessons.target)}
            <p className="text-sm text-gray-400 mt-2">Target: At least {goals.productivity.lessonsPerMonth.value} per month</p>
          </div>
        </div>
        
        {/* Display detailed goals for Productivity */}
        {Object.entries(productivityGoals).map(([category, goals]) => (
          <GoalCategory key={category} title={category} goals={goals} />
        ))}
        
        <h3 className="text-xl font-semibold mb-4 text-gray-200">Productivity Trends</h3>
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
    const wellbeingGoals = {};
    
    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-gray-800 p-4 rounded-lg shadow border border-gray-700">
            <h3 className="text-lg font-semibold mb-4 text-gray-200">Journaling</h3>
            {renderProgressBar("Morning Journal", metrics.journaling.morningRate, 100)}
            {renderProgressBar("Evening Journal", metrics.journaling.eveningRate, 100)}
            {renderProgressBar("Both Morning & Evening", metrics.journaling.bothRate, 100)}
            <p className="text-sm text-gray-400 mt-2">Target: >{goals.wellbeing.journalingPercentage.value}% monthly rolling average</p>
          </div>
          
          <div className="bg-gray-800 p-4 rounded-lg shadow border border-gray-700">
            <h3 className="text-lg font-semibold mb-4 text-gray-200">Meditation/Prayer</h3>
            {renderProgressBar("Days with Meditation", metrics.meditation.rate, 100)}
            <p className="text-sm text-gray-400 mt-2">Target: >{goals.wellbeing.meditationPercentage.value}% of days monthly rolling average</p>
          </div>
        </div>
        
        <div className="bg-gray-800 p-4 rounded-lg shadow mb-6 border border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-200">Epic Activities</h3>
          {renderProgressBar("Epic Activities", metrics.epic.count, metrics.epic.target)}
          <p className="text-sm text-gray-400 mt-2">Target: At least {goals.wellbeing.epicActivitiesPerMonth.value} per month</p>
        </div>
        
        {/* Display detailed goals for Wellbeing */}
        {Object.entries(wellbeingGoals).map(([category, goals]) => (
          <GoalCategory key={category} title={category} goals={goals} />
        ))}
        
        <h3 className="text-xl font-semibold mb-4 text-gray-200">Wellbeing Trends</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {renderHistoricalChart('morning_journal', 'Morning Journal History', '#f59e0b')}
          {renderHistoricalChart('evening_journal', 'Evening Journal History', '#ef4444')}
          {renderHistoricalChart('meditation', 'Meditation History', '#8b5cf6')}
          {renderHistoricalChart('epic_activity', 'Epic Activities History', '#ec4899')}
        </div>
      </>
    );
  };

  // Projects state
  const [showCreateProject, setShowCreateProject] = useState(false);
  
  
  // Project Form Component
  const ProjectForm = ({ onSubmit, initialData }) => {
    const [projectData, setProjectData] = useState(initialData || {
      title: '',
      description: '',
      endDate: '',
      goals: []
    });
    
    const [isEditing, setIsEditing] = useState(false);
    
    const handleChange = (e) => {
      const { name, value } = e.target;
      setProjectData(prev => ({
        ...prev,
        [name]: value
      }));
    };
    
    const handleSubmit = async (e) => {
      e.preventDefault();
      
      // Validate form data
      if (!projectData.title.trim()) {
        setError('Project title is required');
        return;
      }
      
      if (!projectData.endDate) {
        setError('Project end date is required');
        return;
      }
      
      // Format data for submission
      const formattedData = {
        ...projectData,
        endDate: Timestamp.fromDate(new Date(projectData.endDate))
      };
      
      await onSubmit(formattedData);
      
      // Reset form if not editing an existing project
      if (!initialData) {
        setProjectData({
          title: '',
          description: '',
          endDate: '',
          goals: []
        });
      } else {
        setIsEditing(false);
      }
    };
    
    return (
      <div className="bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700">
        <h3 className="text-lg font-semibold mb-4 text-gray-100">
          {initialData ? 'Edit Project' : 'Create New Project'}
        </h3>
        
        {initialData && !isEditing ? (
          <div className="text-center">
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
            >
              Edit Project Details
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="title" className="block text-sm font-medium mb-1 text-gray-300">
                Project Title
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={projectData.title}
                onChange={handleChange}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400"
                placeholder="Enter project title"
                required
              />
            </div>
            
            <div className="mb-4">
              <label htmlFor="description" className="block text-sm font-medium mb-1 text-gray-300">
                Description (Optional)
              </label>
              <textarea
                id="description"
                name="description"
                value={projectData.description}
                onChange={handleChange}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400"
                rows={3}
                placeholder="Describe your project"
              />
            </div>
            
            <div className="mb-4">
              <label htmlFor="endDate" className="block text-sm font-medium mb-1 text-gray-300">
                Target Completion Date
              </label>
              <input
                type="date"
                id="endDate"
                name="endDate"
                value={projectData.endDate}
                onChange={handleChange}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                required
              />
            </div>
            
            <div className="flex justify-end">
              {initialData && (
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-md mr-2"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
              >
                {initialData ? 'Update Project' : 'Create Project'}
              </button>
            </div>
          </form>
        )}
      </div>
    );
  };
  
  // Project Timeline Component
  const ProjectTimeline = ({ project, onUpdate }) => {
    const [showGoalForm, setShowGoalForm] = useState(false);
    const [newGoal, setNewGoal] = useState({
      title: '',
      description: '',
      dueDate: '',
      completed: false
    });
    
    // Calculate timeline spans
    const calculateTimelinePosition = (date) => {
      if (!project.endDate || !project.createdAt) return 0;
      
      const projectStart = new Date(project.createdAt).getTime();
      const projectEnd = new Date(project.endDate).getTime();
      const goalDate = new Date(date).getTime();
      
      // Calculate percentage
      const totalDuration = projectEnd - projectStart;
      const goalPosition = goalDate - projectStart;
      
      return Math.min(100, Math.max(0, (goalPosition / totalDuration) * 100));
    };
    
    const handleGoalChange = (e) => {
      const { name, value } = e.target;
      setNewGoal(prev => ({
        ...prev,
        [name]: value
      }));
    };
    
    const addGoal = () => {
      // Validate form data
      if (!newGoal.title.trim() || !newGoal.dueDate) {
        setError('Goal title and due date are required');
        return;
      }
      
      // Add goal to project
      const updatedGoals = [
        ...project.goals,
        {
          id: Date.now().toString(), // Simple unique ID
          ...newGoal,
          completed: false
        }
      ];
      
      // Sort goals by due date
      updatedGoals.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
      
      // Update the project
      onUpdate({
        ...project,
        goals: updatedGoals
      });
      
      // Reset form
      setNewGoal({
        title: '',
        description: '',
        dueDate: '',
        completed: false
      });
      setShowGoalForm(false);
    };
    
    const toggleGoalCompleted = (goalId) => {
      const updatedGoals = project.goals.map(goal => {
        if (goal.id === goalId) {
          return {
            ...goal,
            completed: !goal.completed
          };
        }
        return goal;
      });
      
      onUpdate({
        ...project,
        goals: updatedGoals
      });
    };
    
    // Format dates for display
    const formatDate = (date) => {
      if (!date) return 'N/A';
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    };
    
    // Calculate progress
    const calculateProgress = () => {
      if (project.goals.length === 0) return 0;
      
      const completedGoals = project.goals.filter(goal => goal.completed).length;
      return (completedGoals / project.goals.length) * 100;
    };
    
    // Get the last completed goal
    const getLastCompletedGoalPosition = () => {
      if (project.goals.length === 0) return 0;
      
      const completedGoals = project.goals
        .filter(goal => goal.completed)
        .sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));
      
      if (completedGoals.length === 0) return 0;
      return calculateTimelinePosition(completedGoals[0].dueDate);
    };
    
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 shadow-lg">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-bold text-gray-100">{project.title}</h3>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowGoalForm(!showGoalForm)}
              className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
            >
              {showGoalForm ? 'Cancel' : 'Add Goal'}
            </button>
            
            <button
              onClick={() => {
                if (window.confirm(`Mark project "${project.title}" as complete?\n\nThis will delete the project. This action cannot be undone.`)) {
                  deleteProject(project.id);
                }
              }}
              className="px-2 py-1 bg-red-700 hover:bg-red-800 text-white text-xs rounded-md"
            >
              Complete
            </button>
          </div>
        </div>
        
        {showGoalForm && (
          <div className="mb-4 p-3 bg-gray-700 rounded-md border border-gray-600">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label htmlFor="title" className="block text-xs font-medium mb-1 text-gray-300">
                  Goal Title
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={newGoal.title}
                  onChange={handleGoalChange}
                  className="w-full p-1.5 text-sm bg-gray-600 border border-gray-500 rounded-md text-white"
                  placeholder="Goal title"
                />
              </div>
              
              <div>
                <label htmlFor="dueDate" className="block text-xs font-medium mb-1 text-gray-300">
                  Due Date
                </label>
                <input
                  type="date"
                  id="dueDate"
                  name="dueDate"
                  value={newGoal.dueDate}
                  onChange={handleGoalChange}
                  className="w-full p-1.5 text-sm bg-gray-600 border border-gray-500 rounded-md text-white"
                />
              </div>
              
              <div className="flex items-end">
                <button
                  onClick={addGoal}
                  className="w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm"
                >
                  Add Goal
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Timeline visualization */}
        <div className="mt-3 mb-1">
          <div className="relative h-16">
            
            {/* Main timeline bar - using gradient based on progress */}
            <div className="absolute top-6 left-0 right-0 h-2 rounded-full overflow-hidden">
              {/* Create a gradient to represent progress */}
              <div 
                className="h-full w-full relative"
                style={{
                  background: `linear-gradient(to right, 
                    #10b981 0%, 
                    #10b981 ${getLastCompletedGoalPosition()}%, 
                    #374151 ${getLastCompletedGoalPosition()}%, 
                    #374151 100%)`
                }}
              >
                {/* Completion markers at 25%, 50%, and 75% */}
                <div className="absolute top-0 bottom-0 left-1/4 w-0.5 bg-gray-600 opacity-50"></div>
                <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-gray-600 opacity-50"></div>
                <div className="absolute top-0 bottom-0 left-3/4 w-0.5 bg-gray-600 opacity-50"></div>
              </div>
            </div>
            
            {/* Timeline start point */}
            <div className="absolute top-4 left-0 flex flex-col items-center">
              <div className="w-4 h-4 rounded-full bg-gray-800 border-2 border-green-500 z-10 flex items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-green-400"></div>
              </div>
            </div>
            
            {/* Timeline end point */}
            <div className="absolute top-4 right-0 flex flex-col items-center">
              <div className="w-4 h-4 rounded-full bg-gray-800 border-2 border-green-500 z-10 flex items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-green-400"></div>
              </div>
            </div>
            
            {/* Goal nodes */}
            {project.goals.map((goal, index) => {
              const position = calculateTimelinePosition(goal.dueDate);
              
              return (
                <div 
                  key={goal.id} 
                  className="absolute top-4 flex flex-col items-center group"
                  style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
                >
                  <div 
                    className={`w-5 h-5 rounded-full z-10 cursor-pointer border-2 flex items-center justify-center
                      ${goal.completed 
                        ? 'bg-gray-800 border-green-400' 
                        : position <= getLastCompletedGoalPosition()
                          ? 'bg-gray-800 border-yellow-500'
                          : 'bg-gray-800 border-gray-600'
                      }`}
                    onClick={() => toggleGoalCompleted(goal.id)}
                    title={`${goal.title} (${formatDate(goal.dueDate)})`}
                  >
                    {/* Inner dot that changes color based on completion */}
                    {goal.completed && (
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    )}
                  </div>
                  {/* Small permanent label */}
                  <div className="text-[8px] text-gray-500 mt-0.5 max-w-[50px] text-center overflow-hidden whitespace-nowrap text-ellipsis">
                    {goal.title}
                  </div>
                  
                  {/* Hover tooltip with more details and edit options */}
                  <div className="hidden group-hover:block absolute top-9 left-1/2 transform -translate-x-1/2 mt-1 bg-gray-900 px-3 py-2 rounded text-xs text-gray-300 z-20 border border-gray-700 shadow-lg min-w-[150px]">
                    <div className="font-medium">{goal.title}</div>
                    <div className="mt-1 text-gray-400">Due: {formatDate(goal.dueDate)}</div>
                    <div className="mt-2 flex justify-center">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          
                          if (window.confirm(`Delete goal: ${goal.title}?`)) {
                            const updatedGoals = project.goals.filter(g => g.id !== goal.id);
                            
                            // Update the project without this goal
                            onUpdate({
                              ...project,
                              goals: updatedGoals
                            });
                          }
                        }}
                        className="px-3 py-1 text-xs rounded bg-red-800 text-white hover:bg-red-700"
                      >
                        Delete Goal
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // Overview Tab with Projects
  const renderOverview = () => {
    const metrics = getAllMetrics();
    
    // Video game style health bar renderer
    const renderHealthBar = (label, value, maxValue, color, bgColor, icon) => {
      const percentage = Math.min(100, Math.round((value / maxValue) * 100));
      
      return (
        <div className="bg-gray-900 p-5 rounded-lg shadow-lg border border-gray-700">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center">
              {icon && <span className="mr-2">{icon}</span>}
              <h3 className="text-lg font-bold text-gray-100">{label}</h3>
            </div>
            <div className="text-lg font-bold text-gray-200">{value}/{maxValue}</div>
          </div>
          
          <div className="h-5 w-full bg-gray-800 rounded-full overflow-hidden border border-gray-700 relative">
            {/* Main health bar */}
            <div 
              className={`h-full ${color} transition-all duration-500 ease-out`} 
              style={{ width: `${percentage}%` }}
            ></div>
            
            {/* Segmented video game style overlay */}
            <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none">
              {[...Array(10)].map((_, i) => (
                <div 
                  key={i} 
                  className="absolute top-0 bottom-0 border-l border-gray-900 opacity-50"
                  style={{ left: `${(i+1) * 10}%` }}
                ></div>
              ))}
            </div>
          </div>
        </div>
      );
    };
    
    return (
      <>
        <div className="space-y-4 mb-6">
          <h2 className="text-2xl font-bold text-gray-100 mb-4">Status</h2>
          
          {/* Video game style health bars */}
          {renderHealthBar("Social Life", Math.round(metrics.social.family.rate), 100, "bg-blue-600", "bg-blue-900", "👥")}
          {renderHealthBar("Wellbeing", Math.round(metrics.wellbeing.journaling.totalRate), 100, "bg-purple-600", "bg-purple-900", "✨")}
          {renderHealthBar("Health", metrics.health.strength.total, goals.health.strengthChallengeTarget.value, "bg-green-600", "bg-green-900", "💪")}
        </div>
        
        {/* Projects Section */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-100">Projects</h2>
            <button
              onClick={() => setShowCreateProject(!showCreateProject)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white"
            >
              {showCreateProject ? 'Cancel' : 'New Project'}
            </button>
          </div>
          
          {showCreateProject && (
            <div className="mb-6">
              <ProjectForm onSubmit={addProject} />
            </div>
          )}
          
          {isLoadingProjects ? (
            <div className="text-center py-10">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
              <p className="mt-4 text-gray-400">Loading projects...</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-10 text-center border border-gray-700 shadow">
              <p className="text-gray-400 mb-4">No active projects</p>
              <button
                onClick={() => setShowCreateProject(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white"
              >
                Create Your First Project
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {projects.map(project => (
                <ProjectTimeline
                  key={project.id}
                  project={project}
                  onUpdate={(updatedData) => updateProject(project.id, updatedData)}
                />
              ))}
            </div>
          )}
        </div>
      </>
    );
  };

  // New Function for Database Tab
  const renderDatabaseTab = () => {
    const DatabaseManager = React.lazy(() => import('./DatabaseManager'));
    
    return (
      <React.Suspense fallback={
        <div className="text-center p-8">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
          <p className="mt-4 text-gray-300">Loading database manager...</p>
        </div>
      }>
        <DatabaseManager 
          isAuthenticated={isAuthenticated} 
          auth={auth}
          setError={setError}
        />
      </React.Suspense>
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
            onClick={() => fetchFirestoreData()}
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
          <h2 className="text-xl font-semibold mb-4">Sign In to Life Tracker</h2>
          <p className="mb-6 text-gray-600">
            {showSignUp ? "Create an account to track your goals" : "Sign in to view your Life Tracker Dashboard"}
          </p>
          
          <form onSubmit={showSignUp ? handleSignUp : handleSignIn} className="max-w-md mx-auto">
            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
            
            <div className="mb-6">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
            
            <button 
              type="submit"
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              disabled={isLoading}
            >
              {isLoading ? "Please wait..." : (showSignUp ? "Sign Up" : "Sign In")}
            </button>
          </form>
          
          <div className="mt-4">
            <button
              onClick={() => setShowSignUp(!showSignUp)}
              className="text-blue-600 hover:underline"
            >
              {showSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
            </button>
          </div>
        </div>
      );
    }

    return (
      <>
        {renderDashboardHeader()}
        
        {/* Latest Strava Activity section removed */}
        
        {activeTab === 'overview' && renderOverview()}
        {/* {activeTab === 'social' && renderSocialTab()} */}
        {activeTab === 'wellbeing' && renderWellbeingTab()}
        {activeTab === 'health' && renderHealthTab()}
        {activeTab === 'dailylog' && renderDailyLogTab()}
        {activeTab === 'strava' && renderStravaTab()}
        {activeTab === 'database' && renderDatabaseTab()}
        
        {renderDashboardFooter()}
      </>
    );
  };

  // Export all data to CSV  
  const exportAllData = async () => {
    if (!isAuthenticated || !auth.currentUser) {
      setError('You must be signed in to export data');
      return;
    }
    
    setIsExporting(true);
    
    try {
      // Fetch all data collections
      const dailyLogs = await getDocs(query(
        collection(db, 'users', auth.currentUser.uid, 'logs'),
        orderBy('timestamp', 'desc')
      ));
      
      const journalEntries = await getDocs(query(
        collection(db, 'users', auth.currentUser.uid, 'journal'),
        orderBy('timestamp', 'desc')
      ));
      
      const projectData = await getDocs(query(
        collection(db, 'users', auth.currentUser.uid, 'projects')
      ));
      
      const healthMetricsData = await getDocs(query(
        collection(db, 'users', auth.currentUser.uid, 'healthMetrics'),
        orderBy('date', 'desc')
      ));
      
      // Process data to CSV format
      let logsCSV = "date,";
      // Add headers dynamically from first log
      if (dailyLogs.docs.length > 0) {
        const firstLog = dailyLogs.docs[0].data();
        Object.keys(firstLog).forEach(key => {
          if (key !== 'userId' && key !== 'timestamp') {
            logsCSV += key + ',';
          }
        });
        logsCSV = logsCSV.slice(0, -1) + '\n'; // Remove trailing comma and add newline
        
        // Add data rows
        dailyLogs.docs.forEach(doc => {
          const data = doc.data();
          const date = data.timestamp?.toDate().toISOString() || '';
          logsCSV += date + ',';
          
          Object.keys(firstLog).forEach(key => {
            if (key !== 'userId' && key !== 'timestamp') {
              let value = data[key] || '';
              // Escape commas in string values
              if (typeof value === 'string' && value.includes(',')) {
                value = `"${value}"`;
              }
              logsCSV += value + ',';
            }
          });
          logsCSV = logsCSV.slice(0, -1) + '\n'; // Remove trailing comma and add newline
        });
      } else {
        logsCSV += "No data";
      }
      
      // Process journal entries
      let journalCSV = "date,title,type,mood,content\n";
      if (journalEntries.docs.length > 0) {
        journalEntries.docs.forEach(doc => {
          const entry = doc.data();
          const date = entry.timestamp?.toDate().toISOString() || '';
          const title = entry.title ? `"${entry.title}"` : '';
          const type = entry.journalType || '';
          const mood = entry.mood || '';
          const content = entry.content ? `"${entry.content.replace(/"/g, '""')}"` : '';
          
          journalCSV += `${date},${title},${type},${mood},${content}\n`;
        });
      } else {
        journalCSV += "No data";
      }
      
      // Process health metrics
      let healthCSV = "date,weight,systolic,diastolic,ldl,hdl,source,notes\n";
      if (healthMetricsData.docs.length > 0) {
        healthMetricsData.docs.forEach(doc => {
          const metric = doc.data();
          const date = metric.date?.toDate().toISOString() || '';
          const weight = metric.weight || '';
          const systolic = metric.systolic || '';
          const diastolic = metric.diastolic || '';
          const ldl = metric.ldl || '';
          const hdl = metric.hdl || '';
          const source = metric.source || '';
          const notes = metric.notes ? `"${metric.notes}"` : '';
          
          healthCSV += `${date},${weight},${systolic},${diastolic},${ldl},${hdl},${source},${notes}\n`;
        });
      } else {
        healthCSV += "No data";
      }
      
      // Create download links for each CSV
      const createDownloadLink = (content, filename) => {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      };
      
      // Download each CSV file
      createDownloadLink(logsCSV, `daily_logs_${new Date().toISOString().split('T')[0]}.csv`);
      createDownloadLink(journalCSV, `journal_entries_${new Date().toISOString().split('T')[0]}.csv`);
      createDownloadLink(healthCSV, `health_metrics_${new Date().toISOString().split('T')[0]}.csv`);
      
    } catch (error) {
      console.error("Error exporting data:", error);
      setError(`Error exporting data: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const renderHeader = () => {
    return (
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white p-4 rounded-lg shadow-lg mb-6 border border-gray-700">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
          <h1 className="text-2xl font-bold mb-4 md:mb-0">Life Goals Dashboard</h1>
          
          <div className="flex items-center space-x-2">
            {isAuthenticated && (
              <>
                <button 
                  onClick={fetchFirestoreData} 
                  className="p-2 bg-gray-700 rounded-full hover:bg-gray-600 transition-all"
                  title="Refresh Data"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                
                <button 
                  onClick={exportAllData} 
                  className="px-3 py-1 bg-green-700 rounded text-sm font-medium hover:bg-green-600 flex items-center"
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Exporting...
                    </>
                  ) : (
                    "Export CSV"
                  )}
                </button>
              </>
            )}
            
            {isAuthenticated ? (
              <button 
                onClick={handleSignOut} 
                className="px-4 py-2 rounded text-sm font-medium bg-gray-700 hover:bg-gray-600"
              >
                Sign Out
              </button>
            ) : (
              <button 
                onClick={() => setShowSignUp(false)} 
                className="px-4 py-2 rounded text-sm font-medium bg-gray-700 hover:bg-gray-600"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Strava service is imported at the top of the file
  
  // Strava state
  const [stravaService, setStravaService] = useState(null);
  const [isStravaConnected, setIsStravaConnected] = useState(false);
  const [stravaData, setStravaData] = useState(null);
  const [isLoadingStrava, setIsLoadingStrava] = useState(false);
  const [stravaAuthCode, setStravaAuthCode] = useState(null);
  
  // Initialize Strava service when authenticated
  useEffect(() => {
    if (isAuthenticated && auth.currentUser) {
      const service = new StravaService(auth.currentUser.uid);
      setStravaService(service);
      
      // Check connection status
      const checkConnection = async () => {
        console.log('Checking Strava connection status...');
        const isConnected = await service.checkConnection();
        console.log('Strava connected:', isConnected);
        setIsStravaConnected(isConnected);
        
        if (isConnected) {
          // If connected but no data, fetch it
          if (service.activityData) {
            console.log('Using existing Strava data');
            setStravaData(service.activityData);
          } else {
            console.log('Connected but no data, fetching...');
            try {
              const data = await service.fetchData();
              setStravaData(data);
            } catch (error) {
              console.error('Error fetching initial Strava data:', error);
            }
          }
        }
      };
      
      checkConnection();
      
      // Check URL for Strava authorization code
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      if (code) {
        setStravaAuthCode(code);
        // Clean up URL to remove auth code
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } else {
      setStravaService(null);
      setIsStravaConnected(false);
      setStravaData(null);
    }
  }, [isAuthenticated, auth.currentUser]);
  
  // Handle Strava authorization code if present
  useEffect(() => {
    if (stravaAuthCode && stravaService && !isStravaConnected) {
      const handleAuthCode = async () => {
        setIsLoadingStrava(true);
        try {
          console.log('Handling Strava auth code...');
          await stravaService.handleCallback(stravaAuthCode);
          setIsStravaConnected(true);
          const data = await stravaService.fetchData();
          setStravaData(data);
        } catch (error) {
          console.error('Error handling Strava auth code:', error);
          setError(`Error connecting to Strava: ${error.message}`);
        } finally {
          setIsLoadingStrava(false);
          setStravaAuthCode(null);
        }
      };
      
      handleAuthCode();
    }
  }, [stravaAuthCode, stravaService, isStravaConnected]);
  
  // Connect to Strava
  const connectToStrava = () => {
    // Check if client ID is properly configured
    if (!process.env.REACT_APP_STRAVA_CLIENT_ID || 
        process.env.REACT_APP_STRAVA_CLIENT_ID === '') {
      setError('Strava client ID not configured. Please set up the required environment variables.');
      return;
    }
    
    if (!stravaService) {
      setError('Strava service not initialized');
      return;
    }
    
    // Get the authorization URL and redirect to it
    const authUrl = stravaService.getAuthorizationUrl();
    window.location.href = authUrl;
  };
  
  // Disconnect from Strava
  const disconnectFromStrava = async () => {
    if (!stravaService) {
      return;
    }
    
    try {
      await stravaService.disconnect();
      setIsStravaConnected(false);
      setStravaData(null);
    } catch (error) {
      console.error('Error disconnecting from Strava:', error);
      setError(`Error disconnecting from Strava: ${error.message}`);
    }
  };
  
  // Fetch Strava data
  const fetchStravaData = async () => {
    if (!stravaService || !isStravaConnected) {
      return;
    }
    
    setIsLoadingStrava(true);
    
    try {
      const data = await stravaService.fetchData();
      setStravaData(data);
    } catch (error) {
      console.error('Error fetching Strava data:', error);
      setError(`Error fetching Strava data: ${error.message}`);
    } finally {
      setIsLoadingStrava(false);
    }
  };
  
  // Import Strava data to health metrics
  const importStravaData = async () => {
    if (!stravaService || !isStravaConnected || !auth.currentUser) {
      setError('Cannot import: Strava not connected or user not authenticated');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const importCount = await stravaService.importToHealthMetrics(auth.currentUser.uid);
      alert(`Successfully imported ${importCount} activities from Strava`);
      
      // Refresh health metrics
      fetchHealthMetrics();
    } catch (error) {
      console.error('Error importing Strava data:', error);
      setError(`Error importing Strava data: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Tab navigation component
  const renderTabs = () => {
    if (!isAuthenticated) return null;
    
    const tabs = [
      { id: 'overview', label: 'Overview' },
      { id: 'health', label: 'Health' },
      { id: 'wellbeing', label: 'Wellbeing' },
      { id: 'social', label: 'Social' },
      { id: 'dailylog', label: 'Daily Log' },
      { id: 'strava', label: 'Strava' },
      { id: 'database', label: 'Database' }
    ];
    
    return (
      <div className="mb-6 border-b border-gray-700">
        <div className="overflow-x-auto pb-1">
          <nav className="-mb-px flex" aria-label="Tabs">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap py-3 px-4 border-b-2 text-center text-sm font-medium ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
                }`}
                aria-current={activeTab === tab.id ? 'page' : undefined}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-3 md:p-6">
      <div className="max-w-6xl mx-auto">
        {renderHeader()}
        
        {isAuthenticated && renderTabs()}
        {renderContent()}
      </div>
    </div>
  );
};

export default LifeTrackerDashboard;