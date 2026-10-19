# Uygulama Planı — KIYAS.md işlerinin worker'lara bölünmesi

> **Tarih:** 2026-10-19 · **Kaynak:** [KIYAS.md](KIYAS.md) §9 · **Orca run:** `run_433443d59693` · **Worker ailesi:** Codex `gpt-6-luna` (Emre'nin tercihi), `medium` efor
> Spec dosyaları: `.claude/orca-specs/kiyas-*.md` (ortak kurallar bloğu her spec'in başına eklenir; Codex CLAUDE.md okumaz).

## 0. Durum özeti (checklist)

### Faz 0 — ortak dosyalar (koordinatör)
- [x] `convex/schema.ts`: `deviceEvents` ack alanları + `by_project_category_event_time`; `alarmSettings`; `attendanceCorrections`; `leaves.source` (opsiyonel)
- [x] Boş stub modüller + `api.d.ts` girişleri: `alarms`, `attendanceCorrections`, `employeeImport`, `leaveRequests`, `actions/sendAlarmEmail`
- [x] `/alarms` route + "Alarmlar" admin menü satırı + placeholder sayfa
- [x] `leaves.status`'a eklenen `withdrawn` geri alındı (UI audit işinin tsc'sini kırıyordu; geri çekme = bekleyen talebi silmek)
- [x] tsc: Faz 0'dan kaynaklı hata 0 (kalan tek hata `convex/lib/reportScope.test.ts`, UI audit 08 işi)

### Dalga 1 — BİTTİ (2026-10-19 21:33)
- [x] **P1** Alarm merkezi v1 (liste, filtre, toplu onay, bildirim ayarı, kritik olayda e-posta) + düzeltme turu FIX-C
- [x] **P2** Kişiler Excel şablon/içe aktarma/dışa aktarma + toplu kart atama + düzeltme turu FIX-B (E1 eski kart paneli temizleme + sync, E2 sayısal hücre, D5 import≡create tekillik, D8 export audit + T.C. varsayılan kapalı)
- [x] **P3a** İzin/düzeltme başvuru backend'i + testler + düzeltme turu FIX-A (E3 tek yönlü düzeltme diğer saati korur, D7 vardiya çözümü, D6 bekleyen talep sınırı)
- [x] Denetim: Claude sonnet high → [review-wave1.md](review-wave1.md) (3 Engel / 9 Düzeltilmeli / 9 Not; hepsi düzeltme turuna girdi, D2'nin cardReadings kısmı hariç)
- [x] Kapılar (koordinatör koşumu 21:33): tam vitest **212 dosya / 2178 test yeşil**, tsc 0, eslint (bizim dosyalar) 0
- [ ] **Bekleyen küçük işler:** (1) `convex/cardReadings.ts` ~satır 1743 insert'ine `notifyAlarmIfNeeded(ctx, eventId)` çağrısı (UI audit PDKS dalgası bitince); (2) `upsertManual` ortak `lib/pdksManualWrite.ts` çıkarımı (aynı bekleyiş); (3) Notlar N1/N8'in kalanı; (4) bağımsız ikinci denetim (yalnız Engel düzeltmeleri için) — yapılmadı, kodda ve testlerle doğrulandı

### Dalga 2 — kuyrukta (önkoşul bitince başlar)
- [ ] **P3b** İzin/düzeltme web arayüzü (Talepler sekmesi, düzeltme kuyruğu) — önkoşul: UI audit 10 (İzinler) worker'ı bitti + P3a toplandı
- [ ] **P4** Ayrılma akışı (tarih/tip/neden/geri alma, SGK çıkış ilişkisi) — önkoşul: P2 toplandı (Employees.tsx), employees şema alanları Faz 0'a eklenmeli
- [ ] **P5** Erişim zaman şablonları + kişi bazlı yetki dağıtım durumu (Overview) — önkoşul: UI audit 05 (Geçiş Kontrol) toplandı; Hik/IDE senkron riski → K3 tasarım + denetim
- [ ] **P6** Yönetici 2FA + kullanıcı dondurma/son kullanma — önce Claude K3 tasarım (Convex Auth üstüne e-posta OTP), sonra Codex; güvenlik denetimi zorunlu
- [ ] **P7** Esnek vardiya + Attendance Rule + Custom Export — önkoşul: UI audit 08/09 gece vardiyası işi (pdksCalc çakışır) bitti
- [ ] **P8** Mobil (Flutter) başvuru ekranları — önkoşul: P3a; `mobile/**` başkasının commit'siz işi var, önce sahibiyle eşle

## 1. Neden böyle bölündü

| Karar | Gerekçe |
|---|---|
| Dalga 1 = 3 worker | Birleştirilebilir paralellik (3-5 sınırı); üçü ayrı dosya kümelerine yazar |
| Şema/route/api.d.ts'i koordinatör hazırladı | Paylaşılan dosyaya iki worker yazarsa çakışır; Faz 0'da bir kez, eklemeli yapıldı |
| P3 ikiye bölündü (a: backend, b: UI) | `convex/leaves.ts` + `src/components/leaves/**` şu an UI audit 10-H1 worker'ında (`ctx_cd825c53b02f`); backend yeni dosyalarda yapılabilir |
| P4/P5/P7 sonraya | Aynı dosyalara UI audit dalgaları (Kişiler, Geçiş Kontrol, PDKS/Vardiya) dokunuyor veya P2'ye bağımlı |
| P6 için K3 tasarım | Kimlik doğrulama hassas; yarım 2FA kullanıcıyı kilitleyebilir |
| Geri çekme = silme (izin) | `leaves.status` birliğini değiştirmek UI audit tarafının tip kapısını kırdı |

## 2. Paket tablosu (Dalga 1)

| ID | İş | Sahip dosyalar | Okur (yazmaz) | Kapı |
|---|---|---|---|---|
| P1 | `/alarms`: liste (Alarm / Arıza sekmeleri), filtre, toplu onay, bildirim ayarı, kritik olayda e-posta (debounce) | `convex/alarms.ts`, `convex/actions/sendAlarmEmail.ts`, `convex/deviceEvents.ts` (yalnız tetik), `convex/lib/alarmNotify.ts`, `src/pages/Alarms.tsx`, `src/components/alarms/**` + testler | `convex/actions/sendEmail.ts`, `convex/http.ts` | kendi dosyalarında tsc 0 · eslint 0 · vitest yeşil |
| P2 | Excel şablon + içe aktarma (önizleme, satır hata raporu) + dışa aktarma + toplu kart | `convex/employeeImport.ts`, `convex/lib/employeeImportValidation.ts`, `src/lib/employees/**`, `src/components/employees/import/**`, `EmployeeBulkActions.tsx`, `Employees.tsx` (yalnız araç çubuğu) + testler | `convex/employees.ts`, `exceljs` kullanımı | aynı |
| P3a | Çalışan izin/düzeltme talebi (submit/withdraw/listMine), yönetici düzeltme kuyruğu (listPending/approve/reject), audit | `convex/leaveRequests.ts`, `convex/attendanceCorrections.ts`, `convex/lib/requestRules.ts` + testler | `convex/leaves.ts`, `convex/pdksRecords.ts` | aynı |

Ortak yasaklar (spec'e gömülü): schema/App.tsx/routeMeta/_generated yazma yok; commit/push/deploy/`npx convex *` yok; yeni cron/polling yok (Convex Free kota); kişi verisi loglanmaz.

## 3. Toplama prosedürü (koordinatör = bu oturum)

1. `ORCA orchestration check --run run_433443d59693 --wait --types worker_done,escalation,question` — soruları yanıtla, worker_done'ı beklenen dispatch'e karşı doğrula.
2. Her worker için: `git diff` ile yalnız sahip olduğu dosyalara yazıp yazmadığını kontrol et (kural dışı dosya varsa geri iste).
3. Kapıları kendim koş: `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/eslint <dosyalar>` · `npx vitest run <testler>`; ardından tam `vitest run` (UI audit tarafının testlerini bozmadığımızı göster).
4. Denetçi: Claude `sonnet` / `high`, read-only; girdi = diff + kapı çıktısı (rapor değil). Odak: proje kapsamı (IDOR), rol kontrolü, KVKK, Convex kota (sınırsız collect/polling), idempotency.
5. Bulguları aynı worker'a takip olarak ver (aynı thread); 2 zayıf tur → koordinatör devralır.
6. Birleşik rapor Emre'ye (Türkçe, ≤1 sayfa) + `worker-release`.

## 4. Yayın ve commit (Emre kararı gerekir)

- **Commit:** CEO/koordinatör kuralı: pathspec commit, Emre onayıyla, `Co-Authored-By` satırı yok. `convex/schema.ts`, `api.d.ts`, `App.tsx`, `routeMeta.ts` UI audit tarafıyla ortak → **hunk bazında ayrılacak** (ngsaccess-dd ile eşleşildi: onlar `leaves`'e 3 index ekledi; bizim hunk'lar: deviceEvents ack + index, `alarmSettings`, `attendanceCorrections`, `leaves.source`).
- **Convex yayını:** `npx convex dev --once` TÜM ağacı yollar; yarım worker dosyası canlıya gidebilir. Kural: bizim dalga toplanmadan yayın yok; yayın temiz worktree'de commit'ten yapılır (CEO yöntemi). Web deploy ayrı adım (Netlify CLI).
- Yeni tablolar/alanlar ek ve opsiyonel (geri uyumlu); canlı veriye migration gerekmiyor.

### Commit sırası ve bağımlılıklar (CEO ngsaccess-2e kapı sonucu, 2026-10-19)
Bizim feat commit'i TEK BAŞINA derlenmez; **önce UI audit (ngsaccess-dd) UI-audit-2 commit'i, sonra bizimki** (aynı dosya listesi, karışık dosyalar bütün halinde).
- `convex/attendanceCorrections.ts` (P3a) → dd'nin commit'siz `convex/lib/pdksManual.ts` + `convex/lib/pdksHelpers.ts` imzalarına bağlı (`validateManualPdksInput`, vardiya çözümü). **P3a, UI audit Dalga 3 (pdks*) commit'ine bağlıdır.**
- `src/components/employees/import/BatchCardAssignDialog.tsx` (P2c) → dd'nin untracked `src/components/visitors/lib/readerCapability.ts` dosyasına bağlı.
- `src/components/audit/auditLabels.ts`: bizim 4 etiket dd'nin commit'siz `commonLabels` bloğunun içinde → dd'nin commit'iyle gider.
- Yayın: dd'nin 4B + 3b denetimi bitince TEK temiz worktree'den tek Convex yayını; Emre'nin açık "yayın onay"ı olmadan çıkmaz.

## 5. Riskler

| Risk | Önlem |
|---|---|
| Paylaşımlı ağaç: başka oturumlar aynı anda yazıyor (UI audit koordinatörü, ölü kod temizliği) | Sahiplik listesi; kapı = yalnız kendi dosyaları; tam ağaç kapısı dalga sonunda ben koşarım |
| Alarm e-postası fırtınası | Aynı cihaz+olay için 10 dk debounce; alıcı ≤8; yeni cron yok |
| İçe aktarma ile toplu cihaz senkron fırtınası | Mutation içinde senkron yok; yönetici açıkça "Cihazlara gönder" der |
| Kişi dosyası KVKK | Dosya saklanmaz, loglanmaz; ücret sütunu yok; dışa aktarmada `payVisibility` |
| luna (K1) zayıf kalırsa | Aynı worker'a takip; 2 zayıf turda `sol medium`a yükselt veya ben devralırım |
| Düzeltme onayı PDKS hesabını bozar | P3a `upsertManual` mantığını tekrar kullanır/kopyalar; kopya raporda belirtilir, denetçi ve test kapsar |

## 6. Emre'ye açık kararlar

1. Dalga 2'den hangileri istenir? (öneri sırası: P3b → P4 → P6 → P5 → P7 → P8)
2. İzin geri çekme = silme kabul mü? (alternatif: status'a `withdrawn` ekle; UI audit 10 bitince yapılır)
3. Alarm e-postası için hangi alıcılar/önem varsayılan olsun? (şimdilik kapalı, yönetici açar)
