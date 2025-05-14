
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.1";

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Create a Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ response: "error", error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    console.log('Card Reader Request:', {
      url: req.url,
      method: req.method,
    });

    // Parse request body
    const body = await req.json();
    console.log('Request body:', body);

    // Extract user_id (card number) and device serial
    let user_id, serial;

    // Process request based on format (supporting different formats)
    if ('user_id,serial' in body) {
      const [cardNumber, deviceSerial] = body['user_id,serial'].split(',');
      user_id = cardNumber;
      serial = deviceSerial;
    } else if ('user_id' in body && '%T' in body) {
      // Format from device image
      user_id = body.user_id;
      serial = body['%T']; // %T is placeholder for serial in the device
    } else {
      user_id = body.user_id;
      serial = body.serial || body.deviceSerial;
    }

    // Verify format
    if (!user_id || !serial) {
      console.error('Invalid request format:', body);
      return new Response(
        JSON.stringify({ response: "error", error: 'Invalid request format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing card read: Card ${user_id}, Device ${serial}`);

    // Check if the device exists
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('id, name, device_location')
      .eq('device_serial', serial)
      .single();

    if (deviceError || !device) {
      console.error('Device not found:', serial, deviceError);
      return new Response(
        JSON.stringify({ 
          response: "close_relay",
          error: `Device not found: ${serial}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the employee by card number
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('id, first_name, last_name, department_id')
      .eq('card_number', user_id)
      .single();

    if (employeeError || !employee) {
      console.error('Employee not found:', user_id, employeeError);
      
      // Log the access attempt
      await supabase.from('card_readings').insert({
        card_no: user_id,
        access_granted: false,
        device_id: device.id,
        status: 'denied',
        device_name: device.name,
        device_serial: serial,
        device_location: device.device_location
      });
      
      return new Response(
        JSON.stringify({ response: "close_relay" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check employee access permission
    // Query access rules - simplified for example
    const { data: accessRules, error: accessError } = await supabase
      .from('access_rules')
      .select('*')
      .or(`employee_id.eq.${employee.id},device_id.eq.${device.id}`)
      .eq('is_active', true);
    
    const hasAccess = accessRules && accessRules.length > 0;

    // Log the card reading
    await supabase.from('card_readings').insert({
      card_no: user_id,
      access_granted: hasAccess,
      device_id: device.id,
      device_name: device.name,
      device_serial: serial,
      device_location: device.device_location,
      employee_id: employee.id,
      employee_name: `${employee.first_name} ${employee.last_name}`,
      status: hasAccess ? 'success' : 'denied'
    });

    // Return response matching the device expectation
    return new Response(
      JSON.stringify({ response: hasAccess ? "open_relay" : "close_relay" }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error processing card reader request:', error);
    return new Response(
      JSON.stringify({ response: "error", error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
