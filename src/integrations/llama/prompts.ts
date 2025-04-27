// PDKS AI Rapor Asistanı için prompt şablonları

export interface PromptTemplate {
    name: string;
    description: string;
    template: string;
    examples: string[];
}

// Sistem prompt - Modelin genel davranışını belirler
export const SYSTEM_PROMPT = `Sen bir PDKS (Personel Devam Kontrol Sistemi) rapor asistanısın. Görevin, kullanıcıların doğal dil sorguları ile personel giriş-çıkış kayıtları hakkında bilgi almalarına yardımcı olmaktır.

Veritabanında şu bilgilere erişimin var:
- Çalışanlar (isim, soyisim, departman)
- Departmanlar (isim)
- Giriş-çıkış kayıtları (çalışan, tarih-saat, cihaz, konum)

Yanıtların her zaman nazik, kısa ve öz olmalı. Veri yoksa bunu belirtmelisin. Rapor sonuçlarını Excel veya PDF olarak indirmeyi önerebilirsin.

Eğer kullanıcı sadece bir departman adı yazarsa (örneğin "Engineering"), bu departmandaki tüm çalışanların güncel giriş-çıkış kayıtlarını listele.`;

// Prompt şablonları
export const promptTemplates: PromptTemplate[] = [
    {
        name: "departman_raporu",
        description: "Belirli bir departmanın giriş-çıkış raporunu alma",
        template: "{{departman}} departmanı {{tarih}} raporu",
        examples: [
            "Finans departmanı mart ayı raporu",
            "IT departmanı bugünkü giriş kayıtları",
            "İnsan Kaynakları departmanı geçen hafta raporu",
            "Engineering departmanı"
        ]
    },
    {
        name: "tarih_araligi_raporu",
        description: "Belirli bir tarih aralığı için rapor alma",
        template: "{{başlangıç_tarihi}} ile {{bitiş_tarihi}} arası {{departman}} raporu",
        examples: [
            "1 Mart ile 15 Mart arası Finans departmanı raporu",
            "Geçen ay tüm departmanlar raporu",
            "Bu hafta IT departmanı raporu"
        ]
    },
    {
        name: "gecikme_raporu",
        description: "Gecikme veya erken çıkış raporu alma",
        template: "{{departman}} {{tarih}} gecikme raporu",
        examples: [
            "Bu ay geç gelen çalışanlar listesi",
            "Finans departmanı erken çıkış raporu",
            "Geçen hafta IT departmanı gecikme raporu"
        ]
    },
    {
        name: "devamsizlik_raporu",
        description: "Devamsızlık raporu alma",
        template: "{{departman}} {{tarih}} devamsızlık raporu",
        examples: [
            "Bu ay gelmeyenler listesi",
            "Finans departmanı mart ayı devamsızlık raporu",
            "Geçen hafta izin alanlar"
        ]
    },
    {
        name: "calisma_saatleri_raporu",
        description: "Çalışma saatleri raporu alma",
        template: "{{departman}} {{tarih}} çalışma saatleri raporu",
        examples: [
            "Finans departmanı mart ayı çalışma saatleri",
            "Bu ay çalışma süreleri raporu",
            "Geçen hafta mesai raporu"
        ]
    }
];

// Sorguları formatlama fonksiyonu
export function formatQuery(userInput: string): string {
    // Türkçe karakterleri normalize et
    const normalizedInput = userInput
        .toLowerCase()
        .replace(/ı/g, 'i')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c');

    // Tarih referanslarını standardize et
    let formattedInput = normalizedInput
        .replace(/bugün/g, new Date().toLocaleDateString('tr-TR'))
        .replace(/dün/g, new Date(Date.now() - 86400000).toLocaleDateString('tr-TR'))
        .replace(/bu hafta/g, 'son 7 gün')
        .replace(/geçen hafta/g, '7-14 gün arası')
        .replace(/bu ay/g, new Date().toLocaleString('tr-TR', { month: 'long' }))
        .replace(/geçen ay/g, new Date(new Date().setMonth(new Date().getMonth() - 1)).toLocaleString('tr-TR', { month: 'long' }));

    return formattedInput;
} 