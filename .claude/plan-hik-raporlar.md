# >>> COMMIT EDİLDİ (2026-10-26 ~16:20 TR, ngsaccess-4d, Emre onayıyla): 1df865ee K-02 taşıma · a3eb253b Hik raporları · 83b207a1 proje SMTP. TEKRAR COMMIT ATMA. Yayın (Convex+web) ve test turu ngsaccess-4d'de yürüyor.

# Plan — Hik-Connect'te olup bizde eksik raporlar (Mola + 3 aylık Excel)

## >>> HANDOFF (2026-10-26 ~13:05) — YENİ OTURUM BURADAN
Durum (13:15): F1-F4 kodu + 3 denetim + düzeltmeler BİTTİ; tüm worker'lar release edildi, açık worker YOK. Commit YOK, yayın YOK. Sıradaki: Emre'den "commit yap" (adım 3). Not: 13:12'de app tsc'de `convex/crons.ts(72)` hatası çıktı — başka oturumun commit'siz crons.ts düzenlemesi, bizim pathspec'te yok; commit öncesi temiz `git archive` + pathspec kapısıyla doğrula.
1. (BİTTİ) `orca orchestration check --run run_7233bdd49fb6 --wait --types "worker_done,escalation,question" --timeout-ms 1500000 --json` → denetim raporunu oku (`.claude/reports/hik-rapor-f34-denetim.md`), ENGEL/ÖNEMLİ varsa düzelt (küçükse koordinatör), sonra `worker-release --dispatch <id>`.
2. Düzeltme olduysa 5.1 kapısını tekrar koş (komutlar aşağıda).
3. Emre'ye sor: "commit yap" → `git add -- $(cat .claude/pathspec-hik-raporlar.txt)` + commit (26 dosya; pathspec çalışma ağacıyla birebir doğrulandı). Mesaj önerisi: `feat: break report, monthly summary blocks and person attendance sheets` (Türkçe body). Push/yayın ayrı onay; YAYIN SIRASI Convex önce (yeni detail.pairs/breaks alanları), sonra web. CEO kuralı: `.claude/handoff-ceo-plan.md` üstüne not düş.
4. Yayından sonra Orca turu: /reports/gunluk/mola, /reports/aylik/aylik-ozet (Mayıs 2026), Excel indir (3 düzen).
Ayrı iş (bu planda YOK): getPdksTableData departman filtresinden önce tüm proje okutmalarını okuyor → yoğun projede 31 gün okuma sınırı riski (F2 denetimi Ö1).
Not: ağaçta 44c952ed (sistem audit) commit'lendi, bizim dosyalarla örtüşme yok.

## >>> GÜNCEL PLAN (2026-10-26, koordinatör ngsaccess oturumu; Emre "önerin neyse ona göre") — BURADAN DEVAM
Kararlar (öneriler uygulandı):
- **K1 = birleştir:** yeni "Mola" raporu (Günlük, slug `mola`); eski `/reports/gunluk/mola-ihlalleri` → `mola?ihlal=1`. Kolonlar: Tarih · Ad Soyad · Departman · Vardiya · Plan mola · Mola kayıtları · Mola süresi · İhlal. Filtre "Tüm molalar / Yalnız ihlaller".
- **K2 = ekranda kişi başına aylık toplam tablosu + "Excel (kişi blokları)"**; blok önizleme yok.
- **K3 = ekran görüntüsü düzeni** (`/tmp/hik-rapor-ornek` yok). Emre sonradan Hik Excel'i verirse 5.2'de kıyaslanır.
- **Aylık Durum kodları değişmez** (N/HT/RT/İZN/DV bordro kodu); Faz 3 yalnız Excel biçimi + toplamlar.

