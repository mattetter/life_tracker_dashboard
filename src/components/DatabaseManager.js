import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  query, 
  orderBy, 
  Timestamp,
  setDoc,
  getDoc,
  deleteDoc
} from 'firebase/firestore';

const DatabaseManager = ({ isAuthenticated, auth, setError }) => {
  const [selectedCollection, setSelectedCollection] = useState('logs');
  const [collectionData, setCollectionData] = useState([]);
  const [isLoadingCollection, setIsLoadingCollection] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [documentContent, setDocumentContent] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Get Firestore instance
  const db = getFirestore();
  
  // Collections available in the app
  const collections = [
    { id: 'logs', label: 'Daily Logs' },
    { id: 'journal', label: 'Journal Entries' },
    { id: 'projects', label: 'Projects' },
    { id: 'healthMetrics', label: 'Health Metrics' },
    { id: 'settings', label: 'Settings' }
  ];
  
  // Load collection data
  const loadCollection = useCallback(async (collectionName) => {
    if (!auth.currentUser) return;
    
    setIsLoadingCollection(true);
    setSelectedDocument(null);
    setDocumentContent({});
    
    try {
      let queryRef;
      
      // Special handling for settings subcollection
      if (collectionName === 'settings') {
        // Get all settings documents
        const settingsCollection = collection(db, 'users', auth.currentUser.uid, 'settings');
        const settingsSnapshot = await getDocs(settingsCollection);
        
        if (!settingsSnapshot.empty) {
          const settingsDocs = settingsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: new Date().toISOString() // Add a default timestamp for display
          }));
          
          // If we don't find any user preferences, add a default one
          if (!settingsDocs.some(doc => doc.id === 'userPreferences')) {
            settingsDocs.push({
              id: 'userPreferences',
              theme: 'dark',
              autoRefresh: true,
              refreshInterval: 5,
              dateFormat: 'MM/DD/YYYY',
              timestamp: new Date().toISOString()
            });
          }
          
          setCollectionData(settingsDocs);
        } else {
          // Create default settings if none exist
          const defaultSettings = [
            {
              id: 'userPreferences',
              theme: 'dark',
              autoRefresh: true,
              refreshInterval: 5,
              dateFormat: 'MM/DD/YYYY',
              timestamp: new Date().toISOString()
            }
          ];
          setCollectionData(defaultSettings);
        }
        
        setIsLoadingCollection(false);
        return;
      }
      
      // Regular collection query
      queryRef = collection(db, 'users', auth.currentUser.uid, collectionName);
      
      // If available, order by timestamp or date
      if (['logs', 'journal'].includes(collectionName)) {
        queryRef = query(queryRef, orderBy('timestamp', 'desc'));
      } else if (collectionName === 'healthMetrics') {
        queryRef = query(queryRef, orderBy('date', 'desc'));
      }
      
      const querySnapshot = await getDocs(queryRef);
      const data = querySnapshot.docs.map(doc => {
        const docData = doc.data();
        
        // Format timestamp or date fields for display
        let formattedData = { ...docData, id: doc.id };
        
        if (docData.timestamp && typeof docData.timestamp.toDate === 'function') {
          formattedData.timestamp = docData.timestamp.toDate().toISOString();
        }
        
        if (docData.date && typeof docData.date.toDate === 'function') {
          formattedData.date = docData.date.toDate().toISOString();
        }
        
        if (docData.createdAt && typeof docData.createdAt.toDate === 'function') {
          formattedData.createdAt = docData.createdAt.toDate().toISOString();
        }
        
        if (docData.endDate && typeof docData.endDate.toDate === 'function') {
          formattedData.endDate = docData.endDate.toDate().toISOString();
        }
        
        return formattedData;
      });
      
      setCollectionData(data);
    } catch (error) {
      console.error(`Error loading ${collectionName} collection:`, error);
      setError(`Error loading data: ${error.message}`);
    } finally {
      setIsLoadingCollection(false);
    }
  }, [auth.currentUser, db, setError]);
  
  // Load document details when selected
  const loadDocument = useCallback((docId) => {
    const doc = collectionData.find(doc => doc.id === docId);
    if (doc) {
      setSelectedDocument(docId);
      setDocumentContent(doc);
      setIsEditing(false);
    }
  }, [collectionData]);
  
  // Delete a document
  const deleteDocument = useCallback(async (docId) => {
    if (!window.confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'users', auth.currentUser.uid, selectedCollection, docId));
      
      // Refresh the collection
      await loadCollection(selectedCollection);
      setSelectedDocument(null);
      setDocumentContent({});
      
    } catch (error) {
      console.error('Error deleting document:', error);
      setError(`Error deleting: ${error.message}`);
    }
  }, [selectedCollection, loadCollection, auth.currentUser, db, setError]);
  
  // Update document
  const updateDocument = useCallback(async () => {
    if (!selectedDocument) return;
    
    try {
      // Convert ISO strings back to Firestore timestamps
      const dataToUpdate = { ...documentContent };
      
      if (dataToUpdate.timestamp && typeof dataToUpdate.timestamp === 'string') {
        dataToUpdate.timestamp = Timestamp.fromDate(new Date(dataToUpdate.timestamp));
      }
      
      if (dataToUpdate.date && typeof dataToUpdate.date === 'string') {
        dataToUpdate.date = Timestamp.fromDate(new Date(dataToUpdate.date));
      }
      
      if (dataToUpdate.createdAt && typeof dataToUpdate.createdAt === 'string') {
        dataToUpdate.createdAt = Timestamp.fromDate(new Date(dataToUpdate.createdAt));
      }
      
      if (dataToUpdate.endDate && typeof dataToUpdate.endDate === 'string') {
        dataToUpdate.endDate = Timestamp.fromDate(new Date(dataToUpdate.endDate));
      }
      
      // Remove id field before saving
      const { id, ...docWithoutId } = dataToUpdate;
      
      // Special handling for settings
      if (selectedCollection === 'settings') {
        await setDoc(doc(db, 'users', auth.currentUser.uid, 'settings', selectedDocument), docWithoutId);
      } else {
        await setDoc(doc(db, 'users', auth.currentUser.uid, selectedCollection, selectedDocument), docWithoutId);
      }
      
      // Refresh collection
      await loadCollection(selectedCollection);
      setIsEditing(false);
      
    } catch (error) {
      console.error('Error updating document:', error);
      setError(`Error updating: ${error.message}`);
    }
  }, [selectedDocument, documentContent, selectedCollection, loadCollection, auth.currentUser, db, setError]);
  
  // Handle input change in the form
  const handleInputChange = useCallback((field, value) => {
    setDocumentContent(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);
  
  // Filter documents based on search term
  const filteredDocuments = useMemo(() => {
    if (!searchTerm.trim()) return collectionData;
    
    return collectionData.filter(doc => {
      // Convert all values to strings for searching
      return Object.values(doc).some(value => 
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [collectionData, searchTerm]);
  
  // Load the selected collection when it changes
  useEffect(() => {
    if (isAuthenticated && auth.currentUser) {
      loadCollection(selectedCollection);
    }
  }, [selectedCollection, isAuthenticated, auth.currentUser, loadCollection]);

  // Function to bulk delete health metrics
  const deleteAllHealthMetrics = async () => {
    if (!auth.currentUser) return;
    
    if (!window.confirm('Are you sure you want to delete ALL health metrics? This action cannot be undone.')) {
      return;
    }
    
    try {
      setIsLoadingCollection(true);
      
      // Get all health metrics documents
      const metricsRef = collection(db, 'users', auth.currentUser.uid, 'healthMetrics');
      const snapshot = await getDocs(metricsRef);
      
      if (snapshot.empty) {
        alert('No health metrics found to delete.');
        setIsLoadingCollection(false);
        return;
      }
      
      // Count how many we'll delete
      const count = snapshot.docs.length;
      
      // Delete each document
      const deletePromises = snapshot.docs.map(doc => 
        deleteDoc(doc.ref)
      );
      
      // Wait for all deletes to complete
      await Promise.all(deletePromises);
      
      // Refresh the collection data
      if (selectedCollection === 'healthMetrics') {
        await loadCollection('healthMetrics');
      }
      
      alert(`Successfully deleted ${count} health metrics.`);
    } catch (error) {
      console.error('Error deleting health metrics:', error);
      setError(`Error deleting health metrics: ${error.message}`);
    } finally {
      setIsLoadingCollection(false);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-6 text-gray-100">Database Management</h2>
      
      {/* Collection selector */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex space-x-4 overflow-x-auto pb-2">
          {collections.map(collection => (
            <button
              key={collection.id}
              onClick={() => setSelectedCollection(collection.id)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap ${
                selectedCollection === collection.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {collection.label}
            </button>
          ))}
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Special actions based on selected collection */}
          {selectedCollection === 'healthMetrics' && (
            <button
              onClick={deleteAllHealthMetrics}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
            >
              Delete All Health Metrics
            </button>
          )}
          
          {/* Search input */}
          <div className="w-64">
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
            />
          </div>
        </div>
      </div>
      
      {/* Main content area */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Document list panel */}
        <div className="md:col-span-1 bg-gray-800 rounded-lg shadow border border-gray-700 overflow-hidden">
          <div className="p-3 bg-gray-700 border-b border-gray-600 flex justify-between items-center">
            <h3 className="font-medium text-gray-200">
              {collections.find(c => c.id === selectedCollection)?.label || 'Documents'}
            </h3>
            <div className="text-sm text-gray-400">
              {filteredDocuments.length} items
            </div>
          </div>
          
          {isLoadingCollection ? (
            <div className="p-4 text-center">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-3 border-solid border-blue-400 border-r-transparent"></div>
              <p className="mt-2 text-sm text-gray-400">Loading...</p>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="p-4 text-center text-gray-400">
              No documents found
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[500px]">
              <ul className="divide-y divide-gray-700">
                {filteredDocuments.map(doc => (
                  <li key={doc.id}>
                    <button
                      onClick={() => loadDocument(doc.id)}
                      className={`w-full p-3 text-left hover:bg-gray-700 transition-colors ${
                        selectedDocument === doc.id ? 'bg-gray-700' : ''
                      }`}
                    >
                      <div className="font-medium text-gray-200 truncate">
                        {/* Display a human-readable title based on collection type */}
                        {selectedCollection === 'journal' && doc.title ? doc.title :
                         selectedCollection === 'projects' && doc.title ? doc.title :
                         selectedCollection === 'logs' ? 
                          (doc.timestamp ? new Date(doc.timestamp).toLocaleDateString() : 'Log Entry') :
                         selectedCollection === 'healthMetrics' ?
                          (doc.date ? new Date(doc.date).toLocaleDateString() : 'Health Measurement') :
                         doc.id}
                      </div>
                      <div className="text-xs text-gray-400 mt-1 truncate">
                        {doc.timestamp && `Updated: ${new Date(doc.timestamp).toLocaleString()}`}
                        {!doc.timestamp && doc.date && `Date: ${new Date(doc.date).toLocaleString()}`}
                        {!doc.timestamp && !doc.date && `ID: ${doc.id}`}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        {/* Document detail panel */}
        <div className="md:col-span-2 bg-gray-800 rounded-lg shadow border border-gray-700">
          {selectedDocument ? (
            <>
              <div className="p-3 bg-gray-700 border-b border-gray-600 flex justify-between items-center">
                <h3 className="font-medium text-gray-200">
                  {isEditing ? 'Edit Document' : 'Document Details'}
                </h3>
                <div className="flex space-x-2">
                  {!isEditing ? (
                    <>
                      <button
                        onClick={() => setIsEditing(true)}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteDocument(selectedDocument)}
                        className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={updateDocument}
                        className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          // Reset to original document content and exit edit mode
                          loadDocument(selectedDocument);
                        }}
                        className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-500"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
              
              <div className="p-4">
                {isEditing ? (
                  <div className="space-y-4">
                    {/* Build dynamic edit form based on document fields */}
                    {Object.entries(documentContent).map(([key, value]) => {
                      // Skip the id field, it's not editable
                      if (key === 'id') return null;
                      
                      // Handle different field types
                      if (typeof value === 'boolean') {
                        return (
                          <div key={key} className="grid grid-cols-3 gap-2 items-center">
                            <label className="col-span-1 text-sm font-medium text-gray-300 capitalize">
                              {key.replace(/_/g, ' ')}
                            </label>
                            <div className="col-span-2">
                              <select
                                value={value.toString()}
                                onChange={(e) => handleInputChange(key, e.target.value === 'true')}
                                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                              >
                                <option value="true">True</option>
                                <option value="false">False</option>
                              </select>
                            </div>
                          </div>
                        );
                      }
                      
                      // Handle timestamp fields
                      if (['timestamp', 'date', 'createdAt', 'endDate'].includes(key) && typeof value === 'string') {
                        return (
                          <div key={key} className="grid grid-cols-3 gap-2 items-center">
                            <label className="col-span-1 text-sm font-medium text-gray-300 capitalize">
                              {key.replace(/_/g, ' ')}
                            </label>
                            <div className="col-span-2">
                              <input
                                type="datetime-local"
                                value={value.split('.')[0]} // Remove milliseconds
                                onChange={(e) => handleInputChange(key, e.target.value)}
                                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                              />
                            </div>
                          </div>
                        );
                      }
                      
                      // Handle text/string fields
                      if (typeof value === 'string') {
                        return (
                          <div key={key} className="grid grid-cols-3 gap-2 items-start">
                            <label className="col-span-1 text-sm font-medium text-gray-300 capitalize pt-2">
                              {key.replace(/_/g, ' ')}
                            </label>
                            <div className="col-span-2">
                              {key === 'content' || value.length > 100 ? (
                                <textarea
                                  value={value}
                                  onChange={(e) => handleInputChange(key, e.target.value)}
                                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                                  rows={5}
                                />
                              ) : (
                                <input
                                  type="text"
                                  value={value}
                                  onChange={(e) => handleInputChange(key, e.target.value)}
                                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                                />
                              )}
                            </div>
                          </div>
                        );
                      }
                      
                      // Handle number fields
                      if (typeof value === 'number') {
                        return (
                          <div key={key} className="grid grid-cols-3 gap-2 items-center">
                            <label className="col-span-1 text-sm font-medium text-gray-300 capitalize">
                              {key.replace(/_/g, ' ')}
                            </label>
                            <div className="col-span-2">
                              <input
                                type="number"
                                value={value}
                                onChange={(e) => handleInputChange(key, Number(e.target.value))}
                                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                              />
                            </div>
                          </div>
                        );
                      }
                      
                      // Handle objects and arrays - show as JSON
                      if (typeof value === 'object' && value !== null) {
                        return (
                          <div key={key} className="grid grid-cols-3 gap-2 items-start">
                            <label className="col-span-1 text-sm font-medium text-gray-300 capitalize pt-2">
                              {key.replace(/_/g, ' ')}
                            </label>
                            <div className="col-span-2">
                              <textarea
                                value={JSON.stringify(value, null, 2)}
                                onChange={(e) => {
                                  try {
                                    const parsedValue = JSON.parse(e.target.value);
                                    handleInputChange(key, parsedValue);
                                  } catch (error) {
                                    // Allow invalid JSON during editing, but don't update the value
                                    console.log('Invalid JSON format:', error);
                                  }
                                }}
                                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white font-mono text-sm"
                                rows={Math.min(10, JSON.stringify(value, null, 2).split('\n').length)}
                              />
                            </div>
                          </div>
                        );
                      }
                      
                      // Default fallback for any other type
                      return (
                        <div key={key} className="grid grid-cols-3 gap-2 items-center">
                          <span className="col-span-1 text-sm font-medium text-gray-300 capitalize">
                            {key.replace(/_/g, ' ')}
                          </span>
                          <div className="col-span-2 text-gray-400">
                            {String(value)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Display document content */}
                    {Object.entries(documentContent).map(([key, value]) => {
                      // Format the display of different types of values
                      let displayValue;
                      
                      // Skip id field as it's shown in the header
                      if (key === 'id') return null;
                      
                      if (value === null || value === undefined) {
                        displayValue = <span className="text-gray-500 italic">null</span>;
                      } else if (typeof value === 'boolean') {
                        displayValue = value ? 
                          <span className="text-green-400">Yes</span> : 
                          <span className="text-red-400">No</span>;
                      } else if (['timestamp', 'date', 'createdAt', 'endDate'].includes(key) && typeof value === 'string') {
                        displayValue = <span>{new Date(value).toLocaleString()}</span>;
                      } else if (typeof value === 'object') {
                        displayValue = (
                          <pre className="bg-gray-700 p-2 rounded overflow-x-auto text-xs">
                            {JSON.stringify(value, null, 2)}
                          </pre>
                        );
                      } else if (typeof value === 'string' && value.length > 100) {
                        displayValue = (
                          <div className="bg-gray-700 p-2 rounded overflow-y-auto max-h-40">
                            {value.split('\n').map((line, i) => (
                              <p key={i} className="mb-1">{line}</p>
                            ))}
                          </div>
                        );
                      } else {
                        displayValue = <span>{String(value)}</span>;
                      }
                      
                      return (
                        <div key={key} className="border-b border-gray-700 pb-2">
                          <div className="text-sm font-medium text-gray-400 capitalize mb-1">
                            {key.replace(/_/g, ' ')}
                          </div>
                          <div className="text-gray-200">
                            {displayValue}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-6 text-center text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-medium mb-2">No document selected</h3>
              <p className="text-sm">Select a document from the list to view its details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DatabaseManager;