# Görev: Dalga 2b denetimi — frontend (SALT-OKUMA)
Repo: /Users/emreaydin/ngsaccess. 6 Codex worker doğruluk paketlerini uyguladı (spec'ler .claude/orca-specs/d2b-*.md + d2b-common.md; bulgu ayrıntıları docs/ux-audit/0[1-4]*.md, ortak kurallar docs/ux-audit/DESIGN_SYSTEM.md). Bağımsız denetçisin; raporu değil DİFF'i oku.
## Kapsam
`git diff -- src` + `git status --short src` ile yeni dosyalar (silinen src/pages/Auth.tsx, components/auth/RegisterForm.tsx, LoginForm.tsx koordinatörün — hiçbir yerden import edilmiyordu; doğrula).
## Özellikle bak
1. Aktif proje kapsamı: ekran sorguları `projectId` (aktif proje) mi gönderiyor; proje değişince açık form/seçim/filtre/sayfalama durumu sıfırlanıyor mu (Employees, departman ağacı, ziyaretçi formu, kart okuma listesi, denetim kaydı, raporlar, sync banner); projectId yokken "skip" sonsuz yükleniyor mu kalıyor (super_admin aktif proje seçmemişse ne görür?).
2. usePaginatedQuery kullanımı (CardReadings, AuditLog): "Daha fazla yükle", yüklenen/toplam metni dürüst mü; filtre değişince cursor sıfırlanıyor mu; sayfa içi metin araması "yüklenenlerde" diye etiketli mi.
3. Mutation düğmeleri: useAsyncAction (pending + çift tıklama + hata halinde form açık) — AddDepartmentDialog, AdminDeviceDialog (kayıt+atama yarıda kalma), SyncIssuesBanner (tekli/toplu kapat, retry), ZoneDoorTree/EditDoorDialog (ACC-tree worker'ı bitince). Yıkıcı işlemlerde ConfirmDestructive içeriği doğru mu.
4. Durum ayrımı: loading / proje yok / boş / filtrelenmiş-boş / hata (AuditLog, AdminUsersPanel, HolidayCalendarManager, AdminDashboard, ReportsSettings); `?? []` ile yükleme boş gibi görünüyor mu.
5. Zaman: kullanıcıya görünen zaman Europe/Istanbul + "TR saati" etiketi; tarih filtresi TR günü (CardReadingsTable, AuditLog, raporlar); useNow (AdminDevicesPanel) sayfa gizliyken duruyor mu, interval temizleniyor mu.
6. Erişilebilirlik: yeni ikon düğmelerinde aria-label, Label↔input bağı, Devices.tsx ?deviceId deep-link geri/ileri davranışı.
CLAUDE.md: any/as any yok, ! yok, Convex sonuç tipleri FunctionReturnType ile (yerel tip kopyası yok).
## Kapı (kendin koş)
node_modules/.bin/tsc --noEmit -p tsconfig.app.json · node_modules/.bin/tsc --noEmit -p convex/tsconfig.json · node_modules/.bin/eslint src convex · npx vitest run
## YASAK
Dosya düzenleme yok. commit/push/deploy/DB YOK. Tarayıcı açma yok (yalnız kod okuma).
## worker_done (≤12 satır)
Bulgular önem sırasıyla (kritik/yüksek/orta), file:line + 1 cümle + düzeltme önerisi. Kapı sonuçları. "Commit'e hazır mı: evet/hayır".
