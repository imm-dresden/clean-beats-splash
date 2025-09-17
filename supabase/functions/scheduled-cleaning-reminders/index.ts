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
    console.log('Starting timezone-aware cleaning reminders check...');
    
    const { reminderType = 'noon', checkHour = false } = await req.json();
    console.log('Reminder type:', reminderType, 'Check hour:', checkHour);

    // Get current time in UTC
    const now = new Date();
    const currentUTCHour = now.getUTCHours();
    const currentUTCMinute = now.getUTCMinutes();
    
    console.log(`Current UTC time: ${currentUTCHour}:${currentUTCMinute.toString().padStart(2, '0')}`);

    // Target times for reminders
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

    // Process each piece of equipment with timezone awareness
    for (const equipment of overdueEquipment) {
      const profile = userProfiles.get(equipment.user_id);
      if (!profile || !profile.email) {
        console.log(`No profile or email found for user ${equipment.user_id}`);
        continue;
      }

      const userTimezone = userTimezones.get(equipment.user_id) || 'UTC';
      
      // Calculate what time it is locally for this user
      try {
        // Create a date object in the user's timezone
        const utcTime = new Date();
        const userTime = new Date(utcTime.toLocaleString("en-US", {timeZone: userTimezone}));
        const userHour = userTime.getHours();
        const userMinute = userTime.getMinutes();
        
        console.log(`User ${equipment.user_id} (${userTimezone}): Local time is ${userHour}:${userMinute.toString().padStart(2, '0')}, target is ${targetHour}:${targetMinute.toString().padStart(2, '0')}`);
        
        // Only send reminder if it's within 30 minutes of the target time for this user
        const isCorrectHour = userHour === targetHour;
        const isCorrectMinute = Math.abs(userMinute - targetMinute) <= 30;
        
        if (isCorrectHour && isCorrectMinute) {
          // Calculate days overdue
          const dueDate = new Date(equipment.next_cleaning_due);
          const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

          remindersToSend.push({
            userId: equipment.user_id,
            email: profile.email,
            equipmentName: equipment.name,
            daysOverdue,
            timezone: userTimezone
          });
          
          console.log(`Added reminder for user ${equipment.user_id} - ${equipment.name} (${daysOverdue} days overdue)`);
        } else {
          console.log(`Skipped user ${equipment.user_id} - not the right time (hour: ${isCorrectHour}, minute: ${isCorrectMinute})`);
        }
      } catch (timezoneError) {
        console.error(`Error calculating time for timezone ${userTimezone}:`, timezoneError);
        // If timezone calculation fails, send reminder anyway (better safe than sorry)
        const dueDate = new Date(equipment.next_cleaning_due);
        const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        remindersToSend.push({
          userId: equipment.user_id,
          email: profile.email,
          equipmentName: equipment.name,
          daysOverdue,
          timezone: userTimezone
        });
      }
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
            title: '🧽 Cleaning Reminder',
            message: reminder.daysOverdue > 0 
              ? `Your ${reminder.equipmentName} is ${reminder.daysOverdue} day${reminder.daysOverdue > 1 ? 's' : ''} overdue for cleaning!`
              : `Time to clean your ${reminder.equipmentName} ✨`,
            data: {
              equipment_name: reminder.equipmentName,
              days_overdue: reminder.daysOverdue,
              reminder_type: reminderType,
              scheduled_time: now.toISOString(),
              user_timezone: reminder.timezone
            }
          });

        if (notificationError) {
          console.error('Error creating notification:', notificationError);
          errorCount++;
        } else {
          console.log(`Created notification for ${reminder.userId} - ${reminder.equipmentName}`);
          
          // Send push notification via FCM
          try {
            const { error: fcmError } = await supabase.functions.invoke('send-fcm-notification', {
              body: {
                userId: reminder.userId,
                title: '🧽 Cleaning Reminder',
                body: reminder.daysOverdue > 0 
                  ? `Your ${reminder.equipmentName} is ${reminder.daysOverdue} day${reminder.daysOverdue > 1 ? 's' : ''} overdue for cleaning!`
                  : `Time to clean your ${reminder.equipmentName} ✨`,
                data: {
                  type: 'cleaning_reminder',
                  equipmentName: reminder.equipmentName,
                  daysOverdue: reminder.daysOverdue,
                  reminderType: reminderType,
                  scheduledTime: now.toISOString(),
                  userTimezone: reminder.timezone
                }
              }
            });

            if (fcmError) {
              console.error('Error sending FCM notification for cleaning reminder:', fcmError);
            } else {
              console.log(`FCM notification sent for cleaning reminder: ${reminder.equipmentName}`);
            }
          } catch (fcmError) {
            console.error('Exception sending FCM notification for cleaning reminder:', fcmError);
          }
          
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
      timestamp: now.toISOString(),
      utcTime: `${currentUTCHour}:${currentUTCMinute.toString().padStart(2, '0')}`,
      targetTime: `${targetHour}:${targetMinute.toString().padStart(2, '0')}`
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