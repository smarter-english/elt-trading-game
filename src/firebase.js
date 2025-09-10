// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getDatabase }     from 'firebase/database';
import {
  getAuth,
  setPersistence,
  browserSessionPersistence
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

const app      = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth     = getAuth(app);

// Use sessionStorage so auth survives a page reload but is cleared when the tab closes
setPersistence(auth, browserSessionPersistence)
  .catch(err => console.warn('Auth persistence error', err));

export { auth, database };