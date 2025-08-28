import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import SplashScreen from "@/components/SplashScreen";

const Index = () => {
  const [showSplash, setShowSplash] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
      // Navigate to auth after splash screen
      navigate("/auth");
    }, 4000); // Duration to enjoy the splash animation

    return () => clearTimeout(timer);
  }, [navigate]);

  if (showSplash) {
    return <SplashScreen />;
  }

  // This component will not render anything after splash since we navigate to auth
  return null;
};

export default Index;
