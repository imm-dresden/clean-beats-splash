import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FCMRequest {
  userId?: string;
  userIds?: string[];
  topic?: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  imageUrl?: string;
  actionUrl?: string;
  priority?: 'normal' | 'high';
}

interface FCMMessage {
  message: {
    token?: string;
    topic?: string;
    notification: {
      title: string;
      body: string;
      image?: string;
    };
    data?: Record<string, string>;
    webpush?: {
      notification: {
        click_action?: string;
        icon?: string;
        badge?: string;
      };
    };
    android?: {
      priority: string;
      notification: {
        click_action?: string;
        icon?: string;
        color?: string;
      };
    };
    apns?: {
      payload: {
        aps: {
          alert: {
            title: string;
            body: string;
          };
          badge?: number;
          sound?: string;
        };
      };
    };
  };
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const fcmRequest: FCMRequest = await req.json();
    console.log('FCM notification request:', fcmRequest);

    // Get FCM server key from environment
    const fcmServerKey = Deno.env.get('FCM_SERVER_KEY');
    if (!fcmServerKey) {
      throw new Error('FCM_SERVER_KEY environment variable not set');
    }

    const results = [];
    
    if (fcmRequest.topic) {
      // Send to topic
      const result = await sendToTopic(fcmRequest, fcmServerKey);
      results.push(result);
    } else if (fcmRequest.userId) {
      // Send to single user
      const result = await sendToUser(fcmRequest.userId, fcmRequest, fcmServerKey);
      results.push(result);
    } else if (fcmRequest.userIds && fcmRequest.userIds.length > 0) {
      // Send to multiple users
      for (const userId of fcmRequest.userIds) {
        const result = await sendToUser(userId, fcmRequest, fcmServerKey);
        results.push(result);
      }
    } else {
      throw new Error('No valid recipient specified (userId, userIds, or topic)');
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`FCM notifications sent: ${successCount} successful, ${failureCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${successCount} notifications, ${failureCount} failed`,
        results: results
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error sending FCM notification:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
};

async function sendToTopic(fcmRequest: FCMRequest, fcmServerKey: string) {
  try {
    const message = buildFCMMessage(fcmRequest);
    message.message.topic = fcmRequest.topic;

    const response = await fetch('https://fcm.googleapis.com/v1/projects/clean-beats-fcm/messages:send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${fcmServerKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error('FCM API error:', result);
      return { success: false, error: result.error?.message || 'Unknown FCM error' };
    }

    console.log('FCM topic message sent successfully:', result);
    return { success: true, messageId: result.name };

  } catch (error) {
    console.error('Error sending to topic:', error);
    return { success: false, error: error.message };
  }
}

async function sendToUser(userId: string, fcmRequest: FCMRequest, fcmServerKey: string) {
  try {
    // Get user's active FCM tokens
    const { data: tokens, error } = await supabase
      .from('fcm_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching FCM tokens:', error);
      return { success: false, error: 'Failed to fetch user tokens' };
    }

    if (!tokens || tokens.length === 0) {
      console.log(`No active FCM tokens found for user ${userId}`);
      return { success: false, error: 'No active tokens for user' };
    }

    const results = [];
    
    for (const tokenRecord of tokens) {
      try {
        const message = buildFCMMessage(fcmRequest);
        message.message.token = tokenRecord.token;

        const response = await fetch('https://fcm.googleapis.com/v1/projects/clean-beats-fcm/messages:send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${fcmServerKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message),
        });

        const result = await response.json();
        
        if (!response.ok) {
          console.error('FCM API error for token:', tokenRecord.token, result);
          
          // Handle invalid tokens
          if (result.error?.code === 'NOT_FOUND' || result.error?.code === 'INVALID_ARGUMENT') {
            await supabase
              .from('fcm_tokens')
              .update({ is_active: false })
              .eq('id', tokenRecord.id);
            console.log('Deactivated invalid token:', tokenRecord.token);
          }

          // Track delivery failure
          await supabase
            .from('notification_deliveries')
            .insert({
              user_id: userId,
              notification_type: fcmRequest.data?.type || 'unknown',
              platform: tokenRecord.platform,
              status: 'failed',
              error_message: result.error?.message || 'Unknown FCM error'
            });

          results.push({ success: false, error: result.error?.message || 'Unknown FCM error', platform: tokenRecord.platform });
        } else {
          console.log('FCM message sent successfully to:', tokenRecord.platform, result);
          
          // Track successful delivery
          await supabase
            .from('notification_deliveries')
            .insert({
              user_id: userId,
              notification_type: fcmRequest.data?.type || 'unknown',
              fcm_message_id: result.name,
              platform: tokenRecord.platform,
              status: 'sent'
            });

          // Update token last used time
          await supabase
            .from('fcm_tokens')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', tokenRecord.id);

          results.push({ success: true, messageId: result.name, platform: tokenRecord.platform });
        }

      } catch (error) {
        console.error('Error sending to token:', tokenRecord.token, error);
        results.push({ success: false, error: error.message, platform: tokenRecord.platform });
      }
    }

    const successCount = results.filter(r => r.success).length;
    return { 
      success: successCount > 0, 
      results,
      message: `${successCount}/${results.length} tokens sent successfully`
    };

  } catch (error) {
    console.error('Error in sendToUser:', error);
    return { success: false, error: error.message };
  }
}

function buildFCMMessage(fcmRequest: FCMRequest): FCMMessage {
  const message: FCMMessage = {
    message: {
      notification: {
        title: fcmRequest.title,
        body: fcmRequest.body,
      },
      data: {},
      webpush: {
        notification: {
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
        }
      },
      android: {
        priority: fcmRequest.priority || 'normal',
        notification: {
          icon: 'ic_notification',
          color: '#1a1a2e',
        }
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: fcmRequest.title,
              body: fcmRequest.body,
            },
            sound: 'default',
          }
        }
      }
    }
  };

  // Add image if provided
  if (fcmRequest.imageUrl) {
    message.message.notification.image = fcmRequest.imageUrl;
  }

  // Add click action if provided
  if (fcmRequest.actionUrl) {
    message.message.webpush!.notification!.click_action = fcmRequest.actionUrl;
    message.message.android!.notification!.click_action = fcmRequest.actionUrl;
  }

  // Convert data to strings (FCM requirement)
  if (fcmRequest.data) {
    for (const [key, value] of Object.entries(fcmRequest.data)) {
      message.message.data![key] = typeof value === 'string' ? value : JSON.stringify(value);
    }
  }

  return message;
}

serve(handler);