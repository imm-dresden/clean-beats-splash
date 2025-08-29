import { useState } from "react";
import { Heart, MessageCircle } from "lucide-react";

interface Post {
  id: string;
  content: string;
  image_url?: string;
  created_at: string;
  user_id: string;
  author?: {
    display_name?: string;
    username: string;
  };
  likes_count?: number;
  is_liked?: boolean;
}

interface PostGridItemProps {
  post: Post;
  commentsCount: number;
  onClick: () => void;
}

const PostGridItem = ({ post, commentsCount, onClick }: PostGridItemProps) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className="aspect-square relative cursor-pointer group overflow-hidden bg-muted rounded-lg"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* Post Image or Content Preview */}
      {post.image_url ? (
        <img 
          src={post.image_url} 
          alt="Post"
          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-accent/20 to-primary/20 flex items-center justify-center p-4">
          <p className="text-sm text-center line-clamp-6 text-foreground">
            {post.content}
          </p>
        </div>
      )}

      {/* Hover Overlay */}
      {isHovered && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-200">
          <div className="flex items-center gap-6 text-white">
            <div className="flex items-center gap-2">
              <Heart className="w-6 h-6 fill-white" />
              <span className="font-semibold text-lg">{post.likes_count || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <MessageCircle className="w-6 h-6 fill-white" />
              <span className="font-semibold text-lg">{commentsCount}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostGridItem;