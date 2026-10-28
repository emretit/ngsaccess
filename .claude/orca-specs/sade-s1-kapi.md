# S1-kapi — Kapı Planları sekmesini sadeleştir

## Hedef
Kapı Planları listesi kapı, kısa plan ve gönderim durumunu gösterir; geçmiş gönderim hatası tarihli; kopyalama sonucu gerçeği söyler; editörler tek düzen seçimiyle çalışır; testler yeşil.

## Ownership (yalnız bunlar + testleri)
`src/components/access-control/door-plans/*`, `src/components/access-control/door-dialog/{DoorStatusPlanSection,DoorVerifyPlanSection,DoorVerifyPlanEditor}.tsx`, `src/components/access-control/DoorStatusPlanEditor.tsx`. Backend: `convex/doors.ts` (yalnız `recordPlanResult` ve plan hedefleri liste sorgusu), `convex/schema.ts` (yalnız `doors.hikPlanResults` içindeki sonuç nesnesine opsiyonel `failedAt: v.optional(v.string())`), ilgili `convex/*doorPlan*.test.ts`.

## İşler
1. `recordPlanResult` hata durumunda sonuç nesnesine `failedAt` (ISO) yazar; liste sorgusu son hata zamanını döndürür. Listede: "Son gönderim başarısız" + `pastAttemptText(failedAt, hata)`; ham hata açılır ayrıntıda; `deviceOnline` true ise yanında "Cihaz şu an çevrimiçi". Eski kayıtlarda zaman yoksa yardımcı zaten "Son denemede: …" der (`DoorPlansTab.tsx`, `convex/doors.ts`).
2. Kopyalama sonucu üç durum: "Gönderildi" / "Değişiklik yok, gönderilmedi" / "Gönderilemedi"; üstte toplam, hatalılar açık, diğerleri açılır listede (`bulk.ts`, `CopyDoorPlansDialog.tsx`).
3. Liste satırı: kapı adı + küçük cihaz adı + tek satır plan özeti + gönderim durumu. Bölge, tüm aralıklar ve ayrı doğrulama sütunu satır ayrıntısına (aç/kapa) taşınır (`DoorPlansTab.tsx`).
4. Editörler (durum + doğrulama): "Plan düzeni" seçici + "Hafta içi" butonu + "Pazartesiyi kopyala" → tek seçim "Her gün / Hafta içi / Günlere göre". Gün bazında düzenden "Her gün"e veya "Hafta içi"ne geçiş mevcut farklı günleri silecekse onay ister (veri kaybı yok); "Hafta içi" Pazartesi aralıklarını baz alır (`DoorStatusPlanEditor.tsx`, `door-dialog/DoorVerifyPlanEditor.tsx`).
5. Yardım metinleri: bölüm başına tek cümle ("Saatler dışında kişi yetkileri geçerlidir."); ayrıntı "Plan nasıl çalışır?" açılırında. "TR saati" editör başında bir kez; saniye alanı yalnız kayıtlı değer saniyeli ise görünür (`DoorStatusPlanEditor.tsx`, `DoorVerifyPlanEditor.tsx`, `DoorStatusPlanSection.tsx`, `DoorVerifyPlanSection.tsx`).
6. Tatil: ilk 10 tarih yerine "N tatil aralığı · tam gün" özeti + "Tümünü göster"; cihaz desteği açıklaması yalnız tatil açılınca (`DoorPlanDialog.tsx`).
7. Etki özeti başlığı "Gönderilecek değişiklik"; plan kapatılıyorsa "Kapı normal çalışır" yerine "Durum planı kapatılacak" (gelecek zaman) (`DoorPlanImpactSummary.tsx`, `DoorStatusPlanSection.tsx`).
8. Seçim yokken toplu işlem çubuğu ("0 kapı seçildi", "Planı kopyala") gizli; ilk seçimde görünür (`DoorPlansTab.tsx`).
9. Kopya dialogunda tekrar eden kaynak/hedef bilgisi tek "N hedef kapı — listeyi aç" alanına iner (`CopyDoorPlansDialog.tsx`).

## Kapsam dışı
Tatil takvimi sürüm izleme. Açık dialogun canlı güncellenmesi. Kurallar ve Yetki Durumu dosyaları. `convex/` içinde yukarıdakiler dışında her şey.

## Kapılar
- `node_modules/.bin/vitest run src/components/access-control/door-plans src/components/access-control/door-dialog src/components/access-control/DoorStatusPlanEditor.test.tsx convex/doorPlans convex/doorPlanGateway convex/doorPlanModels convex/doorStatusPlan` → yeşil.
- `node_modules/.bin/eslint <değiştirdiğin dosyalar>` → error 0.
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → senin dosyalarında 0 hata.
- `node scripts/find-node-leak.mjs` → temiz.

## Bağlam
- Proje: /Users/emreaydin/ngsaccess (React + Vite + Convex). Sayfa: Geçiş Kontrol (/access-control) — sekmeler Kurallar, Yetki Durumu, Kapı Planları. Zaman şablonları tamamen kaldırıldı (önceki dalga S0); şablonla ilgili hiçbir şey geri ekleme.
- Kullanıcı geri bildirimi: "çok fazla detay veriyoruz". Kullanıcı ADHD: her ekranda yalnız karar/aksiyon için gereken bilgi kalsın; ayrıntı istenince açılsın. Metinler Türkçe, kısa, düz.
- Bugün yaşanan hata: eski gönderim sonucu ("Cihaz çevrimdışı") güncel durum gibi göründü. Geçmiş hata/gerekçe gösteren HER yerde ortak yardımcıyı kullan: `import { pastAttemptText } from "@/lib/pastAttempt"` → `pastAttemptText(zaman, gerekçe)` = "Son deneme 22.10.2026 13:09 · cihaz o sırada çevrimdışıydı".
- Katlanır filtre paneli için paylaşılan bileşen: `import { CollapsibleFilters } from "@/components/shared/CollapsibleFilters"` → `<CollapsibleFilters collapseOn="all" activeCount={n}>…</CollapsibleFilters>` (masaüstünde de katlı; buton "Filtreler (n)").
- Kaynak rapor: docs/ui-audit-gk/sadelestirme/kapi-planlari.md (satır numaraları S0 öncesine ait, kaymış olabilir; dosyayı okuyup doğru yeri bul). Özet: docs/ui-audit-gk/sadelestirme/00_OZET.md.
- Bu dalgada 3 worker paralel: S1-kurallar, S1-yetki, S1-kapi. Ownership ayrık; başka worker'ın dosyasına YAZMA. Paylaşılan dosyalar (`src/lib/pastAttempt.ts`, `src/components/shared/*`, `src/components/ui/*`) salt okunur — değişiklik gerekiyorsa `ask` ile koordinatöre sor.
- Proje kuralları: `/Users/emreaydin/ngsaccess/CLAUDE.md` (any yasak, camelCase, tip korumalı filtre). Convex dosyasına dokunacaksan önce `convex/_generated/ai/guidelines.md`.
- Çalışma dizininde başka oturumların ilgisiz değişiklikleri var (mobile/, visitors, employees vb.): DOKUNMA.
- Mevcut davranış korumaları (kaydedilmemiş değişiklik uyarısı, onay dialogları, erişilebilirlik etiketleri, mobil 44px hedefler `max-sm:`/`max-lg:` ile) korunur.

## YASAK
- `git add`, `git commit`, `git stash`, `git checkout`, `git reset`, `git restore` YASAK. Commit/push/deploy YOK.
- `npx convex dev`, `npx convex deploy`, `npx convex codegen`, `npx convex run`, DB'ye yazan her komut YASAK. Supabase MCP kullanma.

## Rapor
`worker_done` özetinde ≤10 satır: her iş maddesi için yapıldı/yapılmadı + file:line, kapı sonuçları (komut + sayı). `--files-modified` gerçek liste.
