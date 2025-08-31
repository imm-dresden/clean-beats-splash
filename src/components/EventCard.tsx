import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, MessageCircle, Calendar, MapPin, Users, UserCheck } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Event {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date?: string;
  location?: string;
  event_type: string;
  user_id: string;
  created_at: string;
  author?: {
    display_name?: string;
    username: string;
    avatar_url?: string;
  };
  likes_count?: number;
  is_liked?: boolean;
  is_going?: boolean;
  going_count?: number;
}

interface EventCardProps {
  event: Event;
  onEventUpdate: () => void;
}

const EventCard = ({ event, onEventUpdate }: EventCardProps) => {
  const [isLiked, setIsLiked] = useState(event.is_liked || false);
  const [likesCount, setLikesCount] = useState(event.likes_count || 0);
  const [isGoing, setIsGoing] = useState(event.is_going || false);
  const [goingCount, setGoingCount] = useState(event.going_count || 0);
  const { toast } = useToast();

  const handleLike = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (isLiked) {
        // Unlike the event
        const { error } = await supabase
          .from('event_likes')
          .delete()
          .eq('event_id', event.id)
          .eq('user_id', user.id);

        if (error) throw error;

        setIsLiked(false);
        setLikesCount(prev => prev - 1);
      } else {
        // Like the event
        const { error } = await supabase
          .from('event_likes')
          .insert({ event_id: event.id, user_id: user.id });

        if (error) throw error;

        setIsLiked(true);
        setLikesCount(prev => prev + 1);
      }

      // Call the update callback to refresh the feed
      onEventUpdate();
    } catch (error) {
      console.error('Error toggling like:', error);
      toast({
        title: "Error",
        description: "Failed to update like status",
        variant: "destructive"
      });
    }
  };

  const handleGoing = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (isGoing) {
        // Remove attendance
        const { error } = await supabase
          .from('event_attendees')
          .delete()
          .eq('event_id', event.id)
          .eq('user_id', user.id);

        if (error) throw error;

        setIsGoing(false);
        setGoingCount(prev => prev - 1);
      } else {
        // Add attendance
        const { error } = await supabase
          .from('event_attendees')
          .insert({ event_id: event.id, user_id: user.id });

        if (error) throw error;

        setIsGoing(true);
        setGoingCount(prev => prev + 1);
      }

      // Call the update callback to refresh the feed
      onEventUpdate();
    } catch (error) {
      console.error('Error toggling attendance:', error);
      toast({
        title: "Error",
        description: "Failed to update attendance status",
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="bg-card border-border overflow-hidden mb-4">
      {/* Event Header */}
      <CardContent className="p-4 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center overflow-hidden">
            {event.author?.avatar_url ? (
              <img 
                src={event.author.avatar_url} 
                alt="Profile" 
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-sm font-medium">
                {(event.author?.display_name || event.author?.username || 'User')[0].toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">
              {event.author?.display_name || event.author?.username || 'Unknown User'}
            </p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(event.created_at), 'MMM d, yyyy')} • {event.event_type}
            </p>
          </div>
        </div>

        {/* Event Info */}
        <div className="space-y-3 mb-4">
          <h3 className="font-bold text-lg">{event.title}</h3>
          
          {event.description && (
            <p className="text-sm text-muted-foreground">{event.description}</p>
          )}

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>{format(new Date(event.start_date), 'MMM d, yyyy h:mm a')}</span>
            </div>
            {event.location && (
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                <span>{event.location}</span>
              </div>
            )}
          </div>

          {goingCount > 0 && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              <span>{goingCount} {goingCount === 1 ? 'person' : 'people'} going</span>
            </div>
          )}
        </div>

        {/* Event Actions */}
        <div className="flex items-center gap-6 pt-2 border-t">
          <Button 
            variant="ghost" 
            size="sm" 
            className={`gap-2 p-0 h-auto ${isLiked ? 'text-red-500' : 'text-foreground'} hover:text-red-500 transition-colors`}
            onClick={handleLike}
          >
            <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
            <span className="text-sm">{likesCount > 0 ? likesCount : 'Like'}</span>
          </Button>

          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-2 p-0 h-auto text-foreground hover:text-accent transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-sm">Comment</span>
          </Button>

          <Button 
            variant={isGoing ? "default" : "outline"}
            size="sm" 
            className="gap-2 ml-auto"
            onClick={handleGoing}
          >
            <UserCheck className="w-4 h-4" />
            <span className="text-sm">{isGoing ? 'Going' : 'Interested'}</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default EventCard;