# Denetim — Hik cihaz taşıma engeli + roster eşitleme (SALT-OKUMA)

Yazan: Codex (2 tur). Sen denetçisin: HİÇBİR DOSYAYI DEĞİŞTİRME (rapor dosyası hariç). commit/push/deploy/canlı çağrı YOK.

## Oku
- Spec: `.claude/orca-specs/cihaz-tasima-hik-roster.md` + `.claude/orca-specs/cihaz-tasima-hik-roster-fix1.md`
- Raporlar (yalnız ipucu; DİFF'E GÜVEN): `/tmp/cihaz-tasima-rapor.md`, `/tmp/cihaz-tasima-fix1-rapor.md`
- Diff: `git diff -- convex/hikvisionSync.ts convex/lib/deviceAssignment.ts convex/lib/gatewayBackfill.ts src/components/admin/AdminDeviceDialog.tsx convex/devicesMutations.characterization.test.ts convex/_generated/api.d.ts`
  + yeni dosyalar: `convex/lib/hikRosterReconcile.ts`, `convex/hikRosterReconcile.ts`, `convex/actions/hikRosterReconcile.ts`,
  `convex/lib/hikRosterReconcile.test.ts`, `convex/hikRosterReconcile.test.ts`, `convex/actions/hikRosterReconcile.test.ts`,
  `convex/lib/deviceAssignment.hik.test.ts`, `convex/lib/gatewayBackfill.roster.test.ts`, `src/components/admin/AdminDeviceDialog.test.tsx`
- Convex kuralları: `convex/_generated/ai/guidelines.md`

## Odak (öncelik sırasıyla)
1. **Yanlış silme (kilitleme) riski:** fiziksel cihazdan meşru kişi silinebilir mi? Beklenen küme (`convex/hikRosterReconcile.ts`)
   sistemin Hik cihaza yazdığı TÜM yolları kapsıyor mu (kural çalışanları, ziyaretçiler, parmak izi, yüz, kuyruk, başka yazıcılar —
   `convex/actions/hikvisionSync.ts`, `convex/lib/hikSyncEmployee.ts`, `convex/visitors.ts`, `convex/fingerprintEnrollment.ts`,
   `convex/lib/peopleHikSnapshot.ts` resolveRuleDeviceTargets)? Kart no normalizasyonu cihazdaki employeeNo yazımıyla birebir mi?
   Tetik yalnız YENİ kayıtta mı (`convex/lib/gatewayCommand.ts` + `src/components/devices/hooks/useDeviceFormSubmission.ts`
   — zaten kayıtlı cihazda register çağrılıyor mu)? Canlı NGS0001/NGS0002 (zaten kayıtlı) etkilenir mi?
2. **Açık gerçekten kapanıyor mu:** A'dan sil → B'de yeniden ekle senaryosunda A kişileri silinir mi (register bağlamı + boş küme)?
   Cihaz kayıtta çevrimdışıysa tekrar/uyarı akışı doğru mu? Kısmi silme hatasında (failed>0) ne oluyor?
3. **Taşıma engeli:** claim/reassign'da Hik reddi hiçbir yazımdan önce mi; IDE akışı değişmedi mi; ad değişikliği çalışıyor mu;
   UI kilidi + metin doğru mu.
4. **Convex doğruluğu:** `"use node"` dosyası yalnız action export ediyor mu; internalQuery okuma sınırları; scheduler döngüsü
   sonsuza gidebilir mi; action içinde tip güvenliği (`any` yok, `!` yok).
5. Testler davranışı gerçekten kanıtlıyor mu (mock'lar gerçeği gizliyor mu)?

## Kapılar (kendin koş, sonuçları yaz)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` ·
`node_modules/.bin/vitest run convex/lib/hikRosterReconcile.test.ts convex/hikRosterReconcile.test.ts convex/actions/hikRosterReconcile.test.ts convex/lib/deviceAssignment.hik.test.ts convex/lib/gatewayBackfill.roster.test.ts convex/devicesMutations.characterization.test.ts src/components/admin/AdminDeviceDialog.test.tsx`

## Rapor
`/tmp/cihaz-tasima-denetim.md` (Türkçe, ≤50 satır): sonuç 1-2 cümle · ENGEL / DÜZELTİLMELİ / NOT başlıkları, her bulgu file:line +
somut senaryo · kapı sonuçları. worker_done ≤10 satır.
