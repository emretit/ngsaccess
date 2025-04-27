
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const extractDepartment = (query) => {
  console.log("Extracting department from query:", query);
  
  // First try to match department patterns with "departman" keyword
  const departmentPatterns = [
    /(\w+)\s+departman[ıi]/i,   // Match "X departmanı"
    /departman\s+(\w+)/i,       // Match "departman X"
    /(\w+)\s+bölümü/i,         // Match "X bölümü"
    /bölüm\s+(\w+)/i           // Match "bölüm X"
  ];
  
  for (const pattern of departmentPatterns) {
    const match = query.match(pattern);
    if (match && match[1]) {
      console.log(`Found department via pattern: ${match[1]}`);
      return match[1].toLowerCase();
    }
  }
  
  // Try to match exact department names - extensive list with both Turkish and English names
  const commonDepartments = [
    { tr: 'mühendislik', en: 'engineering' },
    { tr: 'finans', en: 'finance' },
    { tr: 'insan kaynakları', en: 'hr', alt: 'human resources' },
    { tr: 'satış', en: 'sales' },
    { tr: 'pazarlama', en: 'marketing' },
    { tr: 'bilgi teknolojileri', en: 'it', alt: 'information technology' },
    { tr: 'yönetim', en: 'management' },
    { tr: 'muhasebe', en: 'accounting' },
    { tr: 'üretim', en: 'production' },
    { tr: 'lojistik', en: 'logistics' },
    { tr: 'araştırma', en: 'research' },
    { tr: 'hukuk', en: 'legal' }
  ];
  
  const queryLower = query.toLowerCase();
  
  for (const dept of commonDepartments) {
    // Check for Turkish name
    if (queryLower.includes(dept.tr)) {
      console.log(`Found department via Turkish name: ${dept.tr}`);
      return dept.tr;
    }
    
    // Check for English name
    if (queryLower.includes(dept.en)) {
      console.log(`Found department via English name: ${dept.en}`);
      return dept.en;
    }
    
    // Check for alternate name if exists
    if (dept.alt && queryLower.includes(dept.alt)) {
      console.log(`Found department via alternate name: ${dept.alt}`);
      return dept.en;
    }
  }
  
  // If we reach here, no department was found
  console.log("No department found in query");
  return null;
}

const extractMonth = (query) => {
  const months = {
    'ocak': '01', 'january': '01',
    'şubat': '02', 'february': '02',
    'mart': '03', 'march': '03',
    'nisan': '04', 'april': '04',
    'mayıs': '05', 'may': '05',
    'haziran': '06', 'june': '06',
    'temmuz': '07', 'july': '07',
    'ağustos': '08', 'august': '08',
    'eylül': '09', 'september': '09',
    'ekim': '10', 'october': '10',
    'kasım': '11', 'november': '11',
    'aralık': '12', 'december': '12'
  };
  
  for (const [month, num] of Object.entries(months)) {
    if (query.toLowerCase().includes(month.toLowerCase())) {
      return num;
    }
  }
  
  return null;
}

const getCurrentMonthAsString = () => {
  const now = new Date();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  return month;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    console.log("Received query:", query);

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Extract potential filters from the query
    const departmentFilter = extractDepartment(query);
    const monthFilter = extractMonth(query) || getCurrentMonthAsString();
    
    console.log("Extracted filters:", { departmentFilter, monthFilter });

    // Base query that joins with departments
    let supabaseQuery = supabaseClient
      .from('card_readings')
      .select(`
        *,
        employees (
          first_name,
          last_name,
          department:departments (name)
        )
      `)
      .order('access_time', { ascending: false });

    // Apply department filter if present
    if (departmentFilter) {
      console.log(`Filtering by department containing: ${departmentFilter}`);
      
      // Make partial matching more flexible - use double wildcards for partial matching
      supabaseQuery = supabaseQuery.filter('employees.departments.name', 'ilike', `%${departmentFilter}%`);
      
      // Debug with a log to see the actual SQL being generated
      console.log(`SQL filter: employees.departments.name ilike %${departmentFilter}%`);
    }

    // Execute the query
    const { data, error } = await supabaseQuery;
    
    if (error) {
      console.error("Database query error:", error.message);
      throw error;
    }

    console.log(`Query returned ${data?.length || 0} records`);
    
    // If no data found, return an appropriate message
    if (!data || data.length === 0) {
      // More detailed explanation about what filters were attempted
      const filterExplanation = departmentFilter 
        ? `departman: "${departmentFilter}"` 
        : "departman filtresi belirtilmedi";
        
      return new Response(
        JSON.stringify({
          data: [],
          explanation: `Sorgunuz için kayıt bulunamadı (${filterExplanation}).`,
          message: 'Veri bulunamadı. Lütfen farklı bir sorgu deneyin.'
        }),
        { 
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        },
      );
    }

    // Transform the data for the report table
    const formattedData = data.map(record => ({
      name: record.employee_name || `${record.employees?.first_name || ''} ${record.employees?.last_name || ''}`.trim() || 'Bilinmeyen',
      check_in: record.access_time,
      department: record.employees?.department?.name || '-',
      device: record.device_name || '-',
      location: record.device_location || '-'
    }));

    // Generate an explanation based on filters
    let explanation = 'İşte ';
    if (departmentFilter) {
      explanation += `${departmentFilter} departmanı için `;
    }
    explanation += `giriş kayıtları.`;

    return new Response(
      JSON.stringify({
        data: formattedData,
        explanation: explanation,
        message: 'Veriler başarıyla getirildi.'
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );

  } catch (error) {
    console.error('Error:', error.message);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        data: []
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  }
})
