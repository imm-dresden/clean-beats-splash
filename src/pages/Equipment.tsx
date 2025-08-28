import { Headphones, Speaker, Mic, Settings } from "lucide-react";

const Equipment = () => {
  return (
    <div className="min-h-screen gradient-hero">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between text-white">
          <h1 className="text-2xl font-bold">Equipment</h1>
          <Settings className="w-6 h-6 text-accent" />
        </div>
        <p className="text-accent opacity-80 mt-1">Manage your audio gear</p>
      </div>

      {/* Equipment Categories */}
      <div className="px-6 space-y-4">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-12 h-12 bg-accent/20 rounded-xl flex items-center justify-center">
              <Headphones className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h2 className="text-white text-lg font-semibold">Headphones</h2>
              <p className="text-accent text-sm opacity-80">Connected devices</p>
            </div>
          </div>
          
          <div className="space-y-3">
            {["AirPods Pro", "Sony WH-1000XM4"].map((device, index) => (
              <div key={device} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                <span className="text-white">{device}</span>
                <div className={`w-3 h-3 rounded-full ${index === 0 ? 'bg-green-400' : 'bg-gray-400'}`} />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-12 h-12 bg-accent/20 rounded-xl flex items-center justify-center">
              <Speaker className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h2 className="text-white text-lg font-semibold">Speakers</h2>
              <p className="text-accent text-sm opacity-80">Audio output</p>
            </div>
          </div>
          
          <div className="space-y-3">
            {["HomePod", "JBL Charge 5"].map((device, index) => (
              <div key={device} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                <span className="text-white">{device}</span>
                <div className={`w-3 h-3 rounded-full ${index === 1 ? 'bg-green-400' : 'bg-gray-400'}`} />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-accent/20 rounded-xl flex items-center justify-center">
              <Mic className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h2 className="text-white text-lg font-semibold">Recording</h2>
              <p className="text-accent text-sm opacity-80">Microphone settings</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Equipment;