# Görev: SALT-OKUMA denetim — UX-0 PDKS Kayıtları frontend değişikliği

Repo: /Users/emreaydin/ngsaccess (React + Vite + shadcn/ui, backend Convex). Bağlam: `docs/PDKS_KAYITLARI_UX_PLANI_2026-10-16.md` §2 (U1–U8), uygulanan spec `.claude/orca-specs/ux0-frontend.md`.

## Hedef
`git diff -- src` + yeni dosyalar (`src/components/pdks/dashboard/PDKSDateNavigator.tsx`, `src/lib/pdksSummary.ts`, `src/lib/pdksSummary.test.ts`) spec'teki U1–U5, U7, U8'i doğru çözüyor mu ve regresyon var mı — kanıtla ya da çürüt. Raporu değil diff'i oku, kapıları kendin koş.

## Özellikle kontrol et
1. Tarih çapası: URL `date` param'ı ↔ `anchorDate` döngüsü; `usePdksFilterParams` useMemo'da `new Date()` fallback'i gereksiz render/sorgu döngüsü yaratıyor mu (Convex `useQuery` argümanları her render'da değişirse sürekli yeniden abone olur)? `PDKSFilterBar` person debounce effect'i ile `setFilters` sonsuz döngüye girebilir mi?
2. Preset'ler + `QUICK_CHIPS`: "Son 7 gün" gerçekten son 7 gün; "Bugün/Bu hafta/Bu ay" aktif vurgusu doğru; `custom` → gün/hafta/ay geçişinde eski `dateRange` temizleniyor mu?
3. Durum filtresi client-side: KPI'lar filtrelenmemiş `allRecords`'tan, tablo filtrelenmiş satırlardan mı? Kart tıklaması hâlâ çalışıyor mu? `PDKSEnhancedExportPanel` ve diğer tüketiciler doğru listeyi alıyor mu?
4. `summarizePdksRecords`: günlük (days boş) vs dönem (days dolu, yalnız `viewMode=matrix`'te dolar — `convex/lib/pdksTable.ts:328`) ayrımı, devam oranı formülü, hafta sonu çalışması.
5. Manuel düzeltme: günlük modda çapa gününe yazıyor, dönem modunda kapalı (masaüstü + mobil). `ManualPdksEditDialog`'a giden `date` doğru mu?
6. "İçeride" kartı/trend yalnız günlük + bugün iken; `usePdksStats` gereksiz yere sorgu atıyor mu (`"skip"`)?
7. CLAUDE.md kuralları: `any`/`as any` yok, `!` yok, Convex tipleri `FunctionReturnType`; frontend'in `convex/lib/pdksTable` import'u yalnız saf modül çekiyor mu (`_generated/server` runtime import'u yok)?

## Ownership
HİÇBİR dosyaya yazma. Salt okuma + komut koşma. `convex/cardReadings.ts` diff'i başka bir işe ait, kapsam dışı.

## YASAK
Dosya düzenleme / commit / push / deploy / migration / canlı DB erişimi (Convex/Supabase MCP dahil) YOK. Tarayıcı oturumu açma yok.

## Kapılar (kendin koş, sonucu raporla)
node_modules/.bin/tsc --noEmit -p tsconfig.app.json
node_modules/.bin/eslint src convex   (0 error)
npx vitest run
npx vite build   (frontend bundle convex/lib import'uyla derleniyor mu)

## Rapor
worker_done özetinde ≤10 satır: her bulgu için şiddet (kritik/yüksek/orta/düşük) + file:line + somut başarısızlık senaryosu (girdi → yanlış çıktı); yoksa "temiz" + kapı sonuçları. `--outcome succeeded` = denetim tamamlandı (bulgu olsa da).
