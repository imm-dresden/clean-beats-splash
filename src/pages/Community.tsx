import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart, MessageCircle, Share, Search, Calendar, Users, TrendingUp } from "lucide-react";
import PostCard from "@/components/PostCard";
import EventCard from "@/components/EventCard";
import UniversalSearch from "@/components/UniversalSearch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "react-router-dom";

interface Post {
  id: string;
  content: string;
  image_url?: string;
  created_at: string;
  user_id: string;
  author?: {
    display_name?: string;
    username: string;
    avatar_url?: string;
  };
  likes_count?: number;
  is_liked?: boolean;
}

interface Event {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date?: string;
  location?: string;
  event_type: string;
  user_id: string;
  created_at: string;
  author?: {
    display_name?: string;
    username: string;
    avatar_url?: string;
  };
  likes_count?: number;
  is_liked?: boolean;
  is_going?: boolean;
  going_count?: number;
}

const Community = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const { toast } = useToast();
  const location = useLocation();

  useEffect(() => {
    fetchCurrentUser();
    fetchFeedData();
  }, []);

  // Handle notification navigation highlighting
  useEffect(() => {
    if (location.state?.highlightPost || location.state?.highlightEvent) {
      const timeout = setTimeout(() => {
        const highlightId = location.state.highlightPost || location.state.highlightEvent;
        const element = document.getElementById(`post-${highlightId}`) || document.getElementById(`event-${highlightId}`);
        
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Add temporary highlight effect
          element.style.boxShadow = '0 0 0 3px rgba(var(--primary), 0.5)';
          element.style.transition = 'box-shadow 0.3s ease';
          
          setTimeout(() => {
            element.style.boxShadow = '';
          }, 3000);
          
          // If should scroll to comments, trigger comment expansion
          if (location.state.scrollToComments) {
            const commentsButton = element.querySelector('[data-comments-toggle]');
            if (commentsButton && commentsButton instanceof HTMLElement) {
              commentsButton.click();
            }
          }
        }
      }, 1000); // Wait for posts to load
      
      return () => clearTimeout(timeout);
    }
  }, [location.state, posts, events]);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);
  };

  const fetchFeedData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get users that current user follows
      const { data: following } = await supabase
        .from('followers')
        .select('following_id')
        .eq('follower_id', user.id);

      const followingIds = following?.map(f => f.following_id) || [];
      
      // Include current user's own posts/events
      const userIds = [...followingIds, user.id];

      if (userIds.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch posts from followed users
      await fetchPosts(userIds, user.id);
      
      // Fetch events from followed users  
      await fetchEvents(userIds, user.id);

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch community feed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPosts = async (userIds: string[], currentUserId: string) => {
    const { data: postsData, error } = await supabase
      .from('posts')
      .select('*')
      .in('user_id', userIds)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    // Get profile info and engagement data for posts
    const postsWithDetails = await Promise.all(
      (postsData || []).map(async (post) => {
        // Get author profile using secure function
        const { data: profileData } = await supabase
          .rpc('get_public_profile', { profile_user_id: post.user_id });
        
        const authorProfile = profileData && profileData.length > 0 ? profileData[0] : null;

        // Get likes count and user's like status
        const { count: likesCount } = await supabase
          .from('post_likes')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', post.id);

        const { data: userLike } = await supabase
          .from('post_likes')
          .select('id')
          .eq('post_id', post.id)
          .eq('user_id', currentUserId)
          .maybeSingle();

        return {
          ...post,
          author: authorProfile,
          likes_count: likesCount || 0,
          is_liked: !!userLike
        };
      })
    );

    setPosts(postsWithDetails);
  };

  const fetchEvents = async (userIds: string[], currentUserId: string) => {
    const { data: eventsData, error } = await supabase
      .from('events')
      .select('*')
      .in('user_id', userIds)
      .order('start_date', { ascending: true })
      .limit(20);

    if (error) throw error;

    // Get profile info and engagement data for events
    const eventsWithDetails = await Promise.all(
      (eventsData || []).map(async (event) => {
        // Get author profile using secure function
        const { data: profileData } = await supabase
          .rpc('get_public_profile', { profile_user_id: event.user_id });
        
        const authorProfile = profileData && profileData.length > 0 ? profileData[0] : null;

        // Get likes count and user's like status
        const { count: likesCount } = await supabase
          .from('event_likes')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', event.id);

        const { data: userLike } = await supabase
          .from('event_likes')
          .select('id')
          .eq('event_id', event.id)
          .eq('user_id', currentUserId)
          .maybeSingle();

        // Get going count and user's attendance status
        const { count: goingCount } = await supabase
          .from('event_attendees')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', event.id);

        const { data: userAttendance } = await supabase
          .from('event_attendees')
          .select('id')
          .eq('event_id', event.id)
          .eq('user_id', currentUserId)
          .maybeSingle();

        const likes_count = likesCount || 0;
        const is_liked = !!userLike;
        const going_count = goingCount || 0;
        const is_going = !!userAttendance;

        return {
          ...event,
          author: authorProfile,
          likes_count,
          is_liked,
          going_count,
          is_going
        };
      })
    );

    setEvents(eventsWithDetails);
  };

  const filteredPosts = posts.filter(post => 
    post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (post.author?.display_name || post.author?.username || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredEvents = events.filter(event => 
    event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (event.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (event.author?.display_name || event.author?.username || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground gradient-hero flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading community feed...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground gradient-hero">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-foreground">Community</h1>
          <TrendingUp className="w-6 h-6 text-accent" />
        </div>
        
        {/* Universal Search Bar */}
        <UniversalSearch
          placeholder="Search users, posts, and events..."
          onSearchQueryChange={setSearchQuery}
          searchQuery={searchQuery}
        />
      </div>

      {/* Content */}
      <div className="px-4 pb-20 max-w-lg mx-auto">
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="all" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              All
            </TabsTrigger>
            <TabsTrigger value="posts" className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              Posts
            </TabsTrigger>
            <TabsTrigger value="events" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Events
            </TabsTrigger>
          </TabsList>

          {/* All Feed */}
          <TabsContent value="all" className="space-y-4">
            {([...filteredPosts, ...filteredEvents] as (Post | Event)[])
              .sort((a, b) => {
                const dateA = 'content' in a ? a.created_at : a.start_date;
                const dateB = 'content' in b ? b.created_at : b.start_date;
                return new Date(dateB).getTime() - new Date(dateA).getTime();
              })
              .map((item) => {
                if ('content' in item) {
                  return (
                    <PostCard
                      key={item.id}
                      post={item}
                      isOwner={item.user_id === currentUser?.id}
                      onPostUpdate={fetchFeedData}
                      highlightComment={location.state?.highlightPost === item.id ? location.state.highlightComment : undefined}
                      highlightReply={location.state?.highlightPost === item.id ? location.state.highlightReply : undefined}
                      id={`post-${item.id}`}
                    />
                  );
                } else {
                  return (
                    <EventCard
                      key={item.id}
                      event={item}
                      onEventUpdate={fetchFeedData}
                      highlightComment={location.state?.highlightEvent === item.id ? location.state.highlightComment : undefined}
                      highlightReply={location.state?.highlightEvent === item.id ? location.state.highlightReply : undefined}
                      id={`event-${item.id}`}
                    />
                  );
                }
              })}
            
            {filteredPosts.length === 0 && filteredEvents.length === 0 && (
              <Card className="glass-card">
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">
                    No posts or events to show. Follow some users to see their content here!
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Posts Only */}
          <TabsContent value="posts" className="space-y-4">
            {filteredPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                isOwner={post.user_id === currentUser?.id}
                onPostUpdate={fetchFeedData}
                highlightComment={location.state?.highlightPost === post.id ? location.state.highlightComment : undefined}
                highlightReply={location.state?.highlightPost === post.id ? location.state.highlightReply : undefined}
                id={`post-${post.id}`}
              />
            ))}
            
            {filteredPosts.length === 0 && (
              <Card className="glass-card">
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">No posts to show</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Events Only */}
          <TabsContent value="events" className="space-y-4">
            {filteredEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onEventUpdate={fetchFeedData}
                highlightComment={location.state?.highlightEvent === event.id ? location.state.highlightComment : undefined}
                highlightReply={location.state?.highlightEvent === event.id ? location.state.highlightReply : undefined}
                id={`event-${event.id}`}
              />
            ))}
            
            {filteredEvents.length === 0 && (
              <Card className="glass-card">
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">No events to show</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Community;