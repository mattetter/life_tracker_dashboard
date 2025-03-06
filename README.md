# Life Tracker Dashboard

A personal dashboard for tracking various areas of your life: social, wellbeing, health, and productivity.

## Features

- User authentication using Firebase
- Daily tracking of activities and metrics
- Goal setting and progress tracking
- Visual dashboard with progress bars and charts
- Historical data viewing by time period
- Integration with Strava for automatic fitness activity tracking
- Import and sync fitness data to your health metrics

## Tech Stack

- React
- Firebase (Authentication, Firestore, Hosting)
- Tailwind CSS
- Recharts for data visualization
- Strava API integration

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a Firebase project at https://console.firebase.google.com/
4. Add a web app to your Firebase project
5. Enable Email/Password authentication
6. Enable Firestore database
7. Update the Firebase configuration in `src/components/LifeTrackerDashboard.js`
8. For Strava integration: 
   - Create an application in the Strava API portal (https://developers.strava.com/)
   - Go to "My API Application" in your Strava account settings
   - Create a new application with the following details:
     - Application Name: Life Tracker Dashboard (or your preferred name)
     - Category: Fitness
     - Website: Your app's URL or localhost for development
     - Authorization Callback Domain: Your app's domain or localhost (e.g., localhost:3000 for development)
   - After creating the application, you'll receive a Client ID and Client Secret
   - Add these credentials to your `.env` file:
     ```
     REACT_APP_STRAVA_CLIENT_ID=your_client_id_here
     REACT_APP_STRAVA_CLIENT_SECRET=your_client_secret_here
     REACT_APP_STRAVA_REDIRECT_URI=http://localhost:3000
     ```
   - For production, update the redirect URI to your deployed app URL

## Firebase Configuration

Replace the placeholder Firebase config with your own values:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
};
```

## Running Locally

```
npm start
```

## Deploying to Firebase

1. Install Firebase CLI:
   ```
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```
   firebase login
   ```

3. Initialize Firebase in your project:
   ```
   firebase init
   ```
   
   Select Hosting and Firestore when prompted.

4. Build the project:
   ```
   npm run build
   ```

5. Deploy to Firebase:
   ```
   npm run deploy:firebase
   ```

## Creating Your Account

1. Sign up using the registration form with your email and a password
2. Start tracking your daily activities
3. Customize your goals in the dashboard

## Data Structure

The app stores data in Firestore with the following structure:

- `/users/{userId}/logs` - Daily log entries
- `/users/{userId}/settings/goals` - User goals and targets
- `/users/{userId}/journal` - Journal entries
- `/users/{userId}/healthMetrics` - Health measurements and activities
- `/users/{userId}/projects` - Projects and goals
- `/users/{userId}/strava` - Strava sync data and imported activities

## Strava Integration

The dashboard provides integration with Strava to automatically sync:

- Running, cycling, and other activities
- Distance, pace, and elevation data
- Heart rate data (when available from your device)
- Activity types and summaries
- Performance metrics
- Detailed activity stats

To use this feature:

1. Set up Strava API credentials as described in the Setup section
2. Connect your Strava account through the Strava tab
3. Allow the requested permissions for activity data access
4. Sync and import the data into your health metrics

Note: All authentication is handled securely through Strava's OAuth flow. Your credentials are never stored directly in the application.

## License

MIT