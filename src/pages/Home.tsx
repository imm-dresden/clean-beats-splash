import { Music, Play, Heart, TrendingUp } from "lucide-react";

const Home = () => {
  return (
    <div className="min-h-screen gradient-hero">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between text-white">
          <div>
            <h1 className="text-2xl font-bold">Good Morning</h1>
            <p className="text-accent opacity-80">Ready for some clean beats?</p>
          </div>
          <Music className="w-8 h-8 text-accent" />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-6 mb-6">
        <div className="grid grid-cols-2 gap-4">
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

      {/* Trending Section */}
      <div className="px-6">
        <div className="flex items-center space-x-2 mb-4">
          <TrendingUp className="w-5 h-5 text-accent" />
          <h2 className="text-white text-lg font-semibold">Trending Now</h2>
        </div>
        
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center">
                  <Music className="w-6 h-6 text-accent" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-medium">Clean Track {item}</h3>
                  <p className="text-accent text-sm opacity-80">Artist Name</p>
                </div>
                <Play className="w-5 h-5 text-white/60" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Home;