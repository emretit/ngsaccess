# Input border audit — W3 (Kişiler + Vardiya + PDKS + sayfalar)
Alan (yalnız bunları tara): src/components/employees/, src/components/shifts/, src/components/pdks/, src/components/leaves/, src/components/departments/, src/components/reports/, src/components/public/, src/components/audit/, src/pages/
shared/ wrapper'larını (FormDialog vb.) derin analiz etme (W1 yapıyor); yalnız "bu dosya FormDialog içinde → A" diye işaretle.
Rapor dosyası: docs/ui-audit-inputs/W3-kisi-vardiya-pdks.md
## Ortak kurallar (her worker)
Bağlam: ngsaccess web (React + Tailwind + shadcn). Kullanıcı, input olan yerlerde border/focus görünümünün bozuk durduğunu bildirdi.
Örnek vaka (doğrulandı): src/components/visitors/VisitorZoneDialog.tsx:141 "Bölge adı" Input'una odaklanınca focus ring (ring-2 = box-shadow) sağdan-soldan kesik görünüyor.
Kök sebep: src/components/shared/FormDialog.tsx:91 `overflow-y-auto` gövdede yatay padding yok → overflow-x da kırpar, ring dışarı taşan kısmı kesilir.
Base primitive: src/components/ui/input.tsx (ring-2 ring-ring ring-offset-0), textarea.tsx (bg-background!), select.tsx (focus:ring-offset-2, focus: not focus-visible:).

GÖREV: SALT OKUMA AUDIT. Kod DÜZELTME YOK. Kendi alanındaki her input benzeri öğeyi bul, sorunlu olanları raporla.
Input benzeri = <Input>, <Textarea>, <SelectTrigger>, CommandInput, DatePicker/tarih alanları, ham <input>/<textarea>/<select>, arama kutuları, input+ikon/buton grupları.

Kategoriler (her bulguya birini yaz):
- A Ring kırpılması: input'un herhangi bir atası (wrapper bileşenler dahil, ör. FormDialog, Sheet gövdesi, ScrollArea, Card, TabsContent, tablo hücresi) overflow-(auto|y-auto|x-auto|hidden|scroll) ve yatay padding (px-1/p-1 vb.) yok → ring kesilir. Ata zincirini bileşen sınırları boyunca takip et.
- C className override: border-0/border-none/border-transparent, focus-visible:ring-0 / focus:ring-0, outline-none yerine bir şey konmamış, farklı ring-offset, h-*/rounded-*/bg-* uyumsuzluğu, shadow-*.
- D Ham element: primitive yerine ham <input>/<textarea>/<select> (görünür border'lı olanlar; gizli file/checkbox hariç).
- E Hata durumu: hata gösterilen alanda input'un kendisi kırmızı border almıyor ya da aria-invalid yok; aynı formda tutarsız.
- F Grup: ikonlu arama, prefix/suffix, input+bitişik buton → çift border, radius uyumsuzluğu, ring'in ikon/butonla çakışması.
- B (yalnız W1) Primitive tutarsızlığı: ui/ altındaki input/textarea/select/command/date-picker focus/border/bg/yükseklik farkları.

Önem: Y = her kullanıcının gördüğü bozuk görünüm (ör. sık kullanılan dialog'da kesik ring) · O = belirli ekranda tutarsızlık · D = kozmetik.

YASAK: src/ veya convex/ altında HİÇBİR dosyaya yazma. `git add`, `git commit`, `git stash`, `git reset`, `git checkout`, `git restore` ÇALIŞTIRMA. npm install/deploy/convex komutu YOK. Worktree açma.
Yazabileceğin TEK dosya: kendi rapor dosyan (aşağıda).

Rapor dosyası formatı (Türkçe):
1. Üstte özet: taranan dosya sayısı, bulgu sayısı (Y/O/D), en çok tekrar eden kök sebep (1-2 cümle).
2. Tablo: | # | Önem | Kat. | file:line | Öğe | Kanıt (class / ata container file:line) | Ekran (kullanıcının gördüğü yer) | Öneri (tek satır) |
3. "Ortak kök sebepler" bölümü: tek düzeltmeyle çok yeri çözen wrapper'lar (ör. FormDialog) ve etkiledikleri dosya listesi.
Tahmin yazma: her bulguda kanıt satırı olsun; emin değilsen "doğrulanmadı" diye işaretle.

Kapı: rapor dosyası var ve boş değil; `git status --porcelain src convex` çıktısı başladığın andaki ile aynı.
worker_done özeti ≤10 satır: bulgu sayıları + en önemli 3 bulgu file:line + rapor yolu (--report-path ile ver).
