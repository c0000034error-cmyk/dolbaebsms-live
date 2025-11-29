import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// Configuration from the provided legacy code
const firebaseConfig = {
  apiKey: "AIzaSyA35T6z2FYS6m9IEJ9x7evxCphgpLhgMX4",
  authDomain: "dolbaebsms-live.firebaseapp.com",
  databaseURL: "https://dolbaebsms-live-default-rtdb.firebaseio.com",
  projectId: "dolbaebsms-live",
  storageBucket: "dolbaebsms-live.firebasestorage.app",
  messagingSenderId: "912825721862",
  appId: "1:912825721862:web:b92d7f7f553ca4536c0f87",
  measurementId: "G-SCD5JVFM5E"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);