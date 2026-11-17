# Plan — Genel audit 2026-11-03 düzeltmeleri

> Kaynak: `docs/genel-audit-2026-11-03/OZET.md` (21 P0). Kararlar: Emre 2026-11-03 "önerilerin neyse ona göre" → aşağıdaki 4 öneri kabul.
> Kural: worker'lar Codex (yazan Codex → denetleyen Claude), WORKTREE YOK, iki worker aynı dosyaya yazmaz, commit/push/yayın yalnız Emre onayıyla, spec'e `git add/commit` yasağı yazılır.

## Checklist

### Faz A — Hafta tatili paketini kapat (~2 sa + yayın ~20 dk)
- [ ] A1 PDK-001: departman planı önizleme/yazmada gün sahipliği çakışması (kişi atamasındaki kontrolün aynısı, `forceConfirm`) — Codex `gpt-6.1-sol medium` · ownership: `convex/shiftPlans.ts`, `convex/lib/shiftPlan.ts`, ilgili testler, departman önizleme UI'ı
- [ ] A2 Koordinatör kapısı: TAM vitest + tsc app/convex + eslint + `scripts/find-node-leak.mjs`
- [ ] A3 **Emre onayı** → hafta tatili Faz 3 (pathspec commit + `.claude/pathspec-hafta-tatili.txt`'e A1 dosyaları, export, `convex dev --once`, `backfillWeeklyWorkingDays` dry-run=2 → gerçek, Netlify)

### Faz B — Küçük güvenlik paketi (~yarım gün) · A3 commit'inden sonra (sgkExport.ts kirli)
- [ ] B1 backend — `sol medium`: RAP-003 `sgkExport.ts:75` ziyaretçi dışla · ZIY-01 `lib/visitorStatus.ts:52` arama ham kartı yalnız `canRead`'de · ALM-001 `alarms.ts:46` cardNo/rawData kırp · HSP-02 `invites.ts:114` iptali proje+amaçla sınırla · KIS-001 `employees.ts:507` ziyaretçiyi reddet · GK-06 `lib/mobileAccess.ts:42` bitiş dakikası `<=`
- [ ] B2 cihaz/UI — `sol medium`: CIH-02 `adminDevices.ts:40` listeden `idePassword/ideUser` çıkar + claim mutation havuz şifresini sunucuda kopyalasın + `ClaimDeviceDialog.tsx:97` ön doldurma kalksın · ALM-010 `Alarms.tsx` seçim sıfırlama · CIH-11 `DeviceActionsSection.tsx:61` `employees.manage`
- [ ] B3 belgeler (her an paralel) — `sol medium`: `docs/hikconnect-audit/KIYAS.md` + `PDKS_KIYAS.md` + `hikconnect-reports/README.md` ~42 satırı audit raporlarına göre güncelle
- [ ] B4 Claude `sonnet medium` denetim (diff + kapı) → düzeltme aynı thread'e → **Emre onayı** commit + Convex/Netlify yayını

### Faz C — Güvenlik ve erişim (~3 gün, 4 paralel worker, hepsi `gpt-6-astra high`)
- [ ] C1 IDE: CIH-01 `devices.ts:252` + `setIdeUuid` → `assertIdeRosterMovable` · CIH-07 IDE fazlalık sökümü yerel kişilere dokunmasın, yalnız fark göstersin (karar 1) — `accessGraph.ts`, `accessRules.ts`, `ideSync.ts`, `deviceSyncRuns.ts`
- [ ] C2 hesap/KVKK: HSP-01 normal davet kabulünde davet edenin güncel `admin.manage`'ı + üyelik kaldırınca açık davet iptali · HSP-03 (= KIS-005) yüz rızası iptali → yüz şablonu + cihaz kopyası silme zinciri
- [ ] C3 kapı: GK-01 `doors.ts:315` hedef değişince eski hakkı geri al + yeni kapsamı dağıt (kişi silmeden)
- [ ] C4 Hik: CIH-03 cihazdan aktarımda kapı/tarih kısıtını koru, genişletme `accessRules.manage` + açık onay · CIH-06 gateway log maskeleme (`lib/gateway/core.ts:78`, `gatewayCommand.ts:132`)
- [ ] C5 Claude `opus high` denetim → düzeltme → **saha testi** (NGS0002 / ANKA001: GK-01, CIH-03, HSP-03, CIH-07) → **Emre onayı** yayın

### Faz D — Puantaj / maaş doğruluğu (~5 gün, 4 paralel + 1 sıralı, `astra high`)
- [ ] D1 `lib/pdksDay.ts` ailesi: PDK-004 eski mod manuel+tek çıkış · PDK-006 yarım gün tatil mesaisi
- [ ] D2 vardiya planı: PDK-002 saat değişince çoklu plan sırası (`shifts.ts`, `lib/shiftPlan.ts`, `lib/shiftResolver.ts`)
- [ ] D3 raporlar: RAP-001 katsayılar ortak motordan · RAP-002 eski dal bordroyla tek hesap (`reports.ts`, `lib/legacyOvertime.ts`, `sgkExport.ts`)
- [ ] D4 okutma: PDK-007 çift yön + ertesi gün çıkış (`lib/cardReadingProcess.ts`, `lib/pdksWorkDay.ts`) · PDK-003 kural sürümüne okuyucu adresi (`pdksRules.ts`, `lib/pdksRules.ts`, `readers.ts`)
- [ ] D5 (D2 sonrası) PDK-005 = KIS-002 tarihli departman üyeliği (karar 3): şema genişlet → backfill → resolver tarihten okusun; `convex-migration-helper` kalıbı; **migration koşumu Emre onayıyla**
- [ ] D6 Claude `opus high` denetim (beklenen sayı değişikliklerinin her biri gerekçeli mi) → TAM vitest → **Emre onayı** yayın

### Faz E — Cihaz verisi güvenilirliği (~2-3 gün, 2 paralel)
- [ ] E1 CIH-04 tamamlanmış pencere ≠ devam imleci (`lib/gatewayBackfill.ts`) · CIH-05 ortak ISAPI yanıt doğrulaması (`lib/gateway/events.ts`, `gateway/devices.ts`, `gatewayCommand.ts`) — `astra high`
- [ ] E2 CIH-08 olay köprüsü disk kuyruğu + 429 (`infra/hik-event-bridge/bridge.mjs`) · CIH-09 kısmi taramayı tam sayma (`lib/gatewayReconcile.ts`) — `sol medium`
- [ ] E3 Hetzner'de köprü güncellemesi (**Emre onayı**) + canlı AcsEvent backfill turu

### Faz F — Denetim kaydı + alarm (~2-3 gün)
- [ ] F1 ALM-002 olay tipine göre önem eşlemesi · ALM-007/008 tekrar mail · ALM-009 IDE/localBridge çevrimdışı gecikmeli kontrol
- [ ] F2 ALM-004/005 kapı açan kişi + kural/rol/sır değişikliği denetime · ALM-003 toplu PDKS düzeltmesi çalışan geçmişine
- [ ] F3 ALM-006 (karar 4): denetimde tam kişi kopyası yerine değişen alanlar (izin listesi); T.C./ücret/not yazılmaz; kişi silinince/anonimleşince eski audit kopyaları da maskelensin (tek seferlik migration, Emre onayı)

### Faz G — Kalan P1/P2 + Hik eksikleri (sonra, ayrı onay)
- [ ] G1 PDK-012 onaylı izin iptali · PDK-008 çoklu vardiya ara düzeltme · PDK-013 yanlış geç e-postası
- [ ] G2 Kalan P1/P2'ler modül modül (raporlardaki tablolar)
- [ ] G2b Y-03 silinen IDE paneli için UUID sahiplik kaydı (tombstone) — DENETIM-DALGA1.md · PDK-014 sınırsız bordro okumaları (D3 listesi, sayfalama)
- [ ] G3 Hik eksikleri: cihaz işlem günlüğü + sağlık ekranı · proje admin dondurma ekranı · alarm kuralı/Excel · izin eki + karar bildirimi · ziyaretçi QR/PIN

## Kararlar (Emre 2026-11-03: öneriler kabul)
1. **CIH-07:** IDE fazlalık sökümü yerel kişilere dokunmaz, yalnız fark gösterir; ngsplus'ın yönettiği kişinin hedefli iptali kalır.
2. **PDK-001:** hafta tatili paketine girer, paket onunla birlikte commit'lenir.
3. **PDK-005:** tarihli departman üyeliği yapılır (Faz D5).
4. **ALM-006:** denetim kaydında veri minimizasyonu + kişi anonimleşince audit kopyası da maskelenir; ayrı sabit saklama süresi konmaz (kişi verisi saklamasına bağlı).

5. **(2026-11-04)** Yayın her faz sonunda Emre'ye sorulur · CIH-02 kalan: havuz cihazı yalnız super_admin projeye ayırdıysa alınır · Y-10b: eşleşen kişiye yalnız parmak izi dağıtımı · Y-03 (silinen IDE paneli UUID sahiplik kaydı) Faz G.

## Takvim tahmini
Worker süresi toplam ~16 iş günü; paralel dalgalarla takvimde ~8-10 gün (A+B ilk gün, C 3 gün, D 5 gün, E/F D ile kısmen paralel). Her faz ayrı commit + yayın.

## Elenenler
- Toplu "cihazdan fazlalık sil" — 2026-10-28 kararı.
- 2FA, özel rol, harita/captive portal/video/konut/AD/lisans — önceki kararlar.
