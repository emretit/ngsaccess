# Hik-Connect Web Planı — W3–W6 (W1/W2 CEO'da)

> **Tarih:** 2026-10-21 · **Girdi:** [HIKCONNECT_BIRLESIK.md](HIKCONNECT_BIRLESIK.md) §8 · **Yürütücü:** bu oturum (`ngsaccess-65`).
> **İş bölümü (Emre ~12:05):** CEO (`ngsaccess-2f`) = W1 yayını + W2 + drawer + tek yayın + push (`.claude/handoff-ceo-plan.md`, K4). Bu oturum = W3, W4, W5, W6 (W6 drawer commit'inden sonra). CEO'ya bildirildi.

## Checklist

### Faz 0 — W1 ön kontrol (bitti, yayın CEO'da)
- [x] 0.1 Ön kontrol: canlı function-spec = `71163d0` yayın sonrası spec'i ile **birebir aynı** (437 fn). `c23926d` farkı: `leaveRequests` +4 fn, `leaves` 2 opsiyonel alan + index `by_project_status`; cron/http yok → "Deleted" beklenmez. `305f227` yalnız `mobile/**`
- [x] 0.2 Temiz kapı `c23926d` (`/tmp/hik-headbuild`, `/tmp/hik-gate.sh`): tsc 0/0 · eslint 0 · vitest 230 dosya / 2356 test · build OK
- [x] 0.3 Yayın + push → CEO'nun Faz 4'üne devredildi (W1+W2+drawer tek yayın)

### Tasarımlar — BİTTİ (12:03-12:20)
- [x] W3a: Claude + Codex → sentez `.claude/designs/w3-sentez.md`
- [x] W4a: Claude + Codex → sentez `.claude/designs/w4-w5-sentez.md`
- [x] W5a: Codex → aynı sentez
- Kararlar (Emre ~12:20): **2FA şimdilik YOK** · dondurma/bitiş project_admin de kendi projesinde · oturum 7 gün · bitişte tek seferlik iş · 2 açık hemen (W4'ten önce) · W4 önce şablon sonra yetki ekranı · W5 dört parçanın hepsi · sıra: açıklar → W4 → W5

### W3 — Dondurma + erişim bitişi + 7 gün oturum + guard açıkları · ~3-4 sa
- [x] W3b uygulama (12:28; koordinatör kapısı tsc 0/0, eslint 0, vitest 2433/2433) — Codex sol medium, worktree `~/orca/workspaces/ngsaccess/w3-account-access` (dal `emretit/w3-account-access`, taban `4e2ef07`), `task_ed5a126e58f2` · spec `.claude/orca-specs/w3b-account-access.md`
- [x] Denetim (Claude opus: 0E/3D/6N) → düzeltme turu (12:39) → kapı tsc 0/0, eslint 0, vitest 2448/2448
- [x] Commit `8c85462` (main'de, 2026-10-22 15:30)

### W4.0 — 2 erişim açığı · ~0,5-1 gün
- [x] (12:27; kapı tsc 0/0, eslint 0, vitest 2426/2426) Hik çok kapılı cihazda kapı kapsamı + aynı cihazda çoklu kural; bulut kararında (ESP32/QR) gün/saat kontrolü — Codex sol medium, worktree `~/orca/workspaces/ngsaccess/w4-0-access-fixes`, `task_1b65ef8bf699` · spec `.claude/orca-specs/w4-0-access-fixes.md`
- [x] Denetim (Claude sonnet: 0E/4D/5N) → düzeltme turu (12:40) → kapı tsc 0/0, eslint 0, vitest 2434/2434
- [x] Canlı sayım 0/0/0 → commit `42e146b` (main'de)
- [ ] Cihazda doğrulama: virgüllü `planTemplateNo`, son dakika; Windows köprüsü çoklu plan C# desteği

### W4.1 — Zaman şablonu · ~2 gün (W4.0'dan sonra)
- [x] `4e11b2a` — Şablon CRUD + 7×24 editör + sihirbaz seçici + fail-closed çözücü + Hik/IDE/mobil/bulut çeviri + tek birleşik senkron; tatil yok

### W4.2 — Yetki durumu ekranı · ~2 gün
- [x] `e0d4ba2` — `accessGrantStatus` + Overview (sayfalı, reaktif değil); Etkin = cihaz kabul etti (IDE ack / Hik HTTP 200)

### W5 — PDKS kuralları · ~5-7 gün (W4'ten sonra)
- [x] W5.1 Check point (kapı + cihaz düzeyi) — `8146beb`
- [x] W5.2 Giriş/çıkış zorunluluğu (legacy varsayılan, tarihli kural sürümü) — `8146beb`
- [x] W5.3 Esnek vardiya — `c64d240`
- [x] W5.4 PDKS export kolon seçici — `965d0fa`

### W6 — Küçükler · ~4 sa · drawer commit'inden SONRA
- [x] Denetim kaydı Excel + vardiya toplu temizle/dışa aktar `48419e7` · haftalık kapı planı `4495c33` · cihaz bağlantı geçmişi `4e2d565`
- [x] Canlı ön kontrol (2026-10-22): 16 kapının hiçbirinde eski `hikDoorStatusPlan` yok → begin≥end hatası riski 0
- [ ] Cihazda doğrulama: `remainClosed` + haftalık plan firmware davranışı

### Yayın
- [ ] W3–W6 tek yayın (main `4e2d565`, 15 commit) — CEO oturumunda, Emre "yayın onay" ile (reçete `.claude/handoff-ceo-plan.md` en üst)

## Neden bu sıra
| Karar | Gerekçe |
|---|---|
| W1/W2 CEO'da | Emre K4: W1+W2+drawer tek yayın; iki koordinatör aynı dosyaya yazmaz |
| W6 drawer'dan sonra | Cihaz detayı drawer işiyle çakışıyor |
| W3 ∥ CEO işleri | W3 auth/users/system-admin · CEO employees/rapor/SGK/devices — ayrık |
| W3 ve W4 önce tasarım | W3 kimlik doğrulama (yarım 2FA kullanıcıyı kilitler) · W4 cihaz senkronu (yanlış şablon kapıyı açık/kapalı bırakır) |
| W4 ∥ W5 | W4 accessRules + senkron · W5 pdksCalc + shifts; ayrık |

## Paket sahiplikleri (worker yazar, başkası yazmaz)
| Paket | Sahip dosyalar | Dikkat |
|---|---|---|
| W2 | YENİ `convex/employeeTermination.ts`, YENİ `convex/lib/employment.ts`, `convex/lib/reportAttendance.ts`, `convex/sgkExport.ts`, `convex/cardReadings.ts` (yalnız PDKS detay filtresi hunk'ı), `convex/crons.ts` (tek satır), EmployeeDetails ayrılış diyaloğu, Kişiler "Ayrılanlar" filtresi + testler | `cardReadings.ts` Flutter ile ortak → hunk commit |
| W3 | `convex/auth.ts` çevresi, YENİ OTP modülü, `convex/users.ts` (dondur/son kullanma), `/login` 2FA adımı, `/system-admin` kullanıcı sekmesi + testler | Tasarım onayından önce kod yok |
| W6 | `src/pages/AuditLog.tsx` + export yardımcısı, Cihaz detayı çevrimdışı geçmişi, `src/pages/Shifts.tsx` toplu temizle/dışa aktar, `EditDoorDialog` + `hikDoorStatusPlan` | Kapı planı Hik cihazına yazıyor → canlı cihaz yokken test mock ile |
| W4 | `convex/accessRules.ts`, YENİ zaman şablonu modülü, senkron çevirisi (Hik/IDE), `/access-control` şablon + yetki durumu ekranı | Mevcut kurallar şablonsuz çalışmaya devam eder (geri uyum) |
| W5 | `convex/lib/pdksCalc.ts`, vardiya tanımı, ayarlar (attendance rule, check point), rapor kolon seçici | Geniş test yüzeyi; tam vitest şart |

Ortak yasaklar (her spec'e gömülür): schema/App.tsx/routeMeta/_generated yazma yok (koordinatör yazar) · commit/push/deploy/`npx convex *`/DB yazma yok · yeni polling yok (Convex Free kota; yalnız W2'nin günlük cron'u) · kişi verisi loglanmaz · `mobile/**` dokunulmaz.

## Karar noktaları (paket başında sorulur, şimdi gerekmez)
1. **W2:** ayrılış tipleri listesi (istifa / işveren feshi / emeklilik / sözleşme sonu / diğer) yeterli mi?
2. **W3:** 2FA kimler için zorunlu? (öneri: super_admin + project_admin zorunlu, project_user opsiyonel)
3. **W4:** mevcut kurallar otomatik şablona çevrilsin mi, yoksa şablon yalnız yeni kurallarda mı?
4. **W5:** esnek vardiyada geç kalma sayılmaz, eksik süre = devamsız süre — onay?

## Yöntem
- Akış: spec (`.claude/orca-specs/<paket>.md`, şablon `w1-talepler.md`) → Orca Codex worker → kendi kapı koşumum → Claude denetimi (diff + kapı; rapora güvenilmez) → aynı worker'a düzeltme → temiz worktree kapısı → pathspec commit (Emre onayı).
- Kapı: `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/eslint <dosyalar>` · `npx vitest run`; commit öncesi `/tmp/ceo-gate.sh` temiz worktree'de.
- Yayın: dalga sonunda tek seferde; Convex `dev --once` temiz worktree'den, web Netlify CLI ayrı adım. Push öncesi `origin/main..HEAD` kontrolü + CEO'ya haber.
- Kota (2026-10-21): Codex haftalık %5, Claude haftalık %63 → Codex varsayılan.
