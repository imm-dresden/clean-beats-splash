import { User, Settings, Music, Heart, Calendar, Award } from "lucide-react";

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
          
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="text-center">
              <h3 className="text-white text-lg font-bold">127</h3>
              <p className="text-accent text-sm opacity-80">Tracks</p>
            </div>
            <div className="text-center">
              <h3 className="text-white text-lg font-bold">89</h3>
              <p className="text-accent text-sm opacity-80">Favorites</p>
            </div>
            <div className="text-center">
              <h3 className="text-white text-lg font-bold">23</h3>
              <p className="text-accent text-sm opacity-80">Playlists</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="px-6 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
            <div className="flex items-center space-x-3">
              <Music className="w-6 h-6 text-accent" />
              <div>
                <h3 className="text-white font-semibold">42h</h3>
                <p className="text-accent text-sm opacity-80">This Month</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
            <div className="flex items-center space-x-3">
              <Award className="w-6 h-6 text-accent" />
              <div>
                <h3 className="text-white font-semibold">Gold</h3>
                <p className="text-accent text-sm opacity-80">Member</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="px-6">
        <h2 className="text-white text-lg font-semibold mb-4">Recent Activity</h2>
        
        <div className="space-y-3">
          {[
            { icon: Heart, action: "Liked", item: "Clean Vibes Playlist", time: "2h ago" },
            { icon: Music, action: "Added to library", item: "Peaceful Beats", time: "1d ago" },
            { icon: Calendar, action: "Scheduled", item: "Studio Session", time: "2d ago" }
          ].map((activity, index) => (
            <div key={index} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center">
                  <activity.icon className="w-5 h-5 text-accent" />
                </div>
                <div className="flex-1">
                  <p className="text-white">
                    <span className="opacity-80">{activity.action}</span> {activity.item}
                  </p>
                  <p className="text-accent text-sm opacity-80">{activity.time}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Profile;