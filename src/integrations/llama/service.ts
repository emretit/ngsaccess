import { SYSTEM_PROMPT } from './prompts';
import { parseQuery, QueryParams } from './queryParser';
import { supabase } from '../supabase/client';

// Endpoint bilgileri
const LOCAL_ENDPOINTS = {
    completion: [
        "http://localhost:5050/completion",
        "http://127.0.0.1:5050/completion"
    ],
    status: [
        "http://localhost:5050/status",
        "http://127.0.0.1:5050/status"
    ],
    report: [
        "http://localhost:5050/api/pdks-report",
        "http://127.0.0.1:5050/api/pdks-report"
    ]
};

// Cloud Supabase Function endpoint'leri
const CLOUD_ENDPOINTS = {
    naturalQuery: "https://gjudsghhwmnsnndnswho.supabase.co/functions/v1/pdks-natural-query",
};

/**
 * LLama modelinin durumunu kontrol eder
 */
export async function checkLlamaModelStatus(): Promise<boolean> {
    console.log("Checking LLama model connection...");

    for (const endpoint of LOCAL_ENDPOINTS.status) {
        try {
            console.log(`Trying endpoint: ${endpoint}`);

            const response = await fetch(endpoint, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(3000)
            });

            if (response.ok) {
                const data = await response.json();
                console.log("LLama model connected:", data);
                return true;
            }
        } catch (error) {
            console.warn(`LLama model connection error at ${endpoint}:`, error);
        }
    }

    console.log("LLama model not available");
    return false;
}

/**
 * LLama modeline prompt gönderir ve yanıt alır
 */
export async function sendPromptToLlama(userPrompt: string): Promise<string> {
    // Sistem promptu ile kullanıcı promptunu birleştir
    const fullPrompt = `${SYSTEM_PROMPT}\n\nKullanıcı: ${userPrompt}\n\nAsistan:`;

    for (const endpoint of LOCAL_ENDPOINTS.completion) {
        try {
            console.log(`Sending prompt to LLama at ${endpoint}:`, userPrompt);

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: fullPrompt }),
                signal: AbortSignal.timeout(15000)
            });

            if (response.ok) {
                const data = await response.json();
                console.log("LLama response:", data);
                return data.content;
            }
        } catch (error) {
            console.warn(`LLama completion error at ${endpoint}:`, error);
        }
    }

    throw new Error('LLama modeli ile iletişim kurulamadı.');
}

/**
 * Doğal dil sorgusunu alır, parametreleri çıkarır ve rapor verilerini getirir
 */
export async function processNaturalLanguageQuery(query: string) {
    console.log("Processing natural language query:", query);

    try {
        // 1. Önce yerel çözümleme ile parametreleri çıkar
        let params;
        try {
            params = await parseQuery(query);
        } catch (error) {
            console.error("Error parsing query:", error);
            // Hata durumunda basit bir çözümleme yapalım
            params = {
                department: query.toLowerCase(), // Girilen sorguyu direkt departman adı olarak ele al
                startDate: new Date().toISOString().split('T')[0], // Bugün
                endDate: new Date().toISOString().split('T')[0],
                isOnlyDepartment: true
            };
        }

        console.log("Extracted parameters:", params);

        // 2. Parametrelere göre veritabanı sorgusunu oluştur
        const pdksData = await fetchPdksData(params);

        // 3. Eğer veri bulunamazsa, LLama modeline açıklama için gönder
        if (!pdksData || pdksData.length === 0) {
            return {
                explanation: await generateExplanationForNoData(query, params),
                data: []
            };
        }

        // 4. Veri bulunursa, LLama modeline açıklama için gönder
        const explanation = await generateExplanationForData(query, params, pdksData.length);

        return {
            explanation,
            data: pdksData
        };
    } catch (error) {
        console.error("Natural language query processing error:", error);
        return {
            explanation: `Üzgünüm, sorgunuzu işlerken bir hata oluştu: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}. Lütfen başka bir sorgu deneyin.`,
            data: []
        };
    }
}

/**
 * Parametrelere göre PDKS verilerini getirir
 */
async function fetchPdksData(params: QueryParams) {
    try {
        console.log("Fetching PDKS data with params:", params);

        // 1. Yerel LLama backend'ine bağlan
        for (const endpoint of LOCAL_ENDPOINTS.report) {
            try {
                console.log(`Trying report endpoint: ${endpoint}`);

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: JSON.stringify(params) }),
                    signal: AbortSignal.timeout(5000)
                });

                if (response.ok) {
                    const data = await response.json();
                    console.log("Report data received from local backend:", data.length);
                    return data;
                }
            } catch (error) {
                console.warn(`Local report error at ${endpoint}:`, error);
            }
        }

        // 2. Yerel backend çalışmıyorsa doğrudan Supabase'e bağlan
        console.log("Local backend not available, querying Supabase directly");

        // Base query structure
        let query = supabase.from('card_readings')
            .select('*, employees(first_name, last_name, department:departments(name))');

        // Departman filtresi
        if (params.department) {
            query = query.ilike('employees.department.name', `%${params.department}%`);
        }

        // Tarih aralığı filtresi
        if (params.startDate) {
            query = query.gte('access_time', `${params.startDate}T00:00:00`);
        }

        if (params.endDate) {
            query = query.lt('access_time', `${params.endDate}T23:59:59`);
        }

        // Ay ve yıl filtresi (tarih aralığı belirtilmemişse)
        if (!params.startDate && !params.endDate && params.month && params.year) {
            const month = params.month.padStart(2, '0');
            const startDate = `${params.year}-${month}-01`;

            // Ay sonunu hesapla
            const nextMonth = parseInt(month) === 12 ? '01' : (parseInt(month) + 1).toString().padStart(2, '0');
            const nextMonthYear = parseInt(month) === 12 ? (parseInt(params.year) + 1).toString() : params.year;
            const endDate = `${nextMonthYear}-${nextMonth}-01`;

            query = query.gte('access_time', `${startDate}T00:00:00`);
            query = query.lt('access_time', `${endDate}T00:00:00`);
        }

        // Durum filtresi
        if (params.status) {
            if (params.status === 'late') {
                // Geç gelenler için sorgu
                query = query.gt('late_minutes', 0);
            } else if (params.status === 'early-leave') {
                // Erken çıkanlar için sorgu
                query = query.gt('early_leave_minutes', 0);
            }
        }

        const { data, error } = await query;

        if (error) {
            console.error("Supabase query error:", error);
            throw error;
        }

        if (!data || data.length === 0) {
            return [];
        }

        // Veriyi formatlayarak döndür
        return data.map(record => {
            const employee = record.employees || {};
            const department = employee.department || {};

            return {
                name: `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || 'Bilinmeyen Personel',
                check_in: record.access_time,
                check_out: record.exit_time,
                department_name: department.name || 'Bilinmeyen Departman',
                late_minutes: record.late_minutes,
                early_leave_minutes: record.early_leave_minutes
            };
        });

    } catch (error) {
        console.error("Error fetching PDKS data:", error);
        throw error;
    }
}

/**
 * Veri bulunmadığında açıklama oluşturur
 */
async function generateExplanationForNoData(query: string, params: QueryParams): Promise<string> {
    // Önce yerel LLama modelini kullanmayı dene
    try {
        const isLlamaAvailable = await checkLlamaModelStatus();

        if (isLlamaAvailable) {
            const prompt = `
PDKS sisteminde bir sorgu yaptım ancak hiç kayıt bulunamadı. Lütfen bunun için nazik bir yanıt oluştur.

Sorgu: "${query}"

Çıkarılan parametreler:
${Object.entries(params)
                    .filter(([_, value]) => value !== null && value !== undefined)
                    .map(([key, value]) => `- ${key}: ${value}`)
                    .join('\n')}

Yanıtında şunları belirt:
1. Neden kayıt bulunamadığına dair olası nedenler
2. Kullanıcının nasıl daha iyi bir sorgu yapabileceğine dair öneriler
`;

            return await sendPromptToLlama(prompt);
        }
    } catch (error) {
        console.warn("Error using LLama for no data explanation:", error);
    }

    // LLama kullanılamazsa, basit bir açıklama döndür
    const departmentInfo = params.department ? ` '${params.department}' departmanı için` : '';
    const dateInfo = params.startDate && params.endDate
        ? ` ${new Date(params.startDate).toLocaleDateString('tr-TR')} ile ${new Date(params.endDate).toLocaleDateString('tr-TR')} tarihleri arasında`
        : params.month
            ? ` ${params.month}. ay`
            : '';

    return `Üzgünüm, belirtilen kriterlere uygun kayıt bulunamadı.${departmentInfo}${dateInfo} veri bulunmuyor. Lütfen farklı bir departman veya tarih aralığı seçmeyi deneyin.`;
}

/**
 * Veri bulunduğunda açıklama oluşturur
 */
async function generateExplanationForData(query: string, params: QueryParams, recordCount: number): Promise<string> {
    // Önce yerel LLama modelini kullanmayı dene
    try {
        const isLlamaAvailable = await checkLlamaModelStatus();

        if (isLlamaAvailable) {
            // Özel durum: Sadece departman adı girilmişse
            if (params.isOnlyDepartment && params.department) {
                const prompt = `
Kullanıcı sadece "${params.department}" departmanı adını yazdı ve ben bu departmandaki çalışanların bugünkü giriş-çıkış kayıtlarını gösterdim.
${recordCount} kayıt bulundu.

Bu sonuçları açıklayan kısa bir yanıt oluştur. Departman adını ve bugünün tarihini belirterek başla.
`;
                return await sendPromptToLlama(prompt);
            }

            const prompt = `
PDKS sisteminde bir sorgu yaptım ve ${recordCount} kayıt bulundu. Bu veri için açıklayıcı bir yanıt oluştur.

Sorgu: "${query}"

Çıkarılan parametreler:
${Object.entries(params)
                    .filter(([key, value]) => value !== null && value !== undefined && key !== 'isOnlyDepartment')
                    .map(([key, value]) => `- ${key}: ${value}`)
                    .join('\n')}

Yanıtında şunları belirt:
1. Hangi raporun oluşturulduğuna dair açıklama
2. Toplam kayıt sayısı
3. Kullanıcıya bu raporla ne yapabileceğine dair kısa öneriler (örn. indirme seçenekleri)
`;

            return await sendPromptToLlama(prompt);
        }
    } catch (error) {
        console.warn("Error using LLama for data explanation:", error);
    }

    // LLama kullanılamazsa, basit bir açıklama döndür
    // Özel durum: Sadece departman adı girilmişse
    if (params.isOnlyDepartment && params.department) {
        return `${params.department} departmanı için bugünkü ${recordCount} giriş-çıkış kaydı listelendi. Raporu Excel veya PDF olarak indirebilirsiniz.`;
    }

    const departmentInfo = params.department ? ` ${params.department} departmanı için` : '';
    const dateInfo = params.startDate && params.endDate
        ? ` ${new Date(params.startDate).toLocaleDateString('tr-TR')} ile ${new Date(params.endDate).toLocaleDateString('tr-TR')} tarihleri arasında`
        : params.month
            ? ` ${params.month}. ay için`
            : '';

    return `${departmentInfo}${dateInfo} toplam ${recordCount} kayıt bulundu. Raporu Excel veya PDF olarak indirebilirsiniz.`;
} 