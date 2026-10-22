# W5-A DENETİM — PDKS kuralları backend (SALT-OKUMA)

Çalışma dizini: `/tmp/hik-headbuild` (W5-A diff'inin donmuş kopyası; taban commit `2b67349`). İlk iş `cd /tmp/hik-headbuild`. Kodu `git diff --cached` + yeni dosyalardan oku (`git status --short`). Yazan: Codex. Spec: `/Users/emreaydin/ngsaccess/.claude/orca-specs/w5-a-pdks-rules-backend.md`. Yazar raporu/API: `/tmp/w5a-report.md`, `/tmp/w5a-api.md`. Tasarım: `/Users/emreaydin/ngsaccess/.claude/designs/w5-pdks-codex.md` §2, §3, §5.

## YASAK
Kod/dosya düzenleme (rapor dosyası hariç), commit, push, deploy, `npx convex *`, DB yazma. Yalnız oku + kapıları koş.

## Odak (öncelik sırasıyla)
1. **Legacy birebirlik (en kritik):** sürümü olmayan tarihte `computePdksDay` + tablo/detay/bordro/rapor/dashboard/SGK/mobil sonucu bugünküyle AYNI mı. Mevcut test dosyalarında değişen beklenti var mı (`git diff --cached -- '*.test.ts'` — yalnız EKLEME beklenir). Yönsüz tek okuma, çıkış-yönlü tek okuma, manuel kayıt fallback'i legacy'de aynen mi.
2. **Tek filtre sınırı:** spec'teki TÜM çağıranlar (cardReadings ×3, reportScope/reports, sgkExport, dashboard, mobileAttendance, pdksAvailability) politika-farkında sınırdan geçiyor mu; atlanan yol var mı (`grep -rn "isPdksEligibleReading\|filterPdksReadings" convex`). Dışlanan okuma `pdksAvailability`'de günü "veri var" yapıyor mu (yanlış DV riski). Çok projeli sorguda okuma başka projenin politikasıyla mı süzülüyor.
3. **Kanıt matrisi:** tasarım §2 tablosu birebir mi (4 kombinasyon × çift/yalnız giriş/yalnız çıkış/hiç); yönsüz okuma incomplete (DV değil); iki giriş çift sayılmıyor; manuel kayıt yönüyle kanıt; tatilde eksik çıkış yalnız uyarı; `incomplete` devam/devamsız/SGK gününe girmiyor, ayrı sayaçta; sentetik saat/tam süre üretilmiyor.
4. **Sürüm/tarih:** iş günü = vardiya başlangıç günü (gece oturumu giriş gününün sürümü); sürüm sınırındaki gece; `effectiveFrom` ≥ yarın TR (UTC kayması); yürürlükteki sürüm değiştirilemiyor; aynı tarihte gelecek sürüm yerine geçme yarışı (OCC/tekillik); silme yalnız gelecek sürüm + seçimleri.
5. **Check point eşleme:** IDE kapı `deviceId+ideIoId`; tek kapılı cihaz; çok kapılı Hik kapı seçimi reddi; mobil/QR `selected`'da hariç; manuel kayıt muaf; snapshot ile silinmiş kapı; yabancı proje cihaz/kapı reddi; ≤500 hedef.
6. **Yetki/IDOR:** `publishRuleVersion`/`deleteFutureRuleVersion`/`getRules`/`listCheckpointTargets` — project_user reddi, başka proje reddi, ruleVersionId üzerinden başka projenin sürümünü silme.
7. **Kota/okuma:** yükleyici çağrı başına bir kez (okuma başına DB yok); `.take` sınırları + Türkçe hata; büyük ay (500 kişi) tablo sorgusunda ek okuma maliyeti; yeni cron/polling yok; cihaz senkronu tetiklenmiyor.
8. **SGK:** legacy tarih birebir; sürümlü tarihte `reviewDays` dönüyor; belirsiz gün sessizce "çalıştı"/"eksik gün yok" sayılmıyor.
9. **W2:** istihdam dışı gün yeni kuralla aktif olmuyor; haftalık 45 havuzuna istihdam dışı/dışlanan okuma girmiyor.
10. Şema geri uyumu (yalnız 2 yeni tablo), `_generated/api.d.ts` yalnız 2 satır, `src/**` yalnız dar tip uyumu, repo kuralları (`any`/`!`/`filter(Boolean)` yok).

## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` · `node_modules/.bin/eslint src convex` · `node_modules/.bin/vitest run` (sayıları yaz).

## Rapor
`/tmp/w5a-denetim.md`: 1-2 cümle sonuç · kapı sonuçları · ENGEL / DÜZELTİLMELİ / NOT, her biri file:line + somut senaryo + öneri. `worker_done`'da ≤10 satır özet + dosya yolu.
