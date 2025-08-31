import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, MessageCircle, Share, MoreHorizontal, Edit, Trash, User } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import CommentsSection from "./CommentsSection";

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

interface PostCardProps {
  post: Post;
  isOwner: boolean;
  onPostUpdate: () => void;
  highlightComment?: string;
  highlightReply?: string;
  id?: string;
}

const PostCard = ({ post, isOwner, onPostUpdate, highlightComment, highlightReply, id }: PostCardProps) => {
  const [isLiked, setIsLiked] = useState(post.is_liked || false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [showComments, setShowComments] = useState(false);
  const { toast } = useToast();

  const handleLike = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (isLiked) {
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('user_id', user.id)
          .eq('post_id', post.id);
        
        if (error) throw error;
        setIsLiked(false);
        setLikesCount(prev => prev - 1);
      } else {
        const { error } = await supabase
          .from('post_likes')
          .insert({ user_id: user.id, post_id: post.id });
        
        if (error) throw error;
        setIsLiked(true);
        setLikesCount(prev => prev + 1);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update like",
        variant: "destructive",
      });
    }
  };

  const handleEdit = async () => {
    try {
      const { error } = await supabase
        .from('posts')
        .update({ content: editContent })
        .eq('id', post.id);
      
      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Post updated successfully",
      });
      
      setIsEditing(false);
      onPostUpdate();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update post",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', post.id);
      
      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Post deleted successfully",
      });
      
      onPostUpdate();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete post",
        variant: "destructive",
      });
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Post by ${post.author?.display_name || post.author?.username}`,
          text: post.content,
          url: window.location.href
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast({
          title: "Success",
          description: "Post link copied to clipboard",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to share post",
        variant: "destructive",
      });
    }
  };

  return (
    <Card id={id} className="bg-card border-border overflow-hidden max-w-md mx-auto">
      {/* Post Header */}
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Avatar className="w-8 h-8">
              <AvatarImage src={post.author?.avatar_url} />
              <AvatarFallback>
                <User className="w-4 h-4" />
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-sm">
                {post.author?.display_name || post.author?.username || 'Unknown User'}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(post.created_at), 'MMM d, yyyy')}
              </p>
            </div>
          </div>
          
          {isOwner && (
            <div className="flex gap-1">
              <Dialog open={isEditing} onOpenChange={setIsEditing}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <Edit className="w-3 h-3" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Post</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="content">Content</Label>
                      <Textarea
                        id="content"
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={4}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleEdit} disabled={!editContent.trim()}>
                        Update Post
                      </Button>
                      <Button variant="outline" onClick={() => setIsEditing(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleDelete}>
                <Trash className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>

      {/* Post Image */}
      {post.image_url && (
        <div className="w-full">
          <img 
            src={post.image_url} 
            alt="Post image"
            className="w-full object-cover aspect-[4/3]"
          />
        </div>
      )}

      <CardContent className="p-3">
        {/* Post Actions */}
        <div className="flex items-center gap-3 mb-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className={`gap-1 p-0 h-auto ${isLiked ? 'text-red-500' : 'text-foreground'} hover:text-red-500 transition-colors`}
            onClick={handleLike}
          >
            <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-1 p-0 h-auto text-foreground hover:text-accent transition-colors"
            onClick={() => setShowComments(!showComments)}
            data-comments-toggle
          >
            <MessageCircle className="w-5 h-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-1 p-0 h-auto text-foreground hover:text-accent transition-colors" 
            onClick={handleShare}
          >
            <Share className="w-5 h-5" />
          </Button>
        </div>

        {/* Likes Count */}
        {likesCount > 0 && (
          <p className="font-semibold text-xs mb-2">
            {likesCount} {likesCount === 1 ? 'like' : 'likes'}
          </p>
        )}

        {/* Post Content */}
        <div className="space-y-1">
          <p className="text-sm">
            <span className="font-semibold mr-2">
              {post.author?.display_name || post.author?.username || 'Unknown User'}
            </span>
            <span className="whitespace-pre-wrap">{post.content}</span>
          </p>
        </div>

        {/* Comments Section */}
        <CommentsSection 
          postId={post.id}
          isOpen={showComments}
          onClose={() => setShowComments(false)}
          highlightComment={highlightComment}
          highlightReply={highlightReply}
        />
      </CardContent>
    </Card>
  );
};

export default PostCard;