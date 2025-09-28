-- Create function to recalculate all streaks with the new strict logic
CREATE OR REPLACE FUNCTION public.recalculate_strict_streaks()
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
  creation_date DATE;
  is_first_cleaning BOOLEAN;
BEGIN
  -- Loop through each equipment
  FOR equipment_record IN 
    SELECT id, cleaning_frequency_days, created_at FROM public.equipment
  LOOP
    calculated_streak := 0;
    creation_date := DATE(equipment_record.created_at);
    is_first_cleaning := true;
    
    -- Loop through cleaning logs for this equipment in chronological order
    FOR log_record IN 
      SELECT cleaned_at, DATE(cleaned_at) as clean_date, id
      FROM public.cleaning_logs 
      WHERE equipment_id = equipment_record.id 
      ORDER BY cleaned_at ASC
    LOOP
      IF is_first_cleaning THEN
        -- First cleaning must be on creation date
        IF log_record.clean_date = creation_date THEN
          calculated_streak := 1;
        ELSE
          calculated_streak := 1; -- Reset, but this cleaning still counts
        END IF;
        is_first_cleaning := false;
        expected_date := log_record.clean_date;
      ELSE
        -- Calculate expected cleaning date based on previous cleaning
        expected_date := expected_date + equipment_record.cleaning_frequency_days;
        
        -- Check if this cleaning is exactly on the expected date
        IF log_record.clean_date = expected_date THEN
          -- On time, increment streak
          calculated_streak := calculated_streak + 1;
        ELSE
          -- Not on time, reset streak to 1
          calculated_streak := 1;
          expected_date := log_record.clean_date;
        END IF;
      END IF;
      
      -- Update the cleaning log with correct streak values
      UPDATE public.cleaning_logs 
      SET 
        streak_before_cleaning = calculated_streak - 1,
        streak_after_cleaning = calculated_streak
      WHERE id = log_record.id;
    END LOOP;
    
    -- Check if equipment is currently overdue and reset streak if so
    IF expected_date IS NOT NULL THEN
      expected_date := expected_date + equipment_record.cleaning_frequency_days;
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