# Dalga 1 denetimi — READ-ONLY (yazan denetlemez: kodu Codex yazdı, sen Claude olarak denetliyorsun)

Repo: `/Users/emreaydin/ngsaccess` (Convex + React/TS). Amaç: Hik-Connect kıyasından çıkan Dalga 1 işlerinin diff'ini bağımsız denetlemek. KOD DEĞİŞTİRME. Yazacağın TEK dosya: `docs/hikconnect-audit/review-wave1.md` (Türkçe, sade; her bulgu: önem [Engel / Düzeltilmeli / Not] · file:line · sorun · somut senaryo · önerilen düzeltme). commit/push/deploy/`npx convex *` YOK.

## Denetlenecek dosyalar (çoğu untracked/yeni; `git diff` + dosyayı oku. "Ortak dosya" hunk'ları dışında başkasının commit'siz değişikliği var: yalnız aşağıdakilere bak)
- Alarm: `convex/alarms.ts`, `convex/alarms.test.ts`, `convex/actions/sendAlarmEmail.ts`, `convex/lib/alarmNotify.ts` (+test), `convex/deviceEvents.ts` (yalnız `recordHikDeviceEvent` içindeki bildirim tetiği), `src/pages/Alarms.tsx`, `src/components/alarms/**`
- Kişi import: `convex/employeeImport.ts` (+test), `convex/lib/employeeImportValidation.ts` (+test), `src/lib/employees/**`, `src/components/employees/import/**` (BatchCardAssignDialog* dosyalarını ATLA: henüz yazılıyor), `src/pages/Employees.tsx` (yalnız İçe/Dışa aktar eklemeleri)
- Başvuru backend: `convex/leaveRequests.ts` (+test), `convex/attendanceCorrections.ts` (+test), `convex/lib/requestRules.ts` (+test)
- Şema hunk'ları: `convex/schema.ts` içinde `alarmSettings`, `attendanceCorrections`, deviceEvents `acked*` alanları + `by_project_category_event_time`, `leaves.source`.
Karşılaştırma kaynağı: `convex/employees.ts` `create`, `convex/leaves.ts`, `convex/pdksRecords.ts` `upsertManual`, `convex/lib/auth.ts`, `convex/lib/customFunctions.ts`, `convex/lib/audit.ts`.

## Odak soruları (hepsini yanıtla, "sorun yok" ise gerekçeyi bir cümleyle yaz)
1. **Yetki/IDOR:** her public fonksiyon için kim çağırabilir, proje kapsamı nerede zorlanıyor? Çalışan (`employeeAuthed*`) fonksiyonları employeeId/projectId'yi YALNIZ oturumdan mı alıyor? Başka projenin kaydı id tahminiyle okunabilir/değiştirilebilir mi?
2. **Rol:** admin gereken yerde `adminMutation/adminQuery` mı? `project_user` yazabiliyor mu?
3. **KVKK:** log/audit/e-posta/dışa aktarma içinde kişi verisi sızıyor mu? Export'ta ücret/bordro alanı rol kuralına uyuyor mu (`convex/payVisibility.handlers.test.ts` kuralı)? Yüklenen Excel saklanıyor/loglanıyor mu?
4. **Enjeksiyon:** (a) Alarm e-postası HTML ise cihaz adı/olay etiketi/not kaçışlanıyor mu? (b) Excel dışa/hata raporu indirmesinde `=`, `+`, `-`, `@` ile başlayan kullanıcı verisi formül enjeksiyonuna açık mı?
5. **Convex kota/performans:** sınırsız `.collect()`, N+1, indexsiz tarama, satır başı çoklu sorgu (`importChunk` 100 satır × 3 sorgu kabul mü?), `alarms.list` 2000 satır bütçesi, yeni cron/polling var mı?
6. **Doğruluk:** alarm e-posta debounce (10 dk, cihaz+label) gerçekten uygulanıyor ve test ediliyor mu; tetik `recordHikDeviceEvent` akışını bozuyor mu (hata durumunda olay kaydı kaybolur mu — scheduler hatası insert'i geri alır mı)? `attendanceCorrections.approve` içindeki `upsertManual` KOPYASI orijinalle birebir mi (fark listele)? Tarih pencereleri Europe/Istanbul'a göre mi? Çift gönderim/yarış (aynı gün iki pending, çift onay) kapalı mı? İzin geri çekme (silme) sonrası bakiye/çakışma tutarlı mı?
7. **Test kalitesi:** testler gerçek handler'ı mı çağırıyor (tautoloji/aşırı mock var mı)? Eksik kritik senaryo?
8. **Kural uyumu:** `any`/`as any`, `!` non-null, `filter(Boolean)` ile null daraltma, doğrudan `ctx.db.insert("auditLog")`, snake_case mapping.

Ayrıca kendi koşumunla doğrula (çıktıyı raporda say): `npx vitest run convex/alarms.test.ts convex/employeeImport.test.ts convex/leaveRequests.test.ts convex/attendanceCorrections.test.ts convex/lib src/lib/employees src/components/alarms src/components/employees/import` ve `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` (src/lib/reports/** hataları başkasının işi, say ama değerlendirme dışı).

Rapor sonuna: "Engel sayısı / Düzeltilmeli / Not" özeti + birleştirme için önerilen sıra. `worker_done` ≤10 satır, rapor yolu `--report-path`.
