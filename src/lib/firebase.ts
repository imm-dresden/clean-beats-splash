// Firebase configuration for FCM
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

// Firebase configuration - these will be set via environment or build process
const firebaseConfig = {
  apiKey: "AIzaSyBZ8HGR4rKKHnKEJ7rM5vFY6Qn8cKP6wQ8", // Placeholder - will be updated with real values
  authDomain: "clean-beats-fcm.firebaseapp.com",
  projectId: "clean-beats-fcm", 
  storageBucket: "clean-beats-fcm.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize FCM
let messaging: any = null;

// Check if messaging is supported (web environment)
export const initializeMessaging = async () => {
  try {
    const supported = await isSupported();
    if (supported) {
      messaging = getMessaging(app);
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