
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
  if (Deno.env.get('DEVELOPMENT_MODE') === 'true') {
    console.log('Development mode enabled, skipping API key validation')
    return true
  }
  return apiKey === validApiKey && validApiKey !== undefined && validApiKey !== ''
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request for CORS preflight')
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Request received at device-readings endpoint')
    
    // API Key validation (allow bypass in development mode)
    const apiKey = req.headers.get('x-api-key')
    if (!validateApiKey(apiKey)) {
      console.error('Invalid API key provided:', apiKey)
      return new Response(
        JSON.stringify({ error: 'Geçersiz API anahtarı' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Proceed only for POST requests
    if (req.method !== 'POST') {
      console.error('Unsupported method:', req.method)
      return new Response(
        JSON.stringify({ error: 'Sadece POST istekleri desteklenir' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const body = await req.json()
    console.log('Received device data:', JSON.stringify(body))

    // Validate required fields (adjust based on your actual device parameters)
    // card_no: Card number from the swiped card
    // device_id: Device serial number/identifier
    if (!body.card_no || !body.device_id) {
      console.error('Missing required fields:', body)
      return new Response(
        JSON.stringify({ 
          response: "close_relay", 
          error: "Eksik veri: card_no ve device_id gerekli" 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Determine device IP address from request if not in body
    const deviceIp = body.ip_address || req.headers.get('x-forwarded-for') || 'unknown';
    
    // Check if device exists & update last_seen
    let deviceData;
    const { data: existingDevice, error: deviceError } = await supabaseAdmin
      .from('server_devices')
      .select('id, name')
      .eq('serial_number', body.device_id.toString())
      .single()

    if (deviceError) {
      console.log('Device not found, creating a new one with serial:', body.device_id)
      // If device not found, add it
      if (deviceError.code === 'PGRST116') {
        const { data: newDevice, error: insertError } = await supabaseAdmin
          .from('server_devices')
          .insert({
            name: `Cihaz-${body.device_id}`,
            ip_address: deviceIp,
            status: 'active',
            last_seen: new Date().toISOString(),
            device_model_enum: "Access Control Terminal",
            serial_number: body.device_id.toString()
          })
          .select('id, name')
          .single()

        if (insertError) {
          console.error('Error adding new device:', insertError)
          return new Response(
            JSON.stringify({ 
              response: "close_relay", 
              error: "Cihaz eklenemedi" 
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Use the newly created device
        deviceData = newDevice
      } else {
        console.error('Device query error:', deviceError)
        return new Response(
          JSON.stringify({ 
            response: "close_relay", 
            error: "Cihaz doğrulanamadı" 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else {
      deviceData = existingDevice
      console.log('Found existing device:', deviceData)
    }

    // Always update device last_seen
    await supabaseAdmin
      .from('server_devices')
      .update({ 
        last_seen: new Date().toISOString(),
        ip_address: deviceIp
      })
      .eq('serial_number', body.device_id.toString())

    // Find employee by card number
    const { data: employeeData, error: employeeError } = await supabaseAdmin
      .from('employees')
      .select('id, first_name, last_name, photo_url')
      .eq('card_number', body.card_no)
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
      console.log(`Card ${body.card_no} identified as employee: ${employeeName}`)
    } else {
      console.log(`Card ${body.card_no} not found or error:`, employeeError)
    }

    // Insert card reading record
    const { data: readingData, error: readingError } = await supabaseAdmin
      .from('card_readings')
      .insert({
        card_no: body.card_no,
        access_granted: access_granted,
        employee_id: employeeId,
        employee_name: employeeName,
        employee_photo_url: employeePhotoUrl,
        device_id: body.device_id,
        device_name: deviceData?.name || `Cihaz-${body.device_id}`,
        device_location: body.location || "",
        device_ip: deviceIp,
        device_serial: body.device_id.toString(),
        status: access_granted ? 'success' : 'denied',
        raw_data: JSON.stringify(body) // Store raw request for debugging
      })
      .select()
      .single()

    if (readingError) {
      console.error('Card reading record error:', readingError)
      return new Response(
        JSON.stringify({ 
          response: "close_relay", 
          error: "Kart okutma işlemi kaydedilemedi" 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Card reading record saved:', readingData?.id)

    // Return response based on access_granted status
    const responseData = {
      response: access_granted ? "open_relay" : "close_relay",
      confirmation: access_granted ? "relay_opened" : "access_denied",
      employee_name: employeeName,
      timestamp: new Date().toISOString(),
      reading_id: readingData?.id
    };
    
    console.log('Sending response:', responseData);
    
    return new Response(
      JSON.stringify(responseData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ 
        response: "close_relay", 
        error: "Sunucu hatası: " + (error.message || 'Bilinmeyen hata') 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
