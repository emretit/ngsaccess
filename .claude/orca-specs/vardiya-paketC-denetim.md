# Vardiya Paket C1 (atama arayüzü) — denetim (salt okuma, Claude)

## Hedef
Paket C1 diff'ini sözleşmeye, eski akışın korunmasına ve UX/erişilebilirliğe göre denetle; rapor `.claude/review-vardiya-paketC.md`.

## Oku
1. `.claude/design/vardiya-model.md` (OTORİTER, §5.3 API), `.claude/orca-specs/vardiya-paketC-arayuz.md` (spec), `.claude/design/vardiya-model-claude.md` §4.
2. Diff: `git diff -- src` + yeni bileşenler (`RotationEditor.tsx`, `DayShiftsPicker.tsx`, `DepartmentTargetPicker.tsx`) ve yeni testler. `convex/**` denetleme.
3. Proje `CLAUDE.md`.

## Bak (öncelik sırası)
1. **Eski akış:** kişi-tek-vardiya atama payload'ı ve ekranı birebir mi (snapshot gerçekten var mı)? Mevcut test beklentisi değişmiş/silinmiş mi?
2. **API kullanımı:** §5.3'e uygun mu; planlı satırda vardiya değişikliği `plan` ile mi gidiyor; `listAssignments` çağrıları `includePlans: true`; istemci kendi çözümleyicisini yazmamış (takvim `planCells`).
3. **Doğrulama/UX:** ≤8 vardiya, ≥30 dk, döngü 1-31 gün / 1-52 hafta; sunucu ConvexError mesajı kullanıcıya görünüyor; boş/yükleniyor/hata durumları; kısa Türkçe metin.
4. **Erişilebilirlik:** segment kontrol klavyeyle, ızgara hücrelerinde aria-label (tarih + vardiya/Boş), diyalog adımlarında odak.
5. **Tipler:** `FunctionReturnType`, `z.infer`; `any`/`as any`/`!` yok; Convex sonuçları `any[]`'e açılmamış.
6. Ownership dışı dosya (`src/components/pdks/**`, `src/components/shifts/definitions/**`, `convex/**` değişmemeli); A2 bileşen dili dışına çıkan yeni renk/tema.

## Koş
`node_modules/.bin/vitest run src` ve `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`. Tam kapıyı koordinatör koşar.

## Kurallar
Salt okuma: kod DEĞİŞTİRME. Yalnız `.claude/review-vardiya-paketC.md` yaz. git yazma komutu ve `npx convex` YASAK. Dev server açma.

## Rapor biçimi (dosya)
Türkçe, sade. Başta 1-2 cümle özet. Bölümler: Engel / Önemli / Düşük (her madde `file:line` + sorun + somut düzeltme) / Kontrol edilenler (sorun yok).
`worker_done` ≤10 satır: bulgu sayıları + en kritik 3 madde.
