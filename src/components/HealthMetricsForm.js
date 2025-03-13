import React, { useState } from 'react';

const HealthMetricsForm = ({ onSubmit, onCancel }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [metricFormData, setMetricFormData] = useState({
    weight: '',
    systolic: '',
    diastolic: '',
    ldl: '',
    hdl: '',
    vo2max: '',
    notes: '',
    source: 'manual'
  });
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setMetricFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form - require at least one metric to be filled
    const hasMetricData = ['weight', 'systolic', 'diastolic', 'ldl', 'hdl', 'vo2max']
      .some(field => metricFormData[field] && metricFormData[field].trim() !== '');
    
    if (!hasMetricData) {
      setError('Please enter at least one health metric value');
      return;
    }
    
    try {
      setIsSubmitting(true);
      await onSubmit(metricFormData);
      
      // Reset form
      setMetricFormData({
        weight: '',
        systolic: '',
        diastolic: '',
        ldl: '',
        hdl: '',
        vo2max: '',
        notes: '',
        source: 'manual'
      });
      
    } catch (error) {
      console.error("Error in health metrics form:", error);
      setError(`Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700 mb-8">
      <h3 className="text-xl font-semibold mb-4 text-gray-100">Record Health Metrics</h3>
      
      {error && (
        <div className="bg-red-500 text-white p-3 rounded-md mb-4">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
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
              onChange={handleChange}
              placeholder="Enter weight"
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
              step="0.1"
              min="0"
            />
          </div>
          
          <div>
            <label htmlFor="vo2max" className="block text-sm font-medium mb-1 text-gray-300">
              VO2 Max (ml/kg/min)
            </label>
            <input
              type="number"
              id="vo2max"
              name="vo2max"
              value={metricFormData.vo2max}
              onChange={handleChange}
              placeholder="Enter VO2 Max"
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
              step="0.1"
              min="0"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-300">
              Blood Pressure (mmHg)
            </label>
            <div className="flex space-x-2">
              <div className="flex-1">
                <input
                  type="number"
                  id="systolic"
                  name="systolic"
                  value={metricFormData.systolic}
                  onChange={handleChange}
                  placeholder="Systolic"
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  min="0"
                />
              </div>
              <span className="text-gray-400 flex items-center">/</span>
              <div className="flex-1">
                <input
                  type="number"
                  id="diastolic"
                  name="diastolic"
                  value={metricFormData.diastolic}
                  onChange={handleChange}
                  placeholder="Diastolic"
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  min="0"
                />
              </div>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-300">
              Cholesterol (mg/dL)
            </label>
            <div className="flex space-x-2">
              <div className="flex-1">
                <input
                  type="number"
                  id="ldl"
                  name="ldl"
                  value={metricFormData.ldl}
                  onChange={handleChange}
                  placeholder="LDL"
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  min="0"
                />
                <span className="text-xs text-gray-400">LDL</span>
              </div>
              <div className="flex-1">
                <input
                  type="number"
                  id="hdl"
                  name="hdl"
                  value={metricFormData.hdl}
                  onChange={handleChange}
                  placeholder="HDL"
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  min="0"
                />
                <span className="text-xs text-gray-400">HDL</span>
              </div>
            </div>
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
            onChange={handleChange}
            placeholder="Add any additional details or context"
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
            rows={2}
          ></textarea>
        </div>
        
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onCancel}
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
              "Save Health Metrics"
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default HealthMetricsForm;