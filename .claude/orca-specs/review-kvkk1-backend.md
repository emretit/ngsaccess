# Denetim — KVKK Faz 1 BACKEND (salt-okuma)
Repo: /Users/emreaydin/ngsaccess (değişiklikler commit'siz; `git status`, `git diff`, untracked dosyaları doğrudan oku). ÖNCE `CLAUDE.md` ve `convex/_generated/ai/guidelines.md`.
Bağlam: `.claude/orca-specs/kvkk1-common.md` (sözleşme) + worker raporları `.claude/orca-specs/reports/kvkk1-{biometric,biometric-destruction,retention-assistant}.md`.
RAPORLARA GÜVENME: diff'i ve kodu kendin oku, kendi koştuğun komutla doğrula. Kodu DEĞİŞTİRME, commit/deploy/`npx convex`/canlı veri YOK. Yazacağın tek dosya raporun.

## Kapsam (backend)
`convex/lib/privacySettings.ts`, `convex/privacyBiometric.ts`, `convex/lib/biometricGate.ts`, `convex/employeeFaces.ts`, `convex/employeeFingerprints.ts`, `convex/employeeConsents.ts`, `convex/projects.ts` (create),
`convex/hikvisionSync.ts`, `convex/actions/hikvisionSync.ts` (biyometri kapısı kısımları), `convex/biometricDestruction.ts`, `convex/actions/biometricDestruction.ts`, `convex/lib/biometricDestruction*.ts`,
`convex/privacyRetention.ts`, `convex/lib/cardReadingRetention.ts`, `convex/lib/chatMasking.ts`, `convex/actions/{getChatData,openaiChat}.ts`, `convex/crons.ts`, `convex/schema.ts` (projectPrivacySettings), `convex/lib/adminGuards.ts`.

## Kontrol listesi (her madde için kanıt: dosya:satır; "temiz" ise hangi grep/okumayla doğruladığını yaz)
1. **Yetki/IDOR**: her public query/mutation/action admin rolü + `getProjectIdsForUser` ile proje izni mi? Başka projenin `runId`/`projectId`'siyle okuma/yazma/silme mümkün mü? Internal fonksiyonlar yanlışlıkla public mi?
2. **İmha (geri alınamaz silme) — en kritik**: (a) silme yalnız hedef projenin şablonlarına mı dokunuyor, başka proje/çalışan/profil fotoğrafı/ortak storage dosyası silinebilir mi (`employees.by_photo_storage` kontrolü yeterli mi)?
   (b) `confirmText`/gerekçe/modül-kapalı şartı SUNUCUDA zorunlu mu, UI atlanarak çağrılabilir mi? (c) batch yeniden teslim/çift çalışma, watchdog, takılı run, 24 saatlik kilit bayatlama: veri kaybı veya kalıcı kilit senaryosu var mı?
   (d) auditLog satırı durum deposu olarak PATCH ediliyor: bu denetim izinin değiştirilemezliğini bozar mı, Denetim sayfası bu satırları nasıl gösterir (ham JSON/PII sızıntısı?), `searchText` doldurulması?
   (e) cihaz hedefleri doğru proje; gateway/bridge enqueue yolları; 50 cihaz sınırı fail-closed gerçekten hiçbir şey silmeden mi duruyor (partiden önce mi sonra mı)?
3. **Kapı bypass taraması (grep tabanlı)**: yüz/parmak izi ekleyen veya cihaza gönderen TÜM yolları bul (`addFace|addFingerprint|syncEmployeeFace|syncEmployeeFingerprint|enrollFace|biometric|hikPendingOperations.*Face|http.ts`, importerlar, mobil/http route, kart-sahibi oluşturma akışları, `employeeCascade`) ve her birinin `assertBiometricAllowed`/eşdeğerinden geçtiğini doğrula. Geçmeyen her yol = bulgu.
   Silme yolları kapalıyken ÇALIŞIYOR mu (olmalı)? Eski projelerde (satır yok) davranış eski gibi mi? Yeni proje biyometri kapalı mı, projects.create transaction'ı güvenli mi?
4. **Saklama temizliği**: `accessTime` string karşılaştırması farklı formatlarda (`+03:00`, `Z`, milisaniyeli/siz) yanlış kesim üretir mi? Index kullanımı, `filter` yok mu, batch/transaction sınırları, `scheduler` zinciri sonsuz döngü/çift zincir riski, süresiz projeye dokunmuyor mu, kesimden YENİ kayıt silinebilir mi, PDKS hesaplarına etkisi (silinen okuma raporları bozar mı) ve uyarı yeterli mi?
5. **Asistan maskeleme**: OpenAI'a adın gittiği BAŞKA her yol var mı (grep `openai|gpt|chat.completions|dbContext|employeeName` tüm convex + http)? `projectId`siz eski istemci çağrısı gerçekten dış çağrı yapmıyor mu? Maskeleme kapalıyken izin/yetki doğru mu? Kullanıcının kendi sorusundaki ad dışında sızıntı?
6. **Ortak yardımcı/şema**: `upsertPrivacySettings` null/undefined semantiği (`toPatch`), iki worker'ın aynı satıra eşzamanlı yazması, satır yoksa `biometricEnabled` varsayılanı, `projectDeletionCleanupTables` eklemesi, yeni tablo için index yeterli mi, `api.d.ts` tutarlı mı.
7. **Canlıya çıkış riski**: deploy (`npx convex dev --once`) sonrası canlı akışı kıran bir şey var mı (imza kırılması, eski frontend uyumu, yeni cron ilk koşumda ne yapar, yeni tablo boşken eski projelerde davranış)? Hangi davranış değişikliklerini kullanıcıya söylemeliyiz?
8. Her yeni/değişen public fonksiyonda argüman validator'ü, hata mesajı Türkçe/kodlu, `any` yok, sorgular sınırlı mı.

Kapıları KENDİN koş ve çıktıyı yaz: `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` · `node_modules/.bin/eslint convex` · `npx vitest run convex`.

## Rapor
`.claude/orca-specs/reports/review-kvkk1-backend.md`: en üstte tek cümle sonuç ("canlıya hazır: evet/hayır"). Sonra bulgular, ağırlık sırasıyla (KRİTİK/YÜKSEK/ORTA/DÜŞÜK): dosya:satır · sorun · somut başarısızlık senaryosu (girdi→yanlış sonuç) · önerilen düzeltme.
Doğrulayamadığını "doğrulanamadı" yaz; uydurma bulgu yazma. `worker_done` ≤10 satır (sonuç + KRİTİK/YÜKSEK sayısı).
