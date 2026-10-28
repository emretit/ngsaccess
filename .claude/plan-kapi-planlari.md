# Kapı planları → Geçiş Kontrol (plan, 2026-10-23 13:45)

> **OTURUM KAPANDI (ngsaccess-55, 2026-10-23 ~15:30).** Açık işler:
> 1. Emre kararı bekliyor: kapı planı penceresine "Bu saatler dışında kapı normal çalışır" açıklaması (~10 dk) ve/veya "Mesai dışı kilitli"
>    kısayolu (mesai saatini gir → kalan saatler otomatik remainClosed, ~45 dk). Emre planı "bu saatlerde çalışsın, dışında çalışmasın" sandı;
>    gerçekte plan dışı saatler = normal mod (plans.ts EMPTY_SEGMENT enable:false). Kişi bazlı saat kısıtı = Zaman Şablonları + Kurallar.
> 2. NGS0002 cihaz testi (Emre onayı; "sürekli açık" sonrası Kapalı'ya geri al) · 3. Sanal okuyucu tabletle gerçek QR okutma.
> 4. İsteğe bağlı: Hik-Connect /openingAndClosing (Remain Unlocked & Locked) salt-okuma doğrulaması; "Super Access" kişi bayrağı bizde yok.

> **COMMIT'LENDİ (2026-10-23, ngsaccess-55, Emre "commit ve push"):** `32c43288` sanal okuyucu + yön temizliği (35 dosya) ·
> `f126d94c` kapı planları + `603619e3` refactor + `121dc50f` fix (>50 tümünü seç, tarih+saat, geçersiz tatil tarihi, capabilitySnapshot) + `ad025b13` refactor — origin ad025b13 (26 dosya; L2 düz metin kapı adı, L3 ConvexError, L4 doors.update/create plan argümanı accessRules.manage ister,
> L6 rapor docs/door-plans/'a taşındı; L7 bilgi). Kapı: iki staged tree ayrı ayrı temiz export → tsc 0/0, eslint 0 hata, leak temiz,
> vitest 347/3858 ve 353/3927; çalışma ağacında 356/3954. Vardiya dosyaları (schema.ts shifts.color, App.tsx ShiftDefinitions) ağaçta bırakıldı.
> CANLI ad025b13 (2026-10-23 15:15, ngsaccess-26). Orca turu GEÇTİ (sekme, dialog İptal ile, Cihaz ekle → Sanal okuyucu).
> ESKİ KALAN: (1) yayın Convex → web (Emre onayı) · (2) yayın sonrası Orca turu (/access-control?tab=doors — şu an listPlanTargets canlıda yok,
> sekme hata sınırına düşüyor) · (3) NGS0002 cihaz testi (Emre onayı; "sürekli açık" sonrası Kapalı'ya geri al).

Hedef: Kapı durum planı + doğrulama modu planı Geçiş Kontrol sayfasında yeni "Kapı Planları" sekmesinde yönetilsin.
Emre: "önce hepsini oraya taşı, sonra tek tek düzeltiriz" → Faz 1 = olduğu gibi taşı, Faz 2 = iyileştirmeler.

## Orca koordinasyonu (2026-10-23 13:20)
- Run: run_492d7fdcb76d · Faz 1: task_c5ee2b6605ee / dispatch ctx_1474693586a2 (codex gpt-6.1-sol medium), spec .claude/orca-specs/kapi-planlari-faz1.md
- Faz 1 BİTTİ 13:26 (kapılar koordinatörde yeşil, 3870/3870). Faz 2: task_8b88e11fa383 / dispatch ctx_924b7470eede (codex gpt-6-astra high) BİTTİ 13:55 (koordinatör kapıları 3891/3891). Denetim: Claude opus, spec .claude/orca-specs/kapi-planlari-denetim.md, rapor .claude/orca-specs/kapi-planlari-denetim-rapor.md
- Denetim BİTTİ 14:05: 1Y/4O/7D (rapor .claude/orca-specs/kapi-planlari-denetim-rapor.md). Düzeltme: task_f74485c17e22 / ctx_51c203108042 (codex astra high, spec kapi-planlari-fix1.md) BİTTİ 14:25 — Y1+O1–O4 + L1/L5 düzeltildi, 35 test eklendi; koordinatör kapıları: vitest 3927/3927, tsc convex 0, eslint 0 error, node-leak OK (tsc app'teki 2 hata başka oturumun DeviceAudit.test.tsx/types/device.ts işi). Bırakılan: L2/L3/L4/L6/L7 (raporda). Commit/yayın CEO'da.
- Takip: `ORCA orchestration check --wait --types "worker_done,escalation,question" --timeout-ms 900000 --json`

## SONUÇ (14:25)
- Faz 1 + Faz 2 (5 alt iş) + denetim + düzeltme BİTTİ, commit'siz. Run run_492d7fdcb76d, tüm işçiler release edildi.
- Şema: doors'a yalnız opsiyonel alanlar (hikDoorHolidayPlan/Slots, hikDoorStatusTemplateId/UpdatedAt, hikPlanSavedAt/Revision/AppliedAt/ApplyError/Results, hikVerifyPlan.weekly + 2 doğrulama izi).
- Yayın: Convex (`dev --once`, temiz export) → web. Sanal okuyucu işiyle birlikte (.claude/handoff-sanal-okuyucu.md).
- CİHAZDA DOĞRULANMADI (NGS0002, Emre onayıyla): okuyucu readerNo bağlantısı, tatil üstünlüğü/kapasite, durum şablon slotu doorNo+100, capability bayrakları. "Sürekli açık" testi sonrası Kapalı'ya geri al.

## Checklist

### Faz 1 — Olduğu gibi taşı (~1,5 saat)
- [ ] 1. Backend: `doors.updatePlans` mutation (yalnız `hikDoorStatusPlan` + `hikVerifyPlan`; yetki `accessRules.manage`). `doors.update` plan alanlarını şimdilik kabul etmeye devam eder (geriye uyum).
- [ ] 2. Backend: `applyDoorStatusPlan` / `applyVerifyPlan` yetkisi `devices.manage` → `accessRules.manage` (convex/lib/gatewayCommand.ts ~543 ve ~655, `internal.roles.checkPermission`). Önce rol tablosuna bak: kim kazanır/kaybeder (convex/lib/roleCatalog.ts ROLE_DEFAULTS).
- [ ] 3. Backend: `doors.listPlanTargets` query — projedeki Hik gateway kapıları: kapı adı, cihaz adı, bölge, cihaz çevrimiçi mi, mevcut iki plan.
- [ ] 4. UI: `UnifiedAccessControl.tsx` → 4. sekme "Kapı Planları" (`?tab=doors`, yalnız `accessRules.manage`). Liste: kapı · cihaz · durum planı özeti ("Pzt–Cum 08–18 sürekli açık" / "Kapalı") · doğrulama modu özeti.
- [ ] 5. UI: `DoorPlanDialog` — eski EditDoorDialog'un plan kısmı: DoorStatusPlanSection + DoorStatusPlanEditor + DoorVerifyPlanSection + DoorSaveResults (kaydet → cihaza gönder → hata varsa "Tekrar gönder"). Eski kod: `git show HEAD:src/components/access-control/EditDoorDialog.tsx` (satır ~96–250).
- [ ] 6. Testler: eski "haftalık kayıt" testini (`git show HEAD:src/components/access-control/DoorStatusPlanEditor.test.tsx`, son describe) DoorPlanDialog'a taşı; updatePlans + yetki için convex testi.
- [ ] 7. Kapılar: `tsc -p tsconfig.app.json`, `eslint src convex`, tam `vitest run`, `node scripts/find-node-leak.mjs`.
- [ ] 8. Orca tarayıcı turu: sekme + dialog görünümü. Cihaza GÖNDERİM yalnız Emre onayıyla (bkz. Riskler).

### Faz 2 — Düzeltmeler (Emre tek tek seçer)
- [ ] Zaman şablonuyla birleştir: haftalık editör yerine mevcut zaman şablonu seç + mod (sürekli açık/kilitli). Model farkı: şablon `{start,end}`, kapı planı `{beginTime,endTime,mode}`.
- [ ] Doğrulama modu planını haftalık yap (şu an tek günlük pencere).
- [ ] Toplu uygula: birden çok kapıya aynı plan.
- [ ] Tatil günleri planı (cihazda `DoorStatusHolidayPlanCfg` desteği var).
- [ ] Kapı satırında "cihaza gönderildi / bekliyor / hata" durumu.

## Kavram (karıştırma)
- Zaman şablonu (`accessScheduleTemplates`) = KİŞİ hangi saatte geçebilir (erişim kuralına bağlı).
- Kapı durum planı = KAPI herkes için sürekli açık / normal / sürekli kilitli (`remainOpen|normal|remainClosed`), gün başına ≤8 aralık.
- Doğrulama modu planı = belirli saatte ne istenir (kart, yüz, parmak izi, kart veya yüz, kart+şifre, kart+yüz).
- Hik-Connect karşılığı: Access Control → Application → Remain Unlocked & Remain Locked (sayfa 2026-10-19'da boş açıldı, doğrulanmadı).

## Riskler
- "Sürekli açık" cihaza gönderilince kapı gerçekten açık kalır → canlı test yalnız NGS0002 + Emre onayı, test sonrası "Kapalı" geri gönder.
- Yalnız Hik gateway kapıları desteklenir; IDE, Hik localBridge ve sanal okuyucu kapsam dışı (backend göndermiyor).
- Mevcut planlar cihazda çalışmaya devam ediyor; şu an düzenleyen ekran yok (Cihazlar → Kapıyı Düzenle'den 13:30'da kaldırıldı).

## Bağlam
- Önceki iş (sanal okuyucu + yön temizliği + kapı planı kaldırma) commit'siz: `.claude/handoff-sanal-okuyucu.md`. Bu plan o değişikliklerin üstüne kurulur; commit/yayın CEO oturumunda.
- Dosyalar: src/components/access-control/{EditDoorDialog,DoorStatusPlanEditor}.tsx, door-dialog/*, doorPlanResult.ts,
  unified/UnifiedAccessControl.tsx, convex/doors.ts, convex/lib/doorStatusPlan.ts, convex/lib/gatewayCommand.ts, convex/actions/hikGatewayDevice.ts.
