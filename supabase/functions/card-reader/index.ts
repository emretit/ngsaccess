import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    // Parse the request body
    let requestData;
    try {
      requestData = await req.json();
      console.log('Received data:', requestData);
    } catch (error) {
      console.error('Error parsing request body:', error);
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Extract card ID (support both user_id and card_id)
    const cardId = requestData.user_id || requestData.card_id;
    if (!cardId) {
      return new Response(JSON.stringify({ error: 'user_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Processing card ID:', cardId);

    // Find employee by card number
    const { data: employee, error: employeeError } = await supabaseClient
      .from('employees')
      .select('id, first_name, last_name, access_permission, photo_url')
      .eq('card_number', cardId)
      .single();

    if (employeeError && employeeError.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
      console.error('Error finding employee:', employeeError);
    }

    // Default values if employee not found
    const employeeId = employee?.id || null;
    const employeeName = employee ? `${employee.first_name} ${employee.last_name}` : null;
    const accessGranted = employee?.access_permission || false;
    const photoUrl = employee?.photo_url || null;

    // Create card reading record
    const { data: reading, error: readingError } = await supabaseClient
      .from('card_readings')
      .insert({
        card_no: cardId,
        access_granted: accessGranted,
        employee_id: employeeId,
        employee_name: employeeName,
        employee_photo_url: photoUrl,
        status: accessGranted ? 'success' : 'denied',
        device_name: requestData.device_name || 'Supabase Edge Function Reader',
        device_location: requestData.device_location || 'API Endpoint',
        device_serial: requestData.device_serial || 'EDGE-FUNC-1',
      })
      .select();

    if (readingError) {
      console.error('Error inserting card reading:', readingError);
      return new Response(JSON.stringify({ error: 'Failed to process card reading' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Format response to match device expectations
    // Return success response with access status
    return new Response(
      JSON.stringify({
        response: "success",
        open_relay: accessGranted ? "true" : "false",
        confirmation: "relay_opened",
        message: accessGranted ? 'Access granted' : 'Access denied',
        reading_id: reading?.[0]?.id
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
