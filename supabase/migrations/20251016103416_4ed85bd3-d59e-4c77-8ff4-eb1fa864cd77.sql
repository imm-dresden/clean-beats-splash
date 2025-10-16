
-- Fix the equipment streak calculation to be more robust
CREATE OR REPLACE FUNCTION public.update_equipment_streak()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  equipment_record RECORD;
  new_streak INTEGER;
  cleaned_date DATE;
  creation_date DATE;
  expected_due_date DATE;
  is_on_time BOOLEAN := false;
  debug_info TEXT;
BEGIN
  -- Get the equipment record
  SELECT * INTO equipment_record 
  FROM public.equipment 
  WHERE id = NEW.equipment_id;
  
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  
  -- Store current streak before cleaning
  NEW.streak_before_cleaning := equipment_record.current_streak;
  
  -- Get the date part of the cleaned_at timestamp
  cleaned_date := DATE(NEW.cleaned_at);
  creation_date := DATE(equipment_record.created_at);
  
  -- For strict "only on due date" logic:
  -- 1. First cleaning must be on creation date
  -- 2. Subsequent cleanings must be exactly on the calculated due dates
  
  IF equipment_record.last_cleaned_at IS NULL THEN
    -- This is the first cleaning - must be on creation date
    is_on_time := (cleaned_date = creation_date);
    debug_info := format('First cleaning: cleaned=%s, created=%s, on_time=%s', 
                         cleaned_date, creation_date, is_on_time);
  ELSE
    -- Calculate the expected due date based on last cleaning
    expected_due_date := DATE(equipment_record.last_cleaned_at) + equipment_record.cleaning_frequency_days;
    is_on_time := (cleaned_date = expected_due_date);
    debug_info := format('Subsequent cleaning: cleaned=%s, last=%s, expected=%s, frequency=%s, on_time=%s', 
                         cleaned_date, 
                         DATE(equipment_record.last_cleaned_at),
                         expected_due_date,
                         equipment_record.cleaning_frequency_days,
                         is_on_time);
  END IF;
  
  -- Calculate new streak based on strict timing
  IF is_on_time THEN
    -- On time: increment streak (or start at 1 if first cleaning)
    IF equipment_record.last_cleaned_at IS NULL THEN
      new_streak := 1;
    ELSE
      new_streak := equipment_record.current_streak + 1;
    END IF;
  ELSE
    -- Not on time: reset streak to 1 (this cleaning counts as a restart)
    new_streak := 1;
  END IF;
  
  -- Log debug info
  RAISE LOG 'Streak calculation: % | Before: %, After: %', debug_info, NEW.streak_before_cleaning, new_streak;
  
  -- Store new streak after cleaning
  NEW.streak_after_cleaning := new_streak;
  
  -- Update equipment table
  UPDATE public.equipment 
  SET 
    current_streak = new_streak,
    best_streak = GREATEST(best_streak, new_streak),
    last_streak_date = cleaned_date,
    last_cleaned_at = NEW.cleaned_at,
    next_cleaning_due = (cleaned_date + (cleaning_frequency_days || ' days')::interval)::timestamp + interval '23 hours 59 minutes',
    updated_at = now()
  WHERE id = NEW.equipment_id;
  
  RETURN NEW;
END;
$function$;

-- Create a function to manually fix equipment streaks
CREATE OR REPLACE FUNCTION public.fix_equipment_streak(p_equipment_id UUID)
RETURNS TABLE(
  equipment_name TEXT,
  old_streak INTEGER,
  new_streak INTEGER,
  cleaning_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_equipment RECORD;
  v_cleaning_count INTEGER;
  v_calculated_streak INTEGER;
  v_last_clean_date DATE;
  v_prev_clean_date DATE;
  v_creation_date DATE;
BEGIN
  -- Get equipment details
  SELECT * INTO v_equipment
  FROM public.equipment
  WHERE id = p_equipment_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Equipment not found';
  END IF;
  
  -- Get cleaning history count
  SELECT COUNT(*) INTO v_cleaning_count
  FROM public.cleaning_logs
  WHERE equipment_id = p_equipment_id;
  
  -- Calculate correct streak based on recent cleanings
  v_calculated_streak := 0;
  v_creation_date := DATE(v_equipment.created_at);
  
  -- Get the two most recent cleanings to calculate current streak
  FOR v_last_clean_date IN (
    SELECT DATE(cleaned_at) as clean_date
    FROM public.cleaning_logs
    WHERE equipment_id = p_equipment_id
    ORDER BY cleaned_at DESC
    LIMIT 2
  ) LOOP
    IF v_prev_clean_date IS NULL THEN
      -- This is the most recent cleaning
      v_prev_clean_date := v_last_clean_date;
      v_calculated_streak := 1;
    ELSE
      -- Check if previous cleaning was on expected date
      IF v_last_clean_date + v_equipment.cleaning_frequency_days = v_prev_clean_date THEN
        v_calculated_streak := v_calculated_streak + 1;
      ELSE
        -- Streak was broken, so current streak is just 1
        EXIT;
      END IF;
    END IF;
  END LOOP;
  
  -- Return results
  RETURN QUERY
  SELECT 
    v_equipment.name::TEXT as equipment_name,
    v_equipment.current_streak as old_streak,
    v_calculated_streak as new_streak,
    v_cleaning_count as cleaning_count;
  
  -- Update the equipment with correct streak
  UPDATE public.equipment
  SET current_streak = v_calculated_streak,
      best_streak = GREATEST(best_streak, v_calculated_streak),
      updated_at = now()
  WHERE id = p_equipment_id;
  
  -- Update the most recent cleaning log
  UPDATE public.cleaning_logs
  SET streak_after_cleaning = v_calculated_streak
  WHERE id = (
    SELECT id FROM public.cleaning_logs
    WHERE equipment_id = p_equipment_id
    ORDER BY cleaned_at DESC
    LIMIT 1
  );
END;
$function$;

-- Fix the streak for the Fender equipment
SELECT * FROM public.fix_equipment_streak('d78def2d-4cfe-4adf-b73e-fc4484ebdd95');
