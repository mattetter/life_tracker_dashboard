import React, { useState, useEffect } from 'react';
import { getDoc, setDoc, collection, doc, query, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { auth, db } from '../firebase'; 
import HealthMetricsForm from './HealthMetricsForm';
import VO2MaxGoalTracker from './VO2MaxGoalTracker';


const HealthTab = ({ 
    // State from parent
    healthMetrics,
    goals,
    setGoals,
    error,
    setError,
  
    // State management functions
    handleMetricSubmit,
    fetchHealthMetrics,
    
    // Other props as needed
    userId
  }) => {
    // Local state for UI controls
    const [showForm, setShowForm] = useState(false);
    const [showVO2MaxGoalForm, setShowVO2MaxGoalForm] = useState(false);
    const [vo2MaxGoal, setVO2MaxGoal] = useState({
      current: 49,
      target: 53,
      targetDate: ''
    });
  
    // Load VO2 max goal when component mounts
    useEffect(() => {
      const loadVO2MaxGoal = async () => {
        if (!auth.currentUser) return;
        
        try {
          const goalDoc = await getDoc(doc(db, 'users', auth.currentUser.uid, 'settings', 'healthGoals'));
          
          if (goalDoc.exists() && goalDoc.data().vo2max) {
            const vo2maxData = goalDoc.data().vo2max;
            
            // Update the local state
            setVO2MaxGoal({
              initial: vo2maxData.initial || 0,
              current: vo2maxData.current || 0,
              target: vo2maxData.target || 45,
              targetDate: vo2maxData.targetDate 
                ? vo2maxData.targetDate.toDate().toISOString().split('T')[0] 
                : '',
              createdAt: vo2maxData.createdAt 
                ? vo2maxData.createdAt.toDate().toISOString() 
                : new Date().toISOString()
            });
            
            // Update parent state
            setGoals(prevGoals => ({
              ...prevGoals,
              health: {
                ...prevGoals.health,
                vo2maxTarget: {
                  value: vo2maxData.target || 45,
                  targetDate: vo2maxData.targetDate 
                    ? vo2maxData.targetDate.toDate().toISOString().split('T')[0]
                    : '',
                  initial: vo2maxData.initial || 0,
                  current: vo2maxData.current || 0,
                  createdAt: vo2maxData.createdAt 
                    ? vo2maxData.createdAt.toDate().toISOString() 
                    : new Date().toISOString()
                }
              }
            }));
          }
        } catch (error) {
          console.error("Error loading VO2 max goal:", error);
          setError(`Error loading VO2 max goal: ${error.message}`);
        }
      };
      
      loadVO2MaxGoal();
    }, [auth.currentUser]);
  
    // VO2 max goal save function
    const saveVO2MaxGoal = async (e) => {
      e.preventDefault();
      
      if (!auth.currentUser) {
        setError('You must be signed in to set goals');
        return;
      }
      
      try {
        // Find most recent VO2 max measurement
        let initialVO2Max = null;
        
        const q = query(
          collection(db, 'users', auth.currentUser.uid, 'healthMetrics'),
          orderBy('date', 'desc'),
          limit(10)
        );
        
        const querySnapshot = await getDocs(q);
        
        for (const doc of querySnapshot.docs) {
          const data = doc.data();
          if (data.vo2max && !isNaN(parseFloat(data.vo2max))) {
            initialVO2Max = parseFloat(data.vo2max);
            break;
          }
        }
        
        if (initialVO2Max === null) {
          initialVO2Max = parseFloat(vo2MaxGoal.target) * 0.9;
        }
        
        const goalData = {
          initial: initialVO2Max,
          current: initialVO2Max,
          target: parseFloat(vo2MaxGoal.target),
          targetDate: vo2MaxGoal.targetDate ? Timestamp.fromDate(new Date(vo2MaxGoal.targetDate)) : null,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        };
        
        // Save to Firestore
        await setDoc(
          doc(db, 'users', auth.currentUser.uid, 'settings', 'healthGoals'), 
          { vo2max: goalData }, 
          { merge: true }
        );
        
        // Update local state
        setVO2MaxGoal({
          ...vo2MaxGoal,
          initial: initialVO2Max,
          current: initialVO2Max
        });
        
        // Update parent state
        setGoals(prevGoals => ({
          ...prevGoals,
          health: {
            ...prevGoals.health,
            vo2maxTarget: {
              value: parseFloat(vo2MaxGoal.target),
              targetDate: vo2MaxGoal.targetDate,
              initial: initialVO2Max,
              current: initialVO2Max,
              createdAt: new Date().toISOString()
            }
          }
        }));
        
        alert('VO2 max goal saved successfully!');
        setShowVO2MaxGoalForm(false);
      } catch (error) {
        console.error("Error saving VO2 max goal:", error);
        setError(`Error saving goal: ${error.message}`);
      }
    };
  
    // Update current VO2 max after new measurements
    const updateCurrentVO2Max = async (newVO2MaxValue) => {
      if (!auth.currentUser || !newVO2MaxValue) return;
      
      try {
        await setDoc(
          doc(db, 'users', auth.currentUser.uid, 'settings', 'healthGoals'), 
          { 
            vo2max: { 
              current: parseFloat(newVO2MaxValue),
              updatedAt: Timestamp.now()
            } 
          }, 
          { merge: true }
        );
        
        setVO2MaxGoal(prev => ({
          ...prev,
          current: parseFloat(newVO2MaxValue)
        }));
        
        setGoals(prevGoals => {
          if (prevGoals.health && prevGoals.health.vo2maxTarget) {
            return {
              ...prevGoals,
              health: {
                ...prevGoals.health,
                vo2maxTarget: {
                  ...prevGoals.health.vo2maxTarget,
                  current: parseFloat(newVO2MaxValue)
                }
              }
            };
          }
          return prevGoals;
        });
      } catch (error) {
        console.error("Error updating current VO2 max:", error);
      }
    };
  
    // Handle local metric submission before passing to parent
    const handleLocalMetricSubmit = async (formData) => {
      try {
        // Call parent submission handler
        await handleMetricSubmit(formData);
        
        // If VO2 max was provided, update the current value
        if (formData.vo2max && !isNaN(parseFloat(formData.vo2max))) {
          await updateCurrentVO2Max(parseFloat(formData.vo2max));
        }
        
        // Close form
        setShowForm(false);
      } catch (error) {
        console.error("Error in local metric submit:", error);
        throw error;
      }
    };
  
    return (
      <div className="p-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-100">Health Dashboard</h2>
          <div className="flex space-x-4">
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white"
            >
              {showForm ? 'Cancel' : 'Add Health Metrics'}
            </button>
            <button
              onClick={() => setShowVO2MaxGoalForm(!showVO2MaxGoalForm)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white"
            >
              {showVO2MaxGoalForm ? 'Cancel' : 'Set VO2 Max Goal'}
            </button>
          </div>
        </div>
        
        {/* Error Display */}
        {error && (
          <div className="bg-red-500 text-white p-3 rounded-md mb-4">
            {error}
          </div>
        )}
        
        {/* Health Metrics Form */}
        {showForm && (
          <HealthMetricsForm 
            onSubmit={handleLocalMetricSubmit} 
            onCancel={() => setShowForm(false)} 
          />
        )}
        
        {/* VO2 Max Goal Form */}
        {showVO2MaxGoalForm && (
          <div className="bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700 mb-6">
            <h3 className="text-xl font-semibold mb-4 text-gray-100">Set VO2 Max Goal</h3>
            
            <form onSubmit={saveVO2MaxGoal}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="targetVO2Max" className="block text-sm font-medium mb-1 text-gray-300">
                    Target VO2 Max (ml/kg/min)
                  </label>
                  <input
                    type="number"
                    id="targetVO2Max"
                    value={vo2MaxGoal.target}
                    onChange={(e) => setVO2MaxGoal({...vo2MaxGoal, target: e.target.value})}
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                    step="0.1"
                    min="0"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="targetDate" className="block text-sm font-medium mb-1 text-gray-300">
                    Target Date
                  </label>
                  <input
                    type="date"
                    id="targetDate"
                    value={vo2MaxGoal.targetDate}
                    onChange={(e) => setVO2MaxGoal({...vo2MaxGoal, targetDate: e.target.value})}
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                    required
                  />
                </div>
              </div>
              
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
              >
                Save VO2 Max Goal
              </button>
            </form>
          </div>
        )}

        {/* VO2max display */}
        {!showVO2MaxGoalForm && goals.health?.vo2maxTarget?.targetDate && (
        <div className="bg-gray-800 p-4 rounded-lg shadow border border-gray-700 mb-6">
            <h3 className="text-lg font-semibold mb-3 text-gray-200">VO2 Max Goal</h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
                <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-gray-300">Target VO2 Max</span>
                <span className="text-sm font-medium text-gray-300">
                    {goals.health.vo2maxTarget.value}
                </span>
                </div>
                
            </div>
            
            {/* VO2Max Goal Tracker Visualization */}
            <div className="col-span-1 lg:col-span-1">
                <VO2MaxGoalTracker goalData={goals.health.vo2maxTarget} />
            </div>
            </div>
        </div>
        )}


        {/* You can add more complex elements here */}
      </div>
    );
  };


  export default HealthTab;