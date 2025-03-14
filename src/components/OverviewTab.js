import React, { useState, useEffect } from 'react';
import { getDoc, doc, query, collection, orderBy, limit, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';

const OverviewTab = ({
  // State from parent
  logs,
  tasks,
  projects,
  healthMetrics,
  goals,
  error,
  setError,
  
  // State management functions
  fetchLogs,
  fetchTasks,
  fetchProjects,
  fetchHealthMetrics,
  
  // Other props as needed
  userId
}) => {
  // Local state for UI controls
  const [recentActivity, setRecentActivity] = useState([]);
  const [stats, setStats] = useState({
    completedTasks: 0,
    activeTasks: 0,
    activeProjects: 0,
    completedProjects: 0,
    healthEntries: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  // Load overview data when component mounts or dependencies change
  useEffect(() => {
    const loadOverviewData = async () => {
      if (!auth.currentUser) return;
      
      setIsLoading(true);
      
      try {
        // Calculate stats from existing data
        const statsData = {
          completedTasks: tasks.filter(task => task.completed).length,
          activeTasks: tasks.filter(task => !task.completed).length,
          activeProjects: projects.filter(project => !project.completed).length,
          completedProjects: projects.filter(project => project.completed).length,
          healthEntries: healthMetrics.length
        };
        
        setStats(statsData);
        
        // Gather recent activity
        await fetchRecentActivity();
      } catch (error) {
        console.error("Error loading overview data:", error);
        setError(`Error loading overview data: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadOverviewData();
  }, [auth.currentUser, tasks, projects, healthMetrics]);
  
  // Fetch recent activity across all collections
  const fetchRecentActivity = async () => {
    if (!auth.currentUser) return;
    
    try {
      const recentItems = [];
      
      // Get recent logs
      const logsQuery = query(
        collection(db, 'users', auth.currentUser.uid, 'logs'),
        orderBy('timestamp', 'desc'),
        limit(3)
      );
      
      const logsSnapshot = await getDocs(logsQuery);
      logsSnapshot.forEach(doc => {
        const data = doc.data();
        recentItems.push({
          id: doc.id,
          type: 'log',
          title: 'Daily Log',
          timestamp: data.timestamp?.toDate() || new Date(),
          summary: data.content?.substring(0, 100) + '...' || 'No content'
        });
      });
      
      // Get recent tasks
      const tasksQuery = query(
        collection(db, 'users', auth.currentUser.uid, 'tasks'),
        orderBy('updatedAt', 'desc'),
        limit(3)
      );
      
      const tasksSnapshot = await getDocs(tasksQuery);
      tasksSnapshot.forEach(doc => {
        const data = doc.data();
        recentItems.push({
          id: doc.id,
          type: 'task',
          title: data.title || 'Task',
          timestamp: data.updatedAt?.toDate() || new Date(),
          summary: `Status: ${data.completed ? 'Completed' : 'Active'}`
        });
      });
      
      // Get recent health metrics
      const healthQuery = query(
        collection(db, 'users', auth.currentUser.uid, 'healthMetrics'),
        orderBy('date', 'desc'),
        limit(3)
      );
      
      const healthSnapshot = await getDocs(healthQuery);
      healthSnapshot.forEach(doc => {
        const data = doc.data();
        recentItems.push({
          id: doc.id,
          type: 'health',
          title: 'Health Metrics',
          timestamp: data.date?.toDate() || new Date(),
          summary: `Recorded ${Object.keys(data).filter(key => 
            !['date', 'id', 'timestamp'].includes(key)).length} measurements`
        });
      });
      
      // Sort by timestamp and set state
      recentItems.sort((a, b) => b.timestamp - a.timestamp);
      setRecentActivity(recentItems.slice(0, 5));
      
    } catch (error) {
      console.error("Error fetching recent activity:", error);
      setError(`Error fetching recent activity: ${error.message}`);
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-100">Dashboard Overview</h2>
        <button
          onClick={() => {
            fetchLogs();
            fetchTasks();
            fetchProjects();
            fetchHealthMetrics();
            fetchRecentActivity();
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white"
        >
          Refresh Data
        </button>
      </div>
      
      {/* Error Display */}
      {error && (
        <div className="bg-red-500 text-white p-3 rounded-md mb-4">
          {error}
        </div>
      )}
      
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="bg-gray-800 p-4 rounded-lg shadow border border-gray-700">
              <h3 className="text-sm font-medium text-gray-400 mb-1">Active Tasks</h3>
              <p className="text-2xl font-bold text-blue-400">{stats.activeTasks}</p>
            </div>
            
            <div className="bg-gray-800 p-4 rounded-lg shadow border border-gray-700">
              <h3 className="text-sm font-medium text-gray-400 mb-1">Completed Tasks</h3>
              <p className="text-2xl font-bold text-green-400">{stats.completedTasks}</p>
            </div>
            
            <div className="bg-gray-800 p-4 rounded-lg shadow border border-gray-700">
              <h3 className="text-sm font-medium text-gray-400 mb-1">Active Projects</h3>
              <p className="text-2xl font-bold text-blue-400">{stats.activeProjects}</p>
            </div>
            
            <div className="bg-gray-800 p-4 rounded-lg shadow border border-gray-700">
              <h3 className="text-sm font-medium text-gray-400 mb-1">Completed Projects</h3>
              <p className="text-2xl font-bold text-green-400">{stats.completedProjects}</p>
            </div>
            
            <div className="bg-gray-800 p-4 rounded-lg shadow border border-gray-700">
              <h3 className="text-sm font-medium text-gray-400 mb-1">Health Entries</h3>
              <p className="text-2xl font-bold text-purple-400">{stats.healthEntries}</p>
            </div>
          </div>
          
          {/* Recent Activity */}
          <div className="bg-gray-800 p-4 rounded-lg shadow border border-gray-700 mb-6">
            <h3 className="text-lg font-semibold mb-3 text-gray-200">Recent Activity</h3>
            
            {recentActivity.length === 0 ? (
              <p className="text-gray-400">No recent activity found.</p>
            ) : (
              <ul className="divide-y divide-gray-700">
                {recentActivity.map(item => (
                  <li key={`${item.type}-${item.id}`} className="py-3">
                    <div className="flex items-start">
                      {/* Activity icon based on type */}
                      <div className={`mt-1 mr-3 p-2 rounded-full ${
                        item.type === 'log' ? 'bg-blue-500' :
                        item.type === 'task' ? 'bg-green-500' :
                        item.type === 'health' ? 'bg-purple-500' : 'bg-gray-500'
                      }`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                          {item.type === 'log' && (
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                          )}
                          {item.type === 'task' && (
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          )}
                          {item.type === 'health' && (
                            <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                          )}
                        </svg>
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <h4 className="text-md font-medium text-gray-300">{item.title}</h4>
                          <span className="text-xs text-gray-500">
                            {item.timestamp.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400 mt-1">{item.summary}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          {/* Task Progress */}
          <div className="bg-gray-800 p-4 rounded-lg shadow border border-gray-700 mb-6">
            <h3 className="text-lg font-semibold mb-3 text-gray-200">Task Progress</h3>
            
            <div className="w-full bg-gray-700 rounded-full h-4 mb-4">
              <div 
                className="bg-green-500 h-4 rounded-full" 
                style={{ 
                  width: `${stats.completedTasks + stats.activeTasks > 0 
                    ? (stats.completedTasks / (stats.completedTasks + stats.activeTasks) * 100) 
                    : 0}%` 
                }}
              ></div>
            </div>
            
            <div className="text-sm text-gray-400 text-center">
              {stats.completedTasks} of {stats.completedTasks + stats.activeTasks} tasks completed
            </div>
          </div>
          
          {/* Project Progress */}
          <div className="bg-gray-800 p-4 rounded-lg shadow border border-gray-700">
            <h3 className="text-lg font-semibold mb-3 text-gray-200">Project Progress</h3>
            
            <div className="w-full bg-gray-700 rounded-full h-4 mb-4">
              <div 
                className="bg-blue-500 h-4 rounded-full" 
                style={{ 
                  width: `${stats.completedProjects + stats.activeProjects > 0 
                    ? (stats.completedProjects / (stats.completedProjects + stats.activeProjects) * 100) 
                    : 0}%` 
                }}
              ></div>
            </div>
            
            <div className="text-sm text-gray-400 text-center">
              {stats.completedProjects} of {stats.completedProjects + stats.activeProjects} projects completed
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default OverviewTab;