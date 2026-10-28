# 3. DENETİM — Faz 2A düzeltme 2 (DAR, salt-okuma)
ÖNCE oku: `/Users/emreaydin/ngsaccess/.claude/orca-specs/akis-denetim-ortak.md`. Önceki denetim: `/tmp/akis-faz2a-denetim2.md` (E2/D4/D5 + NOT'lar). Düzeltme spec'i: `.claude/orca-specs/akis-faz2a-fix2.md`. Yazar raporu: `/tmp/akis-faz2a-fix2-rapor.md` — rapora değil diff'e ve kendi koştuğun kapıya dayan.
Rapor: `/tmp/akis-faz2a-denetim3.md`.
Dosyalar (bu turda değişen): convex/hikvisionSync.ts, convex/actions/hikvisionSync.ts, convex/actions/hikQueueWorker.ts, convex/deviceSyncRuns.ts, convex/accessRules.ts (2A parçalama hunk'ları), convex/lib/peopleHikSnapshot.ts, src/components/sync/SyncIssuesBanner.tsx + testler convex/hikvisionSync.test.ts, convex/hikRevocation.test.ts, src/components/sync/SyncIssuesBanner.revocation.test.tsx.

## Odak (yalnız bunlar; önceki turda kapanan E1/D2/D3'ü baştan denetleme, yalnız gerilemişse yaz)
1. E2: `hasWritableHikCredential` ekleme yolunun (`buildDoorPlans`) yazabildiği hakla birebir aynı mı; tek plan + geçerli kapı → korur, çoklu plan / boş kapsam → korumaz. Ters risk: tek planlı normal durumda (gateway ve köprü) E1 koruması hâlâ çalışıyor mu (geçerli kişi silinmez).
2. D4: `accessRules.ts` parça mutation'ı `ctx.runMutation` alt transaction ile girdi izolasyonu — Convex'te mutation içinden `ctx.runMutation` hatası yakalanınca yalnız alt transaction'ın yazıları geri alınıyor mu (`convex/_generated/ai/guidelines.md` + Convex dokümanı); continuation önce zamanlanıyor; sonsuz zamanlama yok; hata satırı kişi verisi loglamadan görünür.
3. D5: ekleme/ack sonrası tarama yalnız `failed`; pending/processing silmeleri claim/cron'da hâlâ korunuyor; gateway'de temizlik hatası kart yazımını engellemiyor.
4. N1/N2: çözülemezlik kararı aşırı geniş değil (çözülebilir gerçek silme hatası kapatılamaz); `canDismiss` yalnız çözülemez + super_admin; `:438` "eski çağrıda proje dondurma" yeni bir proje-dışı silme yolu açmıyor.
5. Değişen test beklentileri (rapordaki liste) meşru mu.

## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` · `node_modules/.bin/eslint <dosyalar>` · `node_modules/.bin/vitest run <test dosyaları>`.

Salt-okuma: rapor hariç hiçbir dosyaya yazma. commit/push/deploy/`npx convex`/DB YOK.
Rapor: ENGEL / DÜZELTİLMELİ / NOT, file:line + senaryo + öneri; E2/D4/D5/N1-N3 için "kapandı / kısmen / açık". `worker_done`'da ≤10 satır + `--report-path /tmp/akis-faz2a-denetim3.md`.
