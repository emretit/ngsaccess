
// Follow this setup guide to integrate the Deno runtime into your application:
// https://deno.com/manual/getting_started/setup_your_environment

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.2'

// CORS headers for browser clients
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

// Create a Supabase client with the Admin key
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

function validateApiKey(apiKey: string | null): boolean {
  const validApiKey = Deno.env.get('DEVICE_API_KEY')
  console.log(`Received API key: ${apiKey ? '[REDACTED]' : 'null or empty'}`);
  console.log(`Valid API key exists: ${validApiKey !== undefined && validApiKey !== ''}`);
  return apiKey === validApiKey && validApiKey !== undefined && validApiKey !== ''
}

serve(async (req) => {
  console.log('Device readings function called');
  console.log(`Request method: ${req.method}`);
  console.log(`Request headers: ${JSON.stringify([...req.headers.entries()])}`);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request (CORS preflight)');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // API Key validation
    const apiKey = req.headers.get('x-api-key')
    if (!validateApiKey(apiKey)) {
      console.error('Invalid API key received');
      return new Response(
        JSON.stringify({ 
          response: "close_relay", 
          error: "Geçersiz API anahtarı" 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    console.log('API key validation successful');

    // Proceed only for POST requests
    if (req.method !== 'POST') {
      console.error(`Invalid request method: ${req.method}`);
      return new Response(
        JSON.stringify({ 
          response: "close_relay", 
          error: "Sadece POST istekleri desteklenir" 
        }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const bodyText = await req.text();
    console.log('Raw request body:', bodyText);
    
    let body;
    try {
      body = JSON.parse(bodyText);
      console.log('Parsed device data:', body);
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ 
          response: "close_relay", 
          error: "Geçersiz JSON formatı" 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse fields expected from the device configuration screen
    // Format shown: {"user_id,serial": "%T,3505234822042881"}
    let userId = null, cardNo = null;

    console.log('Extracting user ID and card number');
    if (body["user_id,serial"]) {
      console.log(`Found combined field: ${body["user_id,serial"]}`);
      // Split the combined string value by comma
      const parts = body["user_id,serial"].split(',');
      if (parts.length === 2) {
        // First part is user_id (device ID) with %T prefix
        userId = parts[0].replace('%T', '');
        // Second part is the card number/serial
        cardNo = parts[1];
        console.log(`Extracted userId: ${userId}, cardNo: ${cardNo}`);
      } else {
        console.error(`Invalid format for "user_id,serial": ${body["user_id,serial"]}`);
      }
    } else {
      // Fallback to the original format
      userId = body.user_id;
      cardNo = body.card_no;
      console.log(`Using fallback fields - userId: ${userId}, cardNo: ${cardNo}`);
    }

    // Validate required fields
    if (!cardNo || !userId) {
      console.error('Missing required fields:', { cardNo, userId });
      return new Response(
        JSON.stringify({ 
          response: "close_relay", 
          error: "Eksik veri: user_id ve card_no/serial gerekli" 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate a device_id if not provided (use userId for now)
    const deviceId = body.device_id || userId;
    console.log(`Using deviceId: ${deviceId}`);

    // Check if device exists & update last_seen
    console.log(`Checking if device exists with IP: ${userId}`);
    let deviceData: any = null;
    const { data: existingDevice, error: deviceError } = await supabaseAdmin
      .from('server_devices')
      .select('id, name')
      .eq('ip_address', userId)
      .single()

    if (deviceError) {
      console.log(`Device error: ${deviceError.code} - ${deviceError.message}`);
      // If device not found, add it
      if (deviceError.code === 'PGRST116') {
        console.log(`Device not found, adding new device with IP: ${userId}`);
        const { data: newDevice, error: insertError } = await supabaseAdmin
          .from('server_devices')
          .insert({
            name: `Cihaz-${userId}`,
            ip_address: userId,
            status: 'active',
            last_seen: new Date().toISOString(),
            device_model_enum: "Access Control Terminal",
            serial_number: deviceId.toString()
          })
          .select('id, name')
          .single()

        if (insertError) {
          console.error('Error adding new device:', insertError);
          return new Response(
            JSON.stringify({ 
              response: "close_relay", 
              error: "Cihaz eklenemedi" 
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        console.log('New device added successfully:', newDevice);
        // Use the newly created device
        deviceData = newDevice
      } else {
        console.error('Error querying device:', deviceError);
        return new Response(
          JSON.stringify({ 
            response: "close_relay", 
            error: "Cihaz doğrulanamadı" 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else {
      console.log('Found existing device:', existingDevice);
      deviceData = existingDevice
    }

    // Always update device last_seen
    console.log(`Updating last_seen timestamp for device with IP: ${userId}`);
    const { error: updateError } = await supabaseAdmin
      .from('server_devices')
      .update({ last_seen: new Date().toISOString() })
      .eq('ip_address', userId)

    if (updateError) {
      console.error('Error updating device last_seen:', updateError);
    }

    // Find employee by card number
    console.log(`Looking up employee with card number: ${cardNo}`);
    const { data: employeeData, error: employeeError } = await supabaseAdmin
      .from('employees')
      .select('id, first_name, last_name, photo_url')
      .eq('card_number', cardNo)
      .single()

    let access_granted = false
    let employeeId = null
    let employeeName = null
    let employeePhotoUrl = null

    if (!employeeError && employeeData) {
      access_granted = true
      employeeId = employeeData.id
      employeeName = `${employeeData.first_name} ${employeeData.last_name}`
      employeePhotoUrl = employeeData.photo_url
      console.log(`Card ${cardNo} identified as employee: ${employeeName}`);
    } else {
      console.log(`Card ${cardNo} not found or error:`, employeeError);
    }

    // Insert card reading record
    console.log('Inserting card reading record...');
    const { data: readingData, error: readingError } = await supabaseAdmin
      .from('card_readings')
      .insert({
        card_no: cardNo,
        access_granted: access_granted,
        employee_id: employeeId,
        employee_name: employeeName,
        employee_photo_url: employeePhotoUrl,
        device_id: deviceData?.id || null,
        device_name: deviceData?.name || `Cihaz-${userId}`,
        device_location: body.location || "",
        device_ip: userId,
        device_serial: deviceId.toString(),
        status: access_granted ? 'success' : 'denied'
      })
      .select()
      .single()

    if (readingError) {
      console.error('Error inserting card reading:', readingError);
      return new Response(
        JSON.stringify({ 
          response: "close_relay", 
          error: "Kart okutma işlemi kaydedilemedi" 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Card reading record created successfully:', readingData);

    // Return response based on access_granted status in the format expected by the device
    const response = {
      response: access_granted ? "open_relay" : "close_relay",
      confirmation: access_granted ? "relay_opened" : "access_denied",
      employee_name: employeeName,
      timestamp: new Date().toISOString(),
      reading_id: readingData?.id
    };
    
    console.log('Sending response to device:', response);
    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ 
        response: "close_relay", 
        error: "Sunucu hatası: " + (error instanceof Error ? error.message : String(error))
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
