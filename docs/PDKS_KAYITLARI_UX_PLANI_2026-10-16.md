# PDKS Kayıtları Sayfası — UX/UI Audit + Plan (2026-10-16)

> Kapsam: `src/pages/PDKSRecords.tsx` + `src/components/pdks/**` + `src/hooks/usePdks*.ts` +
> sayfayı besleyen `cardReadings.getPdksTableData` / `dashboard.getPdksStats`.
> Girdi: kod okuması + `docs/PDKS_AUDIT_VE_PLAN_2026-10-16.md` (P1–P17) + `docs/AUDIT_2026-10-16.md` (B4/R8).

## 1. Özet

Sayfa "her şey üst üste" büyümüş: tablo ekranın ~2. katında başlıyor, aynı kontrol 2-3 yerde var,
ve en temel iş — **geçmiş bir günün kaydına bakmak** — yapılamıyor. Özet kartlar ve grafikler seçili
tarihe bağlı değil, haftalık/aylık modda tablo yanıltıcı, manuel düzeltme yanlış güne yazabiliyor.

## 2. Bulgular

### 🔴 Fonksiyonel UX hataları
| # | Bulgu | Yer |
|---|---|---|
| U1 | Günlük modda gün değiştirilemiyor: `setSelectedDate` hiçbir yerde kullanılmıyor → yalnız bugün. Dün için tek yol "özel aralık" → o da matris moduna geçiyor | `usePdksTableData.ts:24`, `PDKSRecords.tsx:63` |
| U2 | "Son 7 gün" preset'i `reportType: weekly` yazıyor; hook weekly'de `dateRange`'i yok sayıp takvim haftasını gösteriyor. Önceki ay/hafta'ya geçiş de yok | `PDKSQuickPresets.tsx:13`, `usePdksTableData.ts:50` |
| U3 | Özet kartlar her zaman **bugün** (`trTodayKey`), grafikler her zaman **son 7 gün** — filtre/tarih seçimi etkilemiyor → aynı ekranda çelişen sayılar | `dashboard.ts:332`, `PDKSChartView.tsx:35` |
| U4 | Haftalık/aylık modda "Tablo" dönemin ilk/son okumasını tek satırda gösteriyor (`days[]` yalnız Heatmap'te). Manuel düzeltme `selectedDate` (bugün) ile açılıyor → dönem modunda **yanlış güne yazar** | `PDKSTableView.tsx:479` |
| U5 | "Yenile" butonu sadece toast atıyor (Convex zaten reaktif) — sahte | `PDKSRecords.tsx:78` |
| U6 | Detay logunda her okuma "Giriş", konum sabit "Bilinmiyor" (P8 ile bağlı) | `convex/lib/pdksTable.ts:438-441` |
| U7 | Akıllı preset'ler yalnız yüklü satırları client-side süzüyor; "Mola ihlali" seçili günü değil bugünü sorguluyor | `PDKSRecords.tsx:72`, `PDKSSmartPresets.tsx:42` |
| U8 | Stats yüklenirken tüm sayfa tam ekran spinner (en yavaş sorgu her şeyi bloke ediyor) | `PDKSRecords.tsx:109` |

### 🟠 Bilgi mimarisi / kalabalık
- Tablodan önce 8 bant: başlık · filtre kutusu · 6 tarih preset · aktif chip'ler · 3 akıllı preset · 270h uyarısı · 6 özet kart · AI satırı.
  Toplam **13 chip butonu** 3 ayrı satırda (FilterBar 4 + QuickPresets 6 + SmartPresets 3).
- Aynı kontrol birden fazla yerde:
  - Durum filtresi 3 yerde (FilterBar, tablo "Durum Filtresi", özet kart tıklama) — tablodaki yerel, diğerleri sunucu tarafı; birbirinden habersiz.
  - Arama 2 yerde (FilterBar `person` sunucu, tablo `searchTerm` yerel).
  - Dışa aktarma 3 yerde (tablo "İndir", "Dışa Aktar" sekmesi, seçim çubuğu).
  - Dönem seçimi 3 yerde (Rapor select, preset'ler, export paneli kendi select'i).
- "Dışa Aktar" bir **sekme** — görünüm değil, eylem. Başlık "PDKS Dashboard", menü "PDKS Kayıtları".

### 🟡 Görsel tutarlılık + kod kuralları
- `statusMeta.ts` semantik token'larla (`status-success-*`) var ama tablo, drawer ve mobil kart **kendi renk haritalarını** kullanıyor (3 kopya, `bg-green-100` vb. sabit renk → dark mode bozuk).
- Emoji ikonlar (📊 🕐 📍 ✏️ 📄), fazla mesai ham dakika (`125m`), departman chip'i sabit mavi.
- Tablo: sıralama yok, sticky header yok, boş durum mesajı yok, iskelet yerine spinner; satır tıklaması klavyeyle çalışmıyor.
- CLAUDE.md ihlali: `PDKSTableView` yerel `EmployeeRecord` interface'i (→ `FunctionReturnType<typeof api.cardReadings.getPdksTableData>`), 4 adet `as Id<"employees">` cast.

### ⚙ Performans (sayfa açılış hızı)
- super_admin dalı `by_access_time` + `.filter` = tam tablo taraması; proje dalı `by_project` + `.filter` — oysa `by_project_access_time` index'i **zaten var** (P15) — `cardReadings.ts:272-299`.
- Çalışan başına `pdksRecords` sorgusu (N+1) + `.filter` ile tarih (index aralığı yerine) — `cardReadings.ts:370-386`.
- `leaves` tamamı `.filter(status)` ile taranıyor, `by_status` index'i var — `cardReadings.ts:389-392`.

## 3. Hedef tasarım

```
┌ PDKS Kayıtları ─────────────── [◀ 16 Eki 2026 ▶] [Bugün]  [Gün | Dönem]  [Dışa aktar ▾] [⋯] ┐
│ [🔍 Personel ara]  [Filtreler (2)]  [Kayıtlı görünüm ▾]                         [Asistan] │
│ Tümü 42 · Mevcut 30 · Geç 5 · Devamsız 4 · İzinli 3 · Mesai 2      ← durum sekmeleri       │
│ Devam %88 │ Geç 5 │ Devamsız 4 │ Fazla mesai 12,5 sa   ← SEÇİLİ DÖNEM, tablodan türetilir   │
│ ⚠ Uyarılar (3) ▸  270h yaklaşan 2 · Eksik okutma 1 · Mola ihlali 0   ← tıklanınca filtre   │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ Gün modu: sıralanabilir tablo, satır açılınca giriş/çıkış zaman çizelgesi + düzelt          │
│ Dönem modu: puantaj matrisi (çalışan × gün, hücre = durum rengi + saat), hücre → gün detayı │
│ Analiz sekmesi: grafikler seçili dönem + filtrelere bağlı                                    │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

İlkeler:
1. **Tek dönem kaynağı**: tarih gezgini + Gün/Dönem modu; tüm bantlar (KPI, grafik, uyarı, export) aynı dönemi kullanır.
2. **Her kontrol tek yerde**: durum = sekme, arama = sunucu tarafı tek kutu, export = başlıkta tek menü.
3. **KPI tablodan türetilir** → tablo ile kart hiç çelişmez. Canlı "içeride" sayısı Canlı İzleme/ana Dashboard'a kalır.
4. Renkler yalnız `statusMeta.ts` üzerinden; emoji yok; dark mode çalışır.
5. Heatmap ayrı sekme olmaktan çıkar → Dönem modunun kendisi olur.

## 4. Fazlar

### UX-0 — Hata düzeltmeleri (~1 gün, yalnız frontend)
1. U1/U2: tarih gezgini (◀ ▶ Bugün) + URL'de `date` param; preset'ler doğru `reportType`/aralık yazsın.
2. U4: manuel düzeltme satırın/hücrenin gününü alsın; dönem modunda tablo yerine matris (UX-2'ye kadar Heatmap'e yönlendir).
3. U3: KPI'ları tablo satırlarından hesapla; `PDKSChartView` dönem + filtreleri prop olarak alsın.
4. U5 sahte "Yenile"yi kaldır · U8 bölüm bazlı iskelet · U7 akıllı preset'ler seçili tarihi kullansın.

### UX-1 — Sadeleştirme (~2 gün)
1. Yeni başlık şeridi + "Filtreler" popover (şirket/departman/pozisyon/vardiya) + durum sekmeleri (sayılı).
2. QuickChips + QuickPresets + SmartPresets + OvertimeAlert → tek "Uyarılar" paneli + tarih gezgini.
3. Export sekmesi → başlıkta "Dışa aktar" menüsü (Excel/PDF/CSV, Aylık bordro cetveli, SGK APHB).
4. Tablo içi yerel arama/durum filtresi kaldırılır; `PDKSInlineQuery` bandı kalkar → "Asistan" butonu (P16 KVKK maskeleme Faz 1'de).
5. Başlık "PDKS Kayıtları".

### UX-2 — Tablo + puantaj matrisi (~3 gün)
1. Tablo: `FunctionReturnType` tipleri, sıralama, sticky header, boş durum, klavye erişimi, `statusMeta` renkleri, mesai `sa:dk`.
2. Dönem modu = puantaj matrisi (Heatmap'ten evrilir): hücre → gün detayı + o güne düzeltme.
3. Çalışan drawer'ı: dönem toplamları + gün listesi + gün bazlı düzelt; `statusMeta` ile tek renk haritası.
4. Mobil: aynı veri, kart listesi + alt sayfa filtre.

### UX-3 — Hesap motoruna bağlı (Faz 2 motoru gelince, ~2 gün)
1. Giriş/çıkış çiftleri zaman çizelgesi + "eksik okutma" rozeti (P8, U6).
2. Net çalışma / mola / fazla mesai kolonları tek motordan (P9/R8 — tablo, drawer, bordro aynı sayı).
3. Okuma kaynağı rozeti (kart/QR/mobil/biyometrik) — biyometrik PDKS'den hariç (P1, Faz 1).
4. Dönem kilidi rozeti + kilitli günde düzeltme = gerekçeli talep (P14, Faz 3).

### UX-4 — Sorgu performansı (~2 sa, backend, şema değişikliği yok)
1. `getPdksTableData`: `by_project_access_time` / `by_access_time` index aralığı (`.filter` yerine).
2. `pdksRecords`: `by_employee_date` aralığı; `leaves`: `by_status` + tarih kesişimi.
3. Golden testler değişmemeli (`vitest`).

## 5. Sıralama + bağımlılıklar
- **Önce Faz 0 commit'leri** (handoff'ta onay bekliyor; `PDKSEnhancedExportPanel.tsx` ikisinde de var).
- UX-0 + UX-4 paralel (ayrık dosyalar) → UX-1 → UX-2. UX-3, PDKS planı Faz 1/2/3'ü bekler.
- Worker bölümü (Orca, `--worktree current`):
  - W-UX0 (K2): `PDKSRecords.tsx`, `usePdksTableData.ts`, `usePdksFilterParams.ts`, `PDKSQuickPresets.tsx`, `PDKSChartView.tsx`, `usePdksChartData.ts`, `PDKSSmartPresets.tsx`
  - W-UX4 (K2): `convex/cardReadings.ts#getPdksTableData`
  - UX-1/UX-2 (K3 tasarım, sonra K2 uygulama): yeni bileşenler `src/components/pdks/records/*`
- Kapılar: app+convex tsc, eslint 0 error, vitest yeşil, + tarayıcıda manuel tur (gün gezgini, dönem modu, düzeltme doğru güne yazıyor mu).
