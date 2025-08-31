import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface UniversalSearchProps {
  placeholder?: string;
  className?: string;
  onSearchQueryChange: (query: string) => void;
  searchQuery: string;
}

interface SearchUser {
  user_id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
}

const UniversalSearch = ({ 
  placeholder = "Search users, posts, and events...", 
  className = "",
  onSearchQueryChange,
  searchQuery
}: UniversalSearchProps) => {
  const [userResults, setUserResults] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showUserResults, setShowUserResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowUserResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const searchUsers = async () => {
      if (!searchQuery.trim()) {
        setUserResults([]);
        setShowUserResults(false);
        return;
      }

      // Only show user results if the search looks like it's for a user (starts with @, or looks like a username)
      const shouldSearchUsers = searchQuery.startsWith('@') || searchQuery.length > 0;
      
      if (!shouldSearchUsers) return;

      setIsSearching(true);
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        
        const cleanQuery = searchQuery.replace('@', ''); // Remove @ if present
        const { data, error } = await supabase
          .rpc('search_public_profiles', { 
            search_query: cleanQuery,
            current_user_id: currentUser?.id 
          });

        if (error) throw error;

        setUserResults(data || []);
        setShowUserResults((data || []).length > 0);
      } catch (error) {
        console.error('Error searching users:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, toast]);

  const handleUserSelect = (userId: string) => {
    onSearchQueryChange("");
    setShowUserResults(false);
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
          onChange={(e) => onSearchQueryChange(e.target.value)}
          onFocus={() => searchQuery.trim() && setShowUserResults(userResults.length > 0)}
          className="pl-10"
        />
      </div>

      {showUserResults && userResults.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
          <div className="p-2 border-b border-border">
            <p className="text-xs text-muted-foreground font-medium">Users</p>
          </div>
          <div className="py-1">
            {userResults.map((user) => (
              <button
                key={user.user_id}
                onClick={() => handleUserSelect(user.user_id)}
                className="w-full px-3 py-2 hover:bg-accent/50 transition-colors flex items-center gap-3 text-left"
              >
                <Avatar className="w-6 h-6">
                  <AvatarImage src={user.avatar_url} />
                  <AvatarFallback>
                    <User className="w-3 h-3" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground text-sm truncate">
                    {getUserDisplayName(user)}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    @{user.username}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default UniversalSearch;