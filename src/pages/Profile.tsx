import { User, Settings } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

const Profile = () => {
  return (
    <div className="min-h-screen gradient-hero">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between text-white">
          <h1 className="text-2xl font-bold">Profile</h1>
          <Settings className="w-6 h-6 text-accent" />
        </div>
      </div>

      {/* Profile Info */}
      <div className="px-6 mb-6">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-accent" />
            </div>
            <div>
              <h2 className="text-white text-xl font-bold">Music Enthusiast</h2>
              <p className="text-accent opacity-80">Clean Beats Lover</p>
            </div>
          </div>
        </div>
      </div>

      {/* Theme Settings */}
      <div className="px-6 mb-6">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white text-lg font-semibold">Appearance</h3>
              <p className="text-accent opacity-80 text-sm">Toggle between light and dark theme</p>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;