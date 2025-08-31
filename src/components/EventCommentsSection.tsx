import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Send, MessageCircle, Reply, Trash, LogIn, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  parent_comment_id?: string;
  author?: {
    display_name?: string;
    username: string;
    avatar_url?: string;
  };
  replies?: Comment[];
}

interface EventCommentsSectionProps {
  eventId: string;
  isOpen: boolean;
  onToggle: () => void;
}

const EventCommentsSection = ({ eventId, isOpen, onToggle }: EventCommentsSectionProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [commentsCount, setCommentsCount] = useState(0);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    getCurrentUser();
    if (isOpen) {
      fetchComments();
    } else {
      fetchCommentsCount();
    }
  }, [eventId, isOpen]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);
  };

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

      // Organize comments into threaded structure
      const topLevelComments: Comment[] = [];
      const repliesMap = new Map<string, Comment[]>();

      commentsWithAuthor.forEach(comment => {
        if (comment.parent_comment_id) {
          // This is a reply
          if (!repliesMap.has(comment.parent_comment_id)) {
            repliesMap.set(comment.parent_comment_id, []);
          }
          repliesMap.get(comment.parent_comment_id)!.push(comment);
        } else {
          // This is a top-level comment
          topLevelComments.push(comment);
        }
      });

      // Attach replies to their parent comments
      const threaded = topLevelComments.map(comment => ({
        ...comment,
        replies: repliesMap.get(comment.id) || []
      }));

      setComments(threaded);
      setCommentsCount(commentsWithAuthor.length);
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
    if (!newComment.trim() || !currentUser) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('event_comments')
        .insert({
          event_id: eventId,
          user_id: currentUser.id,
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

  const handleSubmitReply = async (parentCommentId: string) => {
    if (!replyContent.trim() || !currentUser) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('event_comments')
        .insert({
          event_id: eventId,
          user_id: currentUser.id,
          content: replyContent.trim(),
          parent_comment_id: parentCommentId
        });

      if (error) throw error;

      setReplyContent("");
      setReplyingTo(null);
      await fetchComments();
      
      toast({
        title: "Success",
        description: "Reply added successfully",
      });
    } catch (error) {
      console.error('Error adding reply:', error);
      toast({
        title: "Error",
        description: "Failed to add reply",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAuthRequired = () => {
    toast({
      title: "Authentication Required",
      description: "Please log in or create an account to comment",
    });
    navigate('/auth');
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('event_comments')
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
          {/* Add Comment - Show different UI based on auth status */}
          {currentUser ? (
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
          ) : (
            <div className="bg-muted/30 p-4 rounded-lg text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Join the conversation! Log in or create an account to comment.
              </p>
              <div className="flex gap-2 justify-center">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => navigate('/auth')}
                  className="gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  Log In
                </Button>
                <Button 
                  size="sm" 
                  onClick={() => navigate('/auth')}
                  className="gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Sign Up
                </Button>
              </div>
            </div>
          )}

          {/* Comments List */}
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {comments.length > 0 ? (
              comments.map((comment) => (
                <div key={comment.id} className="space-y-2">
                  {/* Main Comment */}
                  <Card className="bg-muted/30">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-accent/20 rounded-full flex items-center justify-center overflow-hidden">
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
                          <div>
                            <span className="text-sm font-medium">
                              {comment.author?.display_name || comment.author?.username}
                            </span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {format(new Date(comment.created_at), 'MMM d, h:mm a')}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => currentUser ? setReplyingTo(comment.id) : handleAuthRequired()}
                          >
                            <Reply className="w-3 h-3 mr-1" />
                            Reply
                          </Button>
                          {comment.user_id === currentUser?.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2"
                              onClick={() => handleDeleteComment(comment.id)}
                            >
                              <Trash className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="text-sm mb-2">{comment.content}</p>
                      
                      {/* Reply Form */}
                      {replyingTo === comment.id && (
                        <div className="mt-3 space-y-2">
                          <Textarea
                            placeholder="Write a reply..."
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            className="min-h-[60px] resize-none text-sm"
                            rows={2}
                          />
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="ghost"
                              size="sm" 
                              onClick={() => {
                                setReplyingTo(null);
                                setReplyContent("");
                              }}
                            >
                              Cancel
                            </Button>
                            <Button 
                              size="sm" 
                              onClick={() => handleSubmitReply(comment.id)}
                              disabled={!replyContent.trim() || loading}
                              className="gap-2"
                            >
                              <Send className="w-3 h-3" />
                              Reply
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Replies */}
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="ml-6 space-y-2">
                      {comment.replies.map((reply) => (
                        <Card key={reply.id} className="bg-muted/20">
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-5 h-5 bg-accent/20 rounded-full flex items-center justify-center overflow-hidden">
                                  {reply.author?.avatar_url ? (
                                    <img 
                                      src={reply.author.avatar_url} 
                                      alt="Profile" 
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-xs font-medium">
                                      {(reply.author?.display_name || reply.author?.username || 'U')[0].toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                <div>
                                  <span className="text-sm font-medium">
                                    {reply.author?.display_name || reply.author?.username}
                                  </span>
                                  <span className="text-xs text-muted-foreground ml-2">
                                    {format(new Date(reply.created_at), 'MMM d, h:mm a')}
                                  </span>
                                </div>
                              </div>
                              
                              {reply.user_id === currentUser?.id && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2"
                                  onClick={() => handleDeleteComment(reply.id)}
                                >
                                  <Trash className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                            <p className="text-sm">{reply.content}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
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