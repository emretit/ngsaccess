# Ziyaretçiler audit düzeltme planı (2026-10-27)

## Checklist
### Faz 0 — Plan
- [x] Audit raporu: docs/ui-audit-ziyaretci/00_RAPOR.md (1Y/7O/5D)
- [x] Kararlar (Emre "ne öneriyorsan" dedi → öneriler bağlayıcı, aşağıda)
- [x] Spec'ler: .claude/orca-specs/ziy-ortak.md + ziy-w1..w4.md
### Faz 1 — Codex worker'lar (paralel, dosya sahipliği ayrık)
- [x] W1 kart yakalama: Z-O1, Z-O2, Z-O3, Z-D3 (gpt-6-astra high)
- [x] W2 backend + sayfa: Z-Y1 backend, Z-O5, Z-O6, Z-D1, Z-D4 (gpt-6-astra high)
- [x] W3 form: Z-Y1 arayüz, Z-O7, Z-D2, Z-D5 (gpt-6.1-sol medium)
- [x] W4 saklama: Z-O4 (gpt-6-astra high)
### Faz 2 — Denetim + kapılar
- [x] Çapraz denetim: Geçti (docs/ui-audit-ziyaretci/review.md), R-1 EVET kararı uygulandı
- [x] Denetim düzeltmeleri: R-1,R-2,R-4..R-7 yapıldı; R-3 codegen sonrası, R-8/R-10 kabul
- [x] Kapılar: tsc 0/0, eslint 0, vitest 5221/5221, find-node-leak temiz
- [x] Orca turu: form açılıyor, host araması OK, Z-D4 başlıkta
- [x] R-3: fff44910
- [x] R-9: NGS0001 listede
### Faz 3 — Yayın (Emre onayı)
- [x] Commit 407b520c + fff44910; Convex 17:17:19, web 17:19 TR (deploy 6ae0b2f8…); push YOK
### Faz 4 — Canlı turlar (2026-10-27)
- [x] Mobil 390px turu (iframe yöntemi)
- [x] Dolu liste turu (kapısız test verisi, sonra silindi)
- [x] Tur düzeltmeleri commit'li: 3b7cc506 (saklama ipucu), f749691f (tablo taşması)
- [ ] Web yayını (Emre onayı; Convex gerekmez)

## Kararlar (koordinatör önerisi, Emre 2026-10-27 "ne öneriyorsan" ile onayladı)
1. **Z-Y1:** Aktif ziyaretçiyi düzenlerken "Erişim izni ver" kutusu gizlenir; erişim yalnız "Ziyareti sonlandır" ile kapanır. Backend savunma: `update` pasife alırken `visitorStatus: "checkedOut"` yazar (artık "preRegistered" değil). Eski yanlış kayıtlar için veri düzeltmesi YOK (ayrı onay).
2. **Z-O4:** Proje ayarı "Ziyaretçi kayıtlarını saklama süresi (gün)". Varsayılan boş = kapalı (yayından sonra hiçbir kayıt kendiliğinden silinmez). Süre dolan PASİF ziyaretçi, elle silmeyle aynı zincirle silinir (cihaz + KVKK temizliği). Aktif ve bitişi gelecekte olan kayıtlara dokunulmaz.
3. **Z-O6:** Ziyaretçiler sayfası + liste/özet/ayrıntı yalnız `visitors.manage` veya `reports.view` yetkisine açık (Teknik rolü görmez). Telefon, notlar ve ziyaret amacı yalnız `visitors.manage` sahibine gösterilir.

## Sahiplik (iki worker aynı dosyaya yazmaz)
- W1: convex/cardReadings.ts (yalnız kart yakalama sorgusu), convex/cardReadings.readingAccess.test.ts, src/components/visitors/{VisitorCardCapture.tsx, cardCaptureSession.ts(+test), lib/readerCapability.ts(+test)}, src/components/employees/import/BatchCardAssignDialog.tsx
- W2: convex/visitors.ts, convex/lib/visitorStatus.ts(+test), src/lib/routeMeta.ts, src/components/visitors/{VisitorManagement, VisitorStats, VisitorFilters, VisitorTable, VisitorSlideOverPanel}.tsx, src/hooks/useVisitors.ts, src/types/visitor.ts, src/components/visitors/visitors.test.tsx, ziyaretçi çağıran convex testleri
- W3: src/components/visitors/{VisitorFormFields, VisitorForm, VisitorCombobox}.tsx, hooks/{useVisitorFormData, useVisitorFormSchema}.ts, lib/formPayload.ts, visitorAudit/visitorActivation*.test.tsx, yeni convex/visitorHosts.ts(+test)
- W4: convex/privacyRetention.ts, convex/lib/privacySettings.ts, convex/schema.ts (yalnız projectPrivacySettings alanı), yeni convex/lib/visitorRetention.ts(+test), src/components/settings/sections/privacy/VisitorNoticeCard.tsx(+test), convex/privacyRetention.settings.test.ts, convex/retention.test.ts

## Taban
HEAD d2530e68; tsc app 0 / convex 0 hata (2026-10-27 16:05).

## Yayın notu
Pathspec: .claude/pathspec-ziyaretci-audit.txt (convex/deviceSyncRuns.ts + deviceSyncRun.test.ts başka oturumun, HARİÇ). Yeni index: employees.by_project_visitor_active_expiry (dev --once kurar). Saklama varsayılan kapalı.
