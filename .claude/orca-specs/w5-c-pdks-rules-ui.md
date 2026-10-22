# W5-C — PDKS kuralları: ayar ekranı + İnceleme gösterimi + APHB uyarısı: FRONTEND (UYGULAMA)

## Ortak kurallar (bu repo; CLAUDE.md'yi okumadığın için buraya gömüldü)
- TypeScript strict. `any`/`as any` YASAK (eslint error); `unknown` + narrowing; `!` yerine erken return; tip korumalı filtre, `filter(Boolean)` değil.
- Convex sonuçları `any[]`'a açılmaz: `useQuery` sonucu ya da `FunctionReturnType<typeof api.X.Y>`. Form payload'ı `z.infer<typeof schema>`.
- YASAK: commit, push, deploy, `npx convex *`, DB yazma, `convex/**` (W5-A backend denetimde; API'yi olduğu gibi kullan), `mobile/**`, `bridge/**`, `package.json`/lock, `App.tsx`/route dosyaları.
- Yeni polling YOK. Kullanıcıya görünen metinler Türkçe, sade (jargon yok). Mevcut shadcn bileşenleri ve ayar sayfası desenleri (`src/components/settings/sections/components/OvertimeSettingsForm.tsx`) kullanılır.

## Hedef (test edilebilir)
Proje yöneticisi Ayarlar > Çalışma'da PDKS devam kurallarını (giriş/çıkış zorunluluğu + PDKS'e sayılan kapı/cihazlar) yarından itibaren geçerli yeni sürüm olarak yayınlayabilir, gelecek sürümü silebilir, geçmişi görebilir; PDKS ekranları "İnceleme" günlerini ve "Süre hesaplanamadı" durumunu gösterir; APHB indirmesi inceleme günü varken kapalıdır ve nedenini listeler.

## Bağlam (kodda doğrula)
- API (otoriter): `/tmp/w5a-api.md` — `api.pdksRules.getRules/listCheckpointTargets/publishRuleVersion/deleteFutureRuleVersion`; yeni alanlar `incomplete` durum, `punchQuality`, `durationMeasured`, `incompleteDays`, APHB `employees[].reviewDays`. Backend kodu bu worktree'de (`convex/pdksRules.ts`, `convex/lib/pdksEvidence.ts`) — oku, yazma.
- Tasarım: `/Users/emreaydin/ngsaccess/.claude/designs/w5-pdks-codex.md` §2 (ayar modeli, kombinasyon matrisi), §3 (check point), §3 SGK maddeleri. Emre kararları: eski projeler "Mevcut davranış" (legacy) kalır; yeni modda önerilen başlangıç = giriş ve çıkış zorunlu, tek yön eksikse "İnceleme", hiç okutma "Devamsız"; kurallar yarından geçerli, geçmiş yeniden hesaplanmaz; check point = kapı + cihaz, okuyucu yok.
- Ayar sayfası: `src/components/settings/sections/WorkAndPayrollSettings.tsx` (OvertimeSettingsForm + HolidayCalendarManager). Yetki deseni `useActiveProjectScope()` → `isAdmin`.
- Durum eşlemesi zaten var: `src/components/pdks/statusMeta.ts` (incomplete → "İnceleme", nötr). PDKS ekranları: `src/components/pdks/dashboard/PDKSTableView.tsx`, `PdksRowStatus.tsx`, `PDKSEmployeeDetailDrawer.tsx`, `PDKSMobileCardList.tsx`, `PDKSFilterBar.tsx`, `src/components/pdks/lib/presentation.ts`, `analysis.ts`.
- APHB akışı: `src/components/pdks/dashboard/PDKSEnhancedExportPanel.tsx` (~100-118: ilk tık sorgu + önizleme `aphb` state, ikinci tık indirme). Bu dosyada W5-D kolon seçici değişiklikleri de var — onları KORU.

