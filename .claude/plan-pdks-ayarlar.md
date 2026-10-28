# Plan — PDKS ayarları → PDKS Kayıtları › Ayarlar alt sayfası (2026-10-23)

## >>> 15:20 GÜNCEL: CANLI ad025b13 (hepsi yayında), canlı tur GEÇTİ; kalan yalnız kart okutup hikCardReaderNo kontrolü + öğle arası kararı

## (eski) DEVAM NOKTASI (2026-10-23 13:50) — sıfırdan başlayan oturum BURADAN okur
- **Commit'li, yayın bekliyor:** `8f142ea8` + `6e69b6fb` (sayfa, çalışma günleri, nokta tipi, her giriş/çıkış) + `34d70c2a` (okuyucu uyarısı) + `bb7d942a` (başlık: Ayarlar bordo, İşlemler menüsü içinde Dışa aktar; Analiz + Düzeltme talepleri kaldırıldı). Kapı temiz export bb7d942a: tsc 0/0, eslint 0, vitest 345/3850 (+1 başkasının themeBootstrap kırığı).
- **localhost'ta ayar sayfası "yüklenemedi"** = Convex'te getWorkingDays/getCheckpointWarnings yok (yayın bekliyor), kod hatası değil.
- **Yayın (Emre "yayın onay"):** `git archive bb7d942a` export → `npx convex dev --once` → hemen Netlify `deploy --prod --no-build`. 1086c306 ters sıra istediğinden arada canlı cihaz İşlemler sekmesi birkaç dk bozuk. Sonra Orca'da /pdks-records/settings turu + canlı Hik cardReaderNo eşleşmesi.
- **Ek (14:10):** `9e36836c` cihaz listesi "· X önce" düzeltmesi (yalnız web). TEK YAYIN `git archive 9e36836c`.
- **Açık:** öğle arası kararı (todo.md) · ölü kod: convex/attendanceCorrections.ts + src/components/pdks/lib/analysis.ts (yalnız testler kullanıyor).

