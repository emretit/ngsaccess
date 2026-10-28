# FAZ 0-C FIX1 — C-02 bypass kapatma (IDE roster taşıma kontrolü 3 yolda)

ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-ortak.md` OKU. Denetim raporu: `/tmp/fix-f0-c-denetim.md` (DÜZELT 1 ve 2 — oku).
Önceki iş: `.claude/orca-specs/fix-f0-c-cihaz.md` + `/tmp/fix-f0-c-cihaz-rapor.md`. Rapor: `/tmp/fix-f0-c-fix1-rapor.md`.

Kural (koordinatör kararı): yeni IDE panelin ilk kaydı serbest. Bir ideUuid için `idePanelUsers` satırları varsa ve bu satırlar
**başka bir projeye** aitse (paneldeki eski kişiler o projenin), cihaz bu UUID ile başka projede oluşturulamaz/atanamaz/claim edilemez →
`IDE_DEVICE_MOVE_UNSUPPORTED`. Aynı projeye geri claim (release→aynı proje) SERBEST. Roster boşsa her şey serbest.

## Ownership
`convex/lib/deviceProvision.ts`, `convex/lib/deviceAssignment.ts`, `convex/fixF0Devices.test.ts` (+ gerekirse `convex/adminDevices.ts`, `convex/devices.ts`).

## Değişiklik
1. Ortak yardımcı `assertIdeRosterMovable(ctx, ideUuid, targetProjectId)`: `idePanelUsers.by_uuid` ile sınırlı okuma; satırın projesi
   (`idePanelUsers.projectId` varsa onu, yoksa satırın `deviceId` → devices.projectId) hedef projeden farklı bir satır varsa reddet.
2. Çağır: `createCore` ve `createIdePanelCore` (`deviceProvision.ts` ~107, ~185), deviceAssignment'taki claim/reassign yolları (mevcut kontrolü bu yardımcıya bağla;
   release→aynı proje claim artık geçmeli — `assignedProjectId` temizlenmiş olsa bile karar roster'ın projesine göre).
3. Testler: (a) A'da roster varken cihaz silinip B'de aynı UUID ile create → red; (b) release→aynı proje claim → başarılı; (c) roster boşken B'ye create → başarılı;
   (d) mevcut F0-C testleri yeşil.
Kapılar fix-ortak.md'deki gibi; ek `node --test scripts/lib/ide-mqtt-routing.nodetest.mjs`.
