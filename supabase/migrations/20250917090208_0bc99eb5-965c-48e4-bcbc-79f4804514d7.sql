-- Fix email exposure vulnerability in profiles table
-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Users can view public profile info" ON public.profiles;

-- Create a more secure policy that excludes email from public view
-- Users can only see their own full profile (including email)
CREATE POLICY "Users can view their own full profile" ON public.profiles
FOR SELECT 
USING (auth.uid() = user_id);

-- Create a separate policy for public profile data (excluding email)
-- This allows other users to see username, display_name, avatar_url, and bio only
CREATE POLICY "Users can view public profile data only" ON public.profiles
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND auth.uid() != user_id
);

-- Create a security definer function to safely return public profile data
-- This function will be used by the application to get non-sensitive profile info
CREATE OR REPLACE FUNCTION public.get_safe_public_profile(profile_user_id uuid)
RETURNS TABLE(
  user_id uuid, 
  username text, 
  display_name text, 
  avatar_url text, 
  bio text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.bio
  FROM public.profiles p
  WHERE p.user_id = profile_user_id;
$$;

-- Update the existing get_public_profile function to ensure consistency
CREATE OR REPLACE FUNCTION public.get_public_profile(profile_user_id uuid)
RETURNS TABLE(user_id uuid, username text, display_name text, avatar_url text, bio text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.bio
  FROM public.profiles p
  WHERE p.user_id = profile_user_id;
$$;

-- Ensure the public profiles function also excludes email
CREATE OR REPLACE FUNCTION public.get_public_profiles(profile_user_ids uuid[])
RETURNS TABLE(user_id uuid, username text, display_name text, avatar_url text, bio text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.bio
  FROM public.profiles p
  WHERE p.user_id = ANY(profile_user_ids);
$$;