import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { MessageCircle, Send, MoreHorizontal, Edit, Trash } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  author?: {
    display_name?: string;
    username: string;
  };
}

interface CommentsSectionProps {
  postId: string;
  isOpen: boolean;
  onClose: () => void;
}

const CommentsSection = ({ postId, isOpen, onClose }: CommentsSectionProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchComments();
      getCurrentUser();
    }
  }, [isOpen, postId]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);
  };

  const fetchComments = async () => {
    try {
      const { data: commentsData, error } = await supabase
        .from('post_comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get unique user IDs from comments
      const userIds = [...new Set(commentsData?.map(comment => comment.user_id) || [])];
      
      // Fetch profiles for all comment authors using secure function
      const { data: profilesData } = await supabase
        .rpc('get_public_profiles', { profile_user_ids: userIds });

      // Create a map for quick lookup
      const profileMap = new Map(profilesData?.map(profile => [profile.user_id, profile]) || []);

      const commentsWithAuthor = commentsData?.map(comment => ({
        ...comment,
        author: profileMap.get(comment.user_id) || { username: 'Unknown User' }
      })) || [];

      setComments(commentsWithAuthor);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch comments",
        variant: "destructive",
      });
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !currentUser) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('post_comments')
        .insert({
          post_id: postId,
          user_id: currentUser.id,
          content: newComment.trim()
        });

      if (error) throw error;

      setNewComment("");
      fetchComments();
      
      toast({
        title: "Success",
        description: "Comment added successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add comment",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('post_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      fetchComments();
      
      toast({
        title: "Success",
        description: "Comment deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete comment",
        variant: "destructive",
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="space-y-4 mt-4 border-t pt-4">
      <div className="flex items-center gap-2 mb-3">
        <MessageCircle className="w-4 h-4" />
        <span className="font-medium">{comments.length} Comments</span>
      </div>

      {/* Comments List */}
      <div className="space-y-3 max-h-60 overflow-y-auto">
        {comments.map((comment) => (
          <Card key={comment.id} className="bg-background/50">
            <CardContent className="p-3">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-accent/20 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium">
                      {(comment.author?.display_name || comment.author?.username || 'U')[0].toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm font-medium">
                      {comment.author?.display_name || comment.author?.username}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {format(new Date(comment.created_at), 'MMM d, h:mm a')}
                    </span>
                  </div>
                </div>
                
                {comment.user_id === currentUser?.id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteComment(comment.id)}
                  >
                    <Trash className="w-3 h-3" />
                  </Button>
                )}
              </div>
              <p className="text-sm">{comment.content}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Comment */}
      <div className="flex gap-2">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Write a comment..."
          rows={2}
          className="flex-1"
        />
        <Button
          onClick={handleAddComment}
          disabled={!newComment.trim() || loading}
          size="sm"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default CommentsSection;