import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
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

    // Send email reminder
    const emailResponse = await resend.emails.send({
      from: "Clean Beats <noreply@resend.dev>",
      to: [email],
      subject: `🎵 Time to clean your ${equipmentName}!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #1a1a2e; text-align: center;">🎵 Clean Beats Reminder</h1>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #333; margin-top: 0;">Time to clean your ${equipmentName}!</h2>
            <p style="color: #666; font-size: 16px;">
              Your ${equipmentName} is ${daysOverdue > 0 ? `${daysOverdue} days overdue for` : 'due for'} cleaning. Regular maintenance keeps your equipment in top condition and extends its lifespan.
            </p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <p style="color: #888; font-size: 14px;">
              Keep your beats clean and your music flowing! 🎶
            </p>
          </div>
        </div>
      `,
    });

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
      emailResponse,
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