# W4 — Açık risk envanteri: ücret görünürlüğü + orphan erişim kalıbı + rıza yetkisi (salt-okuma; bu rapor sonraki iş spec'lerinin temeli olacak)
Rapor: `/Users/emreaydin/ngsaccess/.claude/orca-specs/reports/audit-1019-risk.md`
Roller: `super_admin`, `project_admin`, `project_user`. `isManager` = super_admin|project_admin (`convex/lib/auth.ts`). Emre kararı: **project_user ücret bilgisi GÖRMESİN.**

## 1. Ücret alanları haritası (asıl iş)
Alanlar: `hourlyRate`, `monthlySalary`, `overtimePayTRY`, maaş/ücret/fazla mesai ücreti ile ilgili diğer alanlar (`grep -rniE "hourlyRate|monthlySalary|overtimePay|salary|wage|ücret|maaş" convex src --include=*.ts --include=*.tsx`).
Her public `query`/`mutation`/`action` (internal değil) için: fonksiyon · dosya:satır · hangi ücret alanını döndürüyor/yazıyor · rol kapısı (hangi wrapper/kontrol) · **project_user alıyor mu: EVET/HAYIR** · kanıt.
Mutlaka bak: `convex/cardReadings.ts` (`getPdksTableData`, `getMonthlyPayrollSheet`), `convex/lib/{pdksTable,pdksPayroll}.ts`, `convex/employees.ts` (liste/detay/get sorguları ham belge dönüyor mu), dışa aktarım/rapor fonksiyonları,
**AI asistan yolu** (`convex/actions/getChatData.ts`, `convex/actions/openaiChat.ts`: project_user'ın sohbeti ücret verisini OpenAI'a/cevaba taşıyor mu?), employee yazma mutation'ları (project_user ücret DEĞİŞTİREBİLİYOR mu?).
UI tarafı: ücret gösteren bileşenler (`src/components/pdks/**`, `src/components/reports/**`, `src/lib/reports/**`, `src/utils/reportsExport.ts`, `src/components/settings/sections/{ReportsSettings.tsx,reports/exportReport.ts}`, `src/components/employees/**` formları) — hangileri role göre gizli, hangileri değil.
Çıktı: önerilen en küçük doğru çözüm (backend'de `canSeePay ? değer : null` nerelere; dönüş şekli değişmeden), etkilenen dosya listesi, gereken testler, kaba süre.

## 2. Orphan (projectId'siz kayıt) erişim kalıbı
`grep -rnE "projectId &&|\.projectId\s*&&|!.*\.projectId\s*\|\|" convex --include=*.ts` ve benzeri: projectId yoksa yetki kontrolünü ATLAYAN her yer (örnek bilinen: `convex/cardReadings.ts:~1483`; `convex/devices.ts:296,381` cihaz kontrolü olarak bildirilmiş).
Her biri: dosya:satır · kontrol edilen kaynak · gerçek açık mı (kim, neyi görür/değiştirir) · düzeltme (`requireEmployeeAccess`/`canAccessEmployeeProject` kalıbı, `convex/lib/auth.ts`).

## 3. KVKK rıza yetkisi
`convex/employeeConsents.ts` `grant`/`revoke`: project_user rıza alıp iptal edebiliyor mu (kanıt)? Kısıtlamak için gereken en küçük değişiklik (backend rol kapısı + UI buton gizleme dosyaları).

## 4. Diğer handoff açıkları (kısa doğrulama, her biri 1-3 satır)
- `convex/hikvisionSync.ts:~501` dedupe `fingerPrintID`'yi yok sayıyor (O-A) — hâlâ öyle mi?
- `convex/biometricDestruction.ts:~298` başarısız op imhada başarı sayılıyor (O-B) — hâlâ öyle mi?
- Süresi dolmuş employee setup token silinmiyor mu (`convex/employeeAuth.ts`)?
- Şifre kuralı kaç yerde kopya (`convex/invites.ts`, `src/pages/UserSetup.tsx`, `src/pages/EmployeeSetup.tsx`, başka)?
Rapor sırası: 1 (tablo + çözüm önerisi) → 2 → 3 → 4. Her bulguya Önem (YÜKSEK/ORTA/DÜŞÜK).
