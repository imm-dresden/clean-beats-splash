import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CleaningReminderRequest {
  email: string;
  equipmentName: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, equipmentName }: CleaningReminderRequest = await req.json();

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
              Your ${equipmentName} is due for cleaning in 1 hour. Regular maintenance keeps your equipment in top condition and extends its lifespan.
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

    return new Response(JSON.stringify(emailResponse), {
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