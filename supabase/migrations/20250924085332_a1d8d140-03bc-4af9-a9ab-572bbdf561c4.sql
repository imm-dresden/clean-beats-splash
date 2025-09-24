-- Fix the function to avoid ambiguous column references
CREATE OR REPLACE FUNCTION public.recalculate_equipment_streaks()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  equipment_record RECORD;
  log_record RECORD;
  expected_date DATE;
  calculated_streak INTEGER;
  prev_cleaning_date DATE;
BEGIN
  -- Loop through each equipment
  FOR equipment_record IN 
    SELECT id, cleaning_frequency_days, created_at FROM public.equipment
  LOOP
    calculated_streak := 0;
    prev_cleaning_date := NULL;
    
    -- Loop through cleaning logs for this equipment in chronological order
    FOR log_record IN 
      SELECT cleaned_at, DATE(cleaned_at) as clean_date 
      FROM public.cleaning_logs 
      WHERE equipment_id = equipment_record.id 
      ORDER BY cleaned_at ASC
    LOOP
      -- For the first cleaning, start streak at 1
      IF prev_cleaning_date IS NULL THEN
        calculated_streak := 1;
      ELSE
        -- Calculate expected cleaning date based on previous cleaning
        expected_date := prev_cleaning_date + equipment_record.cleaning_frequency_days;
        
        -- Check if this cleaning is on or before the expected date
        IF log_record.clean_date <= expected_date THEN
          -- On time, increment streak
          calculated_streak := calculated_streak + 1;
        ELSE
          -- Late, reset streak to 1
          calculated_streak := 1;
        END IF;
      END IF;
      
      -- Update the cleaning log with correct streak values
      UPDATE public.cleaning_logs 
      SET 
        streak_before_cleaning = CASE WHEN prev_cleaning_date IS NULL THEN 0 ELSE calculated_streak - 1 END,
        streak_after_cleaning = calculated_streak
      WHERE equipment_id = equipment_record.id 
      AND cleaned_at = log_record.cleaned_at;
      
      prev_cleaning_date := log_record.clean_date;
    END LOOP;
    
    -- Check if equipment is currently overdue and reset streak if so
    IF prev_cleaning_date IS NOT NULL THEN
      expected_date := prev_cleaning_date + equipment_record.cleaning_frequency_days;
      IF CURRENT_DATE > expected_date THEN
        calculated_streak := 0;
      END IF;
    END IF;
    
    -- Update equipment with recalculated streak
    UPDATE public.equipment 
    SET 
      current_streak = calculated_streak,
      best_streak = GREATEST(best_streak, calculated_streak)
    WHERE id = equipment_record.id;
  END LOOP;
END;
$function$;

-- Run the recalculation
SELECT recalculate_equipment_streaks();