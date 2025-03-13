// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration
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
  
export { auth, db, firebaseApp };

