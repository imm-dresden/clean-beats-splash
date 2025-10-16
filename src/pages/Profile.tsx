import { User, Settings, Music, Calendar, Bell, CheckCircle, Edit, Heart, Users, Grid, UserPlus, UserMinus, Camera, ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ThemeToggle from "@/components/ThemeToggle";
import CreatePost from "@/components/CreatePost";
import PostGridItem from "@/components/PostGridItem";
import PostModal from "@/components/PostModal";
import FollowButton from "@/components/FollowButton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Equipment {
  id: string;
  name: string;
  type: string;
  description?: string;
  photo_url?: string;
  icon?: string;
  last_cleaned_at?: string;
  next_cleaning_due?: string;
  cleaning_frequency_days: number;
  current_streak: number;
  best_streak: number;
}

interface UserProfile {
  id: string;
  user_id: string;
  display_name?: string;
  username: string;
  bio?: string;
  email?: string;
  avatar_url?: string;
}

interface Post {
  id: string;
  content: string;
  image_url?: string;
  created_at: string;
  user_id: string;
  author?: {
    display_name?: string;
    username: string;
  };
  likes_count?: number;
  is_liked?: boolean;
}

interface FollowStats {
  followers: number;
  following: number;
}

const equipmentIcons = {
  guitar: "🎸",
  drums: "🥁", 
  microphone: "🎤",
  speaker: "🔊",
  keyboard: "🎹",
  violin: "🎻",
  trumpet: "🎺",
  saxophone: "🎷",
  amplifier: "📢",
  mixer: "🎛️",
  headphones: "🎧",
  other: "🎵"
};

