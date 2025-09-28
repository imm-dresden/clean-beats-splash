-- Create OneSignal subscriptions table to replace FCM tokens
CREATE TABLE public.onesignal_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  player_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('web', 'ios', 'android')),
  device_info JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, player_id, platform)
);

-- Enable Row Level Security
ALTER TABLE public.onesignal_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policies for OneSignal subscriptions
CREATE POLICY "Users can create their own OneSignal subscriptions" 
ON public.onesignal_subscriptions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own OneSignal subscriptions" 
ON public.onesignal_subscriptions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own OneSignal subscriptions" 
ON public.onesignal_subscriptions 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own OneSignal subscriptions" 
ON public.onesignal_subscriptions 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create function to update updated_at column
CREATE TRIGGER update_onesignal_subscriptions_updated_at
BEFORE UPDATE ON public.onesignal_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update notification_deliveries table to support OneSignal
ALTER TABLE public.notification_deliveries 
ADD COLUMN onesignal_player_id TEXT,
ADD COLUMN onesignal_message_id TEXT;

-- Create index for better performance
CREATE INDEX idx_onesignal_subscriptions_user_id ON public.onesignal_subscriptions(user_id);
CREATE INDEX idx_onesignal_subscriptions_platform ON public.onesignal_subscriptions(platform);
CREATE INDEX idx_onesignal_subscriptions_active ON public.onesignal_subscriptions(is_active) WHERE is_active = true;