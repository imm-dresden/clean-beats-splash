import { Dialog, DialogContent } from "@/components/ui/dialog";
import PostCard from "./PostCard";

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

interface PostModalProps {
  post: Post | null;
  isOpen: boolean;
  onClose: () => void;
  isOwner: boolean;
  onPostUpdate: () => void;
}

const PostModal = ({ post, isOpen, onClose, isOwner, onPostUpdate }: PostModalProps) => {
  if (!post) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
        <div className="overflow-y-auto max-h-[90vh]">
          <PostCard 
            post={post}
            isOwner={isOwner}
            onPostUpdate={onPostUpdate}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PostModal;