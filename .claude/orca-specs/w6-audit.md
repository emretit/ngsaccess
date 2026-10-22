# W6 DENETİM — denetim Excel + vardiya temizle/dışa aktar + cihaz bağlantı geçmişi + haftalık kapı planı (SALT-OKUMA)

Çalışma dizini: `/Users/emreaydin/orca/workspaces/ngsaccess/hik-rebase` (dal `emretit/hik-w3-w5-rebased`, HEAD `5d36adb`). İlk iş `cd` oraya. Denetlenen değişiklik = `git diff HEAD` + yeni dosyalar (`git status --short`, `node_modules` symlink hariç). Yazan: Codex (3 worker) + koordinatör (deviceEvents kategori indeksi).
Spec'ler: `/Users/emreaydin/ngsaccess/.claude/orca-specs/w6-1-audit-shifts.md`, `w6-2-device-offline.md`, `w6-3-door-plan.md`. Yazar raporları: `/tmp/w6-1-report.md`, `/tmp/w6-2-report.md`, `/tmp/w6-3-report.md`.

## YASAK
Kod/dosya düzenleme (rapor hariç), `git add/stash/checkout/reset/commit`, push, deploy, `npx convex *`, DB yazma.

## Odak (öncelik sırasıyla)
1. **Yetki/IDOR:** `convex/shifts.ts` `previewClearAssignments`/`clearAssignments` (project_user reddi, başka proje çalışanı/ataması, projesiz atama), `convex/deviceEvents.ts` `getConnectivityHistory` (başka projenin cihazı), `convex/doors.ts` create/update weekly. Denetim Excel'i yalnız mevcut `list` sorgusunu mu kullanıyor (yetki aynen).
2. **Veri bütünlüğü:** toplu temizle kırp/böl mantığı (`weekPattern` korunuyor mu, bitişik/aynı gün sınırları, tek günlük atama, aralık tam eşit), önizleme == mutation, atomiklik, >1000 sınırı, audit kaydı. Geçmiş tarih temizliği PDKS'yi sessizce değiştiriyor mu (UI uyarısı var mı).
3. **Cihaz geçiş kaydı:** her sinyal yazıcısında (`convex/devices.ts` ~294, ~416, ~533, ~1257; `convex/http.ts` 158, 323) geçiş tek kez mi kaydediliyor; olağan heartbeat'te ek DB yazması/okuması var mı (kota — Convex Free planı, bu projede daha önce heartbeat/poll kaynaklı kota yangını oldu); throttle erken dönüşü geçişi kaçırıyor mu; yarış (iki eşzamanlı heartbeat → çift dönem); `markIdeOnline` +1 get maliyeti.
4. **Kapı planı:** eski tek-aralık kaydı cihaza birebir aynı segmentleri mi gönderiyor (iki action); boş günlerin 8 devre dışı slotla eski planı temizlemesi doğru mu; doğrulama (çakışma, begin<end, 8 sınırı, 23:59:59); weekly varken zorunlu eski alanlar; `remainClosed` gerçekten gateway tipinde destekleniyor mu.
5. **Dışa aktarma güvenliği:** tüm Excel/CSV hücreleri `spreadsheetSafety` ile nötr mü (formül enjeksiyonu: `=`, `+`, `-`, `@`, TAB/CR); exceljs dinamik import (ana bundle'a girmedi mi — build çıktısı); 10.000 sınırı ve iptal.
6. **Kota/okuma:** yeni sorgularda sınırsız `.collect()` yok mu; `getConnectivityHistory` artık `by_device_category_event_time` indeksiyle mi (koordinatör değişikliği) — reaktif abonelik yalnız status olaylarına mı bağlı; vardiya temizleme okuma bütçesi.
7. Şema geri uyumu (doors.hikDoorStatusPlan.weekly opsiyonel + deviceEvents yeni indeks; migration gerekmez), repo kuralları (`any`/`as any`/`!`/`filter(Boolean)` yok), mevcut testlerde değişen/silinen beklenti (`git diff HEAD -- '*.test.ts' '*.test.tsx'` içindeki `-` satırları — W6-2 iki cihaz UI testinin mock'unu güncelledi: yalnız mock mu?).

## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` · `node_modules/.bin/eslint src convex` · `node_modules/.bin/vitest run` (sayılar).

## Rapor
`/tmp/w6-denetim.md`: 1-2 cümle sonuç · kapı sonuçları · ENGEL / DÜZELTİLMELİ / NOT, her biri file:line + somut senaryo (girdi → yanlış çıktı) + öneri; parça (W6-1/2/3) etiketiyle. `worker_done`'da ≤10 satır.
