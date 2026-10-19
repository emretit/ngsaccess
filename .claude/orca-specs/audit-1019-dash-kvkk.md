# W3 — Yayın 4 denetimi: 04023d3 (dashboard) + 7059078 (KVKK rıza kartı) (yazan Claude → sen Codex olarak salt-okuma denetle)
Rapor: `/Users/emreaydin/ngsaccess/.claude/orca-specs/reports/audit-1019-dash-kvkk.md`

## A. 04023d3 `perf(home): stop rescanning today's readings` (`git show 04023d3`)
1. `convex/dashboard.ts getStats` yeni opsiyonel arg `includeTodayReadings` (varsayılan true), false iken `cardReadings: undefined`. Sürüm uyumu:
   - Yeni Convex + eski web (canlı 61cd264): davranış birebir aynı mı?
   - Yeni web + eski Convex (yanlış sıra): Convex arg doğrulaması bilinmeyen arg'ı reddedip sorguyu kırar mı? (Convex validator kuralını kaynakta/guidelines'ta doğrula.) → yayın sırası zorunluluğu.
   - `getStats`'ı başka kim çağırıyor (`grep -rn "dashboard.getStats\|dashboard:getStats" src convex mobile`)? `cardReadings` alanı `undefined` olunca kırılan tüketici var mı?
2. `src/components/dashboard/TodayStrip.tsx` "Kart okuması" artık `getTodayTimeline.total`. Eski `getStats.cardReadings` ile AYNI kümeyi mi sayıyor? (`convex/dashboard.ts getTodayTimeline` + `convex/lib/dashboardTimeline.ts`: proje kapsamı, izin/ret, biyometrik, gün sınırı TR saati). Fark varsa sayı nasıl değişir?
3. Kazanç gerçek mi: getStats artık cardReadings'e abone değil → her okumada yeniden çalışmıyor mu? `getTodayTimeline`'ın kendisi kaç satır okuyor (sınır/limit var mı, büyük projede 16 MB / 32K satır okuma sınırı riski)?
## B. 7059078 `fix(kvkk): restore employee consent card` (`git show 7059078`)
4. `src/components/employees/EmployeeDetails.tsx`: kart doğru çalışanla mı bağlı, `EmployeeActivityBoundary` hata sınırı query hatasında paneli koruyor mu, çalışan değişince eski çalışanın rızası görünebilir mi?
5. `EmployeeConsentsCard.tsx`: modül kapalıyken "Rıza Al" pasif mi; iptal onayı var mı. Backend `convex/employeeConsents.ts` `grant`/`revoke`/`listForEmployee` yetkisi: project_user ne yapabilir (kanıtla)? Projesiz çalışan (orphan) durumu?
6. `RetentionAssistantCard.tsx:92` değişikliği yalnız stil mi?
## C. Kapılar (salt-okuma)
7. `node_modules/.bin/vitest run src/components/employees src/components/dashboard convex/lib/dashboardTimeline.test.ts` (dosya adları farklıysa ilgili testleri bul) + `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`.
Rapor: bulgular tablosu (Önem · dosya:satır · senaryo · öneri) + "Yayın 4'e engel" kararı + yayın sırası notu.
