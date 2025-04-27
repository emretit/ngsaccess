# PDKS AI Rapor Asistanı Kullanım Kılavuzu

## Genel Bakış

PDKS AI Rapor Asistanı, personel devam kontrol sistemi verilerini doğal dil kullanarak sorgulayabilen ve raporlayabilen bir yapay zeka asistanıdır. Bu araç, LLama büyük dil modeli üzerine inşa edilmiş olup, karmaşık SQL sorguları yazmak yerine basit Türkçe cümlelerle PDKS verilerini analiz etmenizi sağlar.

## Özellikler

- **Doğal Dil İşleme**: Günlük Türkçe dilinde yazılmış sorguları anlayabilme
- **Otomatik Filtre Çıkarımı**: Departman, tarih aralığı, durum vb. bilgileri otomatik tespit etme
- **Rapor Oluşturma**: Sorgulanan verilere göre dinamik raporlar oluşturma
- **Dışa Aktarma**: Excel ve PDF formatlarında rapor indirme imkanı
- **Yerel Model Entegrasyonu**: LLama.cpp üzerinden yerel LLM çalıştırma desteği

## Örnek Sorgular

PDKS AI Rapor Asistanı'na aşağıdaki gibi doğal dil sorguları yazabilirsiniz:

### Departman Bazlı Sorgular
- "Finans departmanı mart ayı giriş kayıtları"
- "IT departmanı geçen hafta raporu"
- "İnsan kaynakları bu ay devamsızlık raporu"

### Tarih Bazlı Sorgular
- "Bugün işe gelenler listesi"
- "Geçen hafta geç kalanlar"
- "1 Mart ile 15 Mart arası tüm departmanlar raporu"

### Durum Bazlı Sorgular
- "Bu ay en çok geç kalan çalışanlar"
- "Finans departmanı erken çıkışlar"
- "IT departmanı bu hafta devamsızlık oranı"

## Sorgu Çözümleme Mantığı

PDKS AI Rapor Asistanı, sorgunuzu aşağıdaki adımlarla işler:

1. **Dil işleme**: Sorgunuzu doğal dil işleme teknikleriyle analiz eder
2. **Parametre çıkarımı**: Departman, tarih, durum bilgilerini tespit eder
3. **Veritabanı sorgusu**: Tespit edilen parametrelere göre PDKS veritabanını sorgular
4. **Rapor oluşturma**: Sonuçları anlamlı bir rapor olarak formatlar
5. **Açıklama ekleme**: Yapay zeka ile rapor sonuçlarını açıklayan bir metin oluşturur

## Teknik Detaylar

PDKS AI Rapor Asistanı iki ana bileşenden oluşur:

### Frontend (React)
- `PDKSAiChat.tsx`: Ana chat arayüzü komponenti
- `useAiChat.ts`: Chat mantığını içeren hook
- Prompt ve sorgu çözümleme modülleri

### Backend (Python/Flask)
- LLama.cpp entegrasyonu ile yerel LLM çalıştırma
- Supabase veritabanı entegrasyonu
- PDKS rapor API'leri

## Sistem Gereksinimleri

### Yerel Model İçin
- LLama.cpp derlenmiş binary
- En az 8GB RAM (16GB önerilir)
- GGUF formatında bir LLM modeli (7B parametre önerilir)

### Bulut Modu İçin
- İnternet erişimi
- Supabase hesabı ve API anahtarları

## Kurulum ve Yapılandırma

1. Yerel model kullanımı için:
   ```
   # .env.local dosyasında şu değişkenleri ayarlayın
   LLAMA_MODEL_PATH=/path/to/your/model.gguf
   LLAMA_CONTEXT_SIZE=4096
   LLAMA_GPU_LAYERS=0  # GPU kullanmak için 1+ girin
   ```

2. Supabase entegrasyonu için:
   ```
   # .env.local dosyasında şu değişkenleri ayarlayın
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-anon-key
   ```

## Sorun Giderme

1. **Yerel model bağlantı hatası**: Server.py servisinin çalışıp çalışmadığını kontrol edin
2. **Boş sonuç kümeleri**: Sorguda kullanılan departman veya tarih bilgilerinin veritabanında mevcut olduğunu doğrulayın
3. **Yavaş yanıt süreleri**: Daha küçük bir LLM modeli kullanmayı veya GPU desteğini aktifleştirmeyi deneyin

## İpuçları

- Sorgunuzu ne kadar spesifik yaparsanız, o kadar doğru sonuçlar alırsınız
- Departman isimlerini tam olarak kullanın (ör. "Finans" yerine "Finans departmanı")
- Tarih aralıklarını açıkça belirtin (ör. "mart ayı" veya "1-15 mart arası")
- Durum filtrelerini ekleyin (ör. "geç kalanlar", "erken çıkanlar", "devamsızlar")

---

Bu doküman, PDKS AI Rapor Asistanı'nın temel kullanımını ve özelliklerini açıklar. Daha detaylı teknik bilgiler için kod dokümentasyonuna başvurun. 