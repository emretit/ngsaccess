# Görev: UX/UI audit — Cihazlar modülü

## Hedef (test edilebilir)
`docs/ux-audit/01_CIHAZLAR.md` dosyası, aşağıdaki kapsamdaki her ekran ve akışı rubriğe göre inceleyen, her bulgusu file:line kanıtlı ve faz planı implementasyon worker'larına doğrudan verilebilecek bir UX/UI audit raporu olarak yazılmış olsun. Bulgu ID öneki: `DEV`.

## Kapsam (oku)
- Rotalar: /devices (src/pages/Devices.tsx), /virtual-readers (src/pages/VirtualReaders.tsx)
- src/components/devices/** (37 dosya), src/components/sync/** (cihaz senkron banner'ı — tüm modüllerde görünür, burada değerlendir)
- src/lib/deviceDisplay.ts, src/lib/deviceStatus.ts, src/lib/syncErrorMessages.ts
- Sayfaları besleyen Convex query/mutation'lar (convex/devices*.ts, readers, doors vb. — yalnız oku)
- Bağlam: cihaz tipleri Hikvision (ISAPI/SDK), IDE Smart (MQTT), sanal okuyucu/QR. Kapı↔okuyucu ayrımı: docs/HANDOFF_KAPI_OKUYUCU.md. Ana kullanıcı işi: cihaz ekleme/provizyon, durum (online/offline) izleme, kapı-okuyucu eşleme, senkron hatasını anlama ve çözme.

## Ownership
YALNIZ `docs/ux-audit/01_CIHAZLAR.md` (yeni dosya). Başka hiçbir dosyaya yazma.

## Ortak kurallar (tüm UX audit worker'ları)

Repo: /Users/emreaydin/ngsaccess — React 19 + Vite + Tailwind 4 + shadcn/ui (src/components/ui), backend Convex (convex/). Erişim kontrol + PDKS (personel devam takip) SaaS'ı; kullanıcılar Türk şirket yöneticileri/İK. Kullanıcıya görünen metin Türkçe.
Bu iş SALT-OKUMA bir UX/UI audit'tir: kaynak koda (src/**, convex/**, mobile/**) HİÇBİR DEĞİŞİKLİK yapma. Tek yazacağın dosya aşağıdaki "Rapor dosyası".
Referans örnek (format + derinlik): docs/PDKS_KAYITLARI_UX_PLANI_2026-10-16.md — bu kalitede yaz. PDKS Kayıtları sayfası (/pdks-records, src/components/pdks/**) zaten audit edildi, kapsam dışı.
Beklenen standart (sapmalar bulgudur): paylaşılan bileşenler src/components/shared/{EmptyState,ErrorState,StatCard,AccessDenied,FormFieldWrapper}.tsx, renk tokenları src/index.css + src/styles/colors.css (semantik `status-*` tokenları), shadcn ui bileşenleri, lucide ikonları (emoji değil), sonner toast.

### Rubrik (her ekran/akış için bak)
1. Fonksiyonel UX hatası: yanlış/çelişen veri, kırık/eksik akış, sahte buton, yanlış kayda yazma, filtre/URL state kaybı.
2. Görev akışı + bilgi mimarisi: kullanıcının ana işleri kaç adım; aynı kontrol birden çok yerde; kalabalık; sekme/diyalog derinliği; gezinme.
3. Durumlar: loading (iskelet vs tam ekran spinner), boş durum, hata durumu, başarı geri bildirimi, yıkıcı işlemde onay, disabled/pending buton.
4. Formlar: validasyon + Türkçe hata mesajı, zorunlu alan işareti, mantıklı varsayılan, uzun formun bölünmesi, kaydetmeden çıkış.
5. Görsel tutarlılık: sabit Tailwind renkleri (bg-green-100, text-red-600…) vs semantik token → dark mode; emoji ikon; tipografi/boşluk/başlık hiyerarşisi; shared bileşen yerine yerel kopya.
6. Responsive/mobil: tablo taşması, sabit genişlik, dokunma hedefi.
7. Erişilebilirlik: ikon-buton aria-label, tıklanabilir div (klavye yok), focus, label-input bağı, kontrast.
8. Metin/dil: Türkçe-İngilizce karışık, jargon, ham ID/enum/teknik kod gösterimi, tutarsız terim (kişi/personel/çalışan).
9. Algılanan performans: büyük liste pagination/virtualization yok, N+1 veya tam tablo taraması yapan Convex sorgusu (yalnız sayfayı besleyen query'leri oku), gereksiz yeniden render.
10. Kod kuralı ihlali (yalnız UX'e etkisi olanı yaz): yerel tip kopyası, `as` cast ile gizlenen veri uyumsuzluğu.

Önem: 🔴 Kritik (yanlış veri / kırık akış / veri kaybı riski) · 🟠 Yüksek (ana görevi ciddi zorlaştırıyor) · 🟡 Orta (tutarsızlık, cila) · ⚪ Düşük.
Efor: S (<2 saat) · M (~yarım gün) · L (1+ gün).
Her bulgu kanıta dayanır: `dosya:satır` gerçek ve doğru olmalı (koordinatör otomatik doğrulayacak). Tahmin/varsayımı "(doğrulanmadı)" diye işaretle. Bulgu sayısı için kota yok; önemsiz cilayı şişirme, modül başına önemli olanların hepsini yaz.

### Rapor şablonu (Türkçe, markdown)
```
# <Modül grubu> — UX/UI Audit (2026-10-16)
> Kapsam: rotalar + dosyalar. Sayım: 🔴 n · 🟠 n · 🟡 n · ⚪ n
## 1. Özet            (3-5 cümle: modülün ana işi, en büyük 3 sorun)
## 2. Ana görevler    (tablo: Görev | Bugünkü akış (adım sayısı) | Takıldığı yer) — 3-8 görev
## 3. Bulgular        (ekran/alt modül başlıkları altında tablo: ID | Önem | Kat.(1-10) | Bulgu | Yer (file:line) | Öneri | Efor)
                      ID öneki: <PREFIX>-01, -02 …
## 4. Hedef tasarım   (ekran başına ASCII wireframe + 3-5 tasarım ilkesi)
## 5. Fazlar          UX-0 hata düzeltme · UX-1 sadeleştirme/tutarlılık · UX-2 yeni yetenek.
                      Her faz: kapsadığı bulgu ID'leri, tahmini süre, OWNERSHIP dosya listesi (bir implementasyon worker'ına doğrudan verilebilecek netlikte), backend (convex) değişikliği gerekiyorsa açıkça "backend" etiketi.
## 6. Modüller arası adaylar  (başka modüllerde de muhtemel pattern'ler, ortak bileşene çıkarılabilecek şeyler — kısa liste)
```

### YASAK
Kaynak kodda değişiklik · commit / push / deploy (`npx convex dev`, `npx convex deploy`) · migration · canlı DB'ye okuma/yazma (Convex/Supabase MCP dahil) · dev server'ı arka planda açık bırakmak. Mevcut kirli dosyalara (convex/lib/cardReadingAudit.ts, mobile/**) dokunma.

### Kapılar
1. Rapor dosyası var ve şablondaki 6 başlığın hepsini içeriyor.
2. Her bulgu satırında en az bir `path:satır` referansı var ve o satır dosyada mevcut.
3. `git status --porcelain` çıktısında senin yüzünden değişen tek dosya rapor dosyası.

### worker_done raporu (≤10 satır)
Rapor yolu · önem sayımı · en kritik 3 bulgu (ID + file:line + 1 cümle) · önerilen ilk faz ve süresi · doğrulanamayan noktalar. `--report-path` ile rapor dosyasını bildir.
