-- Fix the update_equipment_streak function to handle date calculations properly
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
  days_since_due INTEGER;
  was_overdue BOOLEAN := false;
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
  
  -- Check if equipment was overdue when cleaned
  IF equipment_record.next_cleaning_due IS NOT NULL THEN
    -- Calculate days since due by subtracting dates directly
    days_since_due := cleaned_date - DATE(equipment_record.next_cleaning_due);
    was_overdue := days_since_due > 0;
  END IF;
  
  -- Calculate new streak
  IF was_overdue THEN
    -- Equipment was overdue, reset streak to 1
    new_streak := 1;
  ELSE
    -- Equipment cleaned on time, increment streak
    new_streak := equipment_record.current_streak + 1;
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