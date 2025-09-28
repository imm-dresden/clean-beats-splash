import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Running scheduled streak reset...')

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Call the auto-reset-streaks function
    const { data, error } = await supabase.functions.invoke('auto-reset-streaks', {
      body: {}
    })

    if (error) {
      console.error('Error calling auto-reset-streaks:', error)
      throw error
    }

    console.log('Scheduled streak reset completed:', data)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Scheduled streak reset completed successfully',
        result: data
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error in scheduled-streak-reset function:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to run scheduled streak reset'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})