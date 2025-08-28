import { useEffect, useState } from "react";
import { Music } from "lucide-react";
import cleanBeatsLogo from "@/assets/clean-beats-logo.png";

const SplashScreen = () => {
  const [loading, setLoading] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeOut(true);
      setTimeout(() => setLoading(false), 500);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  if (!loading) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center gradient-hero transition-opacity duration-500 ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Background Animated Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-musical-electric/10 rounded-full animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-24 h-24 bg-musical-primary/10 rounded-full animate-pulse-slow delay-1000" />
        <div className="absolute top-1/2 right-1/3 w-16 h-16 bg-accent/10 rounded-full animate-float" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center space-y-8">
        {/* Logo Container */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-musical-primary to-accent rounded-full blur-xl opacity-30 animate-pulse-slow" />
          <div className="relative bg-background/10 backdrop-blur-sm rounded-full p-8 shadow-deep border border-white/10">
            <img
              src={cleanBeatsLogo}
              alt="Clean Beats Logo"
              className="w-24 h-24 animate-glow"
            />
          </div>
        </div>

        {/* App Name */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-white tracking-tight">
            Clean Beats
          </h1>
          <div className="flex items-center justify-center space-x-2 text-accent">
            <Music className="w-5 h-5 animate-pulse" />
            <span className="text-lg font-medium tracking-wide">
              Pure Music Experience
            </span>
            <Music className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        {/* Loading Indicator */}
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
          <div className="w-2 h-2 bg-accent rounded-full animate-pulse delay-200" />
          <div className="w-2 h-2 bg-accent rounded-full animate-pulse delay-400" />
        </div>

        {/* Musical Waveform Animation */}
        <div className="flex items-end space-x-1 h-8">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className={`bg-gradient-to-t from-musical-primary to-accent rounded-full animate-pulse`}
              style={{
                width: "4px",
                height: `${Math.random() * 20 + 10}px`,
                animationDelay: `${i * 200}ms`,
                animationDuration: "1s"
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;