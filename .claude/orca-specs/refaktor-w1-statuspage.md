# Refaktör W1 — Yetki Durumu sayfası (StatusPage)

Hedef: `src/components/access-control/unified/status/StatusPage.tsx` (684 satır, 23 useState, 6 useEffect) okunur parçalara bölünür; davranış birebir aynı kalır ve `status.test.tsx` + `RunNotice.test.tsx` yeşil kalır.

Ownership (yalnız bunlara yaz):
- src/components/access-control/unified/status/StatusPage.tsx
- YENİ dosyalar yalnız src/components/access-control/unified/status/ altında (ör. useStatusData.ts, useEmployeeGrantDetail.ts, StatusCounters.tsx, StatusFilters.tsx, RedistributeBar.tsx — isimler senin kararın)
- src/components/access-control/unified/status/model.ts ve StatusViews.tsx: yalnız taşınan saf yardımcı/tip eklemek için
- status.test.tsx: YALNIZ import yolu kırılırsa import satırı

Önerilen yapı (daha iyisini bulursan gerekçeyle uygula):
1. Veri katmanı hook'ları: seçenek yükleme (departments/devices/templates + kural sayfalama döngüsü), sayaçlar (counts + projectCounts), satır listesi + `more()` sayfalama (generation ref yarış koruması AYNEN), cihaz bazlı sayaçlar, kişi detayı (byEmployee). Her hook mevcut `alive`/`generation` iptal mantığını ve `revision` tetikleyicisini birebir korur.
2. Yeniden dağıtım (redistribute) akışı: `action`, `sending`, `success`, `runId`, `actionLock` ref'i tek hook ya da bileşende; `actionLock` çift gönderim koruması korunur.
3. JSX: sayaç butonları, filtre ızgarası, kişi/cihaz görünümü, aksiyon çubuğu ayrı bileşenlere; `StatusContent` yalnız kompozisyon yapar. `export function StatusFilter` ve `export default StatusPage` dışa açık API'si değişmez (başka yerden import ediliyor olabilir — grep ile kontrol et).
4. Arama debounce'u (300 ms) ve `change()`'in `setExpanded(undefined)` yan etkisi korunur.

Kapsam dışı: backend (convex/), RunNotice.tsx davranışı, görsel tasarım, metinler.

Vitest: `node_modules/.bin/vitest run src/components/access-control/unified/status`
Rapor yolu: /tmp/refaktor-w1-rapor.md