const Profile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [followStats, setFollowStats] = useState<FollowStats>({ followers: 0, following: 0 });
  const [loading, setLoading] = useState(true);
  const [detailEquipment, setDetailEquipment] = useState<Equipment | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioText, setBioText] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [commentsCount, setCommentsCount] = useState<Record<string, number>>({});
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      const targetUserId = userId || currentUser.id;
      setIsOwnProfile(!userId || userId === currentUser.id);
      fetchUserProfile(targetUserId);
      fetchProfileEquipment(targetUserId);
      fetchPosts(targetUserId);
      fetchFollowStats(targetUserId);
    }
  }, [userId, currentUser]);

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }
      setCurrentUser(user);
    } catch (error) {
      console.error('Error fetching current user:', error);
      navigate('/auth');
    }
  };

  const fetchUserProfile = async (targetUserId: string) => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (currentUser && currentUser.id === targetUserId) {
        // User viewing their own profile - can access all data including email
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', targetUserId)
          .single();
        
        if (profile) {
          setUserProfile(profile);
          setBioText(profile?.bio || "");
        }
      } else {
        // Viewing someone else's profile - use secure function
        const { data: profileData } = await supabase
          .rpc('get_public_profile', { profile_user_id: targetUserId });
        
        if (profileData && profileData.length > 0) {
          const profile = profileData[0];
          setUserProfile({
            ...profile,
            id: profile.user_id, // Map user_id to id for compatibility
            email: null // Don't include email for public profiles
          });
          setBioText(profile?.bio || "");
        }
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const fetchProfileEquipment = async (targetUserId: string) => {
    try {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .eq('user_id', targetUserId)
        .eq('show_on_profile', true)
        .order('name');

      if (error) throw error;
      setEquipment(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch equipment",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPosts = async (targetUserId: string) => {
    try {
      // Fetch posts with author info and like counts
      const { data: postsData, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get profile info using secure function
      const { data: profileData } = await supabase
        .rpc('get_public_profile', { profile_user_id: targetUserId });
      
      const authorProfile = profileData && profileData.length > 0 ? profileData[0] : null;

      // Transform data to include likes count and check if current user liked
      const postsWithLikes = await Promise.all(
        (postsData || []).map(async (post) => {
          const { count: likesCount } = await supabase
            .from('post_likes')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', post.id);

          // Only check like status for current user if logged in
          let userLike = null;
          if (currentUser) {
            const { data } = await supabase
              .from('post_likes')
              .select('id')
              .eq('post_id', post.id)
              .eq('user_id', currentUser.id)
              .maybeSingle();
            userLike = data;
          }

          return {
            ...post,
            author: authorProfile,
            likes_count: likesCount || 0,
            is_liked: !!userLike
          };
        })
      );

      setPosts(postsWithLikes);
      
      // Fetch comments count for each post
      const commentsCounts: Record<string, number> = {};
      await Promise.all(
        postsWithLikes.map(async (post) => {
          const { count } = await supabase
            .from('post_comments')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', post.id);
          commentsCounts[post.id] = count || 0;
        })
      );
      setCommentsCount(commentsCounts);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch posts",
        variant: "destructive",
      });
    }
  };

  const fetchFollowStats = async (targetUserId: string) => {
    try {
      // Get followers count
      const { count: followersCount } = await supabase
        .from('followers')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', targetUserId);

      // Get following count
      const { count: followingCount } = await supabase
        .from('followers')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', targetUserId);

      setFollowStats({
        followers: followersCount || 0,
        following: followingCount || 0
      });
    } catch (error) {
      console.error('Error fetching follow stats:', error);
    }
  };

  const updateBio = async () => {
    try {
      if (!currentUser || !isOwnProfile) return;

      const { error } = await supabase
        .from('profiles')
        .update({ bio: bioText })
        .eq('user_id', currentUser.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Bio updated successfully",
      });

      setIsEditingBio(false);
      fetchUserProfile(currentUser.id);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update bio",
        variant: "destructive",
      });
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file || !currentUser) return;

      setUploading(true);

      // Upload to Supabase storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUser.id}/${Math.random()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile with avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: data.publicUrl })
        .eq('user_id', currentUser.id);

      if (updateError) throw updateError;

      toast({
        title: "Success",
        description: "Profile picture updated successfully",
      });

      fetchUserProfile(currentUser.id);
    } catch (error) {
      toast({
        title: "Error", 
        description: "Failed to update profile picture",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handlePostClick = (post: Post) => {
    setSelectedPost(post);
    setIsPostModalOpen(true);
  };

  const handlePostModalClose = () => {
    setIsPostModalOpen(false);
    setSelectedPost(null);
  };

  const getDaysUntilDue = (dueDateString?: string) => {
    if (!dueDateString) return null;
    const now = new Date();
    const dueDate = new Date(dueDateString);
    const diffTime = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getUserDisplayName = () => {
    return userProfile?.display_name || userProfile?.username || "Music Enthusiast";
  };

  const openDetailDialog = (item: Equipment) => {
    setDetailEquipment(item);
    setIsDetailDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground gradient-hero">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {userId && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  if (window.history.length > 1) {
                    navigate(-1);
                  } else {
                    navigate('/home');
                  }
                }}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <h1 className="text-2xl font-bold text-foreground">
              {isOwnProfile ? 'Profile' : getUserDisplayName()}
            </h1>
          </div>
          {isOwnProfile && (
            <Button variant="ghost" size="sm" onClick={() => navigate('/settings')}>
              <Settings className="w-6 h-6 text-accent" />
            </Button>
          )}
        </div>
      </div>

      {/* Profile Info */}
      <div className="px-6 mb-6">
        <div className="bg-card/50 backdrop-blur-sm rounded-2xl p-6 border border-border/50">
          <div className="flex items-start space-x-4 mb-4">
            <div className="relative">
              <div className="w-20 h-20 bg-accent/20 rounded-full flex items-center justify-center overflow-hidden">
                {userProfile?.avatar_url ? (
                  <img 
                    src={userProfile.avatar_url} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-10 h-10 text-accent" />
                )}
              </div>
              {isOwnProfile && (
                <>
                  <button 
                    className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center hover:bg-primary/80 transition-colors"
                    onClick={() => document.getElementById('avatar-upload')?.click()}
                    disabled={uploading}
                  >
                    <Camera className="w-3 h-3 text-primary-foreground" />
                  </button>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </>
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-foreground text-xl font-bold">{getUserDisplayName()}</h2>
              <p className="text-accent opacity-80 mb-2">@{userProfile?.username}</p>
              
              {/* Follow Stats */}
              <div className="flex gap-6 mb-3">
                <div className="text-center">
                  <div className="font-bold text-lg">{posts.length}</div>
                  <div className="text-sm text-muted-foreground">Posts</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg">{followStats.followers}</div>
                  <div className="text-sm text-muted-foreground">Followers</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg">{followStats.following}</div>
                  <div className="text-sm text-muted-foreground">Following</div>
                </div>
              </div>

              {/* Bio */}
              <div className="space-y-2">
                {isEditingBio && isOwnProfile ? (
                  <div className="space-y-2">
                    <Textarea
                      value={bioText}
                      onChange={(e) => setBioText(e.target.value)}
                      placeholder="Tell us about yourself..."
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={updateBio}>Save</Button>
                      <Button size="sm" variant="outline" onClick={() => setIsEditingBio(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <p className="text-sm text-muted-foreground flex-1">
                      {userProfile?.bio || "Music lover | Clean beats enthusiast"}
                    </p>
                    {isOwnProfile && (
                      <Button size="sm" variant="ghost" onClick={() => setIsEditingBio(true)}>
                        <Edit className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Follow Button */}
              {!isOwnProfile && (
                <div className="mt-3">
                  <FollowButton 
                    targetUserId={userProfile?.user_id || ''} 
                    onFollowChange={() => fetchFollowStats(userProfile?.user_id || '')}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content Tabs */}
      <div className="px-6">
        <Tabs defaultValue="posts" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="posts" className="flex items-center gap-2">
              <Grid className="w-4 h-4" />
              Posts
            </TabsTrigger>
            <TabsTrigger value="equipment" className="flex items-center gap-2">
              <Music className="w-4 h-4" />
              Equipment
            </TabsTrigger>
          </TabsList>

          {/* Posts Tab */}
          <TabsContent value="posts" className="mt-6">
            {isOwnProfile && <CreatePost onPostCreated={() => fetchPosts(currentUser?.id || '')} />}
            
            {posts.length > 0 ? (
              <div className="grid grid-cols-3 gap-1 mt-4">
                {posts.map((post) => (
                  <PostGridItem
                    key={post.id}
                    post={post}
                    commentsCount={commentsCount[post.id] || 0}
                    onClick={() => handlePostClick(post)}
                  />
                ))}
              </div>
            ) : (
              <Card className="glass-card mt-4">
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">No posts yet. Share your first post!</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Equipment Tab */}
          <TabsContent value="equipment" className="mt-6">
            {equipment.length > 0 ? (
              <div className="space-y-6">
                <div className="bg-card/50 backdrop-blur-sm rounded-2xl p-6 border border-border/50">
                  <div className="flex items-center gap-2 mb-4">
                    <Music className="w-5 h-5 text-accent" />
                    <h3 className="text-foreground text-lg font-semibold">My Equipment</h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {equipment.map((item) => {
                      const daysUntilDue = getDaysUntilDue(item.next_cleaning_due);
                      
                      return (
                        <Card 
                          key={item.id} 
                          className="bg-background/30 border-border/30 hover:bg-background/50 transition-colors cursor-pointer"
                          onClick={() => openDetailDialog(item)}
                        >
                          <CardContent className="p-3">
                            <div className="flex flex-col items-center text-center space-y-2">
                              {item.photo_url ? (
                                <img 
                                  src={item.photo_url} 
                                  alt={item.name}
                                  className="w-12 h-12 rounded-lg object-cover border border-border/50"
                                />
                              ) : (
                                <span className="text-2xl">{equipmentIcons[item.icon as keyof typeof equipmentIcons] || equipmentIcons.other}</span>
                              )}
                              <div className="space-y-1">
                                <h4 className="font-medium text-sm leading-tight">{item.name}</h4>
                                <p className="text-xs text-muted-foreground capitalize">{item.type}</p>
                                {item.description && (
                                  <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                                )}
                              </div>
                              {item.next_cleaning_due && (
                                <Badge 
                                  variant="secondary" 
                                  className={`text-xs ${daysUntilDue !== null && daysUntilDue < 0 ? 'bg-red-500/20 text-red-400' : 
                                    daysUntilDue === 0 ? 'bg-yellow-500/20 text-yellow-400' : ''}`}
                                >
                                  <Calendar className="w-3 h-3 mr-1" />
                                  {daysUntilDue !== null ? (
                                    daysUntilDue > 0 ? `${daysUntilDue}d` : 
                                    daysUntilDue === 0 ? 'Today' : 
                                    `${Math.abs(daysUntilDue)}d overdue`
                                  ) : 'Not scheduled'}
                                </Badge>
                              )}
                              {/* Current Streak */}
                              <div className="flex items-center gap-1 mt-1">
                                <span className="text-sm">🔥</span>
                                <span className="text-xs font-semibold text-orange-500">
                                  {item.current_streak} day streak
                                </span>
                              </div>
                              {item.last_cleaned_at && (
                                <span className="text-xs text-muted-foreground">
                                  Last: {format(new Date(item.last_cleaned_at), 'MMM dd')}
                                </span>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                {/* Equipment Stats */}
                <div className="bg-card/50 backdrop-blur-sm rounded-2xl p-6 border border-border/50">
                  <h3 className="text-foreground text-lg font-semibold mb-4">Equipment Stats</h3>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-accent">{equipment.length}</div>
                      <div className="text-sm text-muted-foreground">Total Items</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-500">
                        {Math.max(...equipment.map(e => e.current_streak), 0)}
                      </div>
                      <div className="text-sm text-muted-foreground">Best Streak</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-500">
                        {equipment.filter(item => {
                          const days = getDaysUntilDue(item.next_cleaning_due);
                          return days !== null && days >= 0;
                        }).length}
                      </div>
                      <div className="text-sm text-muted-foreground">Up to Date</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-500">
                        {equipment.filter(item => {
                          const days = getDaysUntilDue(item.next_cleaning_due);
                          return days !== null && days < 0;
                        }).length}
                      </div>
                      <div className="text-sm text-muted-foreground">Overdue</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <Card className="glass-card">
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">No equipment set to show on profile yet.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

        </Tabs>
      </div>

      {loading && (
        <div className="px-6">
          <div className="bg-card/50 backdrop-blur-sm rounded-2xl p-6 border border-border/50">
            <div className="text-center text-muted-foreground">Loading profile...</div>
          </div>
        </div>
      )}

      {/* Equipment Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-3">
              {detailEquipment?.photo_url ? (
                <img 
                  src={detailEquipment.photo_url} 
                  alt={detailEquipment.name}
                  className="w-12 h-12 object-cover rounded-lg border"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center text-xl">
                  {detailEquipment && equipmentIcons[detailEquipment.type as keyof typeof equipmentIcons] || detailEquipment?.icon || "🎵"}
                </div>
              )}
              <div>
                <h2 className="text-xl font-bold">{detailEquipment?.name}</h2>
                <p className="text-sm text-muted-foreground capitalize">{detailEquipment?.type}</p>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto">
            <div className="space-y-6 p-1">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Equipment Type</Label>
                    <p className="capitalize">{detailEquipment?.type}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Cleaning Frequency</Label>
                    <p>Every {detailEquipment?.cleaning_frequency_days} days</p>
                  </div>
                </div>
                
                {detailEquipment?.description && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Cleaning Requirements</Label>
                    <p className="text-sm mt-1">{detailEquipment.description}</p>
                  </div>
                )}
              </div>

              {/* Cleaning Schedule */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Cleaning Schedule</h3>
                
                {/* Current Streak Display */}
                <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Current Streak</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-3xl">🔥</span>
                        <span className="text-3xl font-bold text-orange-500">{detailEquipment?.current_streak}</span>
                        <span className="text-lg text-muted-foreground">days</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <Label className="text-sm font-medium text-muted-foreground">Best Streak</Label>
                      <div className="flex items-center gap-2 justify-end mt-1">
                        <span className="text-2xl">🏆</span>
                        <span className="text-2xl font-bold text-yellow-500">{detailEquipment?.best_streak}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {detailEquipment?.last_cleaned_at && (
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <Label className="text-sm font-medium text-muted-foreground">Last Cleaned</Label>
                      <p className="text-lg font-medium">{format(new Date(detailEquipment.last_cleaned_at), 'EEEE, MMMM d, yyyy')}</p>
                      <p className="text-sm text-muted-foreground">{format(new Date(detailEquipment.last_cleaned_at), 'h:mm a')}</p>
                    </div>
                  )}
                  
                  {detailEquipment?.next_cleaning_due && (
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <Label className="text-sm font-medium text-muted-foreground">Next Cleaning Due</Label>
                      <p className="text-lg font-medium">{format(new Date(detailEquipment.next_cleaning_due), 'EEEE, MMMM d, yyyy')}</p>
                      {(() => {
                        const daysUntilDue = getDaysUntilDue(detailEquipment.next_cleaning_due);
                        return daysUntilDue !== null && (
                          <p className={`text-sm ${daysUntilDue < 0 ? 'text-red-500' : daysUntilDue === 0 ? 'text-yellow-500' : 'text-green-500'}`}>
                            {daysUntilDue > 0 ? `Due in ${daysUntilDue} days` : 
                             daysUntilDue === 0 ? 'Due today' : 
                             `${Math.abs(daysUntilDue)} days overdue`}
                          </p>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {/* Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Visibility</h3>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>Shown on Profile</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">This equipment is visible on your profile showcase</p>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Post Modal */}
      <PostModal
        post={selectedPost}
        isOpen={isPostModalOpen}
        onClose={handlePostModalClose}
        isOwner={selectedPost?.user_id === currentUser?.id}
        onPostUpdate={() => fetchPosts(userProfile?.user_id || '')}
      />
    </div>
  );
};

export default Profile;