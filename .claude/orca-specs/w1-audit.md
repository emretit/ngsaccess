SALT-OKUMA DENETİM (Claude). Dosya yazma, commit, push, deploy, `npx convex *`, DB yazma YOK.

Hedef: W1 "Talepler ekranı" değişikliği (Codex yazdı) doğru ve güvenli mi? Spec: `.claude/orca-specs/w1-talepler.md`.
Diff'i kendin oku (raporu değil): `git diff -- convex/schema.ts convex/leaveRequests.ts convex/leaveRequests.test.ts convex/leaves.ts src/pages/Leaves.tsx src/pages/PDKSRecords.tsx src/components/pdks/auditPage.test.tsx` + yeni dosyalar `src/components/leaves/LeaveRequestsPanel{,.test}.tsx`, `src/components/pdks/CorrectionRequestsPanel{,.test}.tsx`. (`mobile/**` başka ekibin, kapsam dışı.)

Odak:
1. Yetki/IDOR: listPending/pendingCount/approve/reject proje kapsamı; project_user erişemiyor mu; başka projenin talebi onaylanabilir mi; çalışan↔izin proje uyumu.
2. Doğruluk: yalnız pending işleniyor mu; onayda onaylı izinle çakışma kontrolü; çalışanın `notes` alanı korunuyor mu; eşzamanlı iki onay (çift işlem) güvenli mi; audit yazılıyor mu.
3. Convex maliyeti (Free plan kotası aşılmış durumda): pendingCount reaktif sorgusu her PDKS/İzinler açılışında kaç belge okur; sınırsız collect var mı; gereksiz abonelik.
4. UI: yönetici olmayan rol sekmeyi görmüyor mu; red gerekçesi zorunlu mu; hata mesajları Türkçe ve anlaşılır mı; boş durum; aktif proje değişince doğru veri.
5. Kurallar: `any`/`as any` yok, `!` non-null yok, Convex sonucu `any[]`'a açılmamış, testler gerçekten davranışı doğruluyor mu.

Kapı (kendin koş, dosya değiştirmeden): `node_modules/.bin/vitest run convex/leaveRequests.test.ts src/components/leaves src/components/pdks` ve `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`.

Rapor: worker_done'da ≤10 satır; her bulgu P1 (engel) / P2 (düzeltilmeli) / P3 (not) + file:line + somut senaryo; bulgu yoksa "TEMİZ". Rapor Türkçe.
