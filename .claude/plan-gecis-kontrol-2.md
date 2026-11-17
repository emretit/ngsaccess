# Geçiş Kontrol — 2. tur inceleme + düzeltme planı (2026-11-05)

> 2026-11-11: Güncel kapanış sırası `todo.md` içinde. D1 tamamlandı; masaüstünde filtre/sayaç ve iki onay odağı doğrulandı, 390 px Yetki Durumu görünümünde taşma yok. Commit/yayın yapılmadı. Aşağıdaki 5 Kasım notları tarihçedir.

## 2026-11-11 uygulama eki

Dinamik departman için K1=a, K2=a kullanıcı tarafından onaylandı ve kodlandı. Eski manuel kişi listelerinden departman ilişkisi tahmin edilmez. Takvim değişimi revizyonla yeniden gönderim bekletir; açık plan penceresi değişimi izler. Son gönderim, üyelik değişimi ve anlık bağlantı/saat teşhisi düzeltildi. Yerel çalışma ağacında; canlı yayın/migration/cihaz kabulü yapılmadı. Güncel kalanlar ve doğrulama `todo.md` içinde.

## Checklist

### Faz A — İnceleme (kalan 2 sekme + eski kararlar)
- [x] A1 Kurallar sekmesi incelendi (Orca + kod) — 1 mantık + 4 tasarım bulgusu (aşağıda)
- [x] A2 Yetki Durumu (Codex ctx_907df1a96004) → `docs/ui-audit-gk/tur2/yetki-durumu.md`: 2Y 3O
- [x] A3 Kapı Planları (Codex ctx_f6bc1cec5ab7) → `docs/ui-audit-gk/tur2/kapi-planlari.md`: 1Y 3O 3D; H1 koordinatörce doğrulandı (`convex/holidays.ts` kapıyı bekliyor yapmıyor, `doors.ts:619` değişiklik yoksa gönderim yok)
- [x] A4 Eski kararlar doğrulandı (Codex ctx_5e22514c4ea9) → `docs/ui-audit-gk/tur2/kararlar-dogrulama.md`: 27 yapıldı · 3 kısmen · 6 yapılmadı · 13 geçersiz
  - Yapılmadı: 01-O1 dinamik departman (Faz E) · 01-D4/02-O6 gece saati bölme (büyük; `useAccessRuleSchema.ts:80` + `convex/lib/accessRuleUx.ts:10` reddediyor, koordinatör doğruladı) · 03-O9 bölüm bazlı hata (orta) · 03-O10 hafif sorgular (büyük) · 04-D2 kapı arama/sayfalama (orta)
  - Kısmen: 01-H2 çevrimdışı otomatik yeniden gönderim (bağlantı dönünce senkron tetiklenmiyor) · 03-H1 tüm kişilerde arama · 03-O1 teşhis (çevrimiçi + "şu an saat aralığında mı" yok)
- [ ] A5 A2-A4 bulgularını bu dosyaya Faz D olarak ekle, Emre önceliklendirir

> 2026-11-05 12:20 durum: B+C kodu yazıldı (Codex ctx_b80e7f0318f4; access-control+shared vitest 283/283 koordinatör koşusu; tam vitest makine yükünden zaman aşımı → tekrar koşulacak). D2 worker ctx_2af6e611154a (makine yeniden başlayınca ilk deneme düştü). Aynı anda başka oturumlar: 25879240 FilterBar "sayfa aksiyonları filtre satırında" (3578e3c4 + StatusPage/StatusFilters/RedistributeControls'e dokundu), b885572a tablo genişliği (ui/table.tsx), 4d79c54d Yeni kural tek pencere (CreateRuleDialog). Yeni site kalıbı: birincil düğme PageHeader'da, ikincil sayfa aksiyonları FilterBar `end`'de → "Tüm cihazlara gönder" ve "Yenile" filtre satırına taşınmalı (D1 ile, FilterBar oturumu bitince).

### Faz B — Ortak sayfa başlığı (3 sekmeyi etkiler) ~30 dk
- [ ] B1 `PageHeader title="Geçiş Kontrol"` + scope `"<proje> · <sekme açıklaması>"` en üste; sekmeler altına
- [ ] B2 Sekme içindeki küçük h1'leri kaldır (Kurallar / Yetki Durumu / Kapı Planları)
- [ ] B3 Sekmeye özgü düğmeler başlığa taşınır (Admin'deki `AdminPrimaryActionContext` kalıbı)
- [ ] B4 Testler + Orca turu (masaüstü + 390 px)

### Faz C — Kurallar küçük düzeltmeler ~20 dk
- [ ] C1 "Diğer işlemler" menüsü → doğrudan "Tüm cihazlara gönder" düğmesi (onay penceresi kalır)
- [ ] C2 "Kural durumu" sütun başlığı tek satır (`whitespace-nowrap` + `w-28`)
- [ ] C3 Sayfalama yalnız birden fazla sayfa varken görünür
- [ ] C4 Etiket "Kural Adı" → "Kural adı"
- [ ] C5 Kişi ağacında departmansız kişinin kutusu departman kutusuyla hizalı

### Faz D — Hızlı düzeltmeler (B+C bittikten sonra, 2 paralel worker) ~45 dk
- [x] D1 (2026-11-11) Yetki Durumu: üst sayaç sabit proje özeti (A2-O1) · onay kapanınca odak geri (A2-O2) · liste hatasında boş tablo yerine tekrar dene (A2-O3 liste kısmı) · çekmece yükleme `role=status`
- [x] D2 (Codex ctx_2af6e611154a, koordinatör: access-control vitest 177/177, tsc GK temiz) Kapı Planları: plan hücresi satır tıklamasını kesmesin (A3-O1) · "Hikvision gateway kapıları" kapsam metni (A3-D1) · başlıklar cümle düzeni (A3-D2) · mobil son kart çerçevesi (A3-D3) · dolu tatil listesinde takvim bağlantısı

### Faz G — Karar bekleyen büyük işler (Emre)
- [x] G1 (2026-11-11, yerel kod/test) Takvim değişince kapı planı yeniden gönderimi (A3-H1) — öneri: ilgili kapılar "gönderim bekliyor" + açık "Cihaza tekrar gönder"
- [x] G2 (2026-11-11, yerel kod/test) Yetki Durumu teşhisi (A2-H2/03-O1) — öneri: "şu an" için cihaz çevrimiçi + saat aralığı kontrolü
- [ ] G3 Tüm kişilerde arama (A2-H1/03-H1), çevrimdışı dönüşte otomatik gönderim (01-H2), gece saati bölme (01-D4), hafif sorgular (03-O10) — büyük, sırası Emre'de

- [x] G4 (2026-11-11) Kapı Planları arama + 20 satır sayfalama; görünür sayfanın toplu seçimi. 390/1440 px ve ilk sayfaya filtre dönüşü testli; büyük proje sunucu sayfalaması ayrı açık.

### Faz E — Dinamik departman (backend) ~1 gün — ÖNCE 2 KARAR (Emre)
- [x] E0 Karar K1 + K2 (aşağıda)
- [x] E1 Şema: `groupDepartments` tablosu + `groupMembers.source` alanı
- [x] E2 Ortak yardımcı: kişinin departman kurallarını yeniden hesapla
- [x] E3 Bütün departman yazma noktalarına bağla (6 yer)
- [x] E4 Kural kaydet/düzenle: departman seçimini sakla
- [x] E5 Arayüz: metin + ayrıntı panelinde "Departman: X (alt departmanlar dahil)"
- [ ] E6 Backend + form regresyonları geçti; bağımsız çapraz denetim ve yeni departman akışının gerçek backend ile Orca/cihaz kabulü henüz yapılmadı

### Faz R — Denetim
- [x] R1 Claude denetimi (ctx_c0bbdecc5fe4) → `docs/ui-audit-gk/tur2/denetim-R1.md`: Kritik 0; R1-2/R1-5 test eksikleri kapatıldı (UnifiedAccessControl.test.tsx, DoorPlansTab.test.tsx); R1-1/R1-3 (toplu seç + açıklama katlaması kalktı) 4d79c54d tek pencere oturumunun işi → Emre teyidi
- access-control vitest 29 dosya / 187 test (koordinatör 12:36); tam vitest makine yükü (load 56, başka oturumların 40 vitest süreci) yüzünden ertelendi
- Commit pathspec: `.claude/pathspec-gk2.txt` (2 karışık dosya notlu)

### Faz F — Kapı + commit (Emre onayıyla)
- [x] F1 (2026-11-11) tsc app/convex 0 · eslint src/convex 0 hata (2 mevcut unused-vars uyarısı) · tam vitest 487 dosya / 5486 test geçti
- [x] F2 (2026-11-11) `node scripts/find-node-leak.mjs` temiz
- [ ] F3 Pathspec ile commit (Emre isteyince); Convex + web yayını ayrı onay

---

## Bulgular — Kurallar (A1)

| # | Tür | Bulgu | Kanıt |
|---|-----|-------|-------|
| 1 | Mantık | 2026-10-27 "departman dinamik" kararı uygulanmamış; yeni gelen kişi departman kuralına girmez | `docs/ui-audit-gk/01-kurallar.md:59`, `DepartmentTree.tsx:216` |
| 2 | Tasarım | Sayfa başlığı kalıp dışı: sekmeler en üstte, "Geçiş Kontrol" başlığı yok, sekme içi küçük h1 | `UnifiedAccessControl.tsx:60`, `AccessRulesList.tsx:42`, `StatusPage.tsx:70`, `DoorPlansTab.tsx:92` |
| 3 | Tasarım | "Diğer işlemler" menüsünde tek seçenek → gereksiz ikinci tık | `SyncRuns.tsx:251-265` |
| 4 | Tasarım | "Kural durumu" başlığı 2 satır; tek sayfada da sayfalama görünür | `RulesPage.tsx:73,94` |
| 5 | Tasarım | "Kural Adı" büyük harf; departmansız kişi kutusu hizasız | `RuleBasicInfo.tsx:24`, `DepartmentTree.tsx` |

Uyumlu: FilterBar kalıbı, satır tıklama → Sheet, boş tablo header, StatusBadge, ConfirmDestructive.

---

## Faz B ayrıntı

- Kalıp: `src/pages/SystemAdmin.tsx:34-55` (PageHeader → Tabs, birincil düğme context ile sekmeden başlığa).
- Başlık düğmeleri sekmeye göre:
  - Kurallar: "Tüm cihazlara gönder" (outline, C1) + "Yeni kural" (birincil)
  - Yetki Durumu: "Yenile" (outline)
  - Kapı Planları: sekmenin mevcut üst düğmeleri (A3'te netleşir)
- Sekme açıklamaları scope satırına: "NGS · Kişilerin hangi kapılardan hangi gün ve saatlerde geçebileceği" vb.
- `RuleSaveNotice` (kaydetme bildirimi) başlığın altında kalır.
- Dosyalar: `UnifiedAccessControl.tsx`, `AccessRulesList.tsx`, `status/StatusPage.tsx`, `door-plans/DoorPlansTab.tsx`, ilgili testler (`RulesHeader.test.tsx`, `status.test.tsx`).

## Faz E ayrıntı — dinamik departman

**Bugün:** kural kaydedilince departmandaki kişiler tek tek `groupMembers`'a yazılır; departman bilgisi saklanmaz.
Sonra departmana giren kişi kurala girmez.

**Karar K1 — mevcut kurallar:** (öneri a)
- a) Yalnız yeni/düzenlenen kurallar dinamik olur. Mevcut kural bir kez açılıp departman yeniden işaretlenir (bugün 1 kural: NGS).
- b) Migration: departmanın tüm kişileri seçiliyse kuralı otomatik departmana çevir — yanlış eşleşme riski.

**Karar K2 — departmandan ayrılan kişi:** (öneri a)
- a) Departman yoluyla girdiyse kuraldan çıkar → kartı o kuralın panellerinden sökülür (başka kuralla erişimi varsa kalır). Elle eklendiyse kalır.
- b) Hiç çıkarılmaz; yalnız ekleme otomatik.
- Not: çıkarma mevcut `removeGroupMember` orphan temizliğini tetikler (`convex/accessRules.ts:1182`). Kişi kaydı cihazdan silinmez, yalnız kart/yetki kalkar ([[feedback_never_wipe_device_persons]] ile çelişmez).

**E1 Şema**
- `groupDepartments { groupId, departmentId, includeChildren: boolean, projectId, createdAt }`, index `by_group`, `by_project_department`.
- `groupMembers.source?: "department"` — yoksa elle eklenmiş sayılır (geriye uyumlu, migration gerekmez).

**E2 Yardımcı** — `convex/lib/departmentRuleMembership.ts`
- `reconcileEmployeeDepartmentRules(ctx, employeeId)`: kişinin departmanı + üst departmanları (includeChildren olan kurallar için) → beklenen kural kümesi; eksik `source:"department"` satırlarını ekle, fazla olanları (K2=a ise) sil; değişiklik varsa kişi için Hik + IDE sync planla.
- Ziyaretçi (`isVisitor`) ve işten çıkmış kişi atlanır.

**E3 Bağlanacak yazma noktaları**
1. `employees.create` — `convex/employees.ts:218`
2. `employees.update` departman değişimi — `convex/employees.ts:373`
3. Toplu departman taşıma — `convex/employees.ts:521`
4. Excel içe aktarma — `convex/employeeImport.ts:98`
5. Cihazdan kişi çekme — `convex/actions/hikDeviceImport.ts` (departman atıyorsa)
6. Departman üst değişimi (alt ağaç taşınır) — `convex/departments.ts:63-97` → alt ağaçtaki kişiler için toplu reconcile (sınırlı batch + scheduler)

**E4 Kural kaydet** — `convex/lib/accessRuleWrite.ts` + `accessRules.update`: `departmentSelections: {departmentId, includeChildren}[]` arg'ı; `groupDepartments` yazılır, kişiler `source:"department"` ile genişletilir. Departman kutusu kaldırılırsa o yolla gelen üyeler K2'ye göre işlenir.

**E5 Arayüz** — `DepartmentTree.tsx:216` metni: "Departmana sonradan katılanlar da otomatik eklenir."; `AccessRuleDetails.tsx` departman satırı; form departman seçimini ayrı state'te tutar (`useRuleForm.ts`).

**E6 Test** — her yazma noktası için convex vitest; kural düzenleme (departman ekle/kaldır); ziyaretçi atlanır; tam vitest (src testleri convex'i mock'luyor, [[feedback_full_vitest_gate]]).

**Yürütme:** K3 tasarım bu dosya; E1-E5 Codex worker (gpt-6.1-sol medium, ownership: convex/ + DepartmentTree/useRuleForm/AccessRuleDetails), denetim Claude worker. Worktree yok, commit yasağı spec'te.
