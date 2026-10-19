# Audit 1019 — Durum doğrulama

Komutlar 2026-10-19 tarihinde, salt-okuma modunda çalıştırıldı. Canlı web için `https://ngsplus.app/` HTML’inden başlatılan 13 JS asset’i ve bu JS’lerde referans verilen `.js` parçaları indirildi (bulunan benzersiz referans: 100; indirilen toplam parça: 68). DB çıktıları yalnız sayısal özet olarak işlendi; kişisel veri rapora alınmadı.
Yayın 4’e engel: VAR — canlı Convex dashboard güncellemesi ve 1a0c112 auth düzeltmeleri geride; KVKK rıza işlevleri Convex’te mevcut olmasına karşın canlı web paketinde kart işareti bulunmuyor.

| İddia | Beklenen | Bulunan | Durum | Kanıt |
|---|---|---|---|---|
| Push’lanmamış commit sayısı ve sırası | 3: 04023d3, 7059078, 1a0c112 | `git log --oneline origin/main..HEAD`: tam bu üçü, bu sırada | DOĞRU | Komut çıktısı |
| 04023d3 dosyaları | 3 beklenen dashboard dosyası | `convex/dashboard.ts`; `src/components/dashboard/TodayStrip.tsx`; `src/hooks/useDashboard.ts` | DOĞRU | `git diff-tree --no-commit-id --name-only -r 04023d3` |
| 7059078 dosyaları | 4 beklenen rıza/UI dosyası | `EmployeeConsentsCard.tsx`, `EmployeeDetails{,.test}.tsx`, `RetentionAssistantCard.tsx` (beklenen yollar) | DOĞRU | `git diff-tree --no-commit-id --name-only -r 7059078` |
| 1a0c112 dosyaları | Belirtilen 14 dosya | Tam 14 yol: auth.ts, lib/authEmail{,.test}.ts, employeeAuth{,.test}.ts, actions/setPassword.ts, projects.ts, ideSync.ts, hikvisionSync.ts, syncIssuesAuth.test.ts, _generated/api.d.ts, AuthProvider.tsx, registrationFlow{,.test}.ts | DOĞRU | `git diff-tree --no-commit-id --name-only -r 1a0c112` |
| Commit’siz `convex/` veya `src/` değişikliği | Yok | `git status --short -- convex src`: boş | DOĞRU | Komut çıktısı; diğer commit’siz yollar rapor kapsamı dışında |
| Convex hedef deployment | `notable-tern-4` | `.env.local` `CONVEX_DEPLOYMENT=dev:notable-tern-4` | DOĞRU | Yalnız bu satır gösterildi |
| Canlı `dashboard:getTodayTimeline` | Var | Var, public | DOĞRU | `convex function-spec`; `dashboard.js:getTodayTimeline` |
| Canlı `dashboard:getStats` argümanı `includeTodayReadings` | Yok | Yok; argüman yalnız `projectId` | DOĞRU | `convex function-spec`; `dashboard.js:getStats` |
| Canlı `employeeAuth:consumeSetupToken` | Yok | Yok | DOĞRU | `convex function-spec`’te fonksiyon yok |
| `employeeAuth:getByEmployee` erişimi | Yok ya da internal | Internal | DOĞRU | `convex function-spec`; visibility `internal` |
| `employeeAuth:getByToken` erişimi | Yok ya da internal | Public | YANLIŞ | `convex function-spec`; visibility `public` |
| `users:currentUser` returns validator | Var | Var | DOĞRU | `convex function-spec`; `returns` mevcut |
| D2 canlı args: `getPdksTableData.includePunches`, `listReportTransactions.sources` | İkisi de var | İkisi de var | DOĞRU | `convex function-spec` argüman alanları |
| KVKK Faz 1: consents list/grant/revoke ve employee biometric module | Mevcut | Dört fonksiyonun tümü mevcut ve public | DOĞRU | `convex function-spec` |
| `invites:create` public olmamalı | Internal | Internal | DOĞRU | `convex function-spec`; visibility `internal` |
| Canlı web `dashboard:getTodayTimeline` işareti | Var | İndirilen JS parçalarında yok | YANLIŞ | Asset taraması: eşleşme yok; HEAD kaynakta `convex/dashboard.ts` ve `src/hooks/useDashboard.ts` var (`git grep`) |
| Canlı web `includeTodayReadings` işareti | Yok | Yok | DOĞRU | Asset taraması eşleşme yok; HEAD kaynakta var (`convex/dashboard.ts`, `src/hooks/useDashboard.ts`) |
| Canlı web `employeeConsents:listForEmployee` ve “KVKK Rızalar” | Yok (kartın canlı webde kopuk olduğu handoff iddiası) | İki işaret de yok; eşleşen parça yok | DOĞRU | İndirilen JS asset’lerinde her iki literal için `rg -l` eşleşmesi yok; HEAD kaynakta ikisi de var (`EmployeeConsentsCard.tsx`) |
| Canlı web 1a0c112’ye özgü kaynak işareti | Yok | `Oturumunuz sona erdi` yok | DOĞRU | `git show 1a0c112 -- src` yeni literal’i gösteriyor; indirilen JS parçalarında eşleşme yok |
| `employeeAuth` satır sayısı | 11 | 11 | DOĞRU | `convex data employeeAuth --limit 1000 --format jsonl`, yerelde sayıldı |
| `employees` satır sayısı | 7 | 7 | DOĞRU | `convex data employees --limit 1000 --format jsonl`, yerelde sayıldı |
| Yetim employeeAuth | ~4 | 4 | DOĞRU | employeeAuth.employeeId, employees._id kümesinde değil: 4 |
| Birden çok employeeId’ye bağlı e-posta sayısı | 1 | 1 | DOĞRU | E-postalar yazdırılmadan normalize edilip employeeId kümeleri sayıldı |
| projectId’siz employeeAuth | 2 | 2 | DOĞRU | Yerel sayım |
| projectId’siz employees | Belirtilmemiş | 0 | DOĞRU | Yerel sayım |
| projectId’siz accessRules | 1 | 1 | DOĞRU | Yerel sayım |
