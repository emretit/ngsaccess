# Denetim: Erişim başlangıcı → IDE user.start + gelecek-tarih kuralı (SALT OKUMA)

## Hedef
`git diff HEAD -- $(cat /tmp/erisim-convex-pathspec.txt)` farkını denetle; ENGEL / DÜZELT / NOT olarak raporla.
Yazan: Claude (ngsaccess-04). Denetçi sen (Codex) — "yazan denetlemez".

## Değişiklik özeti (yazanın beyanı)
- `ideUserStartFromAccessStart(accessStartsAt, now)` (convex/ideSync.ts) ve `hikValidBeginFromAccessStart(accessStartsAt, now)`
  (convex/lib/gateway/persons.ts): accessStartsAt YALNIZ `Date.parse(accessStartsAt) > now` ise cihaza yazılır; değilse IDE start=0,
  Hik varsayılan (bugün 00:00). Amaç: ziyaretçide start = kayıt anı → cihaz saati geriyse ilk dakikalarda ret riskini önlemek.
- IDE upsertUser'ı kuran 2 yol start gönderir: actions/ideGatewayDevice.ts syncEmployeeToIdePanels + deviceSyncRuns.ts şablon dispatch.
- Hik: lib/hikSyncEmployee.ts (ISAPI + localBridge addPerson payload'ı beginTime), actions/hikQueueWorker.ts (retry).
- employees.update: accessStartsAt değişince IDE sync de tetiklenir (önceden yalnız Hik).

## Bakılacaklar
1. Ret→izin dönüşümü var mı? (Önceki davranışa göre hiçbir yolda daha gevşek erişim olmamalı; sunucu tarafı ortak kapı
   employeeWithinAccessEpoch DEĞİŞMEDİ — doğrula.)
2. Gelecek tarihli çalışanın IDE/Hik kaydına start/beginTime gerçekten gidiyor mu — TÜM yazım yolları (ana, retry, şablon, reconcile,
   kart değişikliği, termination/visitor yolları). Eksik yol = cihazda erken erişim.
3. Temizleme (accessStartsAt null) → IDE start=0 ve Hik varsayılan gerçekten yazılıyor mu.
4. Zaman/TR saat biçimi: Hik beginTime "YYYY-MM-DDTHH:mm:ss" TR duvar saati; IDE epoch saniye. Off-by-3h / ms-s hatası.
5. Payload'ın zamana bağlı olması (now) senkron "değişiklik var mı" karşılaştırmasında sonsuz yeniden gönderim/churn yaratıyor mu.
6. "use node" / paketleme: `node scripts/find-node-leak.mjs` (npm ci gerekirse /tmp export'ta).

## Kurallar
- SALT OKUMA: kaynak dosyalara yazma; git add/commit/stash/reset/checkout YOK; canlı DB/`convex run` YOK.
- Kapı (kendin koş, export'ta): `rm -rf /tmp/denetim-ide && mkdir /tmp/denetim-ide && git archive HEAD | tar -x -C /tmp/denetim-ide`
  → `while read f; do cp "$f" "/tmp/denetim-ide/$f"; done < /tmp/erisim-convex-pathspec.txt` → `npm ci` →
  tsc app+convex, eslint, ilgili vitest dosyaları, find-node-leak.
- Rapor: /tmp/denetim-erisim-ide.md ; worker_done özeti ≤10 satır, file:line, sayılar (ENGEL/DÜZELT/NOT).
