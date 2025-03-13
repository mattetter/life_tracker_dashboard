import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea, ResponsiveContainer } from 'recharts';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';

const VO2MaxGoalTracker = ({ goalData = {} }) => {
  const [initialVO2Max, setInitialVO2Max] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Extract goal data with default values for safety
  const { 
    initial = initialVO2Max, 
    current = 0, 
    target = 0, 
    createdAt = new Date().toISOString(), 
    targetDate = new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString()
  } = goalData || {};
  
  const startDate = new Date(createdAt);
  const endDate = new Date(targetDate);
  const today = new Date();

  // Fetch the earliest VO2 max value if initial is not provided
  useEffect(() => {
    const fetchEarliestVO2Max = async () => {
      if (!auth.currentUser) {
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        
        // Query the earliest health metrics with VO2 max values
        const q = query(
          collection(db, 'users', auth.currentUser.uid, 'healthMetrics'),
          orderBy('date', 'asc'),
          limit(20)
        );
        
        const querySnapshot = await getDocs(q);
        
        // Find the first record with a valid VO2 max value
        let found = false;
        for (const doc of querySnapshot.docs) {
          const data = doc.data();
          if (data.vo2max && !isNaN(parseFloat(data.vo2max))) {
            setInitialVO2Max(parseFloat(data.vo2max));
            found = true;
            break;
          }
        }
        
        // If no VO2 max value found and we have current, use 90% of current
        if (!found && current) {
          setInitialVO2Max(current * 0.9);
        }
      } catch (error) {
        console.error("Error fetching initial VO2 max:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    // Only fetch if we don't have an initial value
    if (!goalData.initial && initialVO2Max === null) {
      fetchEarliestVO2Max();
    } else {
      setIsLoading(false);
    }
  }, [goalData.initial, initialVO2Max, current]);

  // Calculate progress metrics and create chart data
  const progressData = useMemo(() => {
    // If we're still loading or missing critical data, provide minimal chart data
    if (isLoading && (!initial && initialVO2Max === null)) {
      return {
        chartData: [
          {
            date: new Date().toISOString().split('T')[0],
            expected: 0,
            actual: 0,
            label: 'Today'
          }
        ],
        isOnTrack: false,
        progressPercentage: 0,
        expectedCurrent: 0,
        projectedFinal: 0,
        daysElapsed: 0,
        totalDays: 0,
        timePercentage: 0
      };
    }

    const totalDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
    const daysElapsed = Math.round((today - startDate) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, totalDays - daysElapsed);
    
    // Expected progress for today based on linear trajectory
    const timePercentage = Math.min(100, Math.max(0, (daysElapsed / totalDays) * 100));
    
    // Use initial or the earliest found value
    const initialValue = initial || initialVO2Max || current * 0.9; // Fallback if no initial value
    const expectedCurrent = initialValue + ((target - initialValue) * (daysElapsed / totalDays));
    
    // For safety, if expected is NaN or Infinity, use sensible defaults
    const safeExpectedCurrent = isNaN(expectedCurrent) || !isFinite(expectedCurrent) ? 
      (initialValue + (target - initialValue) * 0.5) : expectedCurrent;
    
    // Calculate current improvement rate
    const currentImprovement = current - initialValue;
    const expectedImprovement = target - initialValue;
    const progressPercentage = expectedImprovement === 0 ? 100 : 
      Math.min(100, Math.max(0, Math.round((currentImprovement / expectedImprovement) * 100)));
    
    // Project final value based on current rate
    let projectedFinal = initialValue;
    
    if (daysElapsed > 0 && totalDays > 0) {
      const improvementRate = currentImprovement / daysElapsed;
      const projectedImprovement = improvementRate * totalDays;
      projectedFinal = Math.round((initialValue + projectedImprovement) * 10) / 10;
      
      // Sanity check - if projected is NaN or infinite, use a sensible default
      if (isNaN(projectedFinal) || !isFinite(projectedFinal)) {
        projectedFinal = target;
      }
    }

    // Determine if on track (within 5% tolerance)
    const isOnTrack = current >= (safeExpectedCurrent - 0.5);

    // Generate chart data points
    const chartData = [];
    
    // Start point
    chartData.push({
      date: startDate.toISOString().split('T')[0],
      expected: initialValue,
      actual: initialValue,
      label: 'Start'
    });
    
    // Today's point
    chartData.push({
      date: today.toISOString().split('T')[0],
      expected: safeExpectedCurrent,
      actual: current,
      label: 'Today'
    });
    
    // Target date point
    chartData.push({
      date: endDate.toISOString().split('T')[0],
      expected: target,
      projected: projectedFinal,
      label: 'Target'
    });

    return {
      chartData,
      isOnTrack,
      progressPercentage,
      expectedCurrent: Math.round(safeExpectedCurrent * 10) / 10,
      projectedFinal,
      daysElapsed,
      totalDays,
      daysRemaining,
      timePercentage,
      initialValue
    };
  }, [initial, initialVO2Max, current, target, createdAt, targetDate, isLoading, startDate, endDate, today]);
  
  // Show loading state
  if (isLoading) {
    return (
      <div className="p-4 text-gray-400 flex items-center justify-center">
        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-solid border-blue-500 border-r-transparent"></div>
        <span>Loading VO2 max data...</span>
      </div>
    );
  }

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  
  // Custom tooltip to show details
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      if (!data) return null;
      
      return (
        <div className="bg-gray-800 p-3 border border-gray-700 rounded shadow-lg text-sm">
          <p className="font-medium text-gray-200">{formatDate(data.date)}</p>
          {data.expected !== undefined && (
            <p className="text-blue-400">Expected: {data.expected.toFixed(1)}</p>
          )}
          {data.actual !== undefined && (
            <p className="text-green-400">Actual: {data.actual.toFixed(1)}</p>
          )}
          {data.projected !== undefined && (
            <p className="text-purple-400">Projected: {data.projected.toFixed(1)}</p>
          )}
        </div>
      );
    }
    
    return null;
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-gray-200">VO2 Max Progress</h3>
        
        <div className={`px-2 py-1 rounded text-xs font-medium ${
          progressData.isOnTrack ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'
        }`}>
          {progressData.isOnTrack ? 'On Track' : 'Falling Behind'}
        </div>
      </div>
      
      <div className="h-52 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={progressData.chartData}
            margin={{ top: 5, right: 5, left: 0, bottom: 25 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis 
              dataKey="date" 
              tickFormatter={formatDate}
              tick={{ fontSize: 12, fill: '#aaa' }}
            />
            <YAxis 
              domain={[
                Math.floor(Math.min(progressData.initialValue || 0, current || 0) - 1), 
                Math.ceil(Math.max(target || 0, progressData.projectedFinal || 0) + 1)
              ]}
              tick={{ fontSize: 12, fill: '#aaa' }}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {/* Expected trajectory line */}
            <Line 
              type="linear"
              dataKey="expected"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: '#3b82f6', r: 4 }}
              activeDot={{ r: 6 }}
              name="Expected"
            />
            
            {/* Actual progress line */}
            <Line 
              type="linear"
              dataKey="actual"
              stroke="#10b981"
              strokeWidth={3}
              strokeDasharray="5 5"
              dot={{ fill: '#10b981', r: 4, strokeWidth: 2 }}
              activeDot={{ r: 6 }}
              name="Actual"
            />
            
            {/* Projected line to end */}
            <Line 
              type="linear"
              dataKey="projected"
              stroke="#8b5cf6"
              strokeWidth={2}
              strokeDasharray="3 3"
              connectNulls={true}
              dot={{ fill: '#8b5cf6', r: 4 }}
              activeDot={{ r: 6 }}
              name="Projected"
            />
            
            {/* Today reference line */}
            {progressData.chartData.length > 1 && (
              <ReferenceLine
                x={progressData.chartData[1]?.date}
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="3 3"
                label={{ value: 'Today', position: 'insideBottomRight', fill: '#f59e0b', fontSize: 12 }}
              />
            )}
            
            {/* Highlight area if behind */}
            {!progressData.isOnTrack && progressData.chartData.length > 1 && (
              <ReferenceArea
                x1={progressData.chartData[1]?.date}
                x2={progressData.chartData[2]?.date}
                y1={progressData.chartData[1]?.actual}
                y2={progressData.chartData[1]?.expected}
                fill="rgba(220, 38, 38, 0.2)"
                stroke="rgba(220, 38, 38, 0.5)"
                strokeDasharray="3 3"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div className="bg-gray-750 p-3 rounded border border-gray-700">
          <div className="text-xs text-gray-400 mb-1">Progress</div>
          <div className="flex justify-between">
            <div className="text-sm font-medium text-gray-200">
              {current} of {target} ml/kg/min
            </div>
            <div className={`text-sm font-medium ${progressData.isOnTrack ? 'text-green-400' : 'text-red-400'}`}>
              {progressData.progressPercentage}%
            </div>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
            <div
              className={`h-2 rounded-full ${progressData.isOnTrack ? 'bg-green-500' : 'bg-red-500'}`}
              style={{ width: `${progressData.progressPercentage}%` }}
            ></div>
          </div>
        </div>
        
        <div className="bg-gray-750 p-3 rounded border border-gray-700">
          <div className="text-xs text-gray-400 mb-1">Time Elapsed</div>
          <div className="flex justify-between">
            <div className="text-sm font-medium text-gray-200">
              {progressData.daysElapsed} of {progressData.totalDays} days
            </div>
            <div className="text-sm font-medium text-blue-400">
              {Math.round(progressData.timePercentage)}%
            </div>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
            <div
              className="h-2 rounded-full bg-blue-500"
              style={{ width: `${progressData.timePercentage}%` }}
            ></div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-center">
        <div className="bg-gray-750 p-3 rounded border border-gray-700">
          <div className="text-xs text-gray-400 mb-1">Expected Today</div>
          <div className={`text-xl font-bold ${current >= progressData.expectedCurrent ? 'text-green-400' : 'text-red-400'}`}>
            {progressData.expectedCurrent}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {current >= progressData.expectedCurrent ? 
              `+${(current - progressData.expectedCurrent).toFixed(1)} ahead` : 
              `-${(progressData.expectedCurrent - current).toFixed(1)} behind`}
          </div>
        </div>
        
        <div className="bg-gray-750 p-3 rounded border border-gray-700">
          <div className="text-xs text-gray-400 mb-1">Projected Final</div>
          <div className={`text-xl font-bold ${progressData.projectedFinal >= target ? 'text-green-400' : 'text-red-400'}`}>
            {progressData.projectedFinal}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {progressData.projectedFinal >= target ? 
              `+${(progressData.projectedFinal - target).toFixed(1)} over target` : 
              `-${(target - progressData.projectedFinal).toFixed(1)} under target`}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VO2MaxGoalTracker;