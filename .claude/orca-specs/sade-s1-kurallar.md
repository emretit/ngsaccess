# S1-kurallar — Kurallar sekmesini sadeleştir

## Hedef
Kurallar sekmesi ilk bakışta yalnız kural, kapsam, saat ve gereken aksiyonu gösterir; geçmiş gönderim hatası tarihli görünür; testler yeşil.

## Ownership (yalnız bunlar + testleri)
`src/components/access-control/unified/AccessRulesList.tsx`, `unified/rules-list/*`, `unified/AccessRuleDetails.tsx`, `unified/CreateRuleDialog.tsx`, `unified/components/RuleBasicInfo.tsx`, `unified/components/selectionHelpers.ts`, `unified/SyncRuns.tsx`, `unified/lib/presentation.ts`, `unified/UnifiedAccessControl.tsx` (yalnız gerekirse).

## İşler
1. Kuralın son gönderim kartında sorunlu cihaz satırı: `{cihaz}: {pastAttemptText(target.updatedAt, target.reason)}` (`SyncRuns.tsx` RuleLastRun). Sheet içindeki RunResult'ta da aynı biçim; "Cihaz bağlanınca yeniden gönderin." kalkar.
2. Kural ayrıntısında kişi ve kapı listeleri varsayılan kapalı: "Kişileri göster (N)" / "Kapıları göster (N)" (details/summary ya da buton + aria-expanded). Bağlantısız kapı ve kapsam-kesildi uyarıları açık kalır (`AccessRuleDetails.tsx`).
3. Başlıktaki "Tüm proje cihazlarına gönder" bir "Diğer işlemler" menüsüne (DropdownMenu, `src/components/ui/dropdown-menu`) taşınır; onay dialogu aynen çalışır (`AccessRulesList.tsx`, `SyncRuns.tsx` ProjectSyncButton).
4. Filtreler: arama kutusu açık; Durum + Tür (ve arama alanı seçici) `CollapsibleFilters collapseOn="all"` içinde, aktif filtre sayısıyla (`rules-list/RulesFilters.tsx`).
5. Sihirbaz: "1. Temel" adımı kalkar; Kural adı 1. adımın (Kimler) üstüne, açıklama "Açıklama ekle" ile açılır. Adımlar: 1. Kimler, 2. Nerede / Ne zaman. Üst açıklama tek cümle: "Kaydedince cihazlara gönderilir." (`CreateRuleDialog.tsx`, `components/RuleBasicInfo.tsx`). Doğrulama (ad zorunlu) korunur.
6. Alt özet sayacı: cihazın tüm kapıları seçiliyse "0 kapı" yazmaz; etkin kapı sayısını `selectionHelpers` mantığıyla hesaplar (`CreateRuleDialog.tsx` alt özet).
7. Liste: ayrı "Tür" sütunu kalkar, tür kural adının yanında küçük ikincil etiket olur; "Durum" sütun başlığı "Kural durumu" (`rules-list/RuleRow.tsx`, `RulesPage`/başlık bileşeni).
8. Proje gönderim onayında marka dağılımı kalkar: yalnız "N cihaz · tüm proje · filtreler uygulanmaz" + mevcut uyarı cümlesi (`SyncRuns.tsx` ProjectSyncButton). `brandDistribution` kullanılmıyorsa sil.

## Kapsam dışı
Bölge→cihaz→kapı ağacının yeniden tasarımı. `convex/` (hiçbir backend değişikliği yok). Yetki Durumu ve Kapı Planları dosyaları.

## Kapılar
- `node_modules/.bin/vitest run src/components/access-control/unified --exclude "**/status/**"` → yeşil (status testleri S1-yetki'nin).
- `node_modules/.bin/eslint <değiştirdiğin dosyalar>` → error 0.
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → senin dosyalarında 0 hata.

## Bağlam
- Proje: /Users/emreaydin/ngsaccess (React + Vite + Convex). Sayfa: Geçiş Kontrol (/access-control) — sekmeler Kurallar, Yetki Durumu, Kapı Planları. Zaman şablonları tamamen kaldırıldı (önceki dalga S0); şablonla ilgili hiçbir şey geri ekleme.
- Kullanıcı geri bildirimi: "çok fazla detay veriyoruz". Kullanıcı ADHD: her ekranda yalnız karar/aksiyon için gereken bilgi kalsın; ayrıntı istenince açılsın. Metinler Türkçe, kısa, düz.
- Bugün yaşanan hata: eski gönderim sonucu ("Cihaz çevrimdışı") güncel durum gibi göründü. Geçmiş hata/gerekçe gösteren HER yerde ortak yardımcıyı kullan: `import { pastAttemptText } from "@/lib/pastAttempt"` → `pastAttemptText(zaman, gerekçe)` = "Son deneme 22.10.2026 13:09 · cihaz o sırada çevrimdışıydı".
- Katlanır filtre paneli için paylaşılan bileşen: `import { CollapsibleFilters } from "@/components/shared/CollapsibleFilters"` → `<CollapsibleFilters collapseOn="all" activeCount={n}>…</CollapsibleFilters>` (masaüstünde de katlı; buton "Filtreler (n)").
- Kaynak rapor: docs/ui-audit-gk/sadelestirme/kurallar.md (satır numaraları S0 öncesine ait, kaymış olabilir; dosyayı okuyup doğru yeri bul). Özet: docs/ui-audit-gk/sadelestirme/00_OZET.md.
- Bu dalgada 3 worker paralel: S1-kurallar, S1-yetki, S1-kapi. Ownership ayrık; başka worker'ın dosyasına YAZMA. Paylaşılan dosyalar (`src/lib/pastAttempt.ts`, `src/components/shared/*`, `src/components/ui/*`) salt okunur — değişiklik gerekiyorsa `ask` ile koordinatöre sor.
- Proje kuralları: `/Users/emreaydin/ngsaccess/CLAUDE.md` (any yasak, camelCase, tip korumalı filtre). Convex dosyasına dokunacaksan önce `convex/_generated/ai/guidelines.md`.
- Çalışma dizininde başka oturumların ilgisiz değişiklikleri var (mobile/, visitors, employees vb.): DOKUNMA.
- Mevcut davranış korumaları (kaydedilmemiş değişiklik uyarısı, onay dialogları, erişilebilirlik etiketleri, mobil 44px hedefler `max-sm:`/`max-lg:` ile) korunur.

## YASAK
- `git add`, `git commit`, `git stash`, `git checkout`, `git reset`, `git restore` YASAK. Commit/push/deploy YOK.
- `npx convex dev`, `npx convex deploy`, `npx convex codegen`, `npx convex run`, DB'ye yazan her komut YASAK. Supabase MCP kullanma.

## Rapor
`worker_done` özetinde ≤10 satır: her iş maddesi için yapıldı/yapılmadı + file:line, kapı sonuçları (komut + sayı). `--files-modified` gerçek liste.
