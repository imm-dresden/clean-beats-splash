-- Fix linter error 0010_security_definer_view
-- Ensure the view runs with the querying user's permissions (RLS of invoker)
ALTER VIEW public.public_profiles SET (security_invoker = true);

-- Note: We previously set security_barrier=false to avoid unexpected RLS behavior through the view.
-- Keeping it as-is since the linter concern is about security definer semantics, not barrier.
-- This change is safe: app code primarily uses RPCs (get_public_profile, get_public_profiles, search_public_profiles)
-- and does not rely on definer semantics of this view.