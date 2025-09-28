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

interface OneSignalRequest {
  userId?: string;
  userIds?: string[];
  playerIds?: string[];
  title: string;
  body: string;
  data?: Record<string, any>;
  imageUrl?: string;
  actionUrl?: string;
  filters?: any[];
}

interface OneSignalMessage {
  app_id: string;
  include_player_ids?: string[];
  include_external_user_ids?: string[];
  filters?: any[];
  headings: {
    en: string;
  };
  contents: {
    en: string;
  };
  data?: Record<string, string>;
  large_icon?: string;
  big_picture?: string;
  url?: string;
  web_url?: string;
  chrome_web_icon?: string;
  chrome_web_image?: string;
  firefox_icon?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const oneSignalApiKey = Deno.env.get('ONESIGNAL_API_KEY');
    const oneSignalAppId = 'cb8bf8b6-8599-4258-9e1b-56333c230041';
    
    if (!oneSignalApiKey) {
      throw new Error('OneSignal API key not configured');
    }

    const requestBody: OneSignalRequest = await req.json();
    console.log('OneSignal request received:', requestBody);

    let result;
    
    if (requestBody.filters) {
      // Send to filtered audience
      result = await sendToFilters(requestBody, oneSignalApiKey, oneSignalAppId);
    } else if (requestBody.userId || requestBody.userIds) {
      // Send to specific user(s)
      const userIds = requestBody.userIds || [requestBody.userId!];
      result = await sendToUsers(userIds, requestBody, oneSignalApiKey, oneSignalAppId);
    } else if (requestBody.playerIds) {
      // Send to specific player IDs
      result = await sendToPlayerIds(requestBody.playerIds, requestBody, oneSignalApiKey, oneSignalAppId);
    } else {
      throw new Error('No target specified (userId, userIds, playerIds, or filters)');
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error sending OneSignal notification:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

async function sendToFilters(
  request: OneSignalRequest,
  apiKey: string,
  appId: string
): Promise<any> {
  const message = buildOneSignalMessage(request, appId);
  message.filters = request.filters;

  try {
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    console.log('OneSignal API response:', result);

    if (!response.ok) {
      throw new Error(`OneSignal API error: ${result.errors || result.error}`);
    }

    return {
      success: true,
      oneSignalResponse: result,
      recipients: result.recipients || 0
    };
  } catch (error) {
    console.error('Error sending OneSignal notification to filters:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function sendToUsers(
  userIds: string[],
  request: OneSignalRequest,
  apiKey: string,
  appId: string
): Promise<any> {
  try {
    // Get active OneSignal subscriptions for these users
    const { data: subscriptions, error: dbError } = await supabase
      .from('onesignal_subscriptions')
      .select('player_id, user_id, platform')
      .in('user_id', userIds)
      .eq('is_active', true);

    if (dbError) {
      throw new Error(`Database error: ${dbError.message}`);
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No active OneSignal subscriptions found for users:', userIds);
      return {
        success: true,
        message: 'No active subscriptions found',
        results: []
      };
    }

    console.log(`Found ${subscriptions.length} active subscriptions`);

    const playerIds = subscriptions.map(sub => sub.player_id);
    const message = buildOneSignalMessage(request, appId);
    message.include_player_ids = playerIds;

    // Send notification to OneSignal
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    console.log('OneSignal API response:', result);

    // Track notification delivery for each user
    for (const userId of userIds) {
      try {
        await supabase
          .from('notification_deliveries')
          .insert({
            user_id: userId,
            notification_type: request.data?.type || 'generic',
            onesignal_message_id: result.id,
            platform: 'onesignal',
            status: response.ok ? 'sent' : 'failed',
            error_message: response.ok ? null : (result.errors || result.error),
            metadata: {
              timestamp: new Date().toISOString(),
              recipients: result.recipients || 0,
              external_id: result.external_id
            }
          });
      } catch (trackingError) {
        console.error('Error tracking notification delivery:', trackingError);
      }
    }

    if (!response.ok) {
      throw new Error(`OneSignal API error: ${result.errors || result.error}`);
    }

    return {
      success: true,
      oneSignalResponse: result,
      sentToUsers: userIds,
      totalSubscriptions: subscriptions.length
    };
  } catch (error) {
    console.error('Error sending OneSignal notification to users:', error);
    
    // Track failed notifications
    for (const userId of userIds) {
      try {
        await supabase
          .from('notification_deliveries')
          .insert({
            user_id: userId,
            notification_type: request.data?.type || 'generic',
            platform: 'onesignal',
            status: 'failed',
            error_message: error instanceof Error ? error.message : String(error),
            metadata: {
              timestamp: new Date().toISOString()
            }
          });
      } catch (trackingError) {
        console.error('Error tracking failed notification:', trackingError);
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      failedUsers: userIds
    };
  }
}

async function sendToPlayerIds(
  playerIds: string[],
  request: OneSignalRequest,
  apiKey: string,
  appId: string
): Promise<any> {
  const message = buildOneSignalMessage(request, appId);
  message.include_player_ids = playerIds;

  try {
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    console.log('OneSignal API response:', result);

    if (!response.ok) {
      throw new Error(`OneSignal API error: ${result.errors || result.error}`);
    }

    return {
      success: true,
      oneSignalResponse: result,
      sentToPlayerIds: playerIds
    };
  } catch (error) {
    console.error('Error sending OneSignal notification to player IDs:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function buildOneSignalMessage(request: OneSignalRequest, appId: string): OneSignalMessage {
  const message: OneSignalMessage = {
    app_id: appId,
    headings: {
      en: request.title
    },
    contents: {
      en: request.body
    }
  };

  // Add data payload (convert values to strings as required by OneSignal)
  if (request.data) {
    message.data = {};
    for (const [key, value] of Object.entries(request.data)) {
      message.data[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }
  }

  // Add image if provided
  if (request.imageUrl) {
    message.large_icon = request.imageUrl;
    message.big_picture = request.imageUrl;
    message.chrome_web_image = request.imageUrl;
  }

  // Add action URL if provided
  if (request.actionUrl) {
    message.url = request.actionUrl;
    message.web_url = request.actionUrl;
  }

  // Set default icons for web
  message.chrome_web_icon = '/icons/icon-192x192.png';
  message.firefox_icon = '/icons/icon-192x192.png';

  return message;
}

serve(handler);