import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { UserPlus, UserMinus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FollowButtonProps {
  targetUserId: string;
  onFollowChange?: () => void;
}

const FollowButton = ({ targetUserId, onFollowChange }: FollowButtonProps) => {
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    checkFollowStatus();
  }, [targetUserId]);

  const checkFollowStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUser(user);

      // Don't show follow button for own profile
      if (user.id === targetUserId) return;

      const { data } = await supabase
        .from('followers')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId)
        .maybeSingle();

      setIsFollowing(!!data);
    } catch (error) {
      console.error('Error checking follow status:', error);
    }
  };

  const handleFollow = async () => {
    if (!currentUser || currentUser.id === targetUserId) return;

    setLoading(true);
    try {
      if (isFollowing) {
        // Unfollow
        const { error } = await supabase
          .from('followers')
          .delete()
          .eq('follower_id', currentUser.id)
          .eq('following_id', targetUserId);

        if (error) throw error;

        setIsFollowing(false);
        toast({
          title: "Success",
          description: "Unfollowed user",
        });
      } else {
        // Follow
        const { error } = await supabase
          .from('followers')
          .insert({
            follower_id: currentUser.id,
            following_id: targetUserId
          });

        if (error) throw error;

        setIsFollowing(true);
        toast({
          title: "Success",
          description: "Now following user",
        });
      }

      onFollowChange?.();
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${isFollowing ? 'unfollow' : 'follow'} user`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Don't show button for own profile
  if (!currentUser || currentUser.id === targetUserId) {
    return null;
  }

  return (
    <Button
      onClick={handleFollow}
      disabled={loading}
      variant={isFollowing ? "outline" : "default"}
      size="sm"
      className="gap-2"
    >
      {isFollowing ? (
        <>
          <UserMinus className="w-4 h-4" />
          Unfollow
        </>
      ) : (
        <>
          <UserPlus className="w-4 h-4" />
          Follow
        </>
      )}
    </Button>
  );
};

export default FollowButton;