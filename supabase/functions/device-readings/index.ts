
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
  return apiKey === validApiKey && validApiKey !== undefined && validApiKey !== ''
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // API Key validation
    const apiKey = req.headers.get('x-api-key')
    if (!validateApiKey(apiKey)) {
      return new Response(
        JSON.stringify({ 
          response: "close_relay", 
          error: "Geçersiz API anahtarı" 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Proceed only for POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ 
          response: "close_relay", 
          error: "Sadece POST istekleri desteklenir" 
        }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const body = await req.json()
    console.log('Received device data:', body)

    // Parse fields expected from the device configuration screen
    // Format shown: {"user_id,serial": "%T,3505234822042881"}
    let userId = null, cardNo = null;

    if (body["user_id,serial"]) {
      // Split the combined string value by comma
      const parts = body["user_id,serial"].split(',');
      if (parts.length === 2) {
        // First part is user_id (device ID) with %T prefix
        userId = parts[0].replace('%T', '');
        // Second part is the card number/serial
        cardNo = parts[1];
      }
    } else {
      // Fallback to the original format
      userId = body.user_id;
      cardNo = body.card_no;
    }

    // Validate required fields
    if (!cardNo || !userId) {
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

    // Check if device exists & update last_seen
    let deviceData: any = null;
    const { data: existingDevice, error: deviceError } = await supabaseAdmin
      .from('server_devices')
      .select('id, name')
      .eq('ip_address', userId)
      .single()

    if (deviceError) {
      // If device not found, add it
      if (deviceError.code === 'PGRST116') {
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
          console.error('Yeni cihaz ekleme hatası:', insertError)
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
        console.error('Cihaz sorgulama hatası:', deviceError)
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
    }

    // Always update device last_seen
    await supabaseAdmin
      .from('server_devices')
      .update({ last_seen: new Date().toISOString() })
      .eq('ip_address', userId)

    // Find employee by card number
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
      console.log(`Card ${cardNo} identified as employee: ${employeeName}`)
    } else {
      console.log(`Card ${cardNo} not found or error:`, employeeError)
    }

    // Insert card reading record
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
      console.error('Kart okutma kaydı hatası:', readingError)
      return new Response(
        JSON.stringify({ 
          response: "close_relay", 
          error: "Kart okutma işlemi kaydedilemedi" 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Return response based on access_granted status in the format expected by the device
    return new Response(
      JSON.stringify({
        response: access_granted ? "open_relay" : "close_relay",
        confirmation: access_granted ? "relay_opened" : "access_denied",
        employee_name: employeeName,
        timestamp: new Date().toISOString(),
        reading_id: readingData?.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ 
        response: "close_relay", 
        error: "Sunucu hatası" 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
