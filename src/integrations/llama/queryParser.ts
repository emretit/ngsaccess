// PDKS Sorgu çözümleyici
import { supabase } from '../supabase/client';

export interface QueryParams {
    department?: string | null;
    month?: string | null;
    year?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    status?: string | null;
    reportType?: string | null;
    isOnlyDepartment?: boolean; // Sadece departman adı girildi mi?
}

const MONTHS = [
    'ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran',
    'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım', 'aralık'
];

// Departman isimleri için önyükleme değeri (yedek)
let cachedDepartments: string[] = [
    'finans', 'it', 'insan kaynakları', 'satış', 'pazarlama',
    'hukuk', 'yönetim', 'muhasebe', 'ar-ge', 'üretim', 'lojistik', 'operasyon', 'engineering'
];

// Departman verilerinin yüklenip yüklenmediğini takip eden değişken
let departmentsLoaded = false;

// departmentTree tablosundan departman verilerini al
async function loadDepartmentsFromDB(): Promise<string[]> {
    // Eğer departmanlar zaten yüklendiyse tekrar yüklemeye gerek yok
    if (departmentsLoaded) {
        return cachedDepartments;
    }

    try {
        const { data, error } = await supabase
            .from('departments')
            .select('name')
            .order('name');

        if (error) {
            console.error('Departman verileri yüklenirken hata:', error);
            return cachedDepartments; // Hata durumunda ön belleği kullan
        }

        if (data && data.length > 0) {
            // Veritabanından gelen departman isimlerini küçük harfe çevirip sakla
            const departments = data.map(dept => dept.name.toLowerCase());
            cachedDepartments = departments; // Ön belleğe kaydet
            departmentsLoaded = true; // Departmanların yüklendiğini işaretle
            console.log('Departmanlar veritabanından yüklendi:', departments);
            return departments;
        }

        departmentsLoaded = true; // Veri yoksa da yüklemeyi tamamladık sayalım
        return cachedDepartments; // Veri yoksa ön belleği kullan
    } catch (error) {
        console.error('Departman verileri yüklenirken beklenmeyen hata:', error);
        return cachedDepartments; // Hata durumunda ön belleği kullan
    }
}

// İlk yükleme için departmanları getirmeye çalış ama uygulamanın başlamasını engelleme
loadDepartmentsFromDB().catch(error => {
    console.warn('İlk departman yüklemesi sırasında hata, varsayılan değerler kullanılacak:', error);
});

// Departmanları döndüren fonksiyon
function getDepartments(): string[] {
    return cachedDepartments;
}

const REPORT_TYPES = [
    'giriş', 'çıkış', 'gecikme', 'erken çıkış',
    'devamsızlık', 'mesai', 'izin', 'çalışma süreleri'
];

/**
 * Doğal dil sorgudan parametreleri çıkarır
 */
export async function parseQuery(query: string): Promise<QueryParams> {
    const queryLower = query.toLowerCase();
    const params: QueryParams = {};

    // Departman listesini güncellemeye çalış, ama hata olursa devam et
    try {
        await loadDepartmentsFromDB();
    } catch (error) {
        console.warn("Departman verilerini güncellerken hata:", error);
        // Hataya rağmen devam ediyoruz, cachedDepartments kullanılacak
    }

    // Departman tespiti
    params.department = extractDepartment(queryLower);

    // Sadece departman adı mı girildi kontrolü
    // Eğer sorgu tek bir kelime ve o da departman listesindeyse
    if (params.department &&
        queryLower.trim() === params.department.toLowerCase().trim()) {
        params.isOnlyDepartment = true;

        // Varsayılan olarak bugünün tarihini ekle
        const today = new Date().toISOString().split('T')[0];
        params.startDate = today;
        params.endDate = today;

        return params;
    }

    // Ay tespiti
    params.month = extractMonth(queryLower);

    // Yıl tespiti
    params.year = extractYear(queryLower);

    // Tarih aralığı tespiti
    const { startDate, endDate } = extractDateRange(queryLower);
    params.startDate = startDate;
    params.endDate = endDate;

    // Rapor tipi tespiti
    params.reportType = extractReportType(queryLower);

    // Durum tespiti (geç gelme, erken çıkma vb.)
    params.status = extractStatus(queryLower);

    return params;
}

/**
 * Sorgudan departmanı çıkarır
 */
function extractDepartment(query: string): string | null {
    const departments = getDepartments();

    for (const department of departments) {
        if (query.includes(department)) {
            return department;
        }

        // Departman + departmanı/bölümü şeklindeki kullanımları yakala
        if (query.includes(`${department} departman`) ||
            query.includes(`${department} bölüm`)) {
            return department;
        }
    }

    return null;
}

/**
 * Sorgudan ayı çıkarır
 */
function extractMonth(query: string): string | null {
    for (let i = 0; i < MONTHS.length; i++) {
        const month = MONTHS[i];
        if (query.includes(month)) {
            // Ay indeksini 1'den başlayacak şekilde döndür (1-12)
            return (i + 1).toString().padStart(2, '0');
        }
    }

    // "Bu ay" ifadesi için mevcut ayı kullan
    if (query.includes('bu ay')) {
        const currentMonth = new Date().getMonth() + 1;
        return currentMonth.toString().padStart(2, '0');
    }

    // "Geçen ay" ifadesi için bir önceki ayı kullan
    if (query.includes('geçen ay')) {
        // JavaScript'te getMonth() 0-11 arası değer döndürür
        const previousMonth = new Date().getMonth();
        return (previousMonth === 0 ? 12 : previousMonth).toString().padStart(2, '0');
    }

    return null;
}

/**
 * Sorgudan yılı çıkarır
 */
function extractYear(query: string): string | null {
    // 4 basamaklı yılları tespit et (2020, 2021, vb.)
    const yearMatch = query.match(/\b(20\d{2})\b/);
    if (yearMatch) {
        return yearMatch[1];
    }

    // "Bu yıl" ifadesi için mevcut yılı kullan
    if (query.includes('bu yıl')) {
        return new Date().getFullYear().toString();
    }

    // "Geçen yıl" ifadesi için bir önceki yılı kullan
    if (query.includes('geçen yıl')) {
        return (new Date().getFullYear() - 1).toString();
    }

    // Varsayılan olarak mevcut yılı kullan
    return new Date().getFullYear().toString();
}

/**
 * Sorgudan tarih aralığını çıkarır
 */
function extractDateRange(query: string): { startDate: string | null, endDate: string | null } {
    // Bugün
    if (query.includes('bugün')) {
        const today = new Date().toISOString().split('T')[0];
        return { startDate: today, endDate: today };
    }

    // Dün
    if (query.includes('dün')) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        return { startDate: yesterdayStr, endDate: yesterdayStr };
    }

    // Bu hafta
    if (query.includes('bu hafta')) {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)); // Pazartesi başlangıç

        return {
            startDate: startOfWeek.toISOString().split('T')[0],
            endDate: today.toISOString().split('T')[0]
        };
    }

    // Geçen hafta
    if (query.includes('geçen hafta')) {
        const today = new Date();
        const dayOfWeek = today.getDay();

        const endOfLastWeek = new Date(today);
        endOfLastWeek.setDate(today.getDate() - dayOfWeek - (dayOfWeek === 0 ? 0 : 1));

        const startOfLastWeek = new Date(endOfLastWeek);
        startOfLastWeek.setDate(endOfLastWeek.getDate() - 6);

        return {
            startDate: startOfLastWeek.toISOString().split('T')[0],
            endDate: endOfLastWeek.toISOString().split('T')[0]
        };
    }

    // Ay bazlı tarih aralığı
    const month = extractMonth(query);
    const year = extractYear(query);

    if (month && year) {
        const startOfMonth = `${year}-${month}-01`;

        // Ay sonunu hesapla
        const nextMonth = parseInt(month) === 12 ? 1 : parseInt(month) + 1;
        const nextMonthYear = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year);
        const endOfMonth = new Date(`${nextMonthYear}-${nextMonth.toString().padStart(2, '0')}-01`);
        endOfMonth.setDate(endOfMonth.getDate() - 1);

        return {
            startDate: startOfMonth,
            endDate: endOfMonth.toISOString().split('T')[0]
        };
    }

    return { startDate: null, endDate: null };
}

/**
 * Sorgudan rapor tipini çıkarır
 */
function extractReportType(query: string): string | null {
    for (const type of REPORT_TYPES) {
        if (query.includes(type)) {
            return type;
        }
    }

    // Genel "rapor" kelimesi varsa, varsayılan olarak "giriş-çıkış" tipini döndür
    if (query.includes('rapor')) {
        return 'giriş-çıkış';
    }

    return null;
}

/**
 * Sorgudan durum bilgisini çıkarır (geç gelme, erken çıkma vb.)
 */
function extractStatus(query: string): string | null {
    if (query.includes('geç') || query.includes('gecikme')) {
        return 'late';
    }

    if (query.includes('erken çık')) {
        return 'early-leave';
    }

    if (query.includes('devamsız') || query.includes('gelmeyen')) {
        return 'absent';
    }

    if (query.includes('izin')) {
        return 'leave';
    }

    if (query.includes('mesai')) {
        return 'overtime';
    }

    return null;
} 