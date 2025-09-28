import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Equipment {
  id: string
  user_id: string
  name: string
  current_streak: number
  next_cleaning_due: string
  cleaning_frequency_days: number
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Starting automatic streak reset check...')

    // Create Supabase client with service role for database operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get all equipment that might be overdue
    const { data: equipment, error: equipmentError } = await supabase
      .from('equipment')
      .select('id, user_id, name, current_streak, next_cleaning_due, cleaning_frequency_days')
      .gt('current_streak', 0) // Only check equipment with active streaks
      .not('next_cleaning_due', 'is', null) // Only equipment with due dates

    if (equipmentError) {
      console.error('Error fetching equipment:', equipmentError)
      throw equipmentError
    }

    console.log(`Found ${equipment?.length || 0} equipment items to check`)

    const now = new Date()
    const overdueEquipment: Equipment[] = []

    // Check each equipment for overdue status
    for (const item of equipment || []) {
      const dueDate = new Date(item.next_cleaning_due)
      
      // If current time is past the due date, equipment is overdue
      if (now > dueDate) {
        overdueEquipment.push(item)
        console.log(`Equipment ${item.name} (${item.id}) is overdue. Due: ${dueDate.toISOString()}, Current: ${now.toISOString()}`)
      }
    }

    console.log(`Found ${overdueEquipment.length} overdue equipment items`)

    if (overdueEquipment.length > 0) {
      // Reset streaks for overdue equipment
      const equipmentIds = overdueEquipment.map(eq => eq.id)
      
      const { error: updateError } = await supabase
        .from('equipment')
        .update({ current_streak: 0 })
        .in('id', equipmentIds)

      if (updateError) {
        console.error('Error updating overdue streaks:', updateError)
        throw updateError
      }

      console.log(`Successfully reset streaks for ${overdueEquipment.length} overdue equipment items`)

      // Log the reset details for debugging
      for (const item of overdueEquipment) {
        console.log(`Reset streak for ${item.name} (User: ${item.user_id}, Previous streak: ${item.current_streak})`)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${equipment?.length || 0} equipment items, reset ${overdueEquipment.length} overdue streaks`,
        reset_count: overdueEquipment.length,
        reset_items: overdueEquipment.map(eq => ({
          id: eq.id,
          name: eq.name,
          user_id: eq.user_id,
          previous_streak: eq.current_streak
        }))
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error in auto-reset-streaks function:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to reset overdue streaks'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})