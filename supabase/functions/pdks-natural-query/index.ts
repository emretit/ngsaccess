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

    // Verileri ayrı sorgularla alıp birleştir
    console.log("1. Temel sorgular hazırlanıyor...");

    // Önce card_readings tablosundan verileri al
    let cardReadingsQuery = supabaseClient.from('card_readings').select("*");

    // Ay filtresi varsa ekle
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

      cardReadingsQuery = cardReadingsQuery
        .gte('access_time', startDate)
        .lt('access_time', endDate);
    }

    // Sorguyu çalıştır
    console.log("2. Card readings verilerini alıyorum...");
    const { data: cardReadings, error: cardError } = await cardReadingsQuery.order('access_time', { ascending: false });

    if (cardError) {
      console.error("Card readings sorgu hatası:", cardError);
      throw cardError;
    }

    console.log(`3. ${cardReadings?.length || 0} kart okuma kaydı bulundu`);

    // Departman ID'sini bul
    let departmentId = null;
    if (departmentFilter) {
      console.log(`4. ${departmentFilter} departmanı ID aranıyor...`);
      const { data: deptData, error: deptError } = await supabaseClient
        .from('departments')
        .select('id')
        .eq('name', departmentFilter)
        .single();

      if (deptError) {
        console.error("Departman bulunamadı:", deptError);
      } else if (deptData) {
        departmentId = deptData.id;
        console.log(`5. Departman ID: ${departmentId}`);
      }
    }

    // Sonuçları topla
    const results = [];
    console.log("6. Veriler işleniyor...");

    // Her kart okuma kaydı için gerekli verileri topla
    for (const card of cardReadings || []) {
      const employeeId = card.employee_id;
      if (!employeeId) continue;

      // Çalışan bilgilerini al
      const { data: employeeData, error: empError } = await supabaseClient
        .from('employees')
        .select('*')
        .eq('id', employeeId)
        .single();

      if (empError || !employeeData) continue;

      // Departman filtresi varsa kontrol et
      if (departmentId && employeeData.department_id !== departmentId) {
        continue;
      }

      // Departman adını al
      let departmentName = 'Bilinmiyor';
      if (employeeData.department_id) {
        const { data: deptNameData } = await supabaseClient
          .from('departments')
          .select('name')
          .eq('id', employeeData.department_id)
          .single();

        if (deptNameData) {
          departmentName = deptNameData.name;
        }
      }

      // Sonucu ekle
      results.push({
        name: card.employee_name || `${employeeData.first_name} ${employeeData.last_name}`,
        check_in: card.access_time,
        check_out: null,
        department: departmentName
      });
    }

    console.log(`7. İşlenen sonuç sayısı: ${results.length}`);

    // Yanıtı oluştur
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
      records: results,
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
