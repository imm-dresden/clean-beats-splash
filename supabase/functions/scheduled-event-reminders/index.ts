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

interface EventReminder {
  userId: string;
  eventId: string;
  eventTitle: string;
  eventType: string;
  startDate: string;
  location?: string;
  isOwner: boolean;
  userEmail: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting scheduled event reminders check...');
    
    const now = new Date();
    // Look for events starting in the next 30-35 minutes to account for execution timing
    const reminderWindow = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now
    const reminderWindowEnd = new Date(now.getTime() + 35 * 60 * 1000); // 35 minutes from now

    console.log(`Checking for events between ${reminderWindow.toISOString()} and ${reminderWindowEnd.toISOString()}`);

    // Fetch events starting in 30-35 minutes
    const { data: upcomingEvents, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .gte('start_date', reminderWindow.toISOString())
      .lte('start_date', reminderWindowEnd.toISOString());

    if (eventsError) {
      console.error('Error fetching upcoming events:', eventsError);
      throw eventsError;
    }

    console.log(`Found ${upcomingEvents?.length || 0} upcoming events`);

    if (!upcomingEvents || upcomingEvents.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No upcoming events found',
        remindersScheduled: 0 
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const remindersToSend: EventReminder[] = [];

    // Process each upcoming event
    for (const event of upcomingEvents) {
      // Get event owner profile
      const { data: ownerProfile, error: ownerError } = await supabase
        .from('profiles')
        .select('user_id, email, username, display_name')
        .eq('user_id', event.user_id)
        .single();

      if (ownerError || !ownerProfile?.email) {
        console.log(`No profile found for event owner ${event.user_id}`);
        continue;
      }

      // Add reminder for event owner
      remindersToSend.push({
        userId: event.user_id,
        eventId: event.id,
        eventTitle: event.title,
        eventType: event.event_type,
        startDate: event.start_date,
        location: event.location,
        isOwner: true,
        userEmail: ownerProfile.email
      });

      // Get attendees for this event
      const { data: attendees, error: attendeesError } = await supabase
        .from('event_attendees')
        .select('user_id')
        .eq('event_id', event.id);

      if (attendeesError) {
        console.error('Error fetching event attendees:', attendeesError);
        continue;
      }

      if (attendees && attendees.length > 0) {
        const attendeeIds = attendees.map(a => a.user_id).filter(id => id !== event.user_id);
        
        if (attendeeIds.length > 0) {
          // Get attendee profiles
          const { data: attendeeProfiles, error: attendeeProfilesError } = await supabase
            .from('profiles')
            .select('user_id, email, username, display_name')
            .in('user_id', attendeeIds);

          if (!attendeeProfilesError && attendeeProfiles) {
            for (const attendeeProfile of attendeeProfiles) {
              if (attendeeProfile.email) {
                remindersToSend.push({
                  userId: attendeeProfile.user_id,
                  eventId: event.id,
                  eventTitle: event.title,
                  eventType: event.event_type,
                  startDate: event.start_date,
                  location: event.location,
                  isOwner: false,
                  userEmail: attendeeProfile.email
                });
              }
            }
          }
        }
      }
    }

    console.log(`Preparing to send ${remindersToSend.length} event reminders`);

    // Send notifications
    let successCount = 0;
    let errorCount = 0;

    for (const reminder of remindersToSend) {
      try {
        const eventDateTime = new Date(reminder.startDate);
        const timeUntilEvent = Math.round((eventDateTime.getTime() - now.getTime()) / (1000 * 60));

        // Create in-app notification
        const { error: notificationError } = await supabase
          .from('notifications')
          .insert({
            user_id: reminder.userId,
            type: 'event_reminder',
            title: 'Event Reminder',
            message: reminder.isOwner 
              ? `Your ${reminder.eventType} "${reminder.eventTitle}" starts in ${timeUntilEvent} minutes!`
              : `Event "${reminder.eventTitle}" you're attending starts in ${timeUntilEvent} minutes!`,
            data: {
              event_id: reminder.eventId,
              event_title: reminder.eventTitle,
              event_type: reminder.eventType,
              start_date: reminder.startDate,
              location: reminder.location,
              is_owner: reminder.isOwner,
              minutes_until_event: timeUntilEvent,
              scheduled_time: now.toISOString()
            }
          });

        if (notificationError) {
          console.error('Error creating event notification:', notificationError);
          errorCount++;
        } else {
          console.log(`Created event reminder for ${reminder.userId} - ${reminder.eventTitle}`);
          successCount++;
        }

      } catch (error) {
        console.error(`Error processing event reminder for ${reminder.userId}:`, error);
        errorCount++;
      }
    }

    console.log(`Event reminders processed: ${successCount} success, ${errorCount} errors`);

    return new Response(JSON.stringify({ 
      success: true,
      remindersScheduled: successCount,
      errors: errorCount,
      eventsProcessed: upcomingEvents.length,
      timestamp: now.toISOString()
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in scheduled event reminders:", error);
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