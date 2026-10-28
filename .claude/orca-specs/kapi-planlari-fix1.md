Repo: /Users/emreaydin/ngsaccess. Önce oku: CLAUDE.md, .claude/orca-specs/kapi-planlari-denetim-rapor.md (denetim bulguları), .claude/orca-specs/kapi-planlari-faz2.md (kapsam/ownership). Mevcut kod: git diff HEAD (Faz 1+2 commit'siz).

HEDEF: Denetim raporundaki Y1, O1, O2, O3, O4 düzeltilsin; her biri için önce kırmızı olan bir regresyon testi yaz, sonra düzelt. Düşük (D*) bulgulardan yalnız tek satırlık ve davranışı riske atmayanları düzelt; diğerlerini raporda "bırakıldı + neden" olarak listele.
- Y1: Kayıt/toplu kopya yalnız DEĞİŞEN planı göndersin; kullanıcı doğrulama planına dokunmadıysa verify gönderimi yok. Kurulmamış (hiç tanımlanmamış/disabled ve cihazda karşılığı olmayan) plan için okuyuculara CardReaderPlan templateNo=0 yazılmasın. Eski hikVerifyPlan kayıtları kullanıcı açıkça kaydetmeden cihaza gitmesin.
- O1: Capability kapısını resmi belgeye göre hizala (/tmp/isapi-pdf/fp.txt; yoksa pdftotext -layout "ISAPI_FingerPrint Terminals_Pro Series.pdf"). HEAD'de çalışan durum planı gönderimi gerilememeli: HEAD davranışını karakterize eden test ekle.
- O2: doors.update hikDoorNo/deviceId değişince plan revizyonu/sonuçları ve hikDoorHolidaySlots sıfırlansın ("Gönderilmedi" görünsün).
- O3: "Şablon değişti" uyarısı yalnız şablon gerçekten plan gönderiminden SONRA değiştiyse çıksın (rapordaki yanlış pozitif senaryosu test olsun).
- O4: Tatil planı haftalık planla aynı zaman çözünürlüğünde olsun; boş tatil grubu gönderilmesin (UI'da da engelle).

OWNERSHIP: kapi-planlari-faz2.md'deki liste + convex/actions/hikQueueWorker.ts + convex/doorStatusPlan.integration.test.ts + convex/deviceCenter.test.ts (yalnız mock/kontrat). Başka dosyaya yazma.
KAPILAR: tsc app + tsc convex 0 hata · eslint src convex 0 error · TAM vitest yeşil · node scripts/find-node-leak.mjs exit 0.
YASAKLAR: git add/commit/stash/checkout/reset/restore YOK · npx convex dev|deploy|codegen|run YOK · canlı cihaz/Convex çağrısı, DB yazma YOK · any yok.
RAPOR: worker_done ≤10 satır: her bulgu için düzeltildi/bırakıldı + file:line + yeni test adı; kapı sayıları.
