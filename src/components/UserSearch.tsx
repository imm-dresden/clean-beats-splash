import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface UserSearchProps {
  placeholder?: string;
  className?: string;
}

interface SearchUser {
  user_id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
}

const UserSearch = ({ placeholder = "Search users...", className = "" }: UserSearchProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const searchUsers = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }

      setIsSearching(true);
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        
        const { data, error } = await supabase
          .from('profiles')
          .select('user_id, username, display_name, avatar_url')
          .or(`username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`)
          .neq('user_id', currentUser?.id || '') // Exclude current user
          .limit(10);

        if (error) throw error;

        setSearchResults(data || []);
        setShowResults(true);
      } catch (error) {
        console.error('Error searching users:', error);
        toast({
          title: "Search Error",
          description: "Failed to search users",
          variant: "destructive",
        });
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, toast]);

  const handleUserSelect = (userId: string) => {
    setSearchQuery("");
    setShowResults(false);
    navigate(`/profile/${userId}`);
  };

  const getUserDisplayName = (user: SearchUser) => {
    return user.display_name || user.username;
  };

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
        <Input
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => searchQuery.trim() && setShowResults(true)}
          className="pl-10"
        />
      </div>

      {showResults && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {isSearching ? (
            <div className="p-4 text-center text-muted-foreground">
              Searching...
            </div>
          ) : searchResults.length > 0 ? (
            <div className="py-2">
              {searchResults.map((user) => (
                <button
                  key={user.user_id}
                  onClick={() => handleUserSelect(user.user_id)}
                  className="w-full px-4 py-3 hover:bg-accent/50 transition-colors flex items-center gap-3 text-left"
                >
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={user.avatar_url} />
                    <AvatarFallback>
                      <User className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground truncate">
                      {getUserDisplayName(user)}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      @{user.username}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-muted-foreground">
              No users found
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UserSearch;