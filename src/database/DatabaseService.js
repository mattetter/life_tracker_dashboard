/**
 * Database Service for Life Tracker Dashboard
 * Provides a structured interface to Firestore with validation and relationships
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { auth, db as firestore } from '../services/firebase';
import * as schema from './schema';

// Export the schema directly for use in the app
export { schema };

class DatabaseService {
  constructor() {
    this.db = firestore;
  }

  /**
   * Get the current user ID
   * @returns {string|null} The current user ID or null
   */
  getCurrentUserId() {
    return auth.currentUser?.uid || null;
  }

  /**
   * Validates an object against a schema
   * @param {Object} data - The data to validate
   * @param {Object} schema - The schema to validate against
   * @returns {boolean} Whether the data is valid
   */
  validateSchema(data, schema) {
    // Skip validation if no schema provided
    if (!schema) return true;

    // Check each field in the schema
    for (const [key, type] of Object.entries(schema)) {
      // Handle nested objects
      if (typeof type === 'object' && !Array.isArray(type) && type !== null) {
        // If field exists in data, validate it
        if (data[key]) {
          if (typeof data[key] !== 'object') return false;
          if (!this.validateSchema(data[key], schema[key])) return false;
        }
        continue;
      }

      // Required field check
      if (key === 'id' || key === 'userId') {
        if (!data[key]) return false;
      }

      // Type check for existing fields
      if (data[key] !== undefined && data[key] !== null) {
        if (type === 'array' && !Array.isArray(data[key])) return false;
        else if (type === 'timestamp') {
          if (!(data[key] instanceof Date) && 
              !(data[key] instanceof Timestamp) && 
              !(typeof data[key] === 'string')) return false;
        }
        else if (type !== 'object' && typeof data[key] !== type) return false;
      }
    }
    return true;
  }

  /**
   * Format data for Firestore storage
   * @param {Object} data - The data to format
   * @returns {Object} Formatted data
   */
  formatDataForStorage(data) {
    if (!data) return data;
    
    const formatted = { ...data };
    
    // Convert Date objects to Firestore Timestamps
    for (const [key, value] of Object.entries(formatted)) {
      if (value instanceof Date) {
        formatted[key] = Timestamp.fromDate(value);
      } else if (typeof value === 'object' && value !== null) {
        formatted[key] = this.formatDataForStorage(value);
      }
    }
    
    return formatted;
  }

  /**
   * Format data from Firestore for the application
   * @param {Object} data - The data to format
   * @returns {Object} Formatted data
   */
  formatDataFromFirestore(data) {
    if (!data) return data;
    
    const formatted = { ...data };
    
    // Convert Firestore Timestamps to Date objects
    for (const [key, value] of Object.entries(formatted)) {
      if (value && typeof value.toDate === 'function') {
        formatted[key] = value.toDate();
      } else if (typeof value === 'object' && value !== null) {
        formatted[key] = this.formatDataFromFirestore(value);
      }
    }
    
    return formatted;
  }

  /**
   * Get document path for a collection
   * @param {string} collectionName - The collection name
   * @param {string} docId - The document ID (optional)
   * @param {string} userId - The user ID (optional)
   * @returns {string} The document path
   */
  getDocPath(collectionName, docId = null, userId = null) {
    const uid = userId || this.getCurrentUserId();
    if (!uid) throw new Error('User ID required');

    // For backward compatibility - convert string collection names to constants
    let normalizedCollection = collectionName;
    
    // Handle string collection names for backward compatibility
    if (typeof collectionName === 'string') {
      // Map common collection strings to their constants
      if (collectionName === 'logs') normalizedCollection = schema.COLLECTIONS.LOGS;
      else if (collectionName === 'journal') normalizedCollection = schema.COLLECTIONS.JOURNAL;
      else if (collectionName === 'healthMetrics') normalizedCollection = schema.COLLECTIONS.HEALTH_METRICS;
      else if (collectionName === 'projects') normalizedCollection = schema.COLLECTIONS.PROJECTS;
      else if (collectionName === 'settings') normalizedCollection = schema.COLLECTIONS.USER_SETTINGS;
      else if (collectionName === 'strava') normalizedCollection = schema.COLLECTIONS.STRAVA_CONNECTION;
    }
    
    // Build the path based on collection
    switch (normalizedCollection) {
      // Main collections
      case schema.COLLECTIONS.USERS:
      case 'users':
        return docId ? `users/${docId}` : `users`;
      
      // User settings
      case schema.COLLECTIONS.USER_SETTINGS:
      case 'settings':
        return docId ? `users/${uid}/settings/${docId}` : `users/${uid}/settings`;
      
      case schema.COLLECTIONS.USER_GOALS:
      case 'goals':
        return `users/${uid}/settings/goals`;
      
      // User data collections
      case schema.COLLECTIONS.LOGS:
      case 'logs':
        return docId ? `users/${uid}/logs/${docId}` : `users/${uid}/logs`;
      
      case schema.COLLECTIONS.JOURNAL:
      case 'journal':
        return docId ? `users/${uid}/journal/${docId}` : `users/${uid}/journal`;
      
      case schema.COLLECTIONS.HEALTH_METRICS:
      case 'healthMetrics':
        return docId ? `users/${uid}/healthMetrics/${docId}` : `users/${uid}/healthMetrics`;
      
      case schema.COLLECTIONS.PROJECTS:
      case 'projects':
        return docId ? `users/${uid}/projects/${docId}` : `users/${uid}/projects`;
      
      // Strava collections
      case schema.COLLECTIONS.STRAVA_CONNECTION:
        return `users/${uid}/settings/strava`;
      
      case schema.COLLECTIONS.STRAVA_DATA:
        return `users/${uid}/strava/data`;
      
      case schema.COLLECTIONS.STRAVA_IMPORTED:
        return `users/${uid}/strava/imported`;
      
      // Fall back to the original pattern for unknown collections
      default:
        if (typeof collectionName === 'string') {
          return docId ? `users/${uid}/${collectionName}/${docId}` : `users/${uid}/${collectionName}`;
        }
        throw new Error(`Unknown collection: ${collectionName}`);
    }
  }

  /**
   * Get collection reference
   * @param {string} collectionName - The collection name
   * @param {string} userId - The user ID (optional)
   * @returns {CollectionReference} The collection reference
   */
  getCollectionRef(collectionName, userId = null) {
    const path = this.getDocPath(collectionName, null, userId);
    return collection(this.db, path);
  }

  /**
   * Get document reference
   * @param {string} collectionName - The collection name
   * @param {string} docId - The document ID
   * @param {string} userId - The user ID (optional)
   * @returns {DocumentReference} The document reference
   */
  getDocRef(collectionName, docId, userId = null) {
    const path = this.getDocPath(collectionName, docId, userId);
    return doc(this.db, path);
  }

  /**
   * Get a document by ID
   * @param {string} collectionName - The collection name
   * @param {string} docId - The document ID
   * @param {string} userId - The user ID (optional)
   * @returns {Promise<Object|null>} The document data or null
   */
  async getDocument(collectionName, docId, userId = null) {
    try {
      const docRef = this.getDocRef(collectionName, docId, userId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...this.formatDataFromFirestore(docSnap.data())
        };
      }
      return null;
    } catch (error) {
      console.error(`Error getting document ${docId} from ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Get documents from a collection with optional filters
   * @param {string} collectionName - The collection name
   * @param {Object} options - Query options (filters, orderBy, etc.)
   * @param {string} userId - The user ID (optional)
   * @returns {Promise<Array>} The documents
   */
  async getDocuments(collectionName, options = {}, userId = null) {
    try {
      const collectionRef = this.getCollectionRef(collectionName, userId);
      
      // Build query
      let queryRef = collectionRef;
      
      // Add filter conditions if provided
      if (options.filters && Array.isArray(options.filters)) {
        options.filters.forEach(filter => {
          queryRef = query(queryRef, where(filter.field, filter.operator, filter.value));
        });
      }
      
      // Add ordering if provided
      if (options.orderBy) {
        const { field, direction = 'desc' } = options.orderBy;
        queryRef = query(queryRef, orderBy(field, direction));
      }
      
      const querySnapshot = await getDocs(queryRef);
      
      // Format results
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...this.formatDataFromFirestore(doc.data())
      }));
    } catch (error) {
      console.error(`Error getting documents from ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Create a new document
   * @param {string} collectionName - The collection name
   * @param {Object} data - The document data
   * @param {string} docId - The document ID (optional)
   * @param {string} userId - The user ID (optional)
   * @returns {Promise<string>} The document ID
   */
  async createDocument(collectionName, data, docId = null, userId = null) {
    try {
      const uid = userId || this.getCurrentUserId();
      
      // Determine which schema to use
      let schemaToValidate;
      switch (collectionName) {
        case schema.COLLECTIONS.USERS:
          schemaToValidate = schema.USER_SCHEMA;
          break;
        case schema.COLLECTIONS.USER_GOALS:
          schemaToValidate = schema.GOALS_SCHEMA;
          break;
        case schema.COLLECTIONS.LOGS:
          schemaToValidate = schema.LOG_SCHEMA;
          break;
        case schema.COLLECTIONS.JOURNAL:
          schemaToValidate = schema.JOURNAL_SCHEMA;
          break;
        case schema.COLLECTIONS.HEALTH_METRICS:
          schemaToValidate = schema.HEALTH_METRIC_SCHEMA;
          break;
        case schema.COLLECTIONS.PROJECTS:
          schemaToValidate = schema.PROJECT_SCHEMA;
          break;
        case schema.COLLECTIONS.STRAVA_CONNECTION:
          schemaToValidate = schema.STRAVA_CONNECTION_SCHEMA;
          break;
        case schema.COLLECTIONS.STRAVA_DATA:
          schemaToValidate = schema.STRAVA_DATA_SCHEMA;
          break;
        case schema.COLLECTIONS.STRAVA_IMPORTED:
          schemaToValidate = schema.STRAVA_IMPORTED_SCHEMA;
          break;
        default:
          schemaToValidate = null;
      }
      
      // Validate data against schema
      const dataToValidate = { ...data, userId: uid };
      if (schemaToValidate && !this.validateSchema(dataToValidate, schemaToValidate)) {
        throw new Error(`Invalid data for ${collectionName} schema`);
      }
      
      // Add userId and timestamp if not provided
      const dataToSave = {
        ...data,
        userId: uid,
        timestamp: data.timestamp || Timestamp.now()
      };
      
      // Format data for Firestore
      const formattedData = this.formatDataForStorage(dataToSave);
      
      // If document ID is provided, use setDoc; otherwise use addDoc
      if (docId) {
        const docRef = this.getDocRef(collectionName, docId, uid);
        await setDoc(docRef, formattedData);
        return docId;
      } else {
        const collectionRef = this.getCollectionRef(collectionName, uid);
        const docRef = await addDoc(collectionRef, formattedData);
        return docRef.id;
      }
    } catch (error) {
      console.error(`Error creating document in ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Update an existing document
   * @param {string} collectionName - The collection name
   * @param {string} docId - The document ID
   * @param {Object} data - The document data to update
   * @param {string} userId - The user ID (optional)
   * @returns {Promise<void>}
   */
  async updateDocument(collectionName, docId, data, userId = null) {
    try {
      const uid = userId || this.getCurrentUserId();
      
      // Get current document to merge with updates
      const docRef = this.getDocRef(collectionName, docId, uid);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        throw new Error(`Document ${docId} not found in ${collectionName}`);
      }
      
      // Merge current data with updates
      const currentData = docSnap.data();
      const mergedData = {
        ...currentData,
        ...data,
        userId: uid, // Ensure userId consistency
        updatedAt: Timestamp.now() // Add updatedAt timestamp
      };
      
      // Format data for Firestore
      const formattedData = this.formatDataForStorage(mergedData);
      
      // Update document
      await setDoc(docRef, formattedData);
    } catch (error) {
      console.error(`Error updating document ${docId} in ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Delete a document
   * @param {string} collectionName - The collection name
   * @param {string} docId - The document ID
   * @param {string} userId - The user ID (optional)
   * @returns {Promise<void>}
   */
  async deleteDocument(collectionName, docId, userId = null) {
    try {
      const docRef = this.getDocRef(collectionName, docId, userId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error(`Error deleting document ${docId} from ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Get user profile
   * @param {string} userId - The user ID (optional, uses current user if not provided)
   * @returns {Promise<Object|null>} The user profile
   */
  async getUserProfile(userId = null) {
    const uid = userId || this.getCurrentUserId();
    return this.getDocument(schema.COLLECTIONS.USER_SETTINGS, 'profile', uid);
  }

  /**
   * Get user goals
   * @param {string} userId - The user ID (optional, uses current user if not provided)
   * @returns {Promise<Object|null>} The user goals
   */
  async getUserGoals(userId = null) {
    const uid = userId || this.getCurrentUserId();
    return this.getDocument(schema.COLLECTIONS.USER_GOALS, 'goals', uid);
  }

  /**
   * Get all logs for a user
   * @param {Object} options - Query options
   * @param {string} userId - The user ID (optional)
   * @returns {Promise<Array>} The logs
   */
  async getLogs(options = {}, userId = null) {
    // Default sorting by timestamp
    const queryOptions = {
      ...options,
      orderBy: options.orderBy || { field: 'timestamp', direction: 'desc' }
    };
    
    return this.getDocuments(schema.COLLECTIONS.LOGS, queryOptions, userId);
  }

  /**
   * Get all journal entries for a user
   * @param {Object} options - Query options
   * @param {string} userId - The user ID (optional)
   * @returns {Promise<Array>} The journal entries
   */
  async getJournalEntries(options = {}, userId = null) {
    // Default sorting by timestamp
    const queryOptions = {
      ...options,
      orderBy: options.orderBy || { field: 'timestamp', direction: 'desc' }
    };
    
    return this.getDocuments(schema.COLLECTIONS.JOURNAL, queryOptions, userId);
  }

  /**
   * Get all health metrics for a user
   * @param {Object} options - Query options
   * @param {string} userId - The user ID (optional)
   * @returns {Promise<Array>} The health metrics
   */
  async getHealthMetrics(options = {}, userId = null) {
    // Default sorting by date
    const queryOptions = {
      ...options,
      orderBy: options.orderBy || { field: 'date', direction: 'desc' }
    };
    
    return this.getDocuments(schema.COLLECTIONS.HEALTH_METRICS, queryOptions, userId);
  }

  /**
   * Get all projects for a user
   * @param {Object} options - Query options
   * @param {string} userId - The user ID (optional)
   * @returns {Promise<Array>} The projects
   */
  async getProjects(options = {}, userId = null) {
    // Default sorting by createdAt
    const queryOptions = {
      ...options,
      orderBy: options.orderBy || { field: 'createdAt', direction: 'desc' }
    };
    
    return this.getDocuments(schema.COLLECTIONS.PROJECTS, queryOptions, userId);
  }

  /**
   * Get Strava connection details
   * @param {string} userId - The user ID (optional)
   * @returns {Promise<Object|null>} The Strava connection
   */
  async getStravaConnection(userId = null) {
    return this.getDocument(schema.COLLECTIONS.STRAVA_CONNECTION, 'strava', userId);
  }

  /**
   * Get Strava data
   * @param {string} userId - The user ID (optional)
   * @returns {Promise<Object|null>} The Strava data
   */
  async getStravaData(userId = null) {
    return this.getDocument(schema.COLLECTIONS.STRAVA_DATA, 'data', userId);
  }
}

// Singleton instance
const databaseService = new DatabaseService();
export default databaseService;