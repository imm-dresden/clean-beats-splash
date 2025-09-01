// Firebase configuration for FCM
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

// Firebase configuration - Updated with actual project details
const firebaseConfig = {
  apiKey: "AIzaSyBZ8HGR4rKKHnKEJ7rM5vFY6Qn8cKP6wQ8",
  authDomain: "clean-beats-640e0.firebaseapp.com",
  projectId: "clean-beats-640e0", 
  storageBucket: "clean-beats-640e0.appspot.com",
  messagingSenderId: "110141202326321971739",
  appId: "1:110141202326321971739:web:abcdef123456"
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