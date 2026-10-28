# Plan — Esnek ↔ Sabit vardiya eşitleme + renk kaldırma (2026-10-26)

## Checklist
### Faz 1 — Renk kaldırma (Emre: "tamamen sil")
- [x] 1a. Arayüz: dialog renk seçimi, takvim/ağaç/rotasyon renkleri, Excel renkleri, `src/components/shifts/lib/shiftColors.ts` kalkar
- [x] 1b. Backend genişlet: `create/update` `color` argümanını geçiş için KABUL eder ama YAZMAZ (eski web bozulmasın)
- [ ] 1c. Veri: `internal` migration tüm `shifts.color` alanını siler — yayından sonra, Emre onayıyla çalıştırılır
- [ ] 1d. Daralt: şemadan `color`, argümanlardan `color`, `convex/lib/shiftColors.ts` kalkar (1c'den sonraki yayın)

### Faz 2 — Esnekte "en az net çalışma" (madde 2)
- [x] Form: Gelişmiş → Gün grubu esnekte de görünür (`minWorkMinutes`)
- [x] Şema/payload: esnekte `minWorkMinutes` korunur (bugün siliniyor)
- [x] Motor: `pdksDay` devamsızlık kuralı esnekte de `minWorkMinutes` uygular
- [x] `docs/hikconnect-audit/PDKS_KIYAS.md:42` düzelt + test

### Faz 3 — Esnekte "resmi tatilde çalışma zorunlu" (madde 5b)
- [x] Form: anahtar esnekte de görünür; motor: tatilde hedef tam, tatil mesaisi yok + test

### Faz 4 — Esnekten sonraki gün çakışması (madde 4)
- [x] `shiftPlan.ts` `validateNextDay`: esnek günün çıkış penceresi sonu (ertesi gün) ile sonraki günün ilk vardiyası arasında ≥30 dk; yoksa hata + test

### Faz 5 — Esnek eksik/fazla süre görünürlüğü (madde 1)
- [x] PDKS tablosu: esnek günde hedef/eksik/fazla; kişi toplamında hedef/eksik/fazla
- [x] Gün detayı: hedef, eksik, fazla satırları
- [x] Raporlar + Excel (kişi blokları/sayfaları): eksik/fazla sütunu (esnek varsa)
- [x] Mobil: API alanları var; Flutter uygulaması ayrı iş

### Faz 6 — Geçerlilik tarihli vardiya sürümü (madde 3, en büyük)
- [x] Tasarım: `convex/lib/shiftVersions.ts` başındaki not (ayrı doc yazılmadı); Codex görüşü denetimde
- [x] Şema: `shiftVersions` {shiftId, validUntil (dahil), rules anlık görüntüsü} + `by_shift_until`; `shifts.versionedUntil`
- [x] Çözümleyici: plan gününde o tarihte geçerli sürüm uygulanır (tüm PDKS/rapor/bordro/yön/geç e-postası yolları)
- [x] `update`: `effectiveFrom` (yoksa bugün); gelecek tarih, son sınırın gerisi ve tür değişikliği reddedilir; denetim kaydı
- [x] Saat değişikliği bu tanımı kullanan planları yeniden doğrular, bozacaksa reddeder (denetim O1)
- [x] Esnek de aynı yola geçer ("Yeni tanım olarak kaydet" kalkar)
- [x] Dialog: "Geçerlilik başlangıcı" alanı + kullanım etkisi metni
- [x] Testler: geçmiş ay PDKS/bordro değişmez, yeni tarihten itibaren yeni kural

### Faz 7 — Kapı, denetim, teslim
- [x] tsc×2 0 · eslint 0 hata · tam vitest 416/4889 · leak 0 (20:50)
- [x] Bağımsız denetim (Codex astra/high) 0E/5Ö/2D → hepsi düzeltildi + karşı örnek testleri; rapor `.claude/review-esnek-sabit.md`; worker release
- [x] Son kapı (21:2x): tsc 0/0 · eslint 0 hata · vitest 416/4893 · leak 0 · reflog commit yok
- [x] Orca tarayıcı turu (dialog: tarih alanı; kayıt yapılmadı — canlı backend eski)
- [x] Commit `9da99378` (2026-10-27 09:1x, 49 dosya, kapı yeşil)
- [ ] Yayın (Emre onayı; Convex+web birlikte) → 1c migration ayrı onay → 1d

## Kararlar (Emre 2026-10-26)
- Sabit düzenleme geçmişi → **geçerlilik tarihli sürüm**
- Esnek devamsızlık → **en az net çalışma** (sabitteki alanın aynısı)
- Esnek geç kalma e-postası → **sonra karar** (bu planda yok)
- Renk → **tamamen sil** (şema + veri)

## Notlar
- Sıra: 1 → 2 → 3 → 4 → 5 → 6 → 7. Tahmin: F1 ~45 dk, F2 ~30 dk, F3 ~20 dk, F4 ~20 dk, F5 ~1.5 sa, F6 ~3-4 sa, F7 ~1 sa.
- Eşzamanlı oturum: ngsaccess-48 (sistem audit). Motor dosyalarına dokunmadan önce `git status` bak; commit'te yalnız bu planın hunk'ları.
- Önceki iş (ağaçta, commit yok): AddShiftDialog Gelişmiş düzeni + `shiftFormSchema.test.tsx`.
