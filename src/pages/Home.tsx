import { LogOut, Settings, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import cleanBeatsLogo from "@/assets/clean-beats-logo.png";

const Home = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    // Get current user
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
    
    getCurrentUser();

    // Set greeting based on time
    const hour = new Date().getHours();
    if (hour < 12) {
      setGreeting("Good Morning");
    } else if (hour < 17) {
      setGreeting("Good Afternoon");
    } else {
      setGreeting("Good Evening");
    }
  }, []);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast({
          title: "Logout Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        navigate("/auth");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  const getUserDisplayName = () => {
    return user?.profile?.display_name || user?.profile?.username || "User";
  };

  return (
    <div className="min-h-screen bg-background text-foreground gradient-hero">
      <div className="container mx-auto p-4">
        {/* Header with logo and buttons */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <img 
              src={cleanBeatsLogo} 
              alt="Clean Beats Logo" 
              className="w-12 h-12 rounded-full"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate("/profile")}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Settings className="w-4 h-4" />
              Settings
            </Button>
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>

        {/* Greeting */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">
            {greeting}, {getUserDisplayName()}! 👋
          </h1>
          <p className="text-muted-foreground">
            Ready to discover new beats?
          </p>
        </div>

        {/* Curved Search Bar */}
        <div className="relative mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search for tracks, artists, or genres..."
              className="pl-12 pr-4 py-4 text-lg rounded-full border-2 border-primary/20 bg-card/50 backdrop-blur-sm focus:border-primary focus:bg-card/80 transition-all duration-300 shadow-lg"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;