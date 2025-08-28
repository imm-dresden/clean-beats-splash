import { Music } from "lucide-react";
import { useEffect, useState } from "react";

const SplashScreen = () => {
  const [textVisible, setTextVisible] = useState(false);
  const [logoVisible, setLogoVisible] = useState(false);

  useEffect(() => {
    // Stagger the animations
    const logoTimer = setTimeout(() => setLogoVisible(true), 500);
    const textTimer = setTimeout(() => setTextVisible(true), 1000);
    
    return () => {
      clearTimeout(logoTimer);
      clearTimeout(textTimer);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground gradient-hero">
      {/* Background Animated Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-musical-electric/10 rounded-full animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-24 h-24 bg-musical-primary/10 rounded-full animate-pulse-slow delay-1000" />
        <div className="absolute top-1/2 right-1/3 w-16 h-16 bg-accent/10 rounded-full animate-pulse-slow" />
      </div>

      {/* Logo with elegant fade-in animation */}
      <div className={`relative mb-8 transition-all duration-1000 ease-out ${
        logoVisible 
          ? 'opacity-100 transform translate-y-0 scale-100' 
          : 'opacity-0 transform translate-y-8 scale-95'
      }`}>
        <div className="absolute inset-0 bg-gradient-to-r from-musical-primary to-accent rounded-full blur-xl opacity-30 animate-pulse-slow" />
        <div className="relative w-24 h-24 bg-accent/20 rounded-full flex items-center justify-center backdrop-blur-sm shadow-deep border border-white/10">
          <img 
            src="/lovable-uploads/08764610-4eba-4667-874c-4f88552bd1ea.png" 
            alt="Clean Beats Logo" 
            className="w-16 h-16 animate-glow"
          />
        </div>
      </div>

      {/* App name with elegant staggered fade-in animation */}
      <div className="text-center mb-8">
        <div className={`transition-all duration-1500 ease-out delay-300 ${
          textVisible 
            ? 'opacity-100 transform translate-y-0' 
            : 'opacity-0 transform translate-y-4'
        }`}>
          <h1 className="text-5xl font-bold text-foreground mb-2 tracking-wide">
            <span className={`inline-block transition-all duration-700 ease-out ${
              textVisible ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-4'
            }`}>
              Clean
            </span>
            <span className={`inline-block ml-3 transition-all duration-700 ease-out delay-300 ${
              textVisible ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-4'
            }`}>
              Beats
            </span>
          </h1>
        </div>
        
        <div className={`flex items-center justify-center space-x-2 text-accent transition-all duration-1000 delay-1000 ${
          textVisible ? 'opacity-80' : 'opacity-0'
        }`}>
          <Music className="w-5 h-5 animate-pulse" />
          <span className="text-lg font-medium tracking-wide">
            Pure Music Experience
          </span>
          <Music className="w-5 h-5 animate-pulse" />
        </div>
      </div>

      {/* Loading indicator */}
      <div className={`transition-all duration-700 delay-1500 ${
        textVisible ? 'opacity-100' : 'opacity-0'
      }`}>
        <div className="flex items-center space-x-1 mb-6">
          <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
          <div className="w-2 h-2 bg-accent rounded-full animate-pulse delay-200" />
          <div className="w-2 h-2 bg-accent rounded-full animate-pulse delay-400" />
        </div>
      </div>

      {/* Musical Waveform Animation */}
      <div className={`flex items-end space-x-1 h-8 transition-all duration-700 delay-2000 ${
        textVisible ? 'opacity-100' : 'opacity-0'
      }`}>
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="bg-gradient-to-t from-musical-primary to-accent rounded-full animate-pulse"
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
  );
};

export default SplashScreen;