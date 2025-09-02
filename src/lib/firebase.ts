// Firebase configuration for FCM
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

// Firebase configuration - Updated with actual project details
const firebaseConfig = {
  apiKey: "AIzaSyBHB6KLrPOUQ04ACC_5LdxfJjDuVEQzyTk",
  authDomain: "clean-beats-640e0.firebaseapp.com",
  projectId: "clean-beats-640e0", 
  storageBucket: "clean-beats-640e0.firebasestorage.app",
  messagingSenderId: "853381074677",
  appId: "1:853381074677:web:db13bc050ef51d1d89ffbc"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize FCM
let messaging: any = null;

// Check if messaging is supported (web environment)
export const initializeMessaging = async () => {
  try {
    console.log('Firebase: Checking messaging support...');
    const supported = await isSupported();
    console.log('Firebase: Messaging supported:', supported);
    
    if (supported) {
      console.log('Firebase: Creating messaging instance...');
      messaging = getMessaging(app);
      console.log('Firebase: Messaging instance created successfully');
      return messaging;
    }
    console.log('Firebase Messaging is not supported in this environment');
    return null;
  } catch (error) {
    console.error('Error initializing Firebase Messaging:', error);
    return null;
  }
};

export { messaging };
export default app;