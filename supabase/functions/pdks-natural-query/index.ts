
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Supabase istemcisini başlat
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Ay isimlerini sayılara çevirmek için yardımcı fonksiyon
const aylarMap: Record<string, string> = {
  'ocak': '01', 'şubat': '02', 'mart': '03', 'nisan': '04', 'mayıs': '05', 'haziran': '06',
  'temmuz': '07', 'ağustos': '08', 'eylül': '09', 'ekim': '10', 'kasım': '11', 'aralık': '12'
};

serve(async (req) => {
  // CORS kontrolleri
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // İstek parametrelerini al
    const { query } = await req.json();
    const queryLower = query.toLowerCase();
    
    console.log(`Alınan sorgu: ${queryLower}`);

    // Departman adını çıkart (varsa)
    let departmentFilter = null;
    const departmanMatches = queryLower.match(/(finans|bilgi teknolojileri|insan kaynakları|muhasebe|satış|pazarlama|üretim|ar-ge|lojistik) departman[ıi]?/);
    if (departmanMatches) {
      departmentFilter = departmanMatches[1];
      console.log(`Departman filtresi: ${departmentFilter}`);
    }

    // Ay bilgisini çıkart (varsa)
    let monthFilter = null;
    let yearFilter = new Date().getFullYear().toString(); // Varsayılan olarak bu yıl
    
    for (const ay in aylarMap) {
      if (queryLower.includes(ay)) {
        monthFilter = aylarMap[ay];
        console.log(`Ay filtresi: ${ay} (${monthFilter})`);
        break;
      }
    }
    
    // Yıl bilgisini çıkart (varsa)
    const yearMatches = queryLower.match(/20[0-9]{2}/);
    if (yearMatches) {
      yearFilter = yearMatches[0];
      console.log(`Yıl filtresi: ${yearFilter}`);
    }

    // Hiçbir filtre bulunamadıysa
    if (!departmentFilter && !monthFilter) {
      return new Response(
        JSON.stringify({
          error: 'Filtreleme kriterleri bulunamadı',
          explanation: "Sorgunuzda departman veya tarih belirterek daha spesifik bir arama yapabilirsiniz. Örneğin: 'Finans departmanı mart ayı giriş raporu'"
        }), 
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Temel sorguyu oluştur
    let supabaseQuery = supabaseClient
      .from('card_readings')
      .select(`
        id,
        access_time,
        employee_name,
        device_name,
        device_location,
        status,
        employees:employee_id(
          department:departments(name)
        )
      `);
    
    // Filtreleri ekle
    if (departmentFilter) {
      supabaseQuery = supabaseQuery.eq('employees.department.name', departmentFilter);
    }

    if (monthFilter) {
      const startDate = `${yearFilter}-${monthFilter}-01T00:00:00`;
      
      // Ay sonunu hesapla
      let nextMonth = parseInt(monthFilter) + 1;
      let nextMonthYear = parseInt(yearFilter);
      if (nextMonth > 12) {
        nextMonth = 1;
        nextMonthYear++;
      }
      const nextMonthStr = nextMonth < 10 ? `0${nextMonth}` : `${nextMonth}`;
      const endDate = `${nextMonthYear}-${nextMonthStr}-01T00:00:00`;
      
      supabaseQuery = supabaseQuery.gte('access_time', startDate).lt('access_time', endDate);
    }

    // Erişim zamanına göre sırala
    supabaseQuery = supabaseQuery.order('access_time', { ascending: false });

    // Sorguyu çalıştır
    console.log("Sorgu yapılıyor...");
    const { data, error } = await supabaseQuery;

    if (error) {
      console.error("Sorgu hatası:", error);
      throw error;
    }

    console.log(`${data?.length || 0} kayıt bulundu`);

    if (!data || data.length === 0) {
      return new Response(
        JSON.stringify({
          records: [],
          explanation: "Arama kriterlerine uygun kayıt bulunamadı."
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Yanıt verisini formatla
    const formattedResponse = data?.map(record => {
      // Giriş saati
      const accessTime = new Date(record.access_time);
      
      // Departman adını çıkart
      let departmentName = 'Bilinmiyor';
      if (record.employees && record.employees.department) {
        departmentName = record.employees.department.name;
      }
      
      return {
        name: record.employee_name || 'Bilinmiyor',
        check_in: record.access_time,
        check_out: null, // Çıkış bilgisi giriş/çıkış mantığına göre işlenecek
        department: departmentName 
      };
    }) || [];

    // Mantıklı açıklama oluştur
    let explanation = "İşte sorgunuza göre rapor sonuçları";
    if (departmentFilter && monthFilter) {
      const ayIsimleri = Object.keys(aylarMap).find(key => aylarMap[key] === monthFilter);
      explanation = `${departmentFilter.charAt(0).toUpperCase() + departmentFilter.slice(1)} departmanı için ${ayIsimleri} ${yearFilter} dönemine ait giriş kayıtları`;
    } else if (departmentFilter) {
      explanation = `${departmentFilter.charAt(0).toUpperCase() + departmentFilter.slice(1)} departmanı için giriş kayıtları`;
    } else if (monthFilter) {
      const ayIsimleri = Object.keys(aylarMap).find(key => aylarMap[key] === monthFilter);
      explanation = `${ayIsimleri} ${yearFilter} dönemine ait giriş kayıtları`;
    }

    return new Response(JSON.stringify({ 
      records: formattedResponse,
      explanation: explanation
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('PDKS doğal dil sorgusu hatası:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        explanation: "Üzgünüm, sorgunuzu işlerken bir hata oluştu." 
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
