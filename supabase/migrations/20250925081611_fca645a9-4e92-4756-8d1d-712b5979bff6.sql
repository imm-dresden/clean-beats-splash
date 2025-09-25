-- Check and recreate the triggers for equipment streak management

-- First drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_equipment_streak_trigger ON public.cleaning_logs;
DROP TRIGGER IF EXISTS equipment_next_cleaning_trigger ON public.equipment;

-- Recreate the trigger for updating equipment streaks when cleaning is logged
CREATE TRIGGER update_equipment_streak_trigger
  BEFORE INSERT ON public.cleaning_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_equipment_streak();

-- Recreate the trigger for updating next cleaning due date on equipment changes
CREATE TRIGGER equipment_next_cleaning_trigger
  BEFORE INSERT OR UPDATE ON public.equipment
  FOR EACH ROW
  EXECUTE FUNCTION public.update_next_cleaning_due();