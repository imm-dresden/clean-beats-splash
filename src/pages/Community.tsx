import { Users, MessageCircle, Heart, Share, Music } from "lucide-react";

const Community = () => {
  return (
    <div className="min-h-screen gradient-hero">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between text-white">
          <h1 className="text-2xl font-bold">Community</h1>
          <Users className="w-6 h-6 text-accent" />
        </div>
        <p className="text-accent opacity-80 mt-1">Connect with clean music lovers</p>
      </div>

      {/* Community Stats */}
      <div className="px-6 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 text-center">
            <h3 className="text-2xl font-bold text-white">12.5K</h3>
            <p className="text-accent text-sm opacity-80">Members</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 text-center">
            <h3 className="text-2xl font-bold text-white">847</h3>
            <p className="text-accent text-sm opacity-80">Online</p>
          </div>
        </div>
      </div>

      {/* Recent Posts */}
      <div className="px-6">
        <h2 className="text-white text-lg font-semibold mb-4">Recent Posts</h2>
        
        <div className="space-y-4">
          {[
            {
              user: "MusicLover23",
              time: "2h ago",
              content: "Just discovered this amazing clean hip-hop track! The production is incredible.",
              likes: 24,
              comments: 8
            },
            {
              user: "CleanBeatsChef",
              time: "4h ago", 
              content: "Working on a new playlist for studying. Any recommendations for instrumental tracks?",
              likes: 31,
              comments: 12
            },
            {
              user: "AudioEnthusiast",
              time: "6h ago",
              content: "The new equipment setup is finally complete! Can't wait to share some recordings.",
              likes: 18,
              comments: 5
            }
          ].map((post, index) => (
            <div key={index} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center">
                  <Music className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 className="text-white font-medium">{post.user}</h3>
                  <p className="text-accent text-sm opacity-80">{post.time}</p>
                </div>
              </div>
              
              <p className="text-white mb-3">{post.content}</p>
              
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-1 text-accent">
                  <Heart className="w-4 h-4" />
                  <span className="text-sm">{post.likes}</span>
                </div>
                <div className="flex items-center space-x-1 text-accent">
                  <MessageCircle className="w-4 h-4" />
                  <span className="text-sm">{post.comments}</span>
                </div>
                <Share className="w-4 h-4 text-accent" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Community;