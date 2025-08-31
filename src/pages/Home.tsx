import { Settings, Music, Bell, Users, Calendar, Wrench, TrendingUp, Trophy, Flame, Crown, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import UserSearch from "@/components/UserSearch";
import { notificationService } from "@/services/notificationService";

interface Equipment {
  id: string;
  name: string;
  current_streak: number;
  best_streak: number;
}

interface TopStreak {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  best_streak: number;
  equipment_name: string;
}

const Home = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [greeting, setGreeting] = useState("");
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [bestEquipment, setBestEquipment] = useState<Equipment | null>(null);
  const [topStreaks, setTopStreaks] = useState<TopStreak[]>([]);
  const [userRank, setUserRank] = useState<number>(0);
  const [totalUsers, setTotalUsers] = useState<number>(0);

  useEffect(() => {
    getCurrentUser();
    fetchUnreadNotifications();
    fetchDashboardData();
    initializeNotifications();

    // Set up real-time subscription for notifications
    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications'
        },
        () => {
          // Refetch unread count when notifications are updated
          fetchUnreadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const initializeNotifications = async () => {
    await notificationService.initializePushNotifications();
  };

  const handleTestNotification = async () => {
    console.log('Test notification button clicked');
    
    try {
      // First check current permission status
      if ('Notification' in window) {
        console.log('Current notification permission:', Notification.permission);
      }
      
      // Request permissions
      console.log('Requesting notification permissions...');
      const hasPermission = await notificationService.requestPermissions();
      console.log('Permission result:', hasPermission);
      
      if (!hasPermission) {
        console.log('Permission denied, showing toast...');
        toast({
          title: "Permission Required",
          description: "Please enable notifications to test this feature. Check your browser settings if the prompt didn't appear.",
          variant: "destructive"
        });
        return;
      }

      console.log('Permission granted, sending test notification...');
      const success = await notificationService.sendTestNotification();
      console.log('Test notification result:', success);
      
      if (success) {
        toast({
          title: "Test Notification Sent!",
          description: "Check your notification area for the test message."
        });
      } else {
        toast({
          title: "Test Failed",
          description: "Unable to send test notification. Check console for details.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error in handleTestNotification:', error);
      toast({
        title: "Error",
        description: `Failed to send test notification: ${error}`,
        variant: "destructive"
      });
    }
  };

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUser(user);
      // Get user profile for display name
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, username')
        .eq('user_id', user.id)
        .single();
      
      if (profile) {
        setUser({ ...user, profile });
      }
    }
  };

  const fetchUnreadNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);

      setUnreadNotifications(count || 0);
    } catch (error) {
      console.error('Error fetching unread notifications:', error);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's best equipment
      const { data: equipment } = await supabase
        .from('equipment')
        .select('id, name, current_streak, best_streak')
        .eq('user_id', user.id)
        .order('best_streak', { ascending: false })
        .limit(1);

      if (equipment && equipment.length > 0) {
        setBestEquipment(equipment[0]);
      }

      // Get top streaks from following/followers (includes user)
      const { data: streaks } = await supabase
        .rpc('get_following_top_streaks', { 
          p_user_id: user.id, 
          p_limit: 5 
        });

      setTopStreaks(streaks || []);

      // Get user's global rank
      const { data: rankData } = await supabase
        .rpc('get_user_global_rank', { 
          p_user_id: user.id 
        });

      if (rankData && rankData.length > 0) {
        setUserRank(rankData[0].rank_position);
        setTotalUsers(rankData[0].total_users);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  // Set greeting based on time
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) {
      setGreeting("Good Morning");
    } else if (hour < 17) {
      setGreeting("Good Afternoon");
    } else {
      setGreeting("Good Evening");
    }
  }, []);

  const getUserDisplayName = () => {
    return user?.profile?.display_name || user?.profile?.username || "User";
  };

  const shortcutCards = [
    {
      title: "Community",
      description: "See posts from friends",
      icon: Users,
      route: "/community",
      color: "text-blue-500"
    },
    {
      title: "Equipment",
      description: "Manage your gear",
      icon: Wrench,
      route: "/equipment", 
      color: "text-green-500"
    },
    {
      title: "Calendar",
      description: "Schedule events",
      icon: Calendar,
      route: "/calendar",
      color: "text-purple-500"
    },
    {
      title: "Notifications",
      description: "Check updates",
      icon: Bell,
      route: "/notifications",
      color: "text-orange-500",
      badge: unreadNotifications
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground gradient-hero">
      <div className="container mx-auto p-4 max-w-md">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center animate-glow">
              <Music className="w-6 h-6 text-accent" />
            </div>
          </div>
          <Button
            onClick={() => navigate("/settings")}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Settings className="w-4 h-4" />
            Settings
          </Button>
        </div>

        {/* Greeting */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">
            {greeting}, {getUserDisplayName()}! 👋
          </h1>
          <p className="text-muted-foreground">Welcome to your dashboard</p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <UserSearch
            placeholder="Search users..."
            className="w-full"
          />
        </div>

        {/* Test Notification Button */}
        <div className="mb-6">
          <Button
            onClick={handleTestNotification}
            variant="outline"
            className="w-full"
          >
            <Bell className="w-4 h-4 mr-2" />
            Test Push Notifications
          </Button>
        </div>

        {/* Shortcut Cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {shortcutCards.map((card) => (
            <Card 
              key={card.title} 
              className="glass-card cursor-pointer hover:scale-105 transition-transform"
              onClick={() => navigate(card.route)}
            >
              <CardContent className="p-4 text-center">
                <div className="relative">
                  <card.icon className={`w-8 h-8 mx-auto mb-2 ${card.color}`} />
                  {card.badge && card.badge > 0 && (
                    <Badge className="absolute -top-1 -right-1 w-5 h-5 p-0 text-xs">
                      {card.badge > 9 ? '9+' : card.badge}
                    </Badge>
                  )}
                </div>
                <h3 className="font-semibold text-sm">{card.title}</h3>
                <p className="text-xs text-muted-foreground">{card.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* User's Best Equipment */}
        {bestEquipment && (
          <Card className="glass-card mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trophy className="w-5 h-5 text-yellow-500" />
                Your Best Streak
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{bestEquipment.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Current: {bestEquipment.current_streak} days
                  </p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1">
                    <Flame className="w-4 h-4 text-orange-500" />
                    <span className="text-xl font-bold">{bestEquipment.best_streak}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">best streak</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Global Ranking */}
        {userRank > 0 && (
          <Card className="glass-card mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="w-5 h-5 text-accent" />
                Your Global Rank
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Crown className="w-6 h-6 text-yellow-500" />
                  <span className="text-2xl font-bold">#{userRank}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  out of {totalUsers} users
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Streaks Leaderboard */}
        {topStreaks.length > 0 && (
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="w-5 h-5 text-blue-500" />
                Top Streaks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {topStreaks.map((streak, index) => (
                <div 
                  key={streak.user_id} 
                  className="flex items-center gap-3 p-2 rounded-lg bg-accent/5 cursor-pointer hover:bg-accent/10 transition-colors"
                  onClick={() => navigate(`/profile/${streak.user_id}`)}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-sm font-bold text-muted-foreground w-4">
                      #{index + 1}
                    </span>
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={streak.avatar_url} />
                      <AvatarFallback>
                        <User className="w-4 h-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">
                        {streak.display_name || streak.username}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {streak.equipment_name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Flame className="w-4 h-4 text-orange-500" />
                    <span className="font-bold">{streak.best_streak}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Home;