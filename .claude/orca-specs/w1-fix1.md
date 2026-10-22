W1 DÜZELTME TURU 1 (aynı kurallar: `.claude/orca-specs/w1-talepler.md` "Ortak kurallar" ve Ownership geçerli; commit/push/deploy/`npx convex *`/DB yazma YOK; mobile/** dokunma).

Claude denetiminden (P1 yok) gelen bulguları düzelt:
1. P2 convex/leaveRequests.ts ~194 listPending: `calendarDays()` geçersiz tarihli eski bir pending kayıtta ConvexError fırlatıp tüm kuyruğu kırıyor → `leaves.ts` enrichLeavePage desenindeki gibi try/catch ile `days: null`; UI "—" gösterir. Test ekle.
2. P3 LeaveRequestsPanel.tsx ~71 ve CorrectionRequestsPanel.tsx: 2. sayfadaki son talep işlenince cursor eskide kalıp "Bekleyen talep yok" görünüyor → sayfa boş ve cursor !== null ise ilk sayfaya dön. Test ekle (saf yardımcıya çıkarmak serbest).
3. P3 pendingCount maliyeti (Convex Free kotası aşılmış): sayaçları ayır → İzinler sayfası yalnız izin sayısını, PDKS sayfası yalnız düzeltme sayısını okusun (arg `kind` ya da iki ayrı query). Her biri `take(101)` ile sınırlı kalsın; projectId zaten zorunluysa super_admin için `projects.collect` gibi tam tarama yapma (gerekiyorsa gerekçeyi raporla).
4. P3 Karar (onay/red) hatasında diyalog açık kalıyor (satır reaktif kayboluyor) → hata sonrası da diyaloğu kapat, hata toast'u kalsın.
5. P3 convex/leaveRequests.ts ve src/pages/PDKSRecords.tsx'teki ilgisiz biçim (prettier) değişikliklerini geri al: diff yalnız işlevsel satırları içersin (`git diff` ile kontrol et; mevcut submit/withdraw/listMine gövdeleri değişmeden kalsın).

Kapılar: tsc app 0 · tsc convex 0 · `eslint src convex` 0 · tam `vitest run` yeşil (sayı). Rapor: worker_done ≤8 satır, her madde için file:line.
