# Görev: Cihazlar sayfası — Faz A küçük web düzeltmeleri

Hedef (test edilebilir): Cihaz paneli başlığında "Zorunlu alanlar * ile işaretlidir." yazmaz; İşlemler › Bağlantı kartında durum ve marka rozeti tekrarlanmaz; "Havuzdan ata" açıklaması anlamlıdır; Tip filtresi de sayı gösterir.

## Ownership (yalnız bunlar)
- src/components/devices/DeviceDetailsPanel.tsx
- src/components/devices/DeviceConnectionSection.tsx
- src/components/devices/DeviceAddMenu.tsx
- src/components/devices/DeviceFilters.tsx
- src/components/devices/DevicesContent.tsx
- src/components/devices/**/*.test.tsx ve *.test.ts (yalnız bu değişiklik yüzünden kırılan/yeni testler)

## Değişiklikler
A1. DeviceDetailsPanel.tsx ~148: `description` prop'unda "Zorunlu alanlar * ile işaretlidir." dalını kaldır. Salt okunur cihaz → "Bağlantı, kapılar ve cihaz bilgileri", marka seçimi adımı → "Önce cihazın markasını seçin." kalır; diğer durumlarda açıklama yok (undefined). Formlarda yıldız mekanizması yok, cümle yanlış. DetailSheet'in `description` boşken düzgün render ettiğini (boş <p> bırakmadığını) kontrol et; bırakıyorsa yalnız bu çağrıda çöz (DetailSheet.tsx sahiplik dışı).
A2. DeviceConnectionSection.tsx: başlıkta (DeviceDetailsPanel headerExtra) zaten ad + bağlantı durumu + marka·model var. Karttan bağlantı durumu StatusBadge'ini (~35-49) ve marka Badge'ini (`adapter.label`, ~26) kaldır; iletişim yöntemi Badge'i (`adapter.transport`, ör. "Gateway") kalsın. Kullanılmayan değişken/import'ları temizle.
A3. DeviceAddMenu.tsx ~45: "Havuzdan ata" altındaki açıklama "Havuzdan projeye ata" → "Sistemde kayıtlı cihazı bu projeye bağla".
A4. Tip filtresi sayıları: DevicesContent.tsx ~88'de `statusCounts` gibi, aynı `locationDevices` listesinden cihaz tipine (deviceType alanı; tip filtresinin kullandığı alanla aynı olmalı — DevicesContent/hook'ta typeFilter'ın neyle karşılaştırdığına bak) göre sayım üret ve DeviceFilters'a yeni bir prop ile geçir. DeviceFilters.tsx ~42: "Tümü (N)" ve her tip seçeneği "Tip adı (n)". Filtreleme mantığını değiştirme.

## Kapsam dışı
Form bölümleri (form-sections/*), DeviceForm.tsx, LocationTree/LocationDoorItem, PaginationBar, FilterBar, convex/*.

## Kapılar (hepsi yeşil olmalı)
- node_modules/.bin/tsc --noEmit -p tsconfig.app.json  (sahiplik dışı hatalar raporlanır)
- node_modules/.bin/eslint src/components/devices
- node_modules/.bin/vitest run src/components/devices
