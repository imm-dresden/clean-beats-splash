// Edge function to handle push notification triggers from database
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushNotificationPayload {
  user_id: string;
  title: string;
  body: string;
  data?: any;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, title, body, data } = await req.json() as PushNotificationPayload;
    
    console.log('Push notification request:', { user_id, title, body, data });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's FCM tokens
    const { data: tokens, error: tokenError } = await supabase
      .from('fcm_tokens')
      .select('token, platform, device_info')
      .eq('user_id', user_id)
      .eq('is_active', true);

    if (tokenError) {
      console.error('Error fetching tokens:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch FCM tokens' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!tokens || tokens.length === 0) {
      console.log('No active tokens found for user:', user_id);
      return new Response(
        JSON.stringify({ message: 'No active tokens found' }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Found ${tokens.length} active tokens for user ${user_id}`);

    // Send notifications to each token
    const results = [];
    for (const tokenData of tokens) {
      try {
        // Call the existing send-fcm-notification function
        const { data: result, error } = await supabase.functions.invoke('send-fcm-notification', {
          body: {
            token: tokenData.token,
            title,
            body,
            data: {
              ...data,
              userId: user_id
            }
          }
        });

        if (error) {
          console.error('Error sending to token:', tokenData.token.substring(0, 20), error);
          results.push({ token: tokenData.token.substring(0, 20), success: false, error: error.message });
        } else {
          console.log('Successfully sent to token:', tokenData.token.substring(0, 20));
          results.push({ token: tokenData.token.substring(0, 20), success: true });
        }
      } catch (err) {
        console.error('Exception sending to token:', tokenData.token.substring(0, 20), err);
        results.push({ token: tokenData.token.substring(0, 20), success: false, error: err.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    return new Response(
      JSON.stringify({ 
        message: `Sent to ${successCount} devices, ${failureCount} failures`,
        results 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in push notification handler:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});