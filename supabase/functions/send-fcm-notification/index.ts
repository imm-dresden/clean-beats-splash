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

// Service account configuration
const serviceAccount = {
  "type": "service_account",
  "project_id": "clean-beats-640e0",
  "private_key_id": "b3f1eb58f7b7def3a409db3204e1d4b8ee834b48",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQCpTqDGiT3DGCVU\nY2FpOdsbVgRBlReIWvRVGk+oga1zn9XjrxbWWFyrTXjU6hl2O1lVgS5NjmvMN3n2\nryL3Xr7Tr8dYJyTp9Z6waQTVEvTEORCJ4nmEVfn8NJLVgNqOXafV0zyhOyP/kpsg\nxXHKtBtYTaxca9z3jGLDM07yIdR4qVIbTXeZgeQ6Jh1FHNPW1DDktEtcUlGyo/2B\nOSt7XJH1d4wuvYjJdLOHnOP6GHstr7xMzrYrZAF+5A/hjrij4fjPl9cL9X5Vta6w\n52UtzbLAvDdcan3KQYLUUetmr/tBOE6KcX1ICO7jWqocovzX0VzkYLQPvT04SMhO\n01KI5Lw3AgMBAAECggEAUTDHoO3HlHtLy4AtAo0gKafCOsEIm/ciHH2VnbUyPLR1\nmc4pIXkWV3+7Zj8tHqmvWXWtgru9rh0ce9PY7M+eq10sN3XuGdQT2X1DN/rzLfY/\nnB/jLjccvnlnwMMeDA+VoNC/zoHR7YmcosaMnyxnwJze/yMqv/uukPVV8n+OqJ2g\n1ipcaWYNa+XBIguz83T40pXj8Jp4Pdr0RA3zQsZI6dQtsaR5gFp9i+sIlXBSJAWa\n58pj03R0Tt/Fb0P5Hv7d8fvr9SDTH1eFzhe/AdzsObGCcwe9c9AVYIb1X8FI006s\n6dU61TyBg5nSszN1rpk1Q8Ndaf8zj89pN/84v0e4oQKBgQDsnPa0W8goP4d853Qd\nhYvAtDWwoWajN0G9M0QgOml3EjSCAM5FDBhZx3vxjVuok9ane6dRq+TViLOsi86G\n+tvVYAiVhH2Ii2trRltFVobG4XdmYNIz+cePNDye7Z8N1i4ylkvCm0wffbd1KLyr\norMmMLLs/+yGZd3T7e9K/oW4xQKBgQC3LeZEZlXxqK58VNKIH1vz7HkT0ZQPgn5J\nkOVgnRzYe952NTcl/DZYEbXYMStpKVfNlJru0/K1/HoN6WccS2ow+65r6QvqMIMc\nPS4VJAqxK39dovxHoo4kn9Hex0Zbm2VWkLiSnGL1QcUKjf8z9tyxCnklvDQs8PS0\nZDXnKnHYywKBgQDqQ0Xmr/BuGOgV/Dp0eCIzurhlloc+FZlar4VFu09r+nROOmn+\n5si9KspGD8SuFSEzVTQFooDAAcaSkSD7dydsDNay4ig/pnnGDjSTY+Wwxs4maLn1\nh9nSqM9UMsOFOYcnwrJjjMpDa37V2m1iKYXhy9l62K/fKMAF8c83muPeWQKBgQCm\nbmyuLvDdbW6Dhqn2hc+NM4jayeuln+HQQ3c1LercgscgTb96ospZgFXhRON1W9vr\n7J5MaoQ2d1wKMcu+eILWWIYkg4yQzl0BllC9Yo7YZHYHhKOFDpvpiNAtgo9Zgjoz\nya/5fV+oCIbXzSZXd28S6DokX/hj8NXU5MvY6caguwKBgQC8T7293c+xQW6KxOhF\nou8JEQJvt7F/35C65oZel7BLeVYrGnmENheAJJ3mEtUDBFbtnybjZOagUQzWazYG\ngy2Fy7p86i9MK/Dpu7C0pBGdSSkP1k2pwbsRc2vopRSo5/MSYjuF8FRUOkYH3SgL\nqmpiFD4oNM/ymWP5cStPT2CNgg==\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@clean-beats-640e0.iam.gserviceaccount.com",
  "client_id": "110141202326321971739",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40clean-beats-640e0.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
}

async function getAccessToken(): Promise<string> {
  try {
    const now = Math.floor(Date.now() / 1000)
    const exp = now + 3600 // 1 hour from now
    
    // Create JWT header and payload
    const header = {
      alg: 'RS256',
      typ: 'JWT'
    }
    
    const payload = {
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: exp
    }
    
    // Encode header and payload
    const encodedHeader = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    const encodedPayload = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    
    // Create message to sign
    const message = `${encodedHeader}.${encodedPayload}`
    
    // Import private key for signing
    const privateKeyPem = serviceAccount.private_key
      .replace(/-----BEGIN PRIVATE KEY-----/, '')
      .replace(/-----END PRIVATE KEY-----/, '')
      .replace(/\s/g, '')
    
    const privateKeyBuffer = Uint8Array.from(atob(privateKeyPem), c => c.charCodeAt(0))
    
    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      privateKeyBuffer,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
      },
      false,
      ['sign']
    )
    
    // Sign the message
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      privateKey,
      new TextEncoder().encode(message)
    )
    
    // Encode signature
    const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    
    const jwt = `${message}.${encodedSignature}`
    
    // Exchange JWT for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      })
    })
    
    const tokenData = await tokenResponse.json()
    
    if (!tokenResponse.ok) {
      console.error('Token request failed:', tokenData)
      throw new Error(`Failed to get access token: ${tokenData.error_description || tokenData.error}`)
    }
    
    return tokenData.access_token
  } catch (error) {
    console.error('Error getting access token:', error)
    throw error
  }
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const fcmRequest: FCMRequest = await req.json();
    console.log('FCM notification request:', fcmRequest);

    // Get access token for FCM v1 API
    const accessToken = await getAccessToken();

    const results = [];
    
    if (fcmRequest.topic) {
      // Send to topic
      const result = await sendToTopic(fcmRequest, accessToken);
      results.push(result);
    } else if (fcmRequest.userId) {
      // Send to single user
      const result = await sendToUser(fcmRequest.userId, fcmRequest, accessToken);
      results.push(result);
    } else if (fcmRequest.userIds && fcmRequest.userIds.length > 0) {
      // Send to multiple users
      for (const userId of fcmRequest.userIds) {
        const result = await sendToUser(userId, fcmRequest, accessToken);
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

async function sendToTopic(fcmRequest: FCMRequest, accessToken: string) {
  try {
    const message = buildFCMMessage(fcmRequest);
    message.message.topic = fcmRequest.topic;

    const response = await fetch('https://fcm.googleapis.com/v1/projects/clean-beats-640e0/messages:send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
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

async function sendToUser(userId: string, fcmRequest: FCMRequest, accessToken: string) {
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

        const response = await fetch('https://fcm.googleapis.com/v1/projects/clean-beats-640e0/messages:send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
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