import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🕐 Starting event reminder check...');

    // Get current time
    const now = new Date();
    const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);
    const fortyMinutesFromNow = new Date(now.getTime() + 40 * 60 * 1000);

    console.log(`⏰ Looking for events starting between ${thirtyMinutesFromNow.toISOString()} and ${fortyMinutesFromNow.toISOString()}`);

    // Find events starting in 30-40 minutes that haven't been reminded
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select(`
        id,
        title,
        description,
        start_date,
        location,
        user_id,
        profiles:user_id (username, display_name)
      `)
      .gte('start_date', thirtyMinutesFromNow.toISOString())
      .lte('start_date', fortyMinutesFromNow.toISOString())
      .is('reminder_sent_at', null);

    if (eventsError) {
      console.error('❌ Error fetching events:', eventsError);
      throw eventsError;
    }

    console.log(`📅 Found ${events?.length || 0} events needing reminders`);

    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No events need reminders', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let successCount = 0;
    let errorCount = 0;

    // Process each event
    for (const event of events) {
      try {
        console.log(`📱 Sending reminder for event: ${event.title} to user ${event.user_id}`);

        const eventDate = new Date(event.start_date);
        const timeUntilEvent = Math.round((eventDate.getTime() - now.getTime()) / 60000); // minutes

        // Create notification in database
        const { error: notificationError } = await supabase
          .from('notifications')
          .insert({
            user_id: event.user_id,
            type: 'event_reminder',
            title: 'Event Starting Soon',
            message: `"${event.title}" starts in ${timeUntilEvent} minutes`,
            data: {
              event_id: event.id,
              event_title: event.title,
              event_location: event.location,
              start_date: event.start_date,
              minutes_until: timeUntilEvent
            }
          });

        if (notificationError) {
          console.error('❌ Error creating notification:', notificationError);
          errorCount++;
          continue;
        }

        // Send push notification
        const pushResponse = await supabase.functions.invoke('send-push-notification', {
          body: {
            user_id: event.user_id,
            title: 'Event Starting Soon 🎵',
            body: `"${event.title}" starts in ${timeUntilEvent} minutes${event.location ? ` at ${event.location}` : ''}`,
            notification_type: 'event_reminder',
            data: {
              event_id: event.id,
              event_title: event.title,
              type: 'event_reminder'
            }
          }
        });

        if (pushResponse.error) {
          console.error('❌ Error sending push notification:', pushResponse.error);
        }

        // Mark reminder as sent
        const { error: updateError } = await supabase
          .from('events')
          .update({ reminder_sent_at: now.toISOString() })
          .eq('id', event.id);

        if (updateError) {
          console.error('❌ Error updating reminder status:', updateError);
        }

        console.log(`✅ Reminder sent for event: ${event.title}`);
        successCount++;

      } catch (error) {
        console.error(`❌ Error processing event ${event.id}:`, error);
        errorCount++;
      }
    }

    console.log(`📊 Event reminders processed: ${successCount} success, ${errorCount} errors`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${successCount} event reminders`,
        sent: successCount,
        errors: errorCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Error in send-event-reminder:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});