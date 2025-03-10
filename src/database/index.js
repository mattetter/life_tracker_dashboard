/**
 * Database module exports
 */

// Export DatabaseService as both default and named export
import DatabaseService from './DatabaseService';
export default DatabaseService;
export const databaseService = DatabaseService;

// Export all schema related constants and types
export * from './schema';