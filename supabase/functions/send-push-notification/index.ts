import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationPayload {
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  notification_type?: string;
}

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

    const { user_id, title, body, data, notification_type } = await req.json() as NotificationPayload;
    
    console.log(`📱 Sending push notification to user ${user_id}:`, { title, body, notification_type });

    // Get user's FCM tokens
    const { data: tokens, error: tokensError } = await supabase
      .from('fcm_tokens')
      .select('token, platform')
      .eq('user_id', user_id)
      .eq('is_active', true);

    if (tokensError) {
      console.error('❌ Error fetching FCM tokens:', tokensError);
      throw tokensError;
    }

    if (!tokens || tokens.length === 0) {
      console.log('⚠️ No active FCM tokens found for user:', user_id);
      return new Response(
        JSON.stringify({ success: false, message: 'No active tokens found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`📱 Found ${tokens.length} active tokens for user ${user_id}`);

    // Send notifications to all user devices
    const results = await Promise.allSettled(
      tokens.map(async (tokenData) => {
        console.log(`📤 Sending to ${tokenData.platform} device:`, tokenData.token.substring(0, 20) + '...');
        
        const response = await supabase.functions.invoke('send-fcm-notification', {
          body: {
            token: tokenData.token,
            title,
            body,
            data: {
              ...data,
              notification_type,
              click_action: 'FLUTTER_NOTIFICATION_CLICK'
            }
          }
        });

        if (response.error) {
          console.error('❌ FCM send error:', response.error);
          throw response.error;
        }

        console.log('✅ Notification sent successfully to:', tokenData.platform);
        return response.data;
      })
    );

    // Count successful sends
    const successful = results.filter(result => result.status === 'fulfilled').length;
    const failed = results.filter(result => result.status === 'rejected').length;

    console.log(`📊 Notification results: ${successful} successful, ${failed} failed`);

    // Log any failures for debugging
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`❌ Failed to send to token ${index}:`, result.reason);
      }
    });

    return new Response(
      JSON.stringify({ 
        success: successful > 0, 
        sent: successful, 
        failed,
        message: `Sent to ${successful}/${tokens.length} devices`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('💥 Error in send-push-notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});