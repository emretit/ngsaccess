# MOBİL TALEPLER (izin + PDKS düzeltme) — NGS Plus 1.0.5

Çalışma dizini: `/Users/emreaydin/ngsaccess` (main). Worktree AÇMA. Aynı ağaçta başka oturumlar da var: YALNIZ Ownership listendeki
dosyalara yaz; listede olmayan bir dosyaya dokunman gerekirse DUR ve `ask` ile koordinatöre sor.

## Hedef (test edilebilir)
Çalışan mobil uygulamadan (1) izin talebi açar, (2) PDKS düzeltme talebi açar, (3) kendi taleplerini durumuyla görür
(Bekliyor / Onaylandı / Reddedildi / Geri çekildi + yönetici karar notu), (4) bekleyen talebini geri çeker. Sunucu reddi
her zaman tipli koddan yerelleştirilmiş TR/EN metinle gösterilir (sunucu metni ekrana basılmaz). Testlerle kanıtlı.

## Mevcut backend (canlı, c23926d) — imzalar
- `leaveRequests:submit` (employeeAuthedMutation) args `{ sessionToken, leaveType, startDate, endDate, notes? }` → leaveId.
  leaveType: annual|sick|excuse|unpaid|parental|marriage|bereavement|paternity|lactation|compensatory. Tarihler `YYYY-MM-DD`.
- `leaveRequests:withdraw` `{ sessionToken, leaveId }` → null (bekleyen kaydı SİLER; yalnız `status=pending && source=employee`).
- `leaveRequests:listMine` `{ sessionToken }` → son 365 gün, ≤100 `leaves` dokümanı (alanlar: `_id, leaveType, startDate, endDate,
  status pending|approved|rejected, notes?, decisionNote?, decidedAt?, source? admin|employee, createdAt`). `source` boş/admin = yönetici kaydı → geri çekilemez.
- `attendanceCorrections:submit` `{ sessionToken, date, correctionType checkIn|checkOut|both, requestedCheckIn?, requestedCheckOut?, reason }` → id.
  Saatler `HH:mm`; türe göre yalnız gereken saat(ler) gönderilir, fazlası reddedilir.
- `attendanceCorrections:withdraw` `{ sessionToken, id }` → null (status → withdrawn).
- `attendanceCorrections:listMine` `{ sessionToken }` → son 90 gün, ≤100 doküman (`_id, date, correctionType, requestedCheckIn?, requestedCheckOut?,
  reason, status pending|approved|rejected|withdrawn, decisionNote?, decidedAt?, createdAt`).
- Kurallar: izin başlangıcı en çok 30 gün geçmiş, aralık ≤60 gün, bitiş ≥ başlangıç, not ≤500, ≤10 bekleyen, bekleyen/onaylı izinle çakışma yok.
  Düzeltme tarihi bugün..bugün−30 (Europe/Istanbul), gerekçe trim sonrası 5–300, aynı gün için tek bekleyen.

## Bölüm A — Backend: çalışan uçlarında tipli hata kodu
Mobil sözleşmesi (`mobile/lib/core/errors.dart`): sunucu metni gösterilmez, yalnız allowlist'teki `code` yerelleştirilir.
Bugün bu 4 uç düz Türkçe `ConvexError("...")` fırlatıyor → mobil hepsini "İşlem tamamlanamadı" gösterir. Değişiklik:
- Yalnız `leaveRequests.submit/withdraw` ve `attendanceCorrections.submit/withdraw` + `convex/lib/requestRules.ts` validator'larındaki
  her `throw` → `new ConvexError({ code, message })`; `message` mevcut Türkçe metnin AYNISI (davranış/metin değişmez).
- Kod listesi (sözleşme — adları değiştirme):
  `REQUEST_PROJECT_MISSING` · `REQUEST_NOTE_TOO_LONG` · `REQUEST_DATE_INVALID` · `REQUEST_RANGE_INVALID` (bitiş<başlangıç) ·
  `REQUEST_START_TOO_OLD` · `REQUEST_RANGE_TOO_LONG` · `REQUEST_PENDING_LIMIT` (10 bekleyen VE tarama sınırı) ·
  `REQUEST_OVERLAP_PENDING` · `REQUEST_OVERLAP_APPROVED` · `REQUEST_NOT_FOUND` (yok/başkasının) · `REQUEST_NOT_PENDING` ·
  `CORRECTION_DATE_OUT_OF_RANGE` · `CORRECTION_REASON_LENGTH` · `CORRECTION_TIMES_MISMATCH` · `CORRECTION_TIME_INVALID` · `CORRECTION_PENDING_EXISTS`.
- Kod tipi + `requestError(code)` yardımcısı `convex/lib/requestRules.ts` içinde (yeni top-level modül AÇMA).
- Yönetici uçlarına (`listPending`, `approve`, `reject`, `upsertManual` vb.) DOKUNMA.
- Testler: `convex/leaveRequests.test.ts`, `convex/attendanceCorrections.test.ts`, `convex/lib/requestRules.test.ts` — her kod en az bir testte
  `ConvexError.data.code` ile doğrulanır; mevcut testler yeşil kalır.

## Bölüm B — Flutter
Mevcut kalıpları izle: `HttpConvexClient.employeeQuery/employeeMutation` (sessionToken istemci ekler), repository + DTO `fromJson` +
malformed → `ProtocolError`, provider (ChangeNotifier), `localizeAppError`, `core/attendance_date.dart` (TR günü), l10n ARB.
1. **Hata kodları:** Bölüm A'daki 16 kodu `normalizeBusinessCode` allowlist'ine ekle (`errors.dart`), `localizeAppError`'da her biri ayrı
   l10n anahtarına gitsin (TR + EN). `userMessage` (TR yedek) de eşlensin.
2. **Repository** `lib/repositories/request_repository.dart`: 6 uç. Mutasyonlarda `retry: false` (varsayılan) — otomatik yeniden gönderme YOK.
3. **Modeller:** izin talebi + düzeltme talebi DTO'ları. Bilinmeyen `status`/`leaveType` tüm listeyi düşürmesin: satır güvenli "Diğer"/"Bilinmiyor"
   etiketiyle gösterilir; zorunlu alan eksik/yanlış tipte → ProtocolError (mevcut kalıp).
4. **Giriş noktası:** Ana sayfaya üçüncü `QuickActionCard` "Taleplerim" → yeni route `AppRoute.requests = '/requests'` (push edilen ekran,
   alt menüye sekme EKLEME). `protectedPaths` + `normalizeAppLocation` allowlist'i + router testi güncellenir.
5. **Taleplerim ekranı:** iki sekme (İzin / PDKS düzeltme); en yeni üstte; durum etiketi + karar notu (reddedilende belirgin);
   yönetici kaydı izinlerde "Yönetici kaydı" notu, geri çek düğmesi yok; boş durum, yükleniyor, hata (yeniden dene) durumları;
   pull-to-refresh. Polling YOK: açılışta + pull-to-refresh + gönder/geri çek sonrası tek yenileme.
6. **Geri çek:** yalnız geri çekilebilir satırda; onay diyaloğu → withdraw → liste yenile; hata yerelleştirilmiş.
7. **Yeni talep:** aktif sekmeye göre form (tam ekran veya bottom sheet, mevcut tasarım diline uy).
   - İzin: tür (10 tür, TR/EN etiket), başlangıç/bitiş tarih seçici, not (≤500, sayaç). İstemci doğrulaması sunucunun aynısı.
   - Düzeltme: tarih (bugün..bugün−30, TR günü), tür (Giriş / Çıkış / İkisi), saat seçici (HH:mm, 24 saat), gerekçe 5–300.
   - Gönderirken düğme kilitli (çift gönderim yok). Ağ/zaman aşımı hatasında: otomatik yeniden gönderme YOK, listeyi yenile ve
     "Talep gönderilmiş olabilir; listeyi kontrol edin" metnini göster.
8. `EMPLOYMENT_ENDED` / oturum düşmesi mevcut global yoldan işler (ek iş yok); bir testle kanıtla.

## Ownership (yalnız bunlara yaz)
`convex/leaveRequests.ts` · `convex/attendanceCorrections.ts` · `convex/lib/requestRules.ts` · `convex/leaveRequests.test.ts` ·
`convex/attendanceCorrections.test.ts` · `convex/lib/requestRules.test.ts` · `mobile/lib/**` · `mobile/test/**`.

## Kapsam dışı
`convex/schema.ts`, `convex/_generated/**`, `src/**`, `docs/**`, `.claude/**` · yönetici uçları · onay/red bildirimi / push · izin bakiyesi ·
dosya eki · Geçmiş ekranından "düzeltme iste" kısayolu · `pubspec.yaml`/`pubspec.lock`/sürüm numarası (1.0.5 bump yayın adımında) ·
`ios/**`, `android/**` · yeni paket.

## YASAK
`git add` · `git commit` · `git stash` · `git reset` · `git checkout` · `git restore` ÇALIŞTIRMA (commit'i koordinatör/CEO atar) ·
push · deploy · `npx convex *` / `convex` CLI (codegen DAHİL — canlı deployment'a yazar) · DB okuma/yazma · Supabase MCP ·
canlı backend'e HTTP çağrısı · `.env*` okuma/yazdırma · paket kurma · kişi verisi loglama.
Repo kuralları: `any`/`as any` yok · `!` non-null yok · Convex için önce `convex/_generated/ai/guidelines.md` oku · kullanıcı metinleri Türkçe (EN ARB ayrıca).

## Kapılar (kendin koş, SIRAYLA; sonuçları rapora yaz — testler yeşil olmadan worker_done GÖNDERME)
Backend (repo kökünden): `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` ·
`node_modules/.bin/eslint <değişen convex dosyaları>` · `node_modules/.bin/vitest run convex/leaveRequests.test.ts convex/attendanceCorrections.test.ts convex/lib/requestRules.test.ts` ·
sonunda tam `node_modules/.bin/vitest run` (başka oturumun kırmızısı varsa kendi dosyanla ilgisini yaz, düzeltmeye çalışma).
Mobil (`mobile/` dizininden, paralel ÇALIŞTIRMA): `flutter gen-l10n` · `python3 scripts/check_l10n.py` · `flutter analyze --no-pub` → 0 ·
`flutter test --no-pub` → tam suite yeşil (önceki ~515 + yeniler).

## Zorunlu testler
Backend: 16 kodun her biri. Mobil: repository arg/isim sözleşmesi + decode + ProtocolError · bilinmeyen enum satırı listeyi düşürmez ·
16 kod → doğru l10n anahtarı (TR/EN) · liste durumları (boş/hata/yükleniyor/veri) · geri çek akışı (yalnız uygun satırda) ·
iki formun istemci doğrulaması (sınır değerleri: 30 gün, 60 gün, 5/300 karakter, HH:mm) · çift gönderim kilidi ·
ağ hatasında yeniden gönderme yok + liste yenileme · `/requests` protected route + deep link allowlist · EMPLOYMENT_ENDED global yolu.

## Rapor
`/tmp/mobil-talepler-rapor.md`: 2-3 cümle sonuç · madde başına ne yapıldı (file:line) · eklenen testler · 8 kapının son çıktı satırı ·
bilinçli bırakılanlar · cihazda/canlıda doğrulanacaklar. `worker_done`'da ≤10 satır + `--files-modified` + `--report-path`.
