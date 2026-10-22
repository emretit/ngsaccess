# W4.1b — Erişim zaman şablonları: ARAYÜZ (UYGULAMA)

## Ortak kurallar (bu repo; CLAUDE.md'yi okumadığın için buraya gömüldü)
- TypeScript strict. `any` / `as any` YASAK (eslint error). Bilinmeyen veri `unknown` + narrowing. `!` non-null yerine erken return.
- Convex sonuçları `any[]`'a açılmaz: doğrudan `useQuery` sonucu ya da `FunctionReturnType<typeof api.X.Y>`. Form payload'ı `z.infer<typeof schema>`.
- react-hook-form `name=` alanları formun zod şemasına bağlı; Convex shape'iyle eşleştirmek için yeniden adlandırma yapma.
- Tüm kullanıcı metni Türkçe; saat Europe/Istanbul. Mevcut `src/components/ui/*` (shadcn) bileşenlerini ve sayfanın mevcut görsel dilini kullan; yeni UI kütüphanesi ekleme. 360 px genişlikte taşma olmasın (mevcut `min-[400px]:` desenleri).
- YASAK: commit, push, deploy, `npx convex *`, DB yazma, `convex/**` (yalnız oku; backend açığı bulursan DÜZELTME, `ask`/raporla), `mobile/**`, `bridge/**`.

## Hedef (test edilebilir)
Proje yöneticisi Erişim Kontrolü sayfasında "Zaman Şablonları" sekmesinden şablon oluşturur/düzenler/kopyalar/arşivler/siler; kural sihirbazında "Özel saat | Şablon kullan" seçip kuralı şablona bağlar veya bağı kaldırır; kural listesi/detayı şablonlu kuralda şablon adını gösterir.

## Bağlam
- Backend bu worktree'de hazır (commit'siz W4.1a). API özeti: `/tmp/w41a-api.md` — ÖNCE OKU. Fonksiyonlar `convex/accessScheduleTemplates.ts`; saf yardımcılar `convex/lib/accessSchedule.ts` (normalizeWeek, splitOvernight, toIdePermissionSegments vb.) — `src/` zaten `convex/lib/*` saf modüllerini göreli yolla import ediyor (ör. `../../../../convex/lib/shiftUx`); doğrulama/özet mantığını KOPYALAMA, oradan import et.
- Sayfa: `src/components/access-control/unified/UnifiedAccessControl.tsx` (tek bileşen) · liste `AccessRulesList.tsx` (yazma yetkisi `useActiveProject().isAdmin`) · sihirbaz `CreateRuleDialog.tsx` + `components/TimeSchedule.tsx` + `hooks/useAccessRuleSchema.ts` (zod; `days.min(1)`, start/end birlikte) + `hooks/useRuleForm.ts` + `lib/loadRuleEditor.ts` + kayıt `src/hooks/access-rules/useComplexAccessRuleMutations.ts` · detay `AccessRuleDetails.tsx` · sekme örneği `src/components/ui/tabs.tsx`, `src/pages/SystemAdmin.tsx`.
- Tasarım (salt-okuma, mutlak yol): `/Users/emreaydin/ngsaccess/.claude/designs/w4-template-claude.md` §5 (madde 1-3; madde 4 Yetki Durumu W4.2 — YAPMA).

## Değişiklik
1. **Sekmeler:** `UnifiedAccessControl` üstüne `Kurallar · Zaman Şablonları` sekmeleri (varsayılan Kurallar; seçili sekme URL `?tab=templates` ile korunur).
2. **Şablon listesi:** ad, haftalık özet (ör. "Pzt–Cum 08:00–12:00, 13:00–17:00 · Cmt 09:00–13:00"; boş hafta "Erişim yok"), bağlı kural sayısı, arşiv rozeti, "Arşivlenenleri göster" anahtarı. Aksiyonlar (yalnız `isAdmin`): Yeni · Düzenle · Kopyala (ad sorulur) · Arşivle/Geri al · Sil (bağlı kural varsa pasif + "N kural kullanıyor" ipucu; silmede onay). Boş durum + yükleniyor durumu.
3. **Editör (dialog/sheet):** ad, açıklama; 7 gün satırı, her günde aralık listesi (ekle/sil, `HH:MM` giriş, bitişte `24:00` seçilebilir), gün başına en çok 8. Kısayollar: "Pazartesi'yi hafta içine kopyala", "Tümünü temizle". Bitiş < başlangıç girilirse "Ertesi güne taşan aralık" olarak `splitOvernight` ile iki parçaya bölünür ve kullanıcıya gösterilir. Kaydetmeden önce `normalizeWeek` ile birleştirilmiş önizleme. Salt-okuma 7×24 haftalık görsel önizleme (gün başına yatay şerit; sürükle-boya YOK). Canlı kontrol satırı: "Hik: gün başına en çok N aralık ✓/✗(8)" · "IDE: K izin kaydı ✓/✗(8)" · boş hafta uyarısı "Bu şablon hiç erişim vermez".
4. **Kaydet akışı:** yeni şablon → `create`. Var olan ve bağlı kuralı olan şablon → önce `previewImpact({templateId, week})` → onay penceresi "N kural, M cihaz güncellenecek; 20 sn içinde tek gönderim başlar." `ideOverLimit` doluysa kaydet pasif + kişi/cihaz listesi ("IDE panelinde 16 izin sınırı aşılıyor"). Backend Türkçe hatasını olduğu gibi göster.
5. **Kural sihirbazı:** zaman bölümünde segment seçici **Özel saat | Şablon kullan**. Şablon modunda: proje şablonlarından arşivsiz seçici (düzenlemede kuralın mevcut arşivli şablonu da görünür, "arşivli" etiketiyle), seçilen şablonun salt-okuma özeti + "Şablonu düzenle" bağlantısı (Zaman Şablonları sekmesine, ilgili şablonu açarak). Gömülü alanlar (gün/saat) mod değişiminde form state'inde KORUNUR. Zod: şablon modunda gün/saat zorunluluğu kalkar, `scheduleTemplateId` zorunlu. Kayıt: şablon modunda `scheduleTemplateId`, Özel modda ve kural önceden şablonluysa `scheduleTemplateId: null`. `loadRuleEditor`: şablonlu kural şablon modunda açılır.
6. **Liste/detay:** `AccessRulesList` ve `AccessRuleDetails` saat özetinde şablonlu kuralda "Şablon: <ad>" (+ özet ipucu) gösterir; şablon bulunamazsa "Şablon bulunamadı — erişim kapalı" (kırmızı).

## Testler (vitest + Testing Library, mevcut desenler)
- Özet biçimlendirici (gün gruplama, boş hafta, 24:00).
- Editör: aralık ekle/sil, 9. aralık engeli, gece bölme gösterimi, kontrol satırı ✓/✗, boş hafta uyarısı.
- Liste: bağlı kuralda Sil pasif; isAdmin=false'ta yazma aksiyonu yok; arşiv anahtarı.
- Kaydet: bağlı şablonda previewImpact onayı; ideOverLimit doluyken kaydet pasif.
- Sihirbaz: mod geçişi gömülü alanları korur; şablon modunda `scheduleTemplateId` gönderilir; Özel'e dönüşte `null` gönderilir; şablonlu kural düzenlemede şablon modunda açılır.
- Mevcut testlerin tamamı yeşil.

## Ownership (yalnız bunlara yaz)
`src/components/access-control/unified/**` (yeni alt klasör `templates/` serbest) · `src/hooks/access-rules/**` · `src/types/access-control.ts` (gerekirse). Başka dosya gerekiyorsa önce `ask`.

## Kapsam dışı
Yetki Durumu ekranı (W4.2) · tatil · sürükle-boya ızgara · backend değişikliği · mobil.

## Kapılar (hepsini kendin koş, çıktıyı raporla)
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0
- `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0
- `node_modules/.bin/eslint src convex` → 0 error
- `node_modules/.bin/vitest run` → tamamı yeşil (sayıyı yaz)
- `node_modules/.bin/vite build` → başarılı

## Rapor
`worker_done`'da ≤10 satır (file:line): yeni/değişen dosyalar · sekme/editör/sihirbaz giriş noktaları · backend'de gördüğün açık (varsa) · kapı sonuçları (sayılarla).