Checklist (tahmin = duvar saati):
### Faz 0 — Kararlar
- [x] 0.1-0.3 K1-K3 kararlandı (Excel örneği yok → ekran görüntüleri)
### Faz 1 — Mola (~45 dk Codex sol medium + ~20 dk Claude sonnet denetim)
- [x] 1.1 `pdksPunchPairs.ts`: okutma çiftleri (eksik uç null) + mola boşlukları (saf fonksiyon)
- [x] 1.2 `pdksDay.ts`/`pdksTable.ts`: `includePunches` iken `detail.pairs/breaks/breakMinutes`; süre hesabı DEĞİŞMEZ
- [x] 1.3 Rapor: "Mola" + ihlal filtresi + eski URL yönlendirmesi
- [x] 1.4 Testler + kapılar (worker: tsc 0/0, eslint 0, leak temiz, vitest 4450/4452 — 2 kırık kapsam dışı: visitorStatus [başka oturumun visitors.ts WIP'i], shiftPlans ölçek timeout) · rapor .claude/reports/hik-rapor-f1.md
- [x] 1.5 Denetim (Claude sonnet): ENGEL 0 / 2 ÖNEMLİ / 3 DÜŞÜK (.claude/reports/hik-rapor-f1-denetim.md). Koordinatör düzeltti: Ö1 mola tam çiftler arasında (tek yönlü ara okutma molayı gizlemez, test eklendi) · Ö2 çok vardiyalı günde çift hesap kalktı · D1 yönlendirme reportGroupPath. Kapı: convex tsc 0, eslint 0, vitest convex/lib 1532/1533 (kırık = visitorStatus, başka oturum)
### Faz 2 — Aylık Özet / Attendance Summary (~1,5 sa + denetim)
- [x] 2.1 `personMonth` satırı (kişi × ay toplamları) + pdksMatrix raporlarında ay seçici
- [x] 2.2 `personBlocks` Excel (kişi blokları × gün, sağda toplamlar, renk, lejant sayfası, A4 yatay)
- [x] 2.3 Dikiş: registry'de "Aylık Özet" + "Kişi Devam Dökümü" girişleri, `excelLayout` dağıtımı, F3/F4'ün dolduracağı ayrı dosyalar
- [x] 2.4 Hacim: 31 gün × kişi sayısı, okuma/çıktı sınırı (gerekirse departman uyarısı) → tahmin raporda (150 kişi × 31 gün × 24 okutma ≈ 10 MB); uyarı UYGULANMADI, denetim eşik önerecek
- [x] 2.x Kapı (worker): tsc 0/0, eslint 0, rapor testleri 83/83, tam vitest 4474/4475 (shiftPlans timeout) · rapor .claude/reports/hik-rapor-f2.md
- [x] 2.5 Denetim (Claude sonnet): ENGEL 0 / 2 ÖNEMLİ / 4 DÜŞÜK (.claude/reports/hik-rapor-f2-denetim.md). Koordinatör düzeltti: Ö2 Aylık Özet + Kişi Devam Dökümü artık canlı abonelik değil TEK SEFERLİK sorgu (ReportResults.tsx usePdksTableSnapshot; 'Yeniden yükle' + filtre değişimi yeniden çeker; ekranda açıklama notu). Ö1 (sorgu departman filtresinden önce tüm proje okutmalarını okur, 31 gün × yoğun proje okuma sınırını aşabilir) ÖNCEDEN VAR OLAN sunucu sorunu → AYRI İŞ, bu planda yok. D3-D6 bırakıldı. Testler: ReportPage/auditFixes mock'una useConvex, personMonthExcel eski fallback testi kaldırıldı.
### Faz 3 ∥ Faz 4 (~45 dk, iki Codex worker, ayrı dosyalar) + tek denetim
- [x] 3.1 Aylık Durum renkli Excel BİTTİ (task_c2578dc50a1d, worker release edildi): src/lib/reports/excel/statusMatrix.ts + test 11/11, registry'de gizli 'Erken çıkış (gün)' kolonu; rapor .claude/reports/hik-rapor-f3.md
- [x] 4.1 Kişi Devam Dökümü BİTTİ (task_136887a64593, worker release edildi): src/lib/reports/excel/personSheets.ts + test; 300+ kişide indirme Türkçe hata ile durur; rapor .claude/reports/hik-rapor-f4.md
- [x] 3-4 Denetim (Claude sonnet): ENGEL 0 / 1 ÖNEMLİ / 4 DÜŞÜK (.claude/reports/hik-rapor-f34-denetim.md). Koordinatör düzeltti: Ö1 kesilen sayfa adı sonunda apostrof kalınca exceljs çöküyordu → personSheets.ts kırpma + test. DÜŞÜK'ler bırakıldı. Rapor testleri 94/94, eslint 0.
### Faz 5 — Doğrulama + yayın (~45 dk)
- [x] 5.1 Koordinatör kapısı (2026-10-26 ~13:05, çalışma ağacı): tsc app 0 · tsc convex 0 · eslint 0 · find-node-leak temiz · TAM vitest 4484/4485 (tek kırık convex/shiftPlans.test.ts yük altında 5 sn timeout; tek başına 19/19 geçiyor, bizim değişiklikle ilgisiz). vite build F2 denetiminde: exceljs ayrı chunk. Denetim düzeltmesi gelirse kapıyı tekrar koş.
- [ ] 5.2 Commit (Emre "commit yap", CEO'ya haber) → yayın (Emre "yayına al"; Convex önce — yeni alanlar backend'den gelir)
- [ ] 5.3 Orca turu Convex yayınından SONRA (localhost → canlı backend), okutmalı ay (Mayıs 2026)

Worker'lar: Orca run `run_7233bdd49fb6` · F1 = task_bf6a3d94494a / ctx_aa0b1de18d21 (Codex sol medium, BİTTİ 12:15) · F2 = task_7fd32dcb71ab / ctx_4f05621b33ca (aynı Codex worker structworker_96a0e4fb…, 12:17) · ortak kurallar `.claude/orca-specs/hik-rapor-ortak.md` · raporlar `.claude/reports/hik-rapor-*.md`.

---

> 2026-10-26 · Kaynak: `docs/hikconnect-reports/README.md` §4-5, `docs/HIKCONNECT_BIRLESIK.md` §4.5, `docs/genel-akis-audit/B-pdks-rapor.md` (19↔16 eşleme).
> Toplam tahmin: ~2,5 gün ajan süresi (worker'larla duvar saati ~1-1,5 gün). Commit/yayın Emre onayıyla.

## Checklist
### Faz 0 — Girdi + kararlar (~10 dk Emre + ~30 dk analiz)
- [ ] 0.1 Emre Hik-Connect'ten aynı ay için 3 Excel indirir: Attendance Summary, Attendance Status, Attendance Overview → `/tmp/hik-rapor-ornek/` (gerçek ad içerir; analiz sonrası silinir)
- [ ] 0.2 Koordinatör düzeni çıkarır: satır/kolon yapısı, birleşik başlıklar, toplam kolonları, izin türü kolonları → PII'siz şablon notu `docs/hikconnect-reports/EXPORT_DUZENI.md`
- [ ] 0.3 Emre kararları (aşağıda K1-K3)
### Faz 1 — Mola raporu (~4 sa) · Codex sol medium → Claude denetim
- [ ] 1.1 `convex/lib/pdksPunchPairs.ts`: `breakGaps(readings, minInterval)` → çiftler arası boşluklar `{out, in, minutes}[]` + toplam
- [ ] 1.2 `convex/lib/pdksTable.ts`: `includePunches=true` iken hücre detayına `breakRecords` + `breakMinutes` (gece vardiyası gün ataması mevcut motordan; hesaplanan çalışma süresine DOKUNMA)
- [ ] 1.3 `src/lib/reports/registry.ts`: Mola raporu (K1'e göre yeni rapor ya da Mola İhlalleri ile birleşik)
- [ ] 1.4 Testler: tek çift, çoklu mola, gece vardiyası, bilinmeyen yön, tekrar okutma aralığı, mola yok; registry/rows/export
### Faz 2 — Aylık Özet / Attendance Summary (~1 gün) · Codex sol medium → Claude denetim
- [ ] 2.1 Veri: mevcut `cardReadings.getPdksTableData` (matrix, ≤31 gün, `includePunches`, departman/kişi filtresi, hücrede `leaveType`) + Faz 1 mola alanları — yeni Convex sorgusu YOK
- [ ] 2.2 Yeni dışa aktarma düzeni `personBlocks` (`src/lib/reports/personBlocks.ts`): kişi başına blok; satırlar Vardiya · Durum · Giriş 1/Çıkış 1…n · Çalışma · Fazla mesai · Geç · Erken · Mola; kolonlar ayın günleri; sağda toplamlar (çalışılan gün, geç, erken, fazla mesai, devamsız, izin türleri ayrı kolon, hafta içi/sonu/tatil)
- [ ] 2.3 Excel biçimi (`src/lib/reports/export.ts`, exceljs zaten lazy): birleşik başlıklar, hafta sonu/tatil renkleri, ilk kolon sabit, A4 yatay yazdırma, lejant sayfası
- [ ] 2.4 Ekran: K2'ye göre (öneri: mevcut aylık tablo görünümü + "Excel (kişi blokları)" indir)
- [ ] 2.5 Hacim testi: 31 gün × 150 kişi okutmalı veride sorgu okuma sınırı; aşılırsa departman parça parça indirme
### Faz 3 — Aylık Durum Matrisi / Attendance Status (~2 sa) · Faz 2 sonrası, Faz 4 ile paralel
- [ ] 3.1 Mevcut `aylik-durum`u Hik düzenine yaklaştır: hücrede durum kodu, sağda toplamlar, lejant sayfası, gün türü renkleri (Faz 0 kıyasına göre)
### Faz 4 — Kişi Devam Dökümü / Attendance Overview (~3 sa) · Faz 2 sonrası, Faz 3 ile paralel
- [ ] 4.1 Kişi başına dikey döküm: üst bilgi (ad, departman, dönem) · her gün bir satır (tarih, gün, vardiya, plan, okutmalar, süreler, durum, izin) · alt toplamlar; çok kişide her kişi ayrı sayfa
- [ ] 4.2 (isteğe bağlı) Kişi detay çekmecesine "Aylık dökümü indir"
### Faz 5 — Doğrulama + yayın (~2 sa)
- [ ] 5.1 Kapılar: `tsc -p tsconfig.app.json` + `-p convex/tsconfig.json` 0 · eslint 0 · tam `vitest run` · `vite build`
- [ ] 5.2 Orca turu canlı veriyle (okutmalı ay: Mayıs 2026) + aynı ay Hik Excel'iyle yan yana kıyas
- [ ] 5.3 Commit (Emre "commit yap") → yayın (Emre "yayına al"): Convex önce, web sonra, temiz export'tan

## Kararlar (Emre)
- **K1 Mola:** "Mola İhlalleri" ayrı kalsın + yeni "Mola" raporu mu, yoksa tek "Mola" raporu (ihlal kolonu + "yalnız ihlaller" filtresi) mi? Öneri: **birleştir**.
- **K2 Aylık Özet ekranı:** yalnız Excel mi, ekranda kişi blok önizlemesi de mi? Öneri: **mevcut aylık tablo + Excel indir** (blok önizleme sonra).
- **K3 Hik Excel örneği:** indirilebiliyor mu? Yoksa ekran görüntüsündeki düzenle ilerlenir (`docs/hikconnect-reports/shots/attendance-*.png`, sabit örnek veri).

## Kapsam dışı / bilinçli
- Mola raporu hesaplanan çalışma süresini değiştirmez (öğle arası kararı `todo.md`'de açık).
- Yeni Convex tablosu/cron yok; rapor zamanlama (Scheduled Report) bu planın dışında.
- KVKK: raporlara biyometrik türev alan taşınmaz; Hik Excel örnekleri repoya girmez.

## Sıra ve sahiplik
F0 → F1 → F2 → (F3 ∥ F4) → F5. F1 ve F2 `pdksTable.ts` paylaşır → sıralı. Yazan Codex, denetleyen Claude; commit'i koordinatör atar (worker'a `git add/commit` yasak).