## Değişiklik
1. **YENİ `src/components/settings/sections/components/PdksRulesSettings.tsx`** (+ gerekirse alt bileşenler aynı klasörde), `WorkAndPayrollSettings`'e eklenir. Yalnız `isAdmin` görür/düzenler (project_user için bölüm gizli ya da salt-okuma özet).
   - **Durum kartı:** "Şu an geçerli: Mevcut davranış" (sürüm yoksa) ya da yürürlükteki sürümün özeti (mod, zorunluluklar, sayılan noktalar); gelecek sürümler (tarih + özet + "Sil" — onaylı); son 20 geçmiş (katlanabilir).
   - **Yeni sürüm formu:** "Geçerlilik tarihi" (varsayılan yarın; bugün ve öncesi seçilemez; TR günü). "Okutma kuralı": "Mevcut davranış (değişiklik yok)" / "Giriş-çıkış kuralları". İkincisinde: Giriş zorunlu ☐, Çıkış zorunlu ☐, "Zorunlu okutma eksikse": İnceleme / Devamsız, "Hiç okutma yoksa": Devamsız / İnceleme — ilk seçimde öneri değerleri dolu. Kısa açıklama: tek yönlü günde süre hesaplanamaz; yön bilgisi olmayan okutmalar İnceleme'ye düşer.
   - **"PDKS'e sayılan noktalar":** "Tüm kapı ve cihazlar" / "Seçilenler". Seçilenlerde `listCheckpointTargets` listesi: cihaz başlığı altında kapılar; seçilemeyen kapı devre dışı + `reason` metni; "Bu cihazın tüm geçişleri" cihaz hedefi. Seçili sayısı gösterilir; boş seçim kaydedilemez; ≤500. Mobil/QR okutmaların "Seçilenler"de sayılmayacağı bir satırla söylenir.
   - **Kaydet:** `publishRuleVersion`; aynı tarihe gelecek sürüm varsa "o tarihteki sürümün yerine geçer" onayı. Backend hata metni gösterilir. Cihaz senkronu olmadığı, geçmiş günlerin değişmediği bir satırla söylenir.
   - Sorgular: `getRules` + `listCheckpointTargets` `useQuery` (ayar sayfası, düşük frekans; `isAdmin` değilse `"skip"`).
2. **PDKS gösterimi:** `incomplete` günler "İnceleme" rozetiyle; `punchQuality` nedeni kısa Türkçe ipucu ("Çıkış okutması yok", "Giriş okutması yok", "Okutma yok", "Yön bilgisi yok"); `durationMeasured === false` → süre hücresinde "Süre hesaplanamadı" (0 sa yerine). Satır/özet sayaçlarında `incompleteDays` (varsa) "İnceleme: N". Filtre çubuğunda durum filtresi varsa "İnceleme" seçeneği. Legacy satırlar (alanlar yok) bugünküyle aynı görünür.
3. **APHB:** önizleme adımında `employees.some(e => e.reviewDays.length > 0)` ise: uyarı kutusu (kaç çalışan, hangi günler — ilk 10 + "ve N gün daha"; çalışan adı mevcut PDKS kayıtlarından eşlenebiliyorsa ad, değilse sayı), "İndir" düğmesi devre dışı + "Önce PDKS'te bu günleri düzeltin" açıklaması. `warnings` mevcut gösterimi korunur. reviewDays yoksa akış bugünküyle aynı.
4. **Raporlar (`src/lib/reports/registry.ts` + rows):** devam özeti / SGK aylık raporlarında `incompleteDays` için "İnceleme (gün)" kolonu, varsayılan görünür DEĞİL (legacy projelerde boş kalmasın diye); mevcut kolonlar ve sıraları değişmez.

## Testler (en az)
- Ayar formu: varsayılan yarın; geçmiş tarih reddi; legacy ↔ kurallar geçişinde öneri değerleri; selected + boş hedef engeli; seçilemeyen kapı devre dışı + neden; publish payload'ı (`z.infer` tipi) doğru; gelecek sürüm silme onayı; project_user'da form yok.
- PDKS: incomplete rozeti + punchQuality ipucu; durationMeasured=false → "Süre hesaplanamadı"; legacy satır anlık görüntüsü değişmez.
- APHB: reviewDays varken İndir devre dışı + liste; yokken eski akış.
- Rapor kolonu: varsayılan gizli, açılınca değer.
- Mevcut testlerin tamamı yeşil.

## Ownership (yalnız bunlara yaz)
YENİ `src/components/settings/sections/components/PdksRules*.tsx` (+test) · `src/components/settings/sections/WorkAndPayrollSettings.tsx` · `src/components/pdks/dashboard/{PDKSTableView,PdksRowStatus,PDKSEmployeeDetailDrawer,PDKSMobileCardList,PDKSFilterBar,PDKSEnhancedExportPanel}.tsx` · `src/components/pdks/lib/{presentation,analysis}.ts` · `src/components/pdks/statusMeta.ts` · `src/lib/reports/registry.ts` · `src/lib/reports/rows.ts` · ilgili mevcut test dosyaları.

## Kapsam dışı
`convex/**` · esnek vardiya (W5.3) · export kolon kataloğu (W5-D bitti; yalnız APHB kısmına dokun) · okuyucu düzeyi seçim · geçmişe yeniden hesap.

## Kapılar (kendin koş; node_modules kurulu)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 · `node_modules/.bin/eslint src convex` → 0 error · `node_modules/.bin/vitest run` → tamamı yeşil (sayı) · `node_modules/.bin/vite build` → OK.

## Rapor
`/tmp/w5c-report.md` + `worker_done`'da ≤10 satır (file:line): değişen dosyalar · ekran akışı · APHB kararı · kapı sayıları.
