# W4.1b DÜZELTME 1 — arayüz denetim bulguları (UYGULAMA)

Çalışma dizini: `/Users/emreaydin/orca/workspaces/ngsaccess/w4-1-schedule-templates` (İLK İŞ `cd`). Denetim raporu: `/tmp/w41b-denetim.md` (oku). Orijinal spec: `/Users/emreaydin/ngsaccess/.claude/orca-specs/w4-1b-schedule-templates-ui.md`.

## Ortak kurallar
TypeScript strict; `any`/`as any`/`!` yok; Convex tipleri `FunctionReturnType`; Türkçe metin; yeni bağımlılık YOK (testler SSR + saf fonksiyon deseniyle).
YASAK: commit, push, deploy, `npx convex *`, DB yazma, `convex/**` (salt-okuma), `mobile/**`, `bridge/**`, `package.json`/lock.

## Düzeltmeler
1. **Kaydedilmemiş değişiklik kaybı** — `CreateRuleDialog.tsx:256` / `components/TimeSchedule.tsx` ~70: "Şablonu düzenle" sihirbazı mevcut kapanma korumasından geçsin (`guard.requestClose(...)` deseni, `CreateRuleDialog.tsx` ~53). Form kirliyse onay sorulur.
2. **Gereksiz cihaz gönderimi** — `hooks/useRuleForm.ts` ~187 (düzenleme): şablon modunda seçili id kuralın mevcut `scheduleTemplateId`'sine eşitse `scheduleTemplateId` GÖNDERİLMESİN (`undefined`); yalnız değiştiyse id, Özel'e dönüşte `null`. Saf fonksiyonla + test.
3. **IDE aşım listesinde ad** — backend `previewImpact.ideOverLimit` öğelerinde artık `employeeName` ve `deviceName` var (`convex/accessScheduleTemplates.ts`'te doğrula). `TemplateEditor.tsx` ~306 listede "Ad Soyad — Cihaz adı (toplam N/16)" göstersin; ad yoksa ID'ye düş.
4. **Hata/geri bildirim** — `TemplatesPage.tsx` ~76/~195: hata tek yerde görünsün; yeni aksiyon açılınca/başarıda temizlensin. Kopyala/Arşivle/Sil başarısında repo'nun mevcut toast/bildirim desenini kullan.
5. **Açık editördeki şablon silinirse** (`TemplatesPage.tsx` ~160): editör sessizce kapanmasın; "Bu şablon silindi" bilgisi gösterip kapat.
6. **Diff şişmesi** — yalnız biçim (whitespace/satır kırma) değişen hunk'ları geri al: `useRuleForm.ts`, `AccessRulesList.tsx`, `AccessRuleDetails.tsx`, `lib/loadRuleEditor.test.ts`, `src/hooks/access-rules/useComplexAccessRuleMutations.ts`. Mantık değişikliklerini KORU; `git diff -w` ile kontrol et. Emin olmadığın hunk'a dokunma.

## Kapılar
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0 · `node_modules/.bin/eslint src convex` → 0 error · `node_modules/.bin/vitest run` → tamamı yeşil (sayı) · `node_modules/.bin/vite build` → OK.

## Rapor
`/tmp/w41b-fix1.md` + `worker_done`'da ≤10 satır: madde başına file:line + test · geri alınan biçim hunk sayısı · kapı sayıları.
