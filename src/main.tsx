import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/pwaService";
import { supabase } from "@/integrations/supabase/client";

// Enhanced session persistence and auth state management
const initializeAuth = async () => {
  try {
    // Get initial session
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error getting session:', error);
      return;
    }

    if (session) {
      console.log('Initial session found:', session.user.email);
    } else {
      console.log('No initial session found');
    }

    // Set up auth state change listener for persistent login
    supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session?.user?.email);
      
      // Store session data in localStorage for persistence
      if (session) {
        localStorage.setItem('supabase.auth.token', JSON.stringify(session));
      } else {
        localStorage.removeItem('supabase.auth.token');
      }
    });

  } catch (error) {
    console.error('Error initializing auth:', error);
  }
};

// Initialize auth before rendering the app
initializeAuth().then(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});
