import { User, Settings } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

const Profile = () => {
  return (
    <div className="min-h-screen bg-background text-foreground gradient-hero">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Profile</h1>
          <Settings className="w-6 h-6 text-accent" />
        </div>
      </div>

      {/* Profile Info */}
      <div className="px-6 mb-6">
        <div className="bg-card/50 backdrop-blur-sm rounded-2xl p-6 border border-border/50">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-accent" />
            </div>
            <div>
              <h2 className="text-foreground text-xl font-bold">Music Enthusiast</h2>
              <p className="text-accent opacity-80">Clean Beats Lover</p>
            </div>
          </div>
        </div>
      </div>

      {/* Theme Settings */}
      <div className="px-6 mb-6">
        <div className="bg-card/50 backdrop-blur-sm rounded-2xl p-6 border border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-foreground text-lg font-semibold">Appearance</h3>
              <p className="text-muted-foreground text-sm">Toggle between light and dark theme</p>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;