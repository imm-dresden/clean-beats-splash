-- Fix security definer view issue by removing security_barrier property
-- This prevents the view from enforcing creator's permissions instead of querying user's permissions
ALTER VIEW public.public_profiles SET (security_barrier = false);