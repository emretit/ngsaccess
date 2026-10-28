# Denetim — Vardiyalar UI düzeltmesi (Codex A/B/C diff'i), SALT OKUMA

**Hedef:** Codex worker'larının yazdığı değişikliği bağımsız denetle; Engel / Önemli / Düşük bulguları file:line ile `docs/ui-audit-shifts/review.md`'ye yaz.

**Kapsam (yalnız bunlar; çalışma ağacında başka oturumların ilgisiz değişiklikleri var, onları denetleme):**
- `git diff -- src/components/shifts src/App.tsx convex/schema.ts convex/shifts.ts convex/shifts.test.ts` (App.tsx ve schema.ts'te YALNIZ ShiftDefinitions route'u ve shifts.color satırı bu işe ait; diğer hunk'lar başka oturumun)
- Yeni dosyalar: src/pages/ShiftDefinitions.tsx, src/components/shifts/calendar/calendarActions.ts, calendar/calendarControls.test.tsx, src/components/shifts/calendarGrid.test.tsx, definitions/AddShiftDialog.test.tsx, src/components/shifts/lib/shiftColors.ts, convex/lib/shiftColors.ts
- Plan/bulgu listesi: docs/ui-audit-shifts/RAPOR.md (V-xx ID'leri), kurallar: CLAUDE.md, convex/_generated/ai/guidelines.md

**Bak:**
1. Doğruluk: atama akışları (Vardiya ata, boş hücre → atama formu ön dolu, Seçilenlere ata, tümünü seç/indeterminate, sayfa değişince seçim), Toplu temizle ve dışa aktarma hâlâ çalışıyor mu; aktif tanım yokken tek boş durum; compact (mobil) dalı; tarih gezinme/aralık etiketi (ay sınırı, yıl sınırı, ay görünümü); hafta/ay geçişi.
2. Yetki: `schedule.manage` olmadan yazma eylemi (Vardiya ata, Toplu temizle, + ipucu, satır tıkla düzenle, Yeni tanım, sil) görünmüyor/çalışmıyor mu; `reports.view` olmadan dışa aktarma yok mu; `/shifts/definitions` sayfası yetkisiz kullanıcıda ne gösteriyor; PDKS ayar bağlantısı yalnız yetkiliye mi.
3. Backend: convex/shifts.ts create/update `color` doğrulaması; update'te null = rengi kaldır gerçekten alanı siliyor mu; eski istemci (color göndermeyen) bozulmuyor mu; yetki kontrolü (mevcut) atlanmış bir yol var mı — grep tabanlı "süzgeçsiz yol" taraması yap (projectId/izin kontrolü olmadan shifts'e yazan yol).
4. Erişilebilirlik: aria-label'lar, odak, klavye ile satır tıklama (tableRowClick), radiogroup renk seçici, aria-pressed düğme grupları.
5. Tasarım tutarlılığı (A2): PDKS Kayıtları başlık kalıbı, PdksSettings alt sayfa kalıbı ile uyum; Türkçe metinler.

**Kurallar:** Kaynak dosyalara YAZMA (yalnız docs/ui-audit-shifts/review.md oluştur). `git add/commit/stash/checkout/reset/restore`, push, convex dev/deploy, DB yazma YASAK. Testleri/tsc'yi istersen koş (salt okuma). Raporu değil diff'i oku.
**Rapor:** worker_done'da ≤10 satır özet (Engel/Önemli/Düşük sayıları + en kritik 3 bulgu file:line), `--report-path docs/ui-audit-shifts/review.md`.
