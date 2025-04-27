
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { query } = await req.json()

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Base query that joins with departments
    let supabaseQuery = supabaseClient
      .from('card_readings')
      .select(`
        *,
        employees (
          first_name,
          last_name,
          department:departments (name)
        )
      `)
      .order('access_time', { ascending: false })

    // Format the response data
    const { data, error } = await supabaseQuery;
    
    if (error) throw error;

    // Transform the data for the report table
    const formattedData = data.map(record => ({
      name: record.employee_name || 'Bilinmeyen',
      check_in: record.access_time,
      department: record.employees?.department?.name || '-',
      device: record.device_name || '-',
      location: record.device_location || '-'
    }));

    return new Response(
      JSON.stringify({
        data: formattedData,
        message: 'Veriler başarıyla getirildi.'
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    )

  } catch (error) {
    console.error('Error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    )
  }
})
