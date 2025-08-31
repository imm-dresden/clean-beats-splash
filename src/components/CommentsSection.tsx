import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { MessageCircle, Send, Reply, Trash } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

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

interface CommentsSectionProps {
  postId: string;
  isOpen: boolean;
  onClose: () => void;
}

const CommentsSection = ({ postId, isOpen, onClose }: CommentsSectionProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchComments();
    }
    getCurrentUser();
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

  const handleSubmitReply = async (parentCommentId: string) => {
    if (!replyContent.trim() || !currentUser) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('post_comments')
        .insert({
          post_id: postId,
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

  const getTotalCommentsCount = () => {
    return comments.reduce((total, comment) => {
      return total + 1 + (comment.replies?.length || 0);
    }, 0);
  };

  if (!isOpen) return null;

  return (
    <div className="space-y-4 mt-4 border-t pt-4">
      <div className="flex items-center gap-2 mb-3">
        <MessageCircle className="w-4 h-4" />
        <span className="font-medium">{getTotalCommentsCount()} Comments</span>
      </div>

      {/* Comments List */}
      <div className="space-y-3 max-h-60 overflow-y-auto">
        {comments.map((comment) => (
          <div key={comment.id} className="space-y-2">
            {/* Main Comment */}
            <Card className="bg-background/50">
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
                      onClick={() => setReplyingTo(comment.id)}
                      disabled={!currentUser}
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
                  <Card key={reply.id} className="bg-muted/30">
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
        ))}
        
        {comments.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No comments yet. Be the first to comment!
          </p>
        )}
      </div>

      {/* Add Comment - Only show if user is authenticated */}
      {currentUser ? (
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
      ) : (
        <p className="text-sm text-muted-foreground text-center py-2">
          Please log in to add comments
        </p>
      )}
    </div>
  );
};

export default CommentsSection;