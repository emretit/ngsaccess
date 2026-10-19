# Dalga 2b — DEV-0D: Senkron durumu doğruluğu (kapat ≠ çözüldü, proje kapsamı, dürüst hata metni, çözüm eylemi)

**Hedef:** Cihaz senkron banner'ları ve durum sorgusu yalnız gerçek operasyon sonucundan "güncel" der; uyarıyı kapatmak operasyonu başarılı saymaz/silmez; sayım aktif projede limit'ten önce yapılır ve eksik taramada "bilinmiyor" döner; hata metni gerçek yeniden-deneme durumunu söyler; banner'dan cihaza gidip rol kontrollü yeniden deneme yapılabilir.

(Ortak kurallar aşağıda; modül raporu: `docs/ux-audit/01_CIHAZLAR.md` §3 DEV-30..34 + §5.)

## Bulgular
1. **DEV-30 (🔴)** — Hik `dismissSyncIssue` status=done yazıyor; IDE dismiss failed op'u siliyor; `syncStatus.deviceSyncStatus` bunlar sıfırlanınca "tüm değişiklikler panellere işlendi" diyor.
   - Kapatma artık yalnız `dismissedAt` + `dismissedBy` yazar (alanlar şemada hazır); `status` DEĞİŞMEZ, IDE op SİLİNMEZ. Banner listeleri `dismissedAt` olanları gizler; durum sorgusu kapatılmış failed'i yine "başarısız (kapatılmış)" olarak sayar — "güncel" demez.
   - Boş kuyruk metni: "Bekleyen işlem yok" (kanıt değil); "tüm değişiklikler işlendi" iddiası yalnız son başarılı ack/done zamanı biliniyorsa ve hiç failed yoksa, tarihiyle.
   - Otomatik retry/temizlik yolları (`listRetryCandidates`, `cleanupStaleSyncIssues`, `resolveTargetFailures`, IDE `requeueTimedOut`) kapatılmış kayıtla nasıl davranmalı: mevcut davranışı bozma; dismissedAt yalnız UI görünürlüğünü etkilesin. Bir yolun `status=done` dismiss'ine dayandığını görürsen raporla.
2. **DEV-32 (🔴)** — `syncStatus.ts` SCAN_CAP=200 her statüye proje filtresinden ÖNCE uygulanıyor; `listSyncIssues` max*4 sonra RBAC. Yeni `by_project_status_created` index'leriyle aktif proje(ler) başına sorgula (kapsam limit'ten önce). Limit dolarsa `hasMore`/`unknown` döndür, `upToDate=true` kurma. Karar mantığını saf fonksiyona çıkar; regression testi: 201 başka-proje kaydı + 1 aktif-proje failed → aktif proje "başarısız" görünür. `projectId`'si olmayan eski op'lar: deviceId→device.projectId ile çözümle veya "kapsam dışı/bilinmiyor" say; yanlış yeşil üretme.
3. **DEV-31 (🟠)** — `SyncIssuesBanner.tsx` varsayılan aktif proje; açık "Tüm projeler" seçimi (yalnız birden fazla izinli proje varsa); proje adı + cihaz + gerçek hata sayısı. "Hepsini kapat" yalnız görünen/filtrelenen kapsamı kapatır, öncesinde adet önizlemeli `ConfirmDestructive` (veya onay); backend `dismissAll` aynı kapsam arg'ını (projectId) alır ve `resolveProjectScope` uygular, işlenen adedi döner; büyük kümede batch sınırı + "kalan var" bilgisi.
4. **DEV-33 (🟠)** — `src/lib/syncErrorMessages.ts` `friendlySyncError` operasyon durumu + attempts/max + nextRetryAt alsın: "Tekrar deneme limiti doldu — müdahale gerekli" / "~30 sn sonra tekrar denenecek" ayrımı; bilinmeyen ham hata ikincil "Teknik ayrıntı" olarak. Saf fonksiyon + test.
5. **DEV-34 (🟠)** — Banner: cihaz adı cihaz ayrıntısına link (mevcut cihaz route'unu bul), "+N eski" rozeti eski hataları açar, tekli/toplu kapatma `useAsyncAction` ile beklenir + hata gösterilir, X ikonlarına `aria-label`. Yeni **yeniden deneme** mutation'ı (Hik + IDE): rol kontrollü (adminMutation düzeyi — mevcut dosyadaki desene uy), yalnız `failed` op'u `pending`'e alır, attempts'i sıfırlar/nextRetryAt=now, dismissedAt'i temizler; yinelenen çağrıya dayanıklı (zaten pending/processing ise no-op). Hik retry tek-op kuyruğu bridge claim/ack yoluyla işlenir — `enqueue/claim/ack/requeue` mantığını DEĞİŞTİRME.

## Ownership (yalnız bunlara yaz)
convex/syncStatus.ts · convex/hikvisionSync.ts — **YALNIZ** `listSyncIssues`, `dismissSyncIssue`, `dismissAllSyncIssues` ve yeni retry mutation'ı (+ bunlara özel yardımcılar); bridge pipeline fonksiyonları (`enqueueLocalBridgeOperation`, `claimLocalBridgeOperations`, `ackLocalBridgeOperation`, `requeueStaleLocalBridgeOperations`, `listRetryCandidates`, `markOp*`, `resolveTargetFailures`, `cleanupStaleSyncIssues`, `getEmployeeWithDevices` vb.) DEĞİŞMEZ; zorunluysa `ask`.
convex/ideSync.ts — **YALNIZ** `listSyncIssues`, `dismissSyncIssue`, `dismissAllSyncIssues`, `getOpStatuses` (gerekirse) ve yeni retry mutation'ı; `enqueueIdeOp`, `listPendingForBridge`, `markSent`, `markAck`, `requeueTimedOut` DEĞİŞMEZ.
convex/lib/syncStatus*.ts (yeni) · src/components/sync/** · src/lib/syncErrorMessages.ts (+ test)

## Kapsam dışı
`convex/actions/**` (PPL worker `actions/hikvisionSync.ts`'e yazıyor) · cihaz sayfaları/diyalogları (DEV-0A/0B bitti) · schema.ts (koordinatör) · Dalga 3 tasarım göçü.
