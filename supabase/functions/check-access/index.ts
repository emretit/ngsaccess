
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { employeeId, deviceId } = await req.json();

    if (!employeeId || !deviceId) {
      return new Response(
        JSON.stringify({ error: 'Employee ID and Device ID are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check access rules
    const { data: accessRules, error: rulesError } = await supabase
      .from('access_rules')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('device_id', deviceId)
      .eq('is_active', true);

    if (rulesError) {
      throw rulesError;
    }

    // Get current time in UTC
    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-US', { hour12: false });
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    // Check if any rule allows access at current time
    const hasAccess = accessRules.some(rule => {
      return rule.days.includes(currentDay) &&
             currentTime >= rule.start_time &&
             currentTime <= rule.end_time;
    });

    return new Response(
      JSON.stringify({ 
        hasAccess,
        timestamp: now.toISOString(),
        rulesFound: accessRules.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error checking access:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
