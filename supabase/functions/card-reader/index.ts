
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS başlıkları
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Log girdilerini ekleyelim
  console.log('İstek URL:', req.url);
  console.log('İstek Metodu:', req.method);
  console.log('İstek Headers:', JSON.stringify(req.headers));
  console.log('İstek IP Adresi:', req.headers.get('x-forwarded-for'));

  // CORS ön kontrol istekleri için
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Sadece POST isteklerine izin ver
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    // Supabase istemcisi oluştur
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    // İstek gövdesini ayrıştır
    let requestData;
    try {
      requestData = await req.json();
      console.log('Ham İstek Gövdesi:', JSON.stringify(requestData));
    } catch (error) {
      console.error('İstek gövdesi ayrıştırma hatası:', error);
      return new Response(JSON.stringify({
        response: "error", 
        error: 'Geçersiz JSON'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Kart ID ve seri numarasını çıkar
    // Format user_id,serial (örneğin 3505234822042881,DEVICE123)
    let cardId = '';
    let deviceSerial = '';

    // Farklı format türlerini kontrol et
    if (requestData['user_id,serial']) {
      // Format "user_id,serial": "3505234822042881,DEVICE123" ise
      const parts = requestData['user_id,serial'].toString().split(',');
      cardId = parts[0];
      deviceSerial = parts.length > 1 ? parts[1] : '';
    } else if (typeof requestData.user_id === 'string' && requestData.user_id.includes(',')) {
      // Format "user_id": "3505234822042881,DEVICE123" ise
      const parts = requestData.user_id.split(',');
      cardId = parts[0];
      deviceSerial = parts.length > 1 ? parts[1] : '';
    } else {
      // Düz user_id veya card_id formatı ise
      cardId = requestData.user_id || requestData.card_id;
      deviceSerial = requestData.serial || '';
    }

    // Parse edilmiş veriyi göster
    console.log('Parse Edilmiş İstek:', JSON.stringify({ user_id: cardId, serial: deviceSerial }));

    if (!cardId) {
      return new Response(JSON.stringify({
        response: "error",
        error: 'user_id gerekli'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Kart numarasına göre çalışanı bul
    try {
      const { data: employee, error: employeeError } = await supabaseClient
        .from('employees')
        .select('id, first_name, last_name, access_permission, photo_url')
        .eq('card_number', cardId)
        .single();

      if (employeeError && employeeError.code !== 'PGRST116') { // PGRST116 "kayıt bulunamadı" hatası
        console.error('Çalışan bulunurken hata:', employeeError);
      }

      // Çalışan bulunamadıysa varsayılan değerler
      const employeeId = employee?.id || null;
      const employeeName = employee ? `${employee.first_name} ${employee.last_name}` : null;
      const accessGranted = employee?.access_permission || false;
      const photoUrl = employee?.photo_url || null;

      // Kart okutma kaydı oluştur
      const { data: reading, error: readingError } = await supabaseClient
        .from('card_readings')
        .insert({
          card_no: cardId,
          access_granted: accessGranted,
          employee_id: employeeId,
          employee_name: employeeName,
          employee_photo_url: photoUrl,
          status: accessGranted ? 'success' : 'denied',
          device_name: requestData.device_name || 'Kart Okuyucu Cihaz',
          device_location: requestData.device_location || 'API Endpoint',
          device_serial: deviceSerial || 'UNKNOWN',
          raw_data: JSON.stringify(requestData)
        })
        .select();

      if (readingError) {
        console.error('Kart okutma kaydı oluştururken hata:', readingError);
        return new Response(JSON.stringify({
          response: "error",
          error: 'Kart okutma işlemi başarısız'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Cihaz beklentilerine göre yanıt formatı
      // Cihaz tam olarak bu formatta yanıt bekliyor
      const responseData = {
        response: accessGranted ? "open_relay" : "close_relay",
        name: employeeName
      };

      console.log('Sending response:', JSON.stringify(responseData));
      
      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } catch (err) {
      console.error('Supabase lookup error:', err);
      return new Response(JSON.stringify({
        response: "error",
        error: 'Database error'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({
      response: "error",
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
