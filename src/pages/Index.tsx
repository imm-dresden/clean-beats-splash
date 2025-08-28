import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import SplashScreen from "@/components/SplashScreen";
import { Music, Play, Heart, Search } from "lucide-react";

const Index = () => {
  const [showSplash, setShowSplash] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
      // Navigate to home after splash screen
      setTimeout(() => navigate("/home"), 500);
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate]);

  if (showSplash) {
    return <SplashScreen />;
  }

  return (
    <div className="min-h-screen gradient-hero">
      {/* Navigation */}
      <nav className="flex items-center justify-between p-6 text-white">
        <div className="flex items-center space-x-2">
          <Music className="w-8 h-8 text-accent" />
          <span className="text-xl font-bold">Clean Beats</span>
        </div>
        <Search className="w-6 h-6 text-accent" />
      </nav>

      {/* Main Content */}
      <div className="px-6 pb-6">
        <div className="text-center text-white mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome to Clean Beats</h1>
          <p className="text-accent">Your pure music experience starts here</p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
          <button className="flex flex-col items-center space-y-3 bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-300">
            <Play className="w-8 h-8 text-accent" />
            <span className="text-white font-medium">Play Music</span>
          </button>
          
          <button className="flex flex-col items-center space-y-3 bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-300">
            <Heart className="w-8 h-8 text-accent" />
            <span className="text-white font-medium">Favorites</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Index;
