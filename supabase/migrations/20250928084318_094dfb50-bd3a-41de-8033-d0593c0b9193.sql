-- Update leaderboard functions to use CURRENT streaks instead of BEST streaks

CREATE OR REPLACE FUNCTION public.get_global_top_streaks(p_limit integer DEFAULT 10)
 RETURNS TABLE(user_id uuid, username text, display_name text, avatar_url text, best_streak integer, equipment_name text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH user_streaks AS (
    SELECT 
      e.user_id,
      p.username,
      p.display_name,
      p.avatar_url,
      e.current_streak AS best_streak, -- keep column name for frontend compatibility
      e.name as equipment_name,
      ROW_NUMBER() OVER (PARTITION BY e.user_id ORDER BY e.current_streak DESC) as rn
    FROM public.equipment e
    JOIN public.profiles p ON e.user_id = p.user_id
    WHERE e.current_streak > 0
  )
  SELECT 
    us.user_id,
    us.username,
    us.display_name,
    us.avatar_url,
    us.best_streak,
    us.equipment_name
  FROM user_streaks us
  WHERE us.rn = 1
  ORDER BY us.best_streak DESC, us.user_id
  LIMIT p_limit;
$function$;

CREATE OR REPLACE FUNCTION public.get_following_top_streaks(p_user_id uuid, p_limit integer DEFAULT 5)
 RETURNS TABLE(user_id uuid, username text, display_name text, avatar_url text, best_streak integer, equipment_name text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH following_users AS (
    SELECT following_id 
    FROM public.followers 
    WHERE follower_id = p_user_id
    UNION
    SELECT follower_id
    FROM public.followers 
    WHERE following_id = p_user_id
    UNION
    SELECT p_user_id -- Include the user themselves
  ),
  user_streaks AS (
    SELECT 
      e.user_id,
      p.username,
      p.display_name,
      p.avatar_url,
      e.current_streak AS best_streak, -- keep column name for frontend compatibility
      e.name as equipment_name,
      ROW_NUMBER() OVER (PARTITION BY e.user_id ORDER BY e.current_streak DESC) as rn
    FROM public.equipment e
    JOIN public.profiles p ON e.user_id = p.user_id
    WHERE e.user_id IN (SELECT following_id FROM following_users)
    AND e.current_streak > 0
  )
  SELECT 
    us.user_id,
    us.username,
    us.display_name,
    us.avatar_url,
    us.best_streak,
    us.equipment_name
  FROM user_streaks us
  WHERE us.rn = 1
  ORDER BY us.best_streak DESC
  LIMIT p_limit;
$function$;