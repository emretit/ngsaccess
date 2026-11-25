# P1-4 talep-eki teslimi

Çalışan mobil izin/düzeltme talebine isteğe bağlı en fazla 3 PDF/JPEG/PNG/WebP (dosya başına 5 MiB) ekler; yönetici web kuyruğundan dosyayı indirir.

- Şema: `convex/schema.ts:1299` requestAttachments ve `:1319` requestAttachmentTickets eklendi; mevcut tablolarda kırıcı değişiklik yok, migration/deploy çalıştırılmadı.
- Depolama: gerçek generateUploadUrl server tarafında kalır; HTTP proxy storageId'yi sahibine bağlar; dosya imzası + `_storage` metadata MIME/boyutu doğrulanır.
- Erişim: sahibi veya aynı projede attendance.approve yetkili yönetici; proje/çalışan/oturum/rol tekrar denetlenir; hash'li tek kullanımlık biletler en fazla 60 saniye geçerlidir.
- İndirme: `/request-attachments` bytes döndürür; private/no-store, attachment ve nosniff; ham getUrl istemciye dönmez.
- Silme: iki withdraw yolunda storage + ek satırı aynı transaction'da silinir; günlük 04:25 UTC işi süresi geçmiş staging, silinmiş talep/çalışan/proje artıkları ve biletleri sınırlı batch'lerle temizler.
- Mobil: dosya seçme/çıkarma, yükleme hatasında formu koruma ve hataya kaydırma, session değişiminde bellekteki belgeleri temizleme; ek metadata talep kartında görünür.
- Paket: yalnız file_picker 10.3.10 ve 3 yeni transitive eklendi; mevcut paket sürümleri yükselmedi; otomatik macOS kayıt değişikliği onayla korundu.

## Kapılar

- Vitest: 6 dosya, 86 test geçti (requestAttachments, files.requestAttachments, leaveRequests, attendanceCorrections, iki panel).
- Flutter test: 7 dosya, 66 test geçti (iki repository testi, provider, iki widget testi, request validation/errors).
- Flutter analyze: 0 error / 0 warning / 0 info, exit 0.
- ESLint: değişen 13 TypeScript/TSX dosyasında 0 error / 0 warning, exit 0; api.d.ts generated eslint-disable kapsamındadır.
- Node leak: temiz, exit 0; git diff --check temiz.
- App tsc koordinatöre devredildi; worker'ın iki tam tsc süreci koordinatör isteğiyle sonlandırıldı.

## Değişen kaynak dosyaları

- Backend: convex/schema.ts, convex/_generated/api.d.ts, convex/leaveRequests.ts, convex/attendanceCorrections.ts, convex/requestAttachments.ts, convex/requestAttachments.test.ts, convex/files.ts, convex/files.requestAttachments.test.ts, convex/http.ts, convex/crons.ts.
- Web: src/components/leaves/LeaveRequestsPanel.tsx ve .test.tsx; src/components/pdks/CorrectionRequestsPanel.tsx ve .test.tsx.
- Mobil: mobile/lib/models/employee_request.dart, mobile/lib/models/request_attachment.dart, mobile/lib/providers/request_provider.dart, mobile/lib/repositories/request_repository.dart, mobile/lib/screens/requests/requests_screen.dart.
- Mobil paket/native: mobile/pubspec.yaml, mobile/pubspec.lock, mobile/macos/Flutter/GeneratedPluginRegistrant.swift.
- Mobil testler: mobile/test/helpers/request_fakes.dart, mobile/test/providers/request_provider_test.dart, mobile/test/repositories/request_attachments_test.dart, mobile/test/widgets/request_attachments_test.dart, mobile/screenshot_test/_harness.dart (yalnız override imzaları).
- Plan: .claude/orca-specs/p1-talep-eki-plan.md.

## Açık noktalar / ayrı işler

- **Önceden var olan risk:** `convex/files.ts:40` herhangi bir henüz bağlı olmayan storageId için yalnız varlık denetimi yapıp `:41` kullanıcı sahipliği oluşturur; talep belgeleri yeni guard ile korunur, genel davranış koordinatör kararıyla değiştirilmedi.
- Android/iOS document picker için ek manifest/Info.plist izni eklenmedi; cihaz/simulator üzerinde native seçim ve canlı storage kabul testi yapılmadı.
- macOS da ürün hedefiyse `mobile/macos/Runner/DebugProfile.entitlements:4` ve `Release.entitlements:4` user-selected.read-only içermiyor; file_picker macOS seçimi için bu ayrı platform yetkisi gerekir, kapsam dışı dosyalara yazılmadı.
- Git add/commit/stash/push, Convex codegen/deploy/run/data, DB migration ve cihaz komutu çalıştırılmadı; diğer worker dosyalarına ve AddShiftDialog'a dokunulmadı.
