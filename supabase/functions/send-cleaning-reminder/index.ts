import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CleaningReminderRequest {
  email: string;
  equipmentName: string;
  userId?: string;
  daysOverdue?: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, equipmentName, userId, daysOverdue = 0 }: CleaningReminderRequest = await req.json();

    // Create reminder notification instead of email
    console.log(`Creating cleaning reminder for ${equipmentName} (${daysOverdue} days overdue)`);

    // Create in-app notification if userId is provided
    if (userId) {
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: 'cleaning_reminder',
          title: 'Cleaning Reminder',
          message: daysOverdue > 0 
            ? `Your ${equipmentName} is ${daysOverdue} days overdue for cleaning!`
            : `Time to clean your ${equipmentName}`,
          data: {
            equipment_name: equipmentName,
            days_overdue: daysOverdue,
            reminder_type: 'cleaning_due'
          }
        });

      if (notificationError) {
        console.error('Error creating notification:', notificationError);
      } else {
        console.log('Cleaning reminder notification created successfully');
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      notificationCreated: !!userId 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error sending cleaning reminder:", error);
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