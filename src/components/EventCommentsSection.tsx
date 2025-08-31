import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Send, MessageCircle } from "lucide-react";
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
    avatar_url?: string;
  };
}

interface EventCommentsSectionProps {
  eventId: string;
  isOpen: boolean;
  onToggle: () => void;
}

const EventCommentsSection = ({ eventId, isOpen, onToggle }: EventCommentsSectionProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [commentsCount, setCommentsCount] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchComments();
    } else {
      fetchCommentsCount();
    }
  }, [eventId, isOpen]);

  const fetchCommentsCount = async () => {
    try {
      const { count } = await supabase
        .from('event_comments')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId);
      
      setCommentsCount(count || 0);
    } catch (error) {
      console.error('Error fetching comments count:', error);
    }
  };

  const fetchComments = async () => {
    try {
      const { data: commentsData, error } = await supabase
        .from('event_comments')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get author profiles for each comment
      const commentsWithAuthors = await Promise.all(
        (commentsData || []).map(async (comment) => {
          const { data: profileData } = await supabase
            .rpc('get_public_profile', { profile_user_id: comment.user_id });
          
          const authorProfile = profileData && profileData.length > 0 ? profileData[0] : null;

          return {
            ...comment,
            author: authorProfile
          };
        })
      );

      setComments(commentsWithAuthors);
      setCommentsCount(commentsWithAuthors.length);
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast({
        title: "Error",
        description: "Failed to load comments",
        variant: "destructive",
      });
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('event_comments')
        .insert({
          event_id: eventId,
          user_id: user.id,
          content: newComment.trim()
        });

      if (error) throw error;

      setNewComment("");
      await fetchComments();
      
      toast({
        title: "Success",
        description: "Comment added successfully",
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: "Error",
        description: "Failed to add comment",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-t border-border pt-3">
      {/* Comments Toggle Button */}
      <Button 
        variant="ghost" 
        size="sm" 
        className="gap-2 p-0 h-auto text-foreground hover:text-accent transition-colors mb-3"
        onClick={onToggle}
      >
        <MessageCircle className="w-5 h-5" />
        <span className="text-sm">
          {commentsCount > 0 ? `${commentsCount} Comments` : 'Comment'}
        </span>
      </Button>

      {/* Comments Section */}
      {isOpen && (
        <div className="space-y-3">
          {/* Add Comment */}
          <div className="space-y-2">
            <Textarea
              placeholder="Write a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="min-h-[60px] resize-none"
            />
            <div className="flex justify-end">
              <Button 
                size="sm" 
                onClick={handleSubmitComment}
                disabled={!newComment.trim() || loading}
                className="gap-2"
              >
                <Send className="w-4 h-4" />
                Post
              </Button>
            </div>
          </div>

          {/* Comments List */}
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {comments.length > 0 ? (
              comments.map((comment) => (
                <Card key={comment.id} className="bg-muted/30">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <div className="w-8 h-8 bg-accent/20 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                        {comment.author?.avatar_url ? (
                          <img 
                            src={comment.author.avatar_url} 
                            alt="Profile" 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs font-medium">
                            {(comment.author?.display_name || comment.author?.username || 'U')[0].toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium">
                            {comment.author?.display_name || comment.author?.username || 'Unknown User'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(comment.created_at), 'MMM d, h:mm a')}
                          </p>
                        </div>
                        <p className="text-sm text-foreground break-words">{comment.content}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No comments yet. Be the first to comment!
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EventCommentsSection;