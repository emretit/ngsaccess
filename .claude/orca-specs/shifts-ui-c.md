# Görev C — Vardiya tanımları alt sayfası + vardiya rengi (Faz 3: V-O8, V-O9, V-D2, V-D4)

**Hedef:** `/shifts/definitions` alt sayfası çalışır (tablo, satıra tıkla düzenle); yan panel (Sheet) kalkar; vardiya tanımına opsiyonel renk eklenir ve formda seçilir.

**Ownership (yalnız bunlara yaz):**
- YENİ src/pages/ShiftDefinitions.tsx
- src/components/shifts/definitions/** (AddShiftDialog.tsx, shiftFormSchema.ts + test, yeni dosyalar)
- src/components/shifts/ShiftListSidebar.tsx + ShiftListSidebar.test.tsx (tabloya dönüştür, taşı ya da sil; DefinitionCount/DeleteImpact yeniden kullanılabilir)
- src/components/shifts/ShiftCalendarView.tsx (Sheet'i kaldır; `openDefinitions` → `navigate("/shifts/definitions")`)
- YENİ src/components/shifts/lib/shiftColors.ts (renk anahtarı → Tailwind/CSS sınıfı + Türkçe ad)
- YENİ convex/lib/shiftColors.ts (izinli renk anahtarları + `shiftColorValidator`)
- convex/schema.ts — YALNIZ `shifts` tablosuna `color: v.optional(shiftColorValidator)` satırı + import. Dosyada başka oturumun commit'lenmemiş hunk'ları var, onlara DOKUNMA.
- convex/shifts.ts — create/update args'a `color` (update'te `v.optional(v.union(v.null(), shiftColorValidator))`, null = rengi kaldır); list zaten belgeyi dönüyorsa dokunma. convex/shifts testleri (varsa ilgili test dosyası).
- src/App.tsx — YALNIZ `const ShiftDefinitions = lazy(() => import('@/pages/ShiftDefinitions'));` ve `<Route path="/shifts/definitions" element={<ShiftDefinitions />} />` (/shifts route'unun yanına). Dosyada başka oturumun hunk'ları var, DOKUNMA.

**Yapılacaklar:**
1. Sayfa: src/pages/PdksSettings.tsx kalıbı — üstte ghost geri düğmesi (ChevronLeft "Vardiyalar" → /shifts), `PageHeader title="Vardiya tanımları"` (scope YOK — proje adı tekrarı kaldırıldı), primary "Yeni vardiya tanımla" yalnız `schedule.manage`. Proje yoksa EmptyState. Açıklama satırı (V-O8): "Çalışma saatleri burada. Mesai politikası ve tatiller PDKS Kayıtları › Ayarlar'da." — "PDKS Kayıtları › Ayarlar" yalnız `schedule.manage` varsa `/pdks-records/settings` Link'i.
2. Tablo (A2 tablo stili, Kişiler/Erişim tablolarına bak): Ad (renk noktası + ad), Tür (Sabit/Esnek), Saat (`shiftTimeLabel`), Mola (breakStart–breakEnd ya da "—"), Atama serisi (`api.shifts.definitionImpacts` TEK sorgu; mevcut DefinitionCount mantığı), Durum (StatusBadge Aktif/Pasif), satır sonu RowActions (Düzenle, Silme etkisini incele — mevcut DeleteImpact akışı aynen). Satır tıklaması (yalnız schedule.manage) düzenlemeyi açar: src/lib/tableRowClick.ts (`onRowActivate`, `ROW_CLICK_CLASS`) kuralı — satırın her yeri, isimde alt çizgi yok. Boş durum: "Henüz vardiya tanımlanmamış" + yönetici için eylem.
3. Düzenleme/ekleme mevcut AddShiftDialog ile (artık tek katman; Sheet yok). V-O9: "Vardiya türü" native `<select>` yerine iki düğmeli seçim (Sabit | Esnek, aria-pressed, PdksPeriodSwitcher stili) ya da radio group. V-D4: "Mesai etkin" açıklaması kutunun hemen altında, `aria-describedby` ile bağlı (büyük boşluk kalksın).
4. V-D2 Renk: convex/lib/shiftColors.ts → anahtarlar `["slate","blue","teal","green","amber","orange","rose","violet"]` + `shiftColorValidator` (v.union literal). Formda opsiyonel "Renk" alanı: 8 swatch + "Renksiz", radio group (role=radiogroup, her swatch aria-label Türkçe: Gri, Mavi, Turkuaz, Yeşil, Sarı, Turuncu, Gül, Mor), seçili halka. Zod schema + payload'a ekle; düzenlemede mevcut renk gelir; "Renksiz" update'te null gönderir. src/components/shifts/lib/shiftColors.ts → `shiftColorClasses(color?: string | null): { dot: string; bar: string } | null` (A2'ye uygun sakin tonlar; bar = hücre sol kenar çizgisi için `border-l-[3px] border-l-<ton>` vb.). Bu yardımcıyı takvim hücresine SEN ekleme (koordinatör ekleyecek).
5. ShiftCalendarView.tsx: Sheet + "Vardiya tanımları" yedek düğmesi + ShiftListSidebar render'ı kalkar; `openDefinitions` = `navigate("/shifts/definitions")`. Başlıktaki düğme (A'nın CalendarHeader'ı) aynı callback'i kullanmaya devam eder.
6. Geri uyum: eski web eski Convex'te `color` göndermez; yeni web yeni Convex ister (yayın sırası Convex → web). `mobile/**` shifts okuyorsa opsiyonel alan bozmaz — grep ile doğrula, raporda yaz.

**Kapsam dışı:** takvim (A, B), src/lib/routeMeta.ts (dokunma; breadcrumb gerekirse PdksSettings'in nasıl çözdüğüne bak, ek dosya gerekiyorsa raporda belirt).
**Kabul:** tsc app 0 + `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` 0, eslint temiz, `npx vitest run src/components/shifts convex/shifts` yeşil; yeni testler: sayfa tabloyu render eder, satır tıklaması düzenlemeyi açar (yönetici), yetkisizde eylem yok, renk seçimi payload'a girer ve "Renksiz" null gönderir, backend geçersiz renk anahtarını reddeder.
