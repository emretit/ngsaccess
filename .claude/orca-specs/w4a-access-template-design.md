# W4a — Erişim zaman şablonları + kişi×kapı yetki durumu: TASARIM (SALT-OKUMA)

Sen tasarımcısın. Kod YAZMA. Tek yazacağın dosya: `{{OUT}}`.
YASAK: commit, push, deploy, `npx convex *` (dev/deploy/codegen/run), DB yazma, git stash/checkout/reset, başka dosya düzenleme.
Not: çalışma ağacında başka bir oturumun commit'siz işi var (W2 işten ayrılma: `convex/employeeTermination.ts`, `convex/lib/employment.ts`, `convex/lib/reportAttendance.ts`, `convex/cardReadings.ts`, `convex/sgkExport.ts`, `src/components/employees/**`; drawer: `src/pages/Devices.tsx` çevresi). Onları OKU ama değişmiş hallerini hesaba kat; tasarımın onlarla çakışmasın.

## Ortak kurallar (repo; CLAUDE.md'yi okumadığın için buraya gömüldü)
- TypeScript strict; `any` yasak; Convex handler'ları camelCase alan döner.
- Convex kuralları: önce `convex/_generated/ai/guidelines.md` oku. Sınırsız `.collect()` yok; okuma bütçesi sınırlı.
- Convex Free plan: function-call kotası dar → YENİ polling / sık cron önermek yasak; toplu cihaz senkron fırtınası yasak (değişiklik → tek, birleştirilmiş senkron çalıştırması).
- Canlı sistem `notable-tern-4` (dev deployment); veri canlı. Şema değişikliği yalnız opsiyonel alan + yeni tablo (migration yok, mevcut kayıtlar değişmeden çalışmaya devam eder).
- Kullanıcıya görünen metinler Türkçe.
Aynı soruyu başka bir model ayrıca cevaplıyor; birbirinizi görmüyorsunuz. Kendi bağımsız değerlendirmeni yap.

## Hedef
1. **Yeniden kullanılabilir haftalık zaman şablonu** (gün başına birden çok aralık, 7 gün; isteğe bağlı tatil davranışı) bir kez tanımlanır, birçok erişim kuralına bağlanır. Şablon değişince bağlı kuralların cihazları doğru ve tek seferde güncellenir.
2. **Kişi × kapı efektif yetki durumu ekranı** (Hik-Connect "Access Overview" karşılığı): kişi başına hangi kapıya hangi kural/şablonla yetkili, cihaza dağıtım durumu Etkin / Bekliyor / Hata / Yetkisiz; departman filtresi, kişi ve cihaz görünümü.

## Bağlam (kodda doğrula)
- Kurallar: `convex/accessRules.ts` (listSummaries/getDetails/create/update/...WithGroups/updateWithGroupsTracked), şema `accessRules` ve ilişkili tablolar (`convex/schema.ts`), kapsam/grafik: `convex/lib/accessGraph.ts`, `accessGraphPure.ts`, `accessScopeRelations.ts`, `accessDecision.ts`.
- Senkron: `convex/deviceSyncRuns.ts`, Hik: `convex/lib/hikSync.ts`, `convex/actions/hikvisionSync.ts`, gateway: `convex/lib/gateway/scheduling.ts`; IDE Smart panel (MQTT): `convex/actions/ideGatewayDevice.ts` ve IDE sync modülleri, `debugIde:panelRosterDiff` (iç araç). Kapı durum planı: `hikDoorStatusPlan` / `EditDoorDialog`.
- Tatiller: `holidays` tablosu; erişim kurallarının bugün tatile bakmadığı görülüyor **[teyit et]**.
- UI: `src/pages/AccessControl.tsx` + `src/components/access-control/**` (kural sihirbazı).
- Hik-Connect referansı: Access Level = kapı kümesi + zaman şablonu; Access Schedule Template = haftalık 7×24 çizelge; Overview = All/Invalid/Effective/Not Granted sayaçları + kişi/kapı/şablon/dağıtım durumu kolonları.

## Cevaplaman gerekenler
1. **Veri modeli:** şablon tablosu (aralık temsili, doğrulama: çakışma, gün başı en fazla aralık), kuralın şablona bağlanması, mevcut kuralların gömülü gün-saat alanlarıyla geri uyum (ikisi birden olursa hangisi geçerli).
2. **Cihaza çeviri:** Hik (ISAPI/gateway week plan / plan template sınırları: gün başı segment sayısı, şablon sayısı) ve IDE Smart panel (zaman bölgesi/plan kapasitesi) için çeviri; sınır aşılırsa davranış; tatil desteği.
3. **Değişiklik yayılımı:** şablon güncellenince etkilenen kurallar → cihazlar; tek birleştirilmiş senkron çalıştırması, fırtına ve kota tahmini (kaç fonksiyon çağrısı).
4. **Yetki durumu verisi:** bugün kişi×kapı×cihaz başına dağıtım durumu tutuluyor mu? Tutulmuyorsa en ucuz kaynak ne (senkron çalıştırma sonuçları, roster farkı, yeni tablo)? Okuma maliyeti (kişi×kapı çarpımı) ve sayfalama; reaktif sorgu yükü.
5. **UI akışı:** şablon listesi + 7×24 düzenleyici, kural sihirbazında şablon seçimi, Overview ekranı (sayaçlar, filtreler, "yeniden dağıt" aksiyonu).
6. **Riskler:** yanlış çeviride kapının açık/kapalı kalması, kısmi senkron, IDE ve Hik farkları; geri dönüş planı.

## Çıktı
`{{OUT}}` (Türkçe, ≤250 satır), aşağıdaki soruların numaralarıyla başlıklandırılmış. İddiaları `dosya:satır` ile kanıtla; doğrulayamadığını **[teyit]** diye işaretle.
Son bölüm: **Uygulama adımları** (sıralı, her biri test edilebilir, tahmini süre) + **Emre'ye açık kararlar** (≤4 madde, her birine önerin).
`worker_done` mesajı ≤10 satır: önerilen model, en büyük 3 risk, açık kararlar, çıktı yolu.