## (eski) DEVAM NOKTASI (2026-10-23 13:25) — sıfırdan başlayan oturum BURADAN okur
- **Commit'li (yayın bekliyor):** `8f142ea8` (PDKS ayarları sayfası + çalışma günleri) + `6e69b6fb` (nokta tipi + her giriş/çıkış). Kayıt `.claude/handoff-ceo-plan.md` (CEO oturumu yok; Emre "sen commit yap" dedi, 6c attı).
- **Commit'SİZ, hazır — Emre "commit at" derse at:** PDKS okuyucu uyarısı (Emre 13:00 "uyarı ekleyebilirsin"). PDKS Ayarları'nda kuralların üstünde sarı kutu: kuralda seçili okuyucu silinmiş/taşınmış · Hik okuyucunun numarası yok · cihaz bugün hariç son 7 günde tanımsız okuyucu numarası göndermiş (kapı numarası değişince olan şey).
  - Dosyalar: `convex/pdksRules.ts` (getCheckpointWarnings), `convex/schema.ts` (YENİ INDEX `cardReadings.by_device_access_time` — yalnız bu satır; şema dosyasının geri kalanı 6e69b6fb'de), `convex/pdksCheckpointWarnings.test.ts` (yeni), `src/components/pdks/settings/CheckpointWarnings.tsx` (+`.test.tsx`, yeni), `src/components/pdks/settings/PdksSettingsPanel.tsx`.
  - Kapı 13:20: tsc app+convex 0, eslint 0, TAM vitest 348/3860, find-node-leak temiz. Codex denetimi (`/tmp/pdks-okuyucu-uyari-denetim.md`) 3 DÜZELTİLMELİ buldu, üçü de düzeltildi + testlendi (gelecek sürüm bugünkü bozuk hedefi gizliyordu → sürüm başına kontrol; proje geneli son 500 okuma → cihaz başına yeni index; başka projenin okuyucusu uyarıyı bastırıyordu → proje filtresi). Düzeltme sonrası yeniden denetim YAPILMADI (istenirse Codex sol medium, aynı spec `.claude/orca-specs/pdks-okuyucu-uyari-denetim.md`).
  - Commit komutu: pathspec dosyası yaz (yukarıdaki 6 dosya) → `git add --pathspec-from-file=F && git commit --only --pathspec-from-file=F` (başlık önerisi `feat: warn when a selected PDKS reader no longer matches readings`, Co-Authored-By YOK). Sonra temiz `git archive HEAD` export kapısı (node_modules symlink) + handoff-ceo-plan.md'ye kayıt.
- **Yayın:** Emre "yayın onay" → Convex ÖNCE (şema: opsiyonel alanlar + 2 yeni cardReadings index'i, biri 49bc0ee0'dan), sonra web. Yayın sonrası: Orca'da /pdks-records/settings görsel tur + canlı Hik cardReaderNo eşleşmesi.
- **Açık karar:** öğle arası (eachPunch'ta mola düşülmüyor) → `todo.md`.
- Orca run `run_7f5fdc18400e`: tüm worker'lar release edildi; 2c denetçisi (ctx_34abfae711e1) Orca'da "user_owned" sohbet sekmesi olarak kaldı — CLI kapatamıyor, Emre elle kapatır.

## Devam notu (sıfırdan başlayan oturum için)
- **Hedef:** Hikvision'daki PDKS (Attendance) ayarlarının karşılığını tek yerde toplamak + giriş/çıkış yönünü PDKS'te doğru saymak.
- **Bitti (commit YOK, main çalışma dizininde):** Faz 0-1. Dosyalar: `src/pages/PdksSettings.tsx`, `src/components/pdks/settings/{PdksSettingsPanel.tsx,route.ts}`, `src/components/settings/useSettingsFormsGuard.ts`, `src/pages/{PDKSRecords,Settings}.tsx`, `src/App.tsx`, `src/lib/capabilities.ts`, `src/components/settings/SettingsSidebar.tsx`, silinen `src/components/settings/sections/WorkAndPayrollSettings.tsx`, testler `src/components/pdks/auditPage.test.tsx`, `src/lib/{capabilities,permissionsUI}.test.ts`, `src/components/settings/settings.test.tsx`. Doküman: `docs/hikconnect-audit/PDKS_KIYAS.md`.
- **Kanıt:** tsc 0, eslint any 0, vitest 335 dosya / 3803 test yeşil; Orca localhost:8081'de Ayarlar düğmesi → `/pdks-records/settings` → geri düğmesi ve tarayıcı geri `?report=weekly` korunarak döndü; `/settings?tab=work-payroll` → `/pdks-records/settings`.
- **Elenen:** sol menüde ayrı "PDKS Ayarları" (Emre istemedi), Kayıtlar/Ayarlar sekmesi (Emre ayrı sayfa istedi), yönü Cihazlar sayfasında ayarlamak (Hik bunu PDKS noktası tipinde yapıyor).
- **Commit:** CEO oturumunda; diğer oturumların commit'siz dosyaları da var (fingerprint*), karıştırma.
- **Faz 2 DURUMU (2026-10-23 ~11:35):** Emre 2b+2c+2d onayladı.
  - 2b BİTTİ (koordinatör, commit yok): `convex/lib/workingDays.ts` (+test 3/3), `convex/settings.ts` `getWorkingDays`/`saveWorkingDays` (schedule.manage, audit), `src/components/pdks/settings/WorkingDaysSettings.tsx` PdksSettingsPanel'in en üstünde. tsc app+convex 0, eslint temiz. UYARI: Convex'e yayınlanmadan localhost ayar sayfası "yüklenemedi" gösterir (yeni query canlıda yok) → yayın sırası Convex → web.
  - 2c ÇALIŞIYOR: Orca run `run_7f5fdc18400e`, task `task_eacd3e8cd99a`, dispatch `ctx_fa481bb6bf1f` (Codex gpt-6-astra high). Spec `.claude/orca-specs/pdks-2c-nokta-tipi.md`, rapor `/tmp/pdks-2c-rapor.md`. Worker'a izin verildi: `convex/mobileAttendance.ts` + `convex/cardReadings.ts` detail boundary'de yalnız policyFor eklemesi.
  - 11:33 cevaplar: worker'a `convex/lib/mobileAttendance.ts` summarizeMovements etkin-yön düzeltmesi izni verildi; legacy ilk/son da yön duyarlı olacak (giriş=Yalnız giriş+G/Ç noktalarında ilk, çıkış=Yalnız çıkış+G/Ç noktalarında son; tüm noktalar G/Ç iken bugünküyle birebir). 2b audit etiketleri koordinatörde eklendi: `convex/lib/auditLogQuery.ts`(+test) `generalSettings`, `src/components/audit/auditLabels.ts` `workingDays` → audit testleri 17/17.
  - 2c BİTTİ 11:39 (Codex, commit yok, rapor `/tmp/pdks-2c-rapor.md`). Koordinatör kapısı 11:41: tsc app+convex 0, eslint 0 hata, tam vitest 340/3826, find-node-leak temiz, reflog temiz. ŞEMA DEĞİŞTİ (readers.pointType/readerId hedef, cardReadings.hikCardReaderNo) → yayın sırası Convex → web.
  - 2c DENETİM ÇALIŞIYOR: Claude sonnet, task `task_342da53657b3`, dispatch `ctx_34abfae711e1`, spec `.claude/orca-specs/pdks-2c-denetim.md`, rapor `/tmp/pdks-2c-denetim.md`. Bekle: `/tmp/orca-wait-done.sh run_7f5fdc18400e <son-mesaj-zamanı> /tmp/pdks-wait.json`. ENGEL/DÜZELTİLMELİ varsa aynı Codex worker'a (ctx_fa481bb6bf1f thread) fix; sonra 2d.
  - 2c DENETİM BİTTİ 11:42: ENGEL yok (`/tmp/pdks-2c-denetim.md`). Koordinatör 2 düzeltme yaptı: `convex/lib/gateway/events.ts` string cardReaderNo kabul, `convex/pdksRules.ts` kapısız/okuyucusuz hedefte doğru hata mesajı (+test, 13/13). 3. madde (reader hikReaderNo sonradan değişirse kural sessiz boşa düşer) kabul edilen risk, snapshot ayrı iş. NOT: PDKS tablosu etkin yönü, Kart Okumaları ham yönü gösterir — tipli noktada iki ekran farklı yön gösterebilir.
  - 2d ÇALIŞIYOR 11:44: Codex gpt-6.1-sol medium, task `task_3a1471b5ee5b`, dispatch `ctx_a07c76f0a836`, rapor `/tmp/pdks-2d-rapor.md`. Spec'e 2c durumu + pdksPayroll/TableQuery/PayrollQuery ownership eklendi.
  - 2d BİTTİ 11:55 (Codex, commit yok, rapor `/tmp/pdks-2d-rapor.md`). Koordinatör kapısı 11:57: tsc app+convex 0, eslint 0 hata, tam vitest 345/3849, leak temiz. ŞEMA: pdksRuleVersions.calculationMode/minPunchIntervalMinutes (opsiyonel). 11:44 başka oturum 49bc0ee0 commit'i (canlı izleme arama) cardReadings.ts/schema.ts'den yalnız kendi hunk'larını almış, 2c/2d sızmadı (doğrulandı).
  - 2d DENETİM ÇALIŞIYOR 11:57: Claude sonnet, task `task_d93f4c4a4615`, dispatch `ctx_25f7edced357`, rapor `/tmp/pdks-2d-denetim.md`.
  - 2d DENETİM BİTTİ 11:59: ENGEL yok (`/tmp/pdks-2d-denetim.md`). Koordinatör düzeltti (12:03): `convex/lib/pdksPunchPairs.ts` yönler önce çözülür, elle uç sonra; yönsüz ilk okumada elle giriş "yerine geç / ekle" adaylarından eksik ucu az olan; tekrar okutma son kabul edilene göre; çağıranlar `pdksEvidence.ts`/`pdksDay.ts` minInterval geçiyor; +2 test. Kapı: tsc 0/0, eslint 0, tam vitest 345/3850.
  - FIX DENETİMİ ÇALIŞIYOR 12:04: Codex sol medium, task `task_da653fbcc376`, dispatch `ctx_fd4cd11b3ae8`, rapor `/tmp/pdks-2d-fix-denetim.md`.
  - Açık NOT'lar (yayın engeli değil): esnek vardiyada eachPunch pencere kontrolünü atlıyor (pdksDay `flex && !eachPunch`); G G Ç Ç → ikinci Ç yetim → İnceleme.
  - Emre'ye sorulacak ürün kararı: eachPunch'ta mola düşülmüyor (mola = dışarıda geçen süre); öğlen kart okutmayan kişi molası ödenmiş sayılır. Hik davranışıyla kıyasla.
  - (eski) 2d SPEC HAZIR, 2c bitince başlat: `.claude/orca-specs/pdks-2d-her-giris-cikis.md` (Codex gpt-6.1-sol medium, aynı run).
  - Bekle: `orca orchestration check --run run_7f5fdc18400e --wait --types "worker_done,escalation,question" --timeout-ms 900000 --json`. worker_done gelince: kapıları KENDİN koş (tsc app+convex, eslint, tam vitest, `node /tmp/find-node-leak.mjs` varsa), `git reflog -5` ile commit atılmadığını doğrula, Claude sonnet ile denetim (yazan denetlemez), sonra 2d'yi başlat.

## COMMIT'Lİ (2026-10-23 12:30, Emre "sen commit yap") — `8f142ea8` (sayfa + çalışma günleri) + `6e69b6fb` (nokta tipi + her giriş/çıkış). Temiz export kapısı tsc 0/0, eslint 0, vitest 343/3845. YAYIN BEKLİYOR (Emre "yayın onay", Convex → web). Kayıt: handoff-ceo-plan.md

## (eski) CEO TESLİM (2026-10-23 12:15) — Faz 0-2 HAZIR
**Kapı (koordinatör, 12:10, son düzeltmeden sonra):** tsc app+convex 0 · eslint 0 hata · tam vitest 345/3850 · find-node-leak temiz · 3 bağımsız denetim (2c sonnet, 2d sonnet, 2d-fix codex) ENGEL yok.
**Yayın sırası ZORUNLU: Convex → web.** Şema: `pdksRuleVersions` (+calculationMode, +minPunchIntervalMinutes, targets.targetType+"reader", +readerId, +pointType), `cardReadings.hikCardReaderNo` — hepsi opsiyonel, migration yok. Web önce çıkarsa PDKS Ayarları sayfası "yüklenemedi" der (getWorkingDays yok).
**Commit dosyaları (hepsi PDKS işi; başka oturum hunk'ı yok, 12:14 kontrol edildi):**
- Faz 0-1 (sayfa taşıma): src/App.tsx · src/pages/{PdksSettings.tsx(yeni),PDKSRecords.tsx,Settings.tsx} · src/components/pdks/settings/** (yeni) · src/components/settings/useSettingsFormsGuard.ts (yeni) · src/components/settings/SettingsSidebar.tsx · src/components/settings/sections/WorkAndPayrollSettings.tsx (SİLİNDİ) · src/lib/capabilities.ts · testler: src/components/pdks/auditPage.test.tsx, src/lib/{capabilities,permissionsUI}.test.ts, src/components/settings/settings.test.tsx
- 2b çalışma günleri: convex/lib/workingDays.ts(+test, yeni) · convex/settings.ts · convex/lib/auditLogQuery.ts(+test) · src/components/audit/auditLabels.ts
- 2c nokta tipi: convex/schema.ts · convex/pdksRules.ts · convex/lib/{pdksRules,pdksSource,pdksWorkDay,pdksTableQuery,pdksPayrollQuery,reportScope,reportAttendance,mobileAttendance,processCardReadingCore,cardReaderParse}.ts · convex/lib/gateway/events.ts · convex/{http,cardReadings,mobileAttendance}.ts · src/components/settings/sections/components/{pdksRulesModel.ts,pdksRulesCheckpointFields.tsx,pdksRulesConfirmation.tsx,PdksRulesSettings.tsx} · testler (yeni): convex/pdksCheckpointTypes.test.ts, convex/lib/gateway/events.checkpoint.test.ts, src/components/settings/sections/components/pdksRulesCheckpointTypes.test.tsx
- 2d her giriş/çıkış: convex/lib/pdksPunchPairs.ts(+test, yeni) · convex/lib/{pdksDay,pdksEvidence,pdksTable,pdksPayroll}.ts · src/components/settings/sections/components/pdksRulesPunchFields.tsx · testler (yeni): convex/pdksEachPunch.test.ts, src/components/settings/sections/components/pdksRulesEachPunch.test.tsx
- Önerilen commit'ler: `feat: move PDKS settings to a page under PDKS records` · `feat: working days setting for PDKS` · `feat: PDKS checkpoint types and Hik reader number` · `feat: each check-in/out PDKS calculation mode`
**Yayın sonrası:** Orca'da /pdks-records/settings görsel tur (çalışma günleri kaydet, nokta tipi seç, hesap modu + onay özeti); canlı Hik cihazında cardReaderNo ↔ readers.hikReaderNo eşleşmesi.
**Bilinen sınırlar (yayın engeli değil):** reader hikReaderNo sonradan değişirse kural sessiz boşa düşer · PDKS tablosu etkin yönü, Kart Okumaları ham yönü gösterir · eachPunch'ta esnek pencere kontrolü atlanıyor · yönsüz okuma + iki elle uçta eşitlik "yerine geç" (12,13,17 + elle 08/18 → 360 dk, testte belgelendi) · eachPunch'ta mola düşülmüyor (Emre sonra konuşacak → todo.md).

## Checklist

### Faz 0 · Ayrı menüyü geri al — BİTTİ 2026-10-23 11:00
- [x] `/pdks-settings` menü kaydı, rota, sayfa silindi; tema izin listesi + nav testi HEAD haline döndü

### Faz 1 · PDKS Ayarları alt sayfası — BİTTİ 2026-10-23 11:20 (commit yok)
- [x] Emre 11:10: sekme DEĞİL ayrı sayfa → `/pdks-records/settings` (`src/pages/PdksSettings.tsx`), menüde yok; PDKS Kayıtları başlığında "Ayarlar" düğmesi (yalnız `schedule.manage`), sayfada "‹ PDKS Kayıtları" geri düğmesi (kayıtlardan gelindiyse `navigate(-1)` → filtreler korunur); tarayıcı geri de çalışır
- [x] İçerik `src/components/pdks/settings/PdksSettingsPanel.tsx`: Mesai politikası + PDKS devam kuralları + Tatil takvimi (karar 2: hepsi taşındı)
- [x] Ayarlar › "Mesai ve tatil" bölümü kaldırıldı (`work-payroll`); eski `/settings?tab=work-payroll` → `/pdks-records/settings`
- [x] Kaydedilmemiş değişiklik koruması ortak hook: `src/components/settings/useSettingsFormsGuard.ts` (Settings + PDKS)
- [x] Kapı: tsc 0, eslint any 0, vitest 3803/3803; Orca'da düğme → sayfa → geri düğmesi/tarayıcı geri (filtre korunur) + eski bağlantı yönlendirmesi doğrulandı

### Faz 2 · Audit P1 içeriği (~12 sa) — kaynak `docs/hikconnect-audit/PDKS_KIYAS.md` §3
- [x] ~~2a Backfill okumalarına yön~~ → İPTAL (Emre 2026-10-23): yön okumaya yazılmayacak, PDKS hesabı anında noktanın tipinden okunacak (2c içinde); backfill/sıra sorunu kendiliğinden kalkar
- [x] 2b Çalışma günleri (hafta sonu) arayüzü → PDKS Ayarları sayfası — BİTTİ 2026-10-23 ~11:30 (commit yok)
- [x] 2c PDKS nokta tipi (BİTTİ 11:39, denetim sürüyor) (Giriş+Çıkış / Yalnız giriş / Yalnız çıkış) + Hik `cardReaderNo` kaydı · ~6 sa — TASARIM: etkin yön = hesap anında okumanın noktasının tipi (kural sürümüne bağlı); Yalnız giriş/çıkış kesin, Giriş+Çıkış noktasında Hik gibi ilk okuma giriş / son okuma çıkış; `cardReadings.direction` yalnız ekran/eski veri yedeği
- [x] 2d Hesap modu (BİTTİ 11:55, denetim sürüyor) "her giriş/çıkışı topla" (min. aralık) · ~4 sa

### Faz 3 · Kapı + teslim
- [x] tsc 0 · eslint `no-explicit-any` 0 · tam vitest (src + convex) — 12:10, 345/3850
- [x] Orca'da görsel kontrol: PDKS Kayıtları başlığı + İşlemler › Dışa aktar (13:40); ayar sayfası yayın sonrası
- [x] Commit 8f142ea8 + 6e69b6fb (12:30) + 34d70c2a okuyucu uyarısı + bb7d942a başlık sadeleştirme (13:45)
- [x] Yayın: CANLI ad025b13 2026-10-23 15:15 (ngsaccess-26 yayınladı; 8f142ea8..9e36836c dahil). 15:20 canlı tur: /pdks-records/settings yüklendi (çalışma günleri, mesai, devam kuralları, tatil), uyarı yok; başlık Ayarlar / İşlemler
- [ ] Canlı Hik cardReaderNo: yayından sonra henüz okuma yok (son 14:02). NGS0001/NGS0002'de kart okut → cardReadings.hikCardReaderNo = 1 olmalı (readers.hikReaderNo = 1)

## Kararlar (Emre 2026-10-23)
1. Yer: PDKS Kayıtları'ndan açılan ayrı alt sayfa (önce sekme denendi, Emre ayrı sayfa istedi).
2. Mesai politikası + tatil takvimi de taşındı.

## Yöntem
- Faz 0-1, 2a, 2b küçük → koordinatör kendisi.
- 2c, 2d → Orca Codex worker (2c K3 tasarım `gpt-6-astra high`, 2d K2 `gpt-6.1-sol medium`), denetim Claude sonnet (yazan denetlemez). Spec'e git add/commit yasağı yazılır.
