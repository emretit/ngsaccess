# Ortak bileşen keşfi B — formlar, dialog/sheet, ayrıntı panelleri (K3, SALT OKUMA)

Önce oku ve uy: /Users/emreaydin/ngsaccess/.claude/orca-specs/ortak-bilesen-ortak.md

## Kapsam
Ekle/düzenle formları (Dialog/Sheet iskeleti, başlık+açıklama+footer butonları, kaydet/iptal/pending durumu), form alanı düzenleri,
tarih/saat/tarih aralığı seçiciler, kişi/departman/cihaz seçiciler (combobox/multi-select), ayrıntı Sheet/Drawer'ları (başlık, sekmeler,
alan-değer listeleri), silme/onay akışları, toast/hata mesajı kalıpları, ayarlar sayfası bölüm/kart düzenleri, mutation çağrısı
etrafındaki pending+toast+hata iskeleti (hook adayı olabilir).
Modüller: src/components/{employees,devices,access-control,visitors,leaves,pdks,admin,settings,profile,shifts,departments,audit,alarms}, src/pages/*.

## Kapsam dışı
Liste/tablo, filtre satırı, sayfalama, ağaç, toplu işlem çubuğu (bunlar A worker'ında).

## Çıktı
Tek dosya yaz: /Users/emreaydin/ngsaccess/.claude/design/ortak-bilesen-B.md
