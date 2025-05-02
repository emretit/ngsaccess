
// Follow this setup guide to integrate the Deno runtime into your application:
// https://deno.com/manual/getting_started/setup_your_environment

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.2'

// CORS headers for browser clients
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
        JSON.stringify({ error: 'Geçersiz API anahtarı' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Proceed only for POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Sadece POST istekleri desteklenir' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const body = await req.json()
    console.log('Received device data:', body)

    // Validate required fields
    if (!body.card_no || !body.device_id || !body.user_id) {
      return new Response(
        JSON.stringify({ 
          response: "close_relay", 
          error: "Eksik veri: card_no, device_id ve user_id gerekli" 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if device exists & update last_seen
    const { data: deviceData, error: deviceError } = await supabaseAdmin
      .from('server_devices')
      .select('id, name')
      .eq('ip_address', body.user_id)
      .single()

    if (deviceError) {
      // If device not found, add it
      if (deviceError.code === 'PGRST116') {
        const { data: newDevice, error: insertError } = await supabaseAdmin
          .from('server_devices')
          .insert({
            name: `Cihaz-${body.user_id}`,
            ip_address: body.user_id,
            status: 'active',
            last_seen: new Date().toISOString(),
            device_model_enum: "Access Control Terminal",
            serial_number: body.device_id.toString()
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
    }

    // Always update device last_seen
    await supabaseAdmin
      .from('server_devices')
      .update({ last_seen: new Date().toISOString() })
      .eq('ip_address', body.user_id)

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
        device_name: deviceData?.name || `Cihaz-${body.user_id}`,
        device_location: body.location || "",
        device_ip: body.user_id,
        device_serial: body.device_id.toString(),
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

    // Return response based on access_granted status
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
