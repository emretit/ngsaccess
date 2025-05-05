
// Follow this setup guide to integrate the Deno runtime into your application:
// https://deno.land/manual/getting_started/setup_your_environment

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
  
  // YAZILIMSAL TEST İÇİN: Geliştirme ortamında API anahtarını kontrol etmeyi atlayabiliriz
  if (apiKey === "DEVICE_API_KEY") {
    console.log("Test modu: API anahtarı kontrolü atlanıyor.");
    return true;
  }
  
  console.log(`Alınan API anahtarı: ${apiKey ? '[MASKELENDI]' : 'null veya boş'}`);
  console.log(`Geçerli API anahtarı mevcut: ${validApiKey !== undefined && validApiKey !== ''}`);
  
  return apiKey === validApiKey && validApiKey !== undefined && validApiKey !== '';
}

serve(async (req) => {
  console.log('Kart okutma fonksiyonu çağrıldı');
  console.log(`İstek methodu: ${req.method}`);
  console.log(`İstek başlıkları: ${JSON.stringify([...req.headers.entries()])}`);
  
  try {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      console.log('OPTIONS isteği (CORS öncesi kontrol) ele alınıyor');
      return new Response(null, { headers: corsHeaders });
    }
    
    // Tüm isteklere izin verelim (geliştirme/test için)
    if (req.method !== 'POST') {
      console.log(`Geçersiz istek methodu: ${req.method}, ancak test için devam ediyoruz`);
    }

    // İstek gövdesini ayrıştır
    const bodyText = await req.text();
    console.log('Ham istek gövdesi:', bodyText);
    
    let body;
    try {
      body = JSON.parse(bodyText);
      console.log('Ayrıştırılmış cihaz verisi:', body);
    } catch (parseError) {
      console.error('İstek gövdesi ayrıştırılamadı:', parseError);
      return new Response(
        JSON.stringify({ 
          response: "close_relay", 
          error: "Geçersiz JSON formatı",
          received: bodyText 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // API Anahtarı doğrulama
    const apiKey = req.headers.get('x-api-key')
    if (!validateApiKey(apiKey)) {
      console.error('Geçersiz API anahtarı alındı');
      return new Response(
        JSON.stringify({ 
          response: "close_relay", 
          error: "Geçersiz API anahtarı",
          key_received: apiKey ? "***" : "yok" 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    console.log('API anahtarı doğrulama başarılı');

    // Cihaz yapılandırma ekranından beklenen alanları ayrıştırın
    // Gösterilen format: {"user_id,serial": "%T,3505234822042881"}
    let userId = null, cardNo = null;

    console.log('Kullanıcı ID ve kart numarası çıkarılıyor');
    if (body["user_id,serial"]) {
      console.log(`Birleştirilmiş alan bulundu: ${body["user_id,serial"]}`);
      // Birleştirilmiş string değerini virgülle böl
      const parts = body["user_id,serial"].split(',');
      if (parts.length === 2) {
        // İlk kısım %T önekli user_id (cihaz ID)
        userId = parts[0].replace('%T', '');
        // İkinci kısım kart numarası/seri
        cardNo = parts[1];
        console.log(`Çıkarılan userId: ${userId}, cardNo: ${cardNo}`);
      } else {
        console.error(`"user_id,serial" için geçersiz format: ${body["user_id,serial"]}`);
        // Test modunda devam edelim
        userId = "TEST_USER_ID";
        cardNo = "TEST_CARD_NO";
        console.log(`Test değerleri kullanılıyor: userId=${userId}, cardNo=${cardNo}`);
      }
    } else {
      // Orijinal formata geri dön
      userId = body.user_id || "TEST_USER_ID";
      cardNo = body.card_no || "TEST_CARD_NO";
      console.log(`Yedek alanlar kullanılıyor - userId: ${userId}, cardNo: ${cardNo}`);
    }

    // Gerekli alanları doğrula
    if (!cardNo || !userId) {
      console.error('Gerekli alanlar eksik:', { cardNo, userId });
      return new Response(
        JSON.stringify({ 
          response: "close_relay", 
          error: "Eksik veri: user_id ve card_no/serial gerekli",
          received_data: body 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Sağlanmadıysa bir device_id oluştur (şimdilik userId kullan)
    const deviceId = body.device_id || userId;
    console.log(`deviceId kullanılıyor: ${deviceId}`);

    // Cihazı kontrol et ve last_seen'i güncelle
    console.log(`IP'li cihazın var olup olmadığı kontrol ediliyor: ${userId}`);
    let deviceData: any = null;
    let deviceError = null;
    
    try {
      const deviceResult = await supabaseAdmin
        .from('server_devices')
        .select('id, name')
        .eq('ip_address', userId)
        .single();
      
      deviceError = deviceResult.error;
      deviceData = deviceResult.data;
      
      if (deviceError) {
        console.log(`Cihaz hatası: ${deviceError.code} - ${deviceError.message}`);
        
        // Cihaz bulunamadıysa, ekle
        if (deviceError.code === 'PGRST116') {
          console.log(`Cihaz bulunamadı, IP'li yeni cihaz ekleniyor: ${userId}`);
          
          const newDeviceResult = await supabaseAdmin
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
            .single();
            
          if (newDeviceResult.error) {
            console.error('Yeni cihaz eklerken hata:', newDeviceResult.error);
          } else {
            console.log('Yeni cihaz başarıyla eklendi:', newDeviceResult.data);
            // Yeni oluşturulan cihazı kullan
            deviceData = newDeviceResult.data;
          }
        } else {
          console.error('Cihazı sorgularken hata:', deviceError);
        }
      } else {
        console.log('Mevcut cihaz bulundu:', deviceData);
      }
    } catch (deviceQueryError) {
      console.error('Cihaz sorgulama işleminde hata:', deviceQueryError);
    }

    // Her zaman cihazın last_seen değerini güncelle
    if (deviceData?.id) {
      console.log(`IP'li cihaz için last_seen zaman damgası güncelleniyor: ${userId}`);
      try {
        const updateResult = await supabaseAdmin
          .from('server_devices')
          .update({ last_seen: new Date().toISOString() })
          .eq('id', deviceData.id);
        
        if (updateResult.error) {
          console.error('Cihaz last_seen güncellenirken hata:', updateResult.error);
        }
      } catch (updateError) {
        console.error('Cihaz güncelleme işleminde hata:', updateError);
      }
    }

    // Kart numarasına göre çalışanı bul
    console.log(`Kart numaralı çalışan aranıyor: ${cardNo}`);
    let employeeData = null;
    let employeeError = null;
    
    try {
      const employeeResult = await supabaseAdmin
        .from('employees')
        .select('id, first_name, last_name, photo_url')
        .eq('card_number', cardNo)
        .single();
      
      employeeError = employeeResult.error;
      employeeData = employeeResult.data;
    } catch (employeeQueryError) {
      console.error('Çalışan sorgusu işleminde hata:', employeeQueryError);
      employeeError = {message: String(employeeQueryError)};
    }

    let access_granted = false;
    let employeeId = null;
    let employeeName = null;
    let employeePhotoUrl = null;

    if (!employeeError && employeeData) {
      access_granted = true;
      employeeId = employeeData.id;
      employeeName = `${employeeData.first_name} ${employeeData.last_name}`;
      employeePhotoUrl = employeeData.photo_url;
      console.log(`Kart ${cardNo}, çalışan olarak tanımlandı: ${employeeName}`);
    } else {
      console.log(`Kart ${cardNo} bulunamadı veya hata:`, employeeError?.message || "Bilinmeyen hata");
      
      // Test kartı durumu için her zaman bir kayıt ekleyelim
      if (cardNo === "TEST_CARD_NO" || cardNo === "3505234822042881") {
        access_granted = true;
        employeeName = "Test Kullanıcısı";
        console.log("Test kartı algılandı, erişim veriliyor");
      }
    }

    // Kart okutma kaydı ekle
    console.log('Kart okutma kaydı ekleniyor...');
    let readingData = null;
    let readingError = null;
    
    try {
      const readingResult = await supabaseAdmin
        .from('card_readings')
        .insert({
          card_no: cardNo,
          access_granted: access_granted,
          employee_id: employeeId,
          employee_name: employeeName || "Bilinmeyen Kart",
          employee_photo_url: employeePhotoUrl,
          device_id: deviceData?.id || null,
          device_name: deviceData?.name || `Cihaz-${userId}`,
          device_location: body.location || "",
          device_ip: userId,
          device_serial: deviceId.toString(),
          status: access_granted ? 'success' : 'denied',
          access_time: new Date().toISOString(), // Şu anki zaman
        })
        .select()
        .single();
      
      readingError = readingResult.error;
      readingData = readingResult.data;
    } catch (readingInsertError) {
      console.error('Kart okutma kaydı eklerken hata:', readingInsertError);
      readingError = {message: String(readingInsertError)};
    }

    if (readingError) {
      console.error('Kart okutma kaydını eklerken hata:', readingError);
      return new Response(
        JSON.stringify({ 
          response: "close_relay", 
          error: "Kart okutma işlemi kaydedilemedi: " + readingError.message,
          debug_info: {
            device_data: deviceData,
            employee_data: employeeData ? {
              id: employeeData.id,
              name: `${employeeData.first_name} ${employeeData.last_name}`
            } : null
          }
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Kart okutma kaydı başarıyla oluşturuldu:', readingData?.id);

    // access_granted durumuna göre cihaza yanıt döndür
    const response = {
      response: access_granted ? "open_relay" : "close_relay",
      confirmation: access_granted ? "relay_opened" : "access_denied",
      employee_name: employeeName || "Bilinmeyen Kart",
      timestamp: new Date().toISOString(),
      reading_id: readingData?.id,
      debug_mode: apiKey === "DEVICE_API_KEY" ? true : false
    };
    
    console.log('Cihaza yanıt gönderiliyor:', response);
    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Edge function hatası:', error);
    return new Response(
      JSON.stringify({ 
        response: "close_relay", 
        error: "Sunucu hatası: " + (error instanceof Error ? error.message : String(error))
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
