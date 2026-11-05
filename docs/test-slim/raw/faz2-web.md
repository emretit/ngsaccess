# Web test sadeleştirme Faz 2 raporu

Durum: tamamlandı; atlanan adım yok. Üretim koduna ve ownership dışındaki çalışma ağacı dosyalarına dokunulmadı; git index/commit işlemi yapılmadı.

## Adımlar

- YAPILDI: `DeviceCommandCenter.audit.test.tsx` düz `mv` ile `src/components/devices/DeviceCommandCenter.test.tsx:1` oldu; ilk 10 case korundu, project_user (`:79`), doors.open (`:122`) ve employees.manage (`:132`) iddiaları değişmedi.
- YAPILDI: `DeviceOfflineConfirmation.test.tsx` içindeki 4 case hedefe (`src/components/devices/DeviceCommandCenter.test.tsx:176`) taşındı; 14/14 hedef testi geçtikten sonra kaynak düz `rm` ile silindi.
- YAPILDI: `DeviceAudit.test.tsx` eski :187 case’i okuyucu ayarı ve ek metin iddiaları içerdiğinden silinmedi; tamamı `src/components/devices/DeviceCommandCenter.test.tsx:190` içine taşındı. Hedef 15/15, kalan `DeviceAudit.test.tsx` 7/7 geçti (önce 10+4+8=22, sonra 15+7=22).
- YAPILDI: tek izin/Convex mock kurulumu, her case öncesi state reset (`DeviceCommandCenter.test.tsx:164`); gerçek command hook ve action/connection bölümleri korunarak yalnız onay case’lerinde pendingAction enjekte edildi (`:142`).
- YAPILDI: saf readFilters/writeFilters source case’i `monitoringAudit.test.tsx` içinden `src/components/live-monitoring/lib/readings.test.ts:21` içine taşındı; round-trip fixture source alanıyla genişletildi (`:27`). Hedef 33→34 case, 34/34 yeşil; render dosyası 7→6 case.
- YAPILDI: `src/test-utils/filterLabel.ts:6` tek ortak expectLabel; label for/id, tek kontrol/tek label ve erişilebilir adı ezecek ARIA override olmaması doğrulanıyor. Regex değişkenleri kaçırılıyor.
- YAPILDI: dokuz tüketici helper’ı import ediyor (aşağıdaki dosyaların :1 satırı); yerel helper kopyaları kaldırıldı ve 8 FilterField sınıf assertion’ı çıkarıldı. Diğer case’ler ve iddialar korunmuştur.
  - `src/components/settings/sections/components/HolidayCalendarManager.test.tsx:1`
  - `src/components/visitors/VisitorFilters.test.tsx:1`
  - `src/components/alarms/AlarmFilters.test.tsx:1`
  - `src/components/admin/components/AdminListParts.test.tsx:1`
  - `src/components/live-monitoring/monitoringAudit.test.tsx:1`
  - `src/components/pdks/dashboard/auditFixes.test.tsx:1`
  - `src/components/reports/auditFixes.test.tsx:1`
  - `src/components/devices/DeviceFilters.test.tsx:1`
  - `src/components/employees/EmployeeFilters.test.tsx:1`
- YAPILDI: sınıf sözleşmesi zaten `src/components/shared/FilterBar.test.tsx:42` içinde tek case olarak mevcut olduğundan bu dosyaya değişiklik gerekmedi.

## Sayımlar

- Silinen dosya: 1 (`DeviceOfflineConfirmation.test.tsx`); ayrıca 1 dosya yeniden adlandırıldı, ortak helper 1 dosya olarak eklendi.
- Silinen case: 0. Başka dosyaya taşınan case: 6 (4 onay + 1 DeviceAudit + 1 URL); dosya yeniden adlandırmasıyla konumu değişen ilk 10 dahil toplam 16.
- Kapsam: önce 130 dosya / 847 case / 0 fail; sonra 129 dosya / 847 case / 0 fail. Case farkı 0; test başlıkları çoklukları da birebir aynı.

## Kapılar (istenen sıra)

1. `node_modules/.bin/vitest run src/components/devices src/components/live-monitoring src/components/settings src/components/visitors src/components/alarms src/components/admin src/components/pdks src/components/reports src/components/employees src/components/shared --reporter=json --outputFile=/tmp/test-slim/faz2/web-before.json` → exit 0, 847/847.
2. `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → exit 0, hata yok.
3. `node_modules/.bin/eslint` + değişen/yeni 13 dosyanın açık listesi → exit 0, error/warning yok.
4. Aynı kapsam vitest komutu, `--outputFile=/tmp/test-slim/faz2/web-after.json` → exit 0, 847/847.

Her case taşıması sonrası hedef testi çalıştırıldı; tam vitest çalıştırılmadı. JSON kanıtları bu raporla aynı dizinde.

`git diff --check` → exit 0 (helper çıkarma sonrası dosya sonu boş satırları temizlendi).
