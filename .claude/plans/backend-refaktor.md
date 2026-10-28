# Backend refaktör planı (2026-10-22)

## Checklist
### Dalga 1 — paralel, saf taşıma (~45 dk + 15 dk denetim)
- [ ] B1 `cardReadings.ts`: `getPdksTableData` (259 sat) + `getMonthlyPayrollSheet` (245) gövdeleri `lib/pdksTable.ts` / `lib/pdksPayroll.ts`'e (R10'un kalanı; `getPdksChartData` zaten kaldırılmış)
- [ ] B2a `accessRules.ts`: `list` (413) + `createWithGroups` (382) gövdeleri lib'e (`lib/accessRuleRead.ts`, `lib/accessRuleWrite.ts`)
- [ ] B4 `actions/hikvisionSync.ts`: `syncEmployeeToDevicesInternal` (303) + `syncWeekPlanToDevicesInternal` (179) lib'e
- [ ] B5 `dashboard.ts`: `getTodayTimeline` (252) → mevcut `lib/dashboardTimeline.ts` yanına
- [ ] Denetim (Claude, salt-okuma) + koordinatör kapısı (app+convex tsc, eslint, vitest, build) → commit (onaylı)

### Dalga 2 — dikkat isteyen (~2 sa)
- [ ] B3 `cardReadings.processCardReading` (418 sat, CANLI kart geçiş kararı): ÖNCE karakterizasyon testleri (izin/ret/yön/token/proje yolları), SONRA taşıma; Claude opus güvenlik denetimi
- [ ] B2b `accessRules.list` hafifletme: personel formu/detay/senk diyaloğu (4 yer) tüm kuralları üye+çalışan dokümanlarıyla (N+1) reaktif çekiyor; ihtiyaç alanlarına göre hafif sorgu → okuma/kota düşer (davranış aynı, API additive)

### Engelli / kapsam dışı
- [ ] `devices.ts` (1372): başka oturumun commit'siz işi var (devices/schema/http/deviceCenter) — o commit'ten sonra
- [ ] Yayın: Convex deploy CEO oturumunda, Emre onayıyla (W4 `c2cab0c8` de deploy bekliyor)
- Yapılmayacak: `schema.ts` bölme (Convex tek dosya; bölüm başlıklı), `http.ts`, küçük dosyalar (<600 sat)

## Kurallar
- Registered fonksiyonlar (`api.*`/`internal.*`) aynı dosyada, aynı ad/args/returns ile ince sarmalayıcı kalır; `_generated` değişmez.
- Yetki kontrolü sırası, hata mesajları, audit kayıtları birebir. Yeni sorgu/abonelik yok (B2b hariç, o ayrı onaylı).
- `npx convex` / deploy / DB yazma worker'da YOK. Worktree yok, dosya ownership'i ile paralel.
