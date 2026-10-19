# Worker C — Okuma (cardReadings) saklama süresi + asistan isim maskeleme
ÖNCE `.claude/orca-specs/kvkk1-common.md` oku (zorunlu).

**Hedef:** Yönetici projenin kart okuma kayıtları için saklama süresi (gün) belirleyebilir; süre dolan kayıtlar günlük bir iş ile kademeli silinir ve her koşum denetim kaydına düşer.
Asistan (OpenAI'a giden sohbet verisi) varsayılan olarak çalışan adlarını maskeler; yönetici projede maskelemeyi kapatabilir.

## Ownership (yalnız bunlara yaz)
- `convex/privacyRetention.ts` (YENİ: `getRetentionAndAssistant` adminQuery, `setCardReadingRetention` adminMutation, `setAssistantMasking` adminMutation, `purgeExpiredCardReadings` internalMutation/Action)
- `convex/lib/cardReadingRetention.ts` (+test) (YENİ: kesim zamanı hesabı, batch planı), `convex/crons.ts` (yalnız YENİ bir `crons.interval` satırı: günlük ~24 saat, kendi bloğunda yorumla)
- `convex/actions/getChatData.ts`, `convex/actions/openaiChat.ts`, `src/components/pdks/chat/**`, `src/components/pdks/AiChatPanel.tsx` (yalnız maskeleme için gerekli yerler)
- `convex/lib/chatMasking.ts` (+test) (YENİ: saf maskeleme)
- `src/components/settings/sections/privacy/RetentionAssistantCard.tsx` (+ test)
- `convex/cardReadings.ts` OKU (silme dışında yazma YOK).

## Davranış
1. Saklama: `cardReadingRetentionDays` boş/null = süresiz (varsayılan, hiçbir şey silinmez). Doluysa `MIN..MAX_CARD_READING_RETENTION_DAYS` (365–3650) dışı reddedilir.
   `purgeExpiredCardReadings`: `projectPrivacySettings` satırı olan ve süresi tanımlı her proje için `cardReadings` `by_project_access_time` ile kesimden ESKİ kayıtları ≤200/batch siler,
   kendini `scheduler.runAfter(0)` ile sürdürür (proje başına günlük tavan, ör. 20 batch; kalan ertesi gün). Bir koşumdan sonra `writeAudit` (`silinen`, `kesim`, `projectId`; kullanıcı yok).
   Neden 365 alt sınır: puantaj/SGK dayanağı kayıtlar yasal saklama süresine tabidir — kartta bu uyarıyı göster: "Mesai ve SGK kayıtlarınızın yasal saklama süresini (5–10 yıl) yasal danışmanınıza sorun."
   `accessTime` ISO string: kesim karşılaştırması ISO ile; TR günü/UTC kayması için `convex/lib/trDate.ts`'e bak, kesimi UTC ISO ver.
2. Maskeleme: `chatMasking.ts` → çalışan adını "Personel 1/2/…" (aynı sohbet verisinde aynı kişi aynı numara) ya da baş harf ("A. Y.") olarak değiştir; hangisini seçtiğini kartta yaz. `getChatData` ve `openaiChat.processMessage`'a giden
   `dbContext` içindeki `employeeName` / `name` alanları maskelenir; kullanıcının KENDİ sorusundaki ad tutulur. `aiMaskNames` ayarı `getPrivacySettings` ile okunur (satır yoksa maskeli).
   Yanıt metninde kullanıcıya görünen etiketler UI'da anlaşılır kalsın ("Personel 3 bugün geç geldi"). Kapalıyken eski davranış aynen.
3. `RetentionAssistantCard`: iki ayrı bölüm — "Okuma kayıtlarını saklama süresi" (süresiz / özel gün sayısı, uyarı metni, kaydet) ve "Asistan gizliliği" (isimleri maskele açık/kapalı + kapatma uyarısı: "Kapatırsanız çalışan adları üçüncü taraf yapay zeka servisine gönderilir").
   Taslak koruması `SettingsFormState` kalıbı. Kaydet kısmi patch (yalnız değişen alanı yazar).

## Kapsam dışı
Biyometri modülü ve imha (Worker A/B). PDKS kayıtlarının (pdksRecords/manuel düzeltme) silinmesi — YOK. Retention'ı canlıda çalıştırma. Mevcut projeler için otomatik süre ataması YOK.
Testler: `cardReadingRetention.test.ts` (kesim, batch, sınırlar), `chatMasking.test.ts` (tutarlı numara, boş ad, ad yok), `RetentionAssistantCard.test.tsx` (sınır doğrulama, uyarılar).
