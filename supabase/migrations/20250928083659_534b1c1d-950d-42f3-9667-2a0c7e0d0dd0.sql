-- Fix the streak calculation to follow strict "only on due date" rules
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
  ELSE
    -- Calculate the expected due date based on last cleaning
    expected_due_date := DATE(equipment_record.last_cleaned_at) + equipment_record.cleaning_frequency_days;
    is_on_time := (cleaned_date = expected_due_date);
  END IF;
  
  -- Calculate new streak based on strict timing
  IF is_on_time THEN
    -- On time: increment streak or start at 1
    new_streak := equipment_record.current_streak + 1;
  ELSE
    -- Not on time: reset streak to 1 (this cleaning counts as a restart)
    new_streak := 1;
  END IF;
  
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