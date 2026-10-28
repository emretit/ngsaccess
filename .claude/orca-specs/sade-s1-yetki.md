# S1-yetki — Yetki Durumu sekmesini sadeleştir

## Hedef
Yetki Durumu ilk bakışta kişi, cihaz/kapı, tek durum mesajı ve tek aksiyon gösterir; geçmiş hata tarihli görünür; testler yeşil.

## Ownership (yalnız bunlar + testleri)
`src/components/access-control/unified/status/*`. Backend yalnız gerekirse: `convex/accessGrantStatus.ts` — liste/çekmece satırına `updatedAt` döndürmek için (zaten dönüyorsa dokunma).

## İşler
1. Satır/kart (masaüstü tablo + mobil kart): Kişi, Cihaz/kapı, Durum, tek aksiyon. Departman, Kural, Son güncelleme kolonları kalkar; bu bilgiler kişi çekmecesinde (`StatusViews.tsx`, `StatusResults.tsx`).
2. Hata: satırda kısa neden + `pastAttemptText(row.updatedAt, kısaNeden)`; ham hata metni çekmecede "Hata ayrıntısı" altında (`model.ts`, `StatusViews.tsx`).
3. Rozetler tek ana mesaja: Etkin/Bekliyor/Hata/Kaldırıldı + gerekiyorsa tek ek mesaj ("Yeniden gönderilmeli" ya da "Kapı seçimi düzeltilmeli"); aynı satırda 3 rozet olmaz (`StatusViews.tsx`).
4. 6 sayaç düğmesi + ayrı Durum seçicisi → tek durum kontrolü: sayaçlar seçilebilir düğme olarak kalır (Tümü/Etkin/Bekliyor/Hata), sıfır olan Kaldırıldı/Bilinmiyor gizlenir (Bilinmiyor > 0 ise görünür); Durum seçicisi filtre panelinden kalkar (`StatusCounters.tsx`, `StatusFilters.tsx`, `useStatusData.ts`).
5. Filtreler: "Ad ara" açık; Departman/Cihaz/Kural `CollapsibleFilters collapseOn="all"` içinde. Mevcut mobil "Filtreler (n)" düğmesi ve kırılgan `[&>[role=search]>div:last-of-type]:order-first` seçicisi kalkar (`StatusFilters.tsx`).
6. Seçim yokken "Seçili N kaydı yeniden gönder" gizli; "Hatalıları yeniden dağıt" ve "Tümünü yeniden dağıt" bir "Diğer gönderim işlemleri" menüsünde (`RedistributeControls.tsx`). Onaylar aynen.
7. "Son yenileme: 17:49 · İstanbul saati" → "Liste okundu: 27.10.2026 17:49" (tam tarih) (`StatusPage.tsx`).
8. Cihaz görünümünde açık cihaz kartının iç satırlarında tekrar eden cihaz adı kalkar (`StatusResults.tsx`/`StatusViews.tsx`).
9. Gönderim sonrası iki ayrı bildirim tek bildirime iner; onay metni kısalır: "Tüm proje · filtreler uygulanmaz · N kayıt", teknik açıklama "Ayrıntı" altında (`StatusPage.tsx`, `RunNotice.tsx`, `RedistributeControls.tsx`, `model.ts`).
10. Çekmecede yetkisiz kapı listesi varsayılan kapalı: "Kural dışında kalan N kapı" + aç (`StatusViews.tsx`). "Yetkisiz kapı yok" → "Kural dışında kalan kapı yok".

## Kapsam dışı
Güncellik (stale) hesabının backend'de yeniden tasarımı. Hikvision "Tüm kapılar (cihaz)" etiketinin değiştirilmesi. Kurallar ve Kapı Planları dosyaları.

## Kapılar
- `node_modules/.bin/vitest run src/components/access-control/unified/status src/components/access-control/unified/audit.test.tsx` → yeşil (`convex/accessGrantStatus.ts` değiştiyse `node_modules/.bin/vitest run convex/accessGrantStatus` de).
- `node_modules/.bin/eslint <değiştirdiğin dosyalar>` → error 0.
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → senin dosyalarında 0 hata.

## Bağlam
- Proje: /Users/emreaydin/ngsaccess (React + Vite + Convex). Sayfa: Geçiş Kontrol (/access-control) — sekmeler Kurallar, Yetki Durumu, Kapı Planları. Zaman şablonları tamamen kaldırıldı (önceki dalga S0); şablonla ilgili hiçbir şey geri ekleme.
- Kullanıcı geri bildirimi: "çok fazla detay veriyoruz". Kullanıcı ADHD: her ekranda yalnız karar/aksiyon için gereken bilgi kalsın; ayrıntı istenince açılsın. Metinler Türkçe, kısa, düz.
- Bugün yaşanan hata: eski gönderim sonucu ("Cihaz çevrimdışı") güncel durum gibi göründü. Geçmiş hata/gerekçe gösteren HER yerde ortak yardımcıyı kullan: `import { pastAttemptText } from "@/lib/pastAttempt"` → `pastAttemptText(zaman, gerekçe)` = "Son deneme 22.10.2026 13:09 · cihaz o sırada çevrimdışıydı".
- Katlanır filtre paneli için paylaşılan bileşen: `import { CollapsibleFilters } from "@/components/shared/CollapsibleFilters"` → `<CollapsibleFilters collapseOn="all" activeCount={n}>…</CollapsibleFilters>` (masaüstünde de katlı; buton "Filtreler (n)").
- Kaynak rapor: docs/ui-audit-gk/sadelestirme/yetki-durumu.md (satır numaraları S0 öncesine ait, kaymış olabilir; dosyayı okuyup doğru yeri bul). Özet: docs/ui-audit-gk/sadelestirme/00_OZET.md.
- Bu dalgada 3 worker paralel: S1-kurallar, S1-yetki, S1-kapi. Ownership ayrık; başka worker'ın dosyasına YAZMA. Paylaşılan dosyalar (`src/lib/pastAttempt.ts`, `src/components/shared/*`, `src/components/ui/*`) salt okunur — değişiklik gerekiyorsa `ask` ile koordinatöre sor.
- Proje kuralları: `/Users/emreaydin/ngsaccess/CLAUDE.md` (any yasak, camelCase, tip korumalı filtre). Convex dosyasına dokunacaksan önce `convex/_generated/ai/guidelines.md`.
- Çalışma dizininde başka oturumların ilgisiz değişiklikleri var (mobile/, visitors, employees vb.): DOKUNMA.
- Mevcut davranış korumaları (kaydedilmemiş değişiklik uyarısı, onay dialogları, erişilebilirlik etiketleri, mobil 44px hedefler `max-sm:`/`max-lg:` ile) korunur.

## YASAK
- `git add`, `git commit`, `git stash`, `git checkout`, `git reset`, `git restore` YASAK. Commit/push/deploy YOK.
- `npx convex dev`, `npx convex deploy`, `npx convex codegen`, `npx convex run`, DB'ye yazan her komut YASAK. Supabase MCP kullanma.

## Rapor
`worker_done` özetinde ≤10 satır: her iş maddesi için yapıldı/yapılmadı + file:line, kapı sonuçları (komut + sayı). `--files-modified` gerçek liste.
