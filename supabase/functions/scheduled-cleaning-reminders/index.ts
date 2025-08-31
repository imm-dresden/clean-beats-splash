import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CleaningReminder {
  userId: string;
  email: string;
  equipmentName: string;
  daysOverdue: number;
  timezone: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting scheduled cleaning reminders check...');
    
    const { reminderType = 'noon' } = await req.json();
    console.log('Reminder type:', reminderType);

    // Get current time in UTC
    const now = new Date();
    const currentHour = now.getUTCHours();
    
    // For noon reminders, we check for 12:00 PM in user's timezone
    // For evening reminders, we check for 11:30 PM in user's timezone
    const targetHour = reminderType === 'noon' ? 12 : 23;
    const targetMinute = reminderType === 'noon' ? 0 : 30;

    // Fetch equipment that needs cleaning reminders
    const { data: overdueEquipment, error: equipmentError } = await supabase
      .from('equipment')
      .select(`
        id,
        name,
        user_id,
        next_cleaning_due,
        notifications_enabled,
        last_cleaned_at
      `)
      .eq('notifications_enabled', true)
      .lt('next_cleaning_due', now.toISOString());

    if (equipmentError) {
      console.error('Error fetching overdue equipment:', equipmentError);
      throw equipmentError;
    }

    console.log(`Found ${overdueEquipment?.length || 0} pieces of overdue equipment`);

    if (!overdueEquipment || overdueEquipment.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No overdue equipment found',
        remindersScheduled: 0 
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get user profiles and timezones
    const userIds = [...new Set(overdueEquipment.map(eq => eq.user_id))];
    
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, email, username, display_name')
      .in('user_id', userIds);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      throw profilesError;
    }

    const { data: timezones, error: timezonesError } = await supabase
      .from('user_timezones')
      .select('user_id, timezone')
      .in('user_id', userIds);

    if (timezonesError) {
      console.error('Error fetching timezones:', timezonesError);
      // Continue with UTC as default
    }

    // Create user timezone map
    const userTimezones = new Map();
    timezones?.forEach(tz => {
      userTimezones.set(tz.user_id, tz.timezone);
    });

    // Create user profile map
    const userProfiles = new Map();
    profiles?.forEach(profile => {
      userProfiles.set(profile.user_id, profile);
    });

    const remindersToSend: CleaningReminder[] = [];

    // Process each piece of equipment
    for (const equipment of overdueEquipment) {
      const profile = userProfiles.get(equipment.user_id);
      if (!profile || !profile.email) {
        console.log(`No profile or email found for user ${equipment.user_id}`);
        continue;
      }

      const userTimezone = userTimezones.get(equipment.user_id) || 'UTC';
      
      // Calculate days overdue
      const dueDate = new Date(equipment.next_cleaning_due);
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      // Check if it's the right time to send reminder in user's timezone
      // For now, we'll send at the scheduled time regardless of timezone
      // In a production system, you'd want more sophisticated timezone handling
      
      remindersToSend.push({
        userId: equipment.user_id,
        email: profile.email,
        equipmentName: equipment.name,
        daysOverdue,
        timezone: userTimezone
      });
    }

    console.log(`Preparing to send ${remindersToSend.length} reminders`);

    // Send notifications
    let successCount = 0;
    let errorCount = 0;

    for (const reminder of remindersToSend) {
      try {
        // Create in-app notification
        const { error: notificationError } = await supabase
          .from('notifications')
          .insert({
            user_id: reminder.userId,
            type: 'cleaning_reminder',
            title: 'Cleaning Reminder',
            message: reminder.daysOverdue > 0 
              ? `Your ${reminder.equipmentName} is ${reminder.daysOverdue} days overdue for cleaning!`
              : `Time to clean your ${reminder.equipmentName}`,
            data: {
              equipment_name: reminder.equipmentName,
              days_overdue: reminder.daysOverdue,
              reminder_type: reminderType,
              scheduled_time: now.toISOString()
            }
          });

        if (notificationError) {
          console.error('Error creating notification:', notificationError);
          errorCount++;
        } else {
          console.log(`Created notification for ${reminder.userId} - ${reminder.equipmentName}`);
          successCount++;
        }

      } catch (error) {
        console.error(`Error processing reminder for ${reminder.userId}:`, error);
        errorCount++;
      }
    }

    console.log(`Cleaning reminders processed: ${successCount} success, ${errorCount} errors`);

    return new Response(JSON.stringify({ 
      success: true,
      remindersScheduled: successCount,
      errors: errorCount,
      reminderType,
      timestamp: now.toISOString()
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in scheduled cleaning reminders:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);