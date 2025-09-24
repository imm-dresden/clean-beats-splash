-- Reset overdue streaks immediately
UPDATE public.equipment
SET current_streak = 0
WHERE next_cleaning_due IS NOT NULL 
AND DATE(next_cleaning_due) < CURRENT_DATE
AND current_streak > 0;