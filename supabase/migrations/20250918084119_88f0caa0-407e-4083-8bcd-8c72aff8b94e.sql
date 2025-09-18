-- Fix security definer view issue
-- Remove the problematic public_profiles view that was causing security warnings
DROP VIEW IF EXISTS public.public_profiles;

-- Revoke any grants that were made to the view
-- (this is safe even if the grants don't exist)
REVOKE ALL ON public.public_profiles FROM authenticated;

-- The secure approach is to use the existing SECURITY DEFINER functions:
-- - get_safe_public_profile(uuid)
-- - get_public_profile(uuid) 
-- - get_public_profiles(uuid[])
-- These functions properly control access to non-sensitive profile data