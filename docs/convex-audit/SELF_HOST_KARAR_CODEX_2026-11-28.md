1. **8–10 Aralık açılışı için önerim E: Cloud Starter ile açılmak, self-host kararını gerçek kullanım ve restore provasından sonra vermek.**
2. **Self-host teknik olarak geçerli bir seçenek; bu yükte sağlayacağı nakit tasarrufu tek kişinin işletme emeğini henüz karşılamıyor.**
3. **Self-host zorunlu tercihse B, ayrı VM, daha savunulabilir; A aynı sunucuda Pafta ve cihaz köprüsünün arızasını backend’e bağlar.**
4. **SQLite hakkında eski ağır hata raporları var, fakat iki önemli düzeltme 25 Kasım kaynak kodunda mevcut; açık issue sayısı tek başına güncel hata kanıtı değil.**
5. **Free’de yedeksiz dev deployment ile devam etmek güvenli başlangıç değil; Starter da kendiliğinden otomatik yedek veya SLA sağlamıyor.**

# NGS Access: self-hosted Convex karar araştırması

**Tarih: 28 Kasım 2026.** Salt okuma araştırmasıdır; yalnız bu dosya yazıldı. SSH, Convex CLI, deploy, commit, kod değişikliği ve canlı yük testi yapılmadı. Orca orchestration becerisi yalnız görev raporlama için kullanıldı. Aşağıdaki web kaynaklarının erişim tarihi **28.11.2026**; yayın/olay tarihleri ayrıca belirtildi. Tahminler ve yorumlar ölçümden ayrılmıştır.

## Kararın zemini ve repo kanıtı

İzin verilen kaynaklar okundu: [YUK_500](YUK_500_2026-11-27.md), [FREE_PLAN](FREE_PLAN_2026-11-28.md), [SELF_HOST_PLAN](SELF_HOST_PLAN_2026-11-28.md) ve [mevcut geçiş denetimi](../../.claude/orca-specs/self-host-review.md). Diğer bağımsız araştırma raporu okunmadı. Bu belgelerdeki 4 Aralık tarihi bu görevin **8–10 Aralık** açılış tarihiyle güncellendi. Sunucunun 8 vCPU/15 GB, 9,2 GB boş RAM ve 96 GB boş disk bilgisi görev bağlamından; uzaktan doğrulanmadı.

Son iki yük raporunu birbirine karıştırmamak gerekir: eski 500 kişi modelinin 447,6 GB/ay I/O’su, yeni FREE_PLAN modelinde **79,98 GB/ay**. Yeni raporda aylık PDKS/bordro batch sürümüyle çalışıyor; eski rapordaki başarısızlık güncel çözülmemiş hata diye taşınmamalı. Bunlar yerel test/model sonuçları, Cloud kullanım faturası veya SQLite kapasite ölçümü değil.

Çalışma ağacı araştırma sırasında başka işler nedeniyle değişiyordu. `src/hooks/useDashboard.ts` artık `useVisibleRefresh` kullanıyor; `src/hooks/useVisibleRefresh.ts` görünür sekmede **2 dakika** aralığı tanımlıyor. Dolayısıyla “ana sayfa iyileştirmesi henüz yok” ifadesi bu ağaç için eskimiş. Canlıya çıktığı veya $1–5 sonucunun ölçüldüğü doğrulanmadı. Mobil `CONVEX_URL` derleme zamanı seçiliyor; `convex/auth.config.ts` issuer’ı `CONVEX_SITE_URL` üzerinden alıyor. Hosting değişikliği yalnız Docker açmak değildir: istemci dağıtımı, auth, dosya URL’leri ve cihazların hedefleri de geçişin parçasıdır.

## 1. Üretim olgunluğu: resmî ürün, fakat yönetilen hizmet değil

Resmî [Self Hosting dokümanı](https://docs.convex.dev/self-hosting) Cloud ile aynı güncel backend kodunu kullandığını söylüyor; daha az işletim isteyenlere Cloud’u öneriyor. [13.02.2025 duyurusu](https://news.convex.dev/self-hosting/) Docker, dashboard ve Postgres desteğini açıklıyor. Bu, terk edilmiş veya yalnız deney amaçlı bir kaynak kodu değil; aynı zamanda Cloud’un işletim güvencelerinin Docker’a taşındığı anlamına gelmiyor.

Resmî [self-host README](https://github.com/convex/convex-backend/blob/main/self-hosted/README.md) içinde “production-ready configuration” ifadesi var: SQLite ile başlayıp gerekirse hosting sağlayıcısına veya ayrı SQL veritabanına geçme bağlamında kullanılıyor. Bunu “varsayılan tek SQLite container her üretim yükü için sertifikalıdır” şeklinde okumamak gerekir. README destek için Discord `#self-hosted` ve GitHub’a yönlendiriyor. [Resmî işletim yazısı](https://stack.convex.dev/self-hosted-develop-and-deploy), self-host için Convex ekibinden destek planı olmadığını açıkça belirtiyor; varsayılan backend tek düğüm, büyüme esasen dikey.

**SLA ayrımı:** Self-host için Convex uygulama SLA’sı bulunamadı. Cloud Starter ve Pro’ya da SLA var denmemeli: [fiyat/özellik karşılaştırmasında](https://www.convex.dev/pricing) Pro’da Service SLAs “No”, SLA Business/Enterprise tarafında. Pro’nun farkı günlük yedek, e-posta desteği ve daha yüksek kapasite. Hetzner’in [VM hizmet vaadi](https://www.hetzner.com/cloud/) uygulamanın, SQLite’ın veya Emre’nin kurtarma süresinin SLA’sı değildir.

### Sürüm hızı ve güncelleme

[Self-host changelog](https://github.com/convex/convex-backend/blob/main/self-hosted/CHANGELOG.md), 17.09.2025’ten beri daha sık sürüm çıkarıldığı için changelog’un aynı sıklıkta güncellenmeyeceğini, git geçmişine bakılmasını söylüyor. Backend ile dashboard sürümleri eşleşmeli. [GitHub release API](https://api.github.com/repos/convex/convex-backend/releases?per_page=14) araştırma anında 24–27 Kasım arasında 14 precompiled kayıt gösterdi; sonuncusu `precompiled-2026-11-27-76da829`, 27.11.2026 23:21 UTC. **Bu, günde güncelleme zorunluluğu veya aynı sıklıkta test edilmiş Docker imajı garantisi değildir.**

[Resmî yükseltme kılavuzu](https://github.com/convex/convex-backend/blob/main/self-hosted/advanced/upgrading.md) yerinde iç veritabanı migration’ı veya export/import yolunu sunuyor; yerinde yükseltmenin nadiren pürüzlü olabileceğini belirtiyor. Önce export öneriliyor. Eski image’a dönmek iç DB migration’ını geri almaz; rollback, sürümle eşleşen veri ve yapılandırmayla prova edilmeli. Changelog’daki somut örnekler: 19.02.2025 `DATABASE_URL` → `POSTGRES_URL`/`MYSQL_URL` değişimi; 29.05.2025 cron bulunan eski kurulumların upgrade engelinin düzeltilmesi. Otomatik `latest` güncellemesi uygun işletim politikası değil.

### Issue’lar: tarih, kapsam ve bugünkü durum

Issue, kullanıcının raporudur; bağımsız tekrar üretim değildir. Bazıları Cloud’la ortak kodu ilgilendiriyor. Aşağıdaki “açık” durumları 28.11.2026 API kontrolüdür; açık issue, düzeltme kodunun hiç gelmediğini kanıtlamaz.

| Başlık / kaynak | Tarih ve kanıt | NGS için anlamı |
|---|---|---|
| [#495 SQLite geniş indeks aralığı/OOM/export](https://github.com/convex/convex-backend/issues/495) | 25.06.2026, açık; sonraki kullanıcılar geniş tarama ve export’un bitmemesini bildirmiş | Uzun ömürlü veri ve dahili scheduler/session geçmişi küçük güncel tablo boyutundan daha ağır olabilir. Ancak aşağıdaki güncel düzeltme kontrolü önemli. |
| [#593 SQLite açılış bellek büyümesi](https://github.com/convex/convex-backend/issues/593) | 09.10.2026, açık; raporlayan 3,43 M geçmiş satırında 17–22 GB heap bildiriyor | Bu rakam NGS’in 500 kişisinin ihtiyacı değildir; tarihsel revizyonlarla yeniden başlatma testi gereğini gösterir. |
| [#498 ikinci Blob okumasında sıfır bayt](https://github.com/convex/convex-backend/issues/498) | 04.07.2026, açık; rapor hem local hem Cloud dev’de tekrarlandığını söylüyor | Sessiz yanlış çıktı/veri bozulması örneği; yalnız self-host sorunu değil ve kalıcı DB kaybı kanıtı değil. Dosya akışları gerçek runtime’da kontrol edilmeli. |
| [#105 dashboard import/export ekranı](https://github.com/convex/convex-backend/issues/105) | 23.05.2025, açık; ekip yorumu CLI import/export’un çalıştığını söylüyor | Ekran eksiği, export motoru yok demek değil; kurtarma CLI ile hazırlanmalı. |
| [#173 admin key reddi](https://github.com/convex/convex-backend/issues/173) | 03.08.2025, açık; yorumlar adres, instance ve tarayıcı/Docker ortamına göre değişiyor | Yönetici erişimi kurulum sorunu; bunu son kullanıcı Convex Auth’un tümden bozuk olduğu şeklinde yorumlamak yanlış. |
| [#648 scheduler gecikmesi](https://github.com/convex/convex-backend/issues/648) | 13.11.2026, açık; testte bazı işler yaklaşık 5 saniye geç başlıyor | Kapı komutu/kuyruk ve erişim süreleri için yalnız HTTP sağlık kontrolü yetmez; iş gecikmesi ölçülmeli. |
| [#637 Docker image yayın zinciri](https://github.com/convex/convex-backend/issues/637) | 09.11.2026, açık; 12.11 ekip yorumu düzeltme üzerinde çalışıldığını söylüyor | Binary release listesi ile GHCR imaj bulunurluğunu eşitlememek gerekir; seçilen digest içeriği ayrıca doğrulanmalı. Bugün bütün image’lar hâlâ bozuk demiyorum. |
| [#655 CPU kıtken shutdown crash](https://github.com/convex/convex-backend/issues/655) | 16.11.2026, açık; raporlayan kendi denemelerinde onaylanmış yazı kaybı görmediğini belirtiyor | Paylaşımlı host ve bakım sırasında crash riski; “veri kaybı var” kanıtı olarak kullanılmamalı. |

**Önemli güncel karşı kanıt:** SQLite kaynak geçmişinde **25.11.2026** tarihli [ae2e775](https://github.com/convex/convex-backend/commit/ae2e775edab31777225a9e9eb71b4dfb7dcb9e07) document history okumalarını sayfalıyor ve `max_ts` için tek indeks araması ekliyor; [4388842](https://github.com/convex/convex-backend/commit/438884285d6fcaac03eef40f4550064dca5bb8a8) `index_scan` sayfalamasını ekliyor. [27 Kasım release kaynak dosyasında](https://github.com/convex/convex-backend/blob/precompiled-2026-11-27-76da829/crates/sqlite/src/lib.rs) `max_ts` ve `size_hint.clamp(1, 5000)` ile sayfalı tarama gerçekten mevcut. #495/#593’ü bugünkü kaynakta aynen sürüyor diye sunmak hatalı olur; seçilecek Docker imajında bu kod ve NGS üzerindeki sonucu henüz doğrulanmadı. Düzeltmeler çok yeni olduğundan uzun süreli üretim güveni de bu okumayla kanıtlanmış değil.

Aramada self-host’a özgü, doğrulanmış genel bir “onaylanmış transaction’lar kalıcı olarak kayboluyor” olayı saptamadım. Bu veri kaybı olmayacağı garantisi değildir. İlgili kayıp yolları hatalı volume silme, başarısız/eksik restore, snapshot sonrası yazılar ve cihaz buffer’ının taşmasıdır. Bunların olasılığı için kamuya açık bir oran bulunmadı.

### SQLite mı Postgres mi?

[Resmî persistence kılavuzu](https://github.com/convex/convex-backend/blob/main/self-hosted/advanced/postgres_or_mysql.md), SQLite/Postgres/MySQL’in desteklendiğini; kesintisizlik gerektiren üretim yükünde **yönetilen Postgres veya MySQL’in muhtemelen tercih edilmesini** söylüyor. Postgres 17 ve MySQL 8 test edilmiş. “Her üretim için zorunlu Postgres” demiyor. Backend ve veritabanını yakın tutmak gerekiyor.

Bu işte ilk seçenek olarak aynı hosta bir Postgres daha eklemek otomatik yüksek erişilebilirlik sağlamaz; yönetilecek ikinci servis yaratır. SQLite, yeni düzeltmeleri içeren imajla, veri büyüklüğüne uygun restart/export/restore ve burst testi geçerse küçük tek müşteride makul olabilir. Uzun geçmiş, daha sık güncelleme, daha düşük RPO veya 20 firma büyümesinde dış/yönetilen DB yeniden değerlendirilir. Yönetilen DB eklendiğinde aşağıdaki €17–19 paketinin toplamı geçerli kalmaz; backend hâlâ tek düğümse DB’nin HA olması uygulamanın bütün kesintilerini gidermez.

### Gerçek üretim kullanımı ne kadar kanıtlı?

- [Convex in Prod, 01.09.2026](https://convex-in-prod.dev/posts/self-hosted-roi-lessons-configuration/): işletenin kendi anlatımı; 1,5 ay, on milyonlarca istek, 32 vCPU/64 GB, özel backend yamaları ve MySQL. Çalışan üretim örneği var; aynı zamanda kayda değer kapasite/işletim emeği anlatıyor. Yazının yaklaşık $1.000 başa baş iddiasını NGS’e genellemek doğru değil; yükü ve bölgesi farklı.
- #495/#593 yorumlarında gerçek üretim arızası, özel yama ve **başarılı export/import ile doğrulanan kurtarma** örnekleri birlikte bulunuyor. Bu, sistemin kullanılabildiğini ve operasyonun gerçekten kullanıcıya kaldığını gösterir; bağımsız denetim veya uptime istatistiği değildir.
- [Convoy’un kendi dağıtım belgesi](https://docs.convoy.build/docs/deployment/self-hosting-convex) kullanılabilir self-host kurulumunu ve doğrulanması gereken auth/dosya/scheduler akışlarını belgeliyor; müşteri sayısı veya uzun süreli uptime vermiyor. Kurulum rehberini ölçekli üretim referansı saymıyorum.
- Resmî kaynaklar Discord `#self-hosted` topluluğunu gösteriyor; özel kanal geçmişine erişmedim. “Discord’da herkes sorunsuz kullanıyor” çıkarımı yapılamaz. Kamuya açık öğreticiler ve Reddit niyet beyanları da 20 firmalık PDKS için kanıt değildir.

## 2. Tek kişinin işletme yükü

**Aşağıdaki süreler benim planlama tahminim; sektör istatistiği veya ölçülmüş Emre süresi değil.** Yalnız backend işletimi; ürün geliştirme, Hik gateway ve Pafta’nın mevcut işletimi hariç. Otomasyon oturduktan sonraki normal ay içindir.

| İş | Self-host / ay | Cloud Starter / ay | Açıklama |
|---|---:|---:|---|
| Release/yama inceleme, staging ve kontrollü upgrade | 1–2,5 saat | 0,25–0,5 saat | Kritik güvenlik yaması normal takvimi bozabilir. |
| Yedek başarısı, saklama/anahtar kontrolü, izole restore provası | 1–2 saat | 0,75–1,5 saat | Starter için dış export otomasyonu hâlâ bize ait. |
| Dış izleme, log/disk/kapasite, alarm düzeltme | 1–2 saat | 0,5–1 saat | Cloud’da da uygulama hatası ve kuyruk yaşı izlenir. |
| TLS, OS/Docker güvenliği, erişim ve runbook | 0,5–1,5 saat | 0,25–0,5 saat | Pro için de uygulama izinleri ve secret yönetimi kalır. |
| **Normal ay bütçesi** | **yaklaşık 4–8 saat** | **yaklaşık 2–4 saat** | Pro’da otomatik yedek sayesinde yaklaşık 1–3 saat. |

Aynı hostta kaynak araştırması ve bakım koordinasyonu nedeniyle 4–10 saat, 20 firmada 6–12 saat ayırmak daha gerçekçi. Ayrı VM için 1 müşteride 4–8, 20 firmada 5–10 saat planlıyorum. İlk self-host kurulum/geçiş/prova için **24–60 saat**, Starter’da export otomasyonu ve prova için **6–16 saat** ek bütçe gerekir; çalışan prototipler varsa azalır. Dev → prod geçişi iki yolda da ayrıca envanter/prova ister. Büyük bir arıza normal ay bütçesine **4–16+ saat** ekleyebilir; yaşanma sıklığı bilinmiyor.

“Ayda dört saat” gece nöbetinin fiyatı değildir. Emre uyuyorsa veya ulaşılamıyorsa otomasyon tek başına karar verip tamir etmez. RPO hedefi (kaybedilebilecek veri süresi) ve RTO hedefi (geri dönme süresi) müşteriyle kararlaştırılmalı. Saatlik export için **RPO ≤1 saat**, **RTO ≤2 saat** ancak hedef olabilir; test edilmeden taahhüt değildir. Kartlar cihazdan tamamlanabilirken aynı saatteki izin, manuel PDKS ve yönetim yazıları tamamlanamayabilir.

[Backup & Restore belgesine](https://docs.convex.dev/database/backup-restore) göre Cloud snapshot’ı tutarlıdır ve dosyalar dahil edilebilir; **code, env, bekleyen scheduled functions dahil değildir**. Free/Starter’da aynı anda iki backup saklama sınırı, periyodik otomatik backup için Pro şartı var. Bu nedenle Starter önerisi “otomatik dış yedek + alarm + restore provası” işiyle birliktedir. [Import belgesi](https://docs.convex.dev/database/import-export/import) ZIP’te ID ve türleri koruduğunu söylüyor, import’u beta olarak işaretliyor. Export’un başarı kodu tek başına çalışan ürünün geri geldiğini kanıtlamaz.

## 3. Aynı Hetzner hostu paylaşmak

Verilen boş kaynaklarla **ilk müşteriyi barındırmak mümkün görünüyor**, fakat load 0,3 tek anlık fotoğraftır. Vardiya giriş piki, aynı anda Pafta işi, backend deploy, restart ve export birlikte ölçülmedi. 5 GB Convex sınırı sonrası yaklaşık 4,2 GB mevcut boşluk kalması olumlu; sınır OOM ile Convex’in öldürülmesini engellemez. DB I/O fatura baytını SSD throughput’u, fiziksel dosya boyutu veya gerekli RAM olarak çeviremeyiz.

| Risk | A: aynı VM | B: ayrı VM | Cloud |
|---|---|---|---|
| CPU/RAM/disk çekişmesi | Pafta, Convex ve gateway aynı sınırları paylaşır | Backend kaynakları ayrılır; sağlayıcı/shared vCPU çekişmesi kalabilir | Backend işletimi ayrılır; plan kapasitesi sınırı kalır |
| Tek hata noktası | Host kaybı hem backend’i hem yerel event spool’u hem Pafta’yı etkileyebilir | Backend VM ile gateway farklı hata alanları; aynı sağlayıcı/bölge riski sürer | Cloud arızası ve mevcut gateway arızası ayrı olaylar olur |
| Güvenlik izolasyonu | Container ortak kernel/host yönetimini paylaşır; root veya Docker socket ihlali diğer ürüne yayılabilir | Ayrı OS/kimlik/secret ve private ağla yayılma alanı küçülür | Altyapı sağlayıcıda; tenant yetki hatası yine uygulamada |
| Bakım | OS/Docker/nginx restart birden çok ürünü etkiler | Bakım pencereleri ayrılır | Backend yaması Convex’te; ürün release’i bize ait |

A’nın somut avantajları mevcut kapasiteyi kullanması, backend–gateway gecikmesinin düşük olması ve daha az VM yönetimidir. B’nin de private ağ/firewall ve yeni sunucu işletimi masrafı vardır; ayrı VM tek başına HA değildir. Cloud seçilse dahi gateway’in kalıcı spool’u ve cihazdan olay mutabakatı gerekir. Aynı hosttaki backend internet bağımlılığını bütünüyle kaldırmaz: müşteri cihazları ve kullanıcılar hâlâ uzaktan bağlanıyor.

## 4. Toplam sahip olma maliyeti

**Ek maliyet** kıyaslanıyor: zaten gereken gateway/Pafta sunucusu, mevcut web hosting/domain/mail ve vergiler dışarıda. Para birimleri özellikle ayrı tutuldu, kur varsayılmadı. Saat değerini örnek olarak **€25/saat** aldım; Emre bunu kendi fırsat maliyetiyle değiştirmeli. Risk için uydurma olasılık veya beklenen zarar eklemedim; risk sütunu ve arıza saatleri bunun yerini tutuyor.

[Güncel fiyat](https://www.convex.dev/pricing) ile ABD bazında tek müşteri yaklaşık hesap: `(79,98−1)×$0,22 + (1,278−1)×$2,20 + (0,736−0,5)×$0,22 + (1,918−1)×$0,132 ≈ $18,16/ay`. Pro aynı kullanımda yaklaşık `$25 + (79,98−50)×$0,20 ≈ $31`. Backup ve Cloud’da ölçülmemiş trafik eklenir. İyileştirmeden sonraki **$1–5**, doğrulanmamış bütçe beklentisidir; garanti edilen fatura değil.

**20 firma tanımı:** Eski yük raporu 20×200 kişi, hedef “20 firma” ise kişi sayısı belirsiz. Aşağıdaki iyileştirilmiş Cloud aralıkları 20 benzer müşteri için kaba planlamadır; tek müşterinin faturasını 20 ile çarpmak dahil kotalar ve ortak cron’lar yüzünden kesin hesap değildir. Hassasiyet için hiç iyileştirme olmadan **20×500**, yaklaşık 1,6 TB I/O ve 25,56 M çağrı varsayılırsa Starter yalnız I/O+çağrıda **$406**, Pro I/O’da yaklaşık **$335** eder; diğer kaynaklar/backup eklenir. Eski 20×200 modelindeki 483 GB’ı yeni kodun ölçümü gibi kullanmadım.

| Seçenek | 1 müşteri: aylık nakit | 20 müşteri: aylık nakit | Emek: 1 / 20 müşteri | €25/saat ile emek eklenmiş toplam | Risk / sınır |
|---|---|---|---|---|---|
| **A aynı Hetzner** | €7–10 dış yedek/izleme payı | €10–30; kapasite artışı hariç | 4–10 / 6–12 saat | €107–260 / €160–330 | Ortak arıza alanı; 20 firmaya 5 GB yeterli kabul edilmedi. |
| **B ayrı Hetzner** | €17–19 başlangıç paketi | €26–40 planlama; daha büyük VM gerekebilir | 4–8 / 5–10 saat | €117–219 / €151–290 | İzolasyon iyi; backup/restore ve nöbet hâlâ Emre’de. |
| **C Starter** | Bugünkü model ~$18 + yedek; iyileştirmeyle $1–5 + €2–8 yedek payı | İyileştirmeyle $20–100 + €5–20; düzeltilmezse ~$406+ | 2–4 / 3–5 saat | 1 müşteri: nakit + €50–100; 20: nakit + €75–125 | S16 kapasitesi, maliyet sıçraması, yedek otomasyonu. |
| **D Pro** | ~$31 bugünkü; iyileştirmeyle çoğunlukla $25, backup trafiği ek | İyileştirmeyle ~$25–100; düzeltilmezse ~$335+ | 1–3 / 2–4 saat | 1 müşteri: nakit + €25–75; 20: nakit + €50–100 | Günlük yedek ve destek yararlı; uygulama ve gateway nöbeti kalır, SLA yok. |
| **E önce C, sonra koşullu B** | Açılışta C ile aynı | Cloud’da kalırsa C; taşınırsa B; prova ayında ikisi | Normalde C/B; geçişte ek 24–60 saat | Seçilen yol + tek sefer €600–1.500 geçiş emeği | Açılıştaki riski azaltır, fakat gelecekteki taşımayı bedelsiz yapmaz. |

B’nin €17–19 tutarı **VM’nin yalın fiyatı değil**, SELF_HOST_PLAN’daki küçük VM + IPv4 + VM backup + dış yedek bütçesidir. 20 firmada planın €26–28 daha büyük paketinden hareketle pay bırakıldı. [Hetzner sayfası](https://www.hetzner.com/cloud/) araştırmada fiyat rakamlarını metin olarak sunmadı; bunlar teyit edilmiş yeni teklif değildir. Stok, lokasyon, vergi ve yedek kullanımına göre yeniden fiyatlanmalı; ucuz CX bulunamazsa bütçe belirgin artabilir. A’nın mevcut sunucu kapasitesinin başka iş için fırsat maliyeti tabloda parasallaştırılmadı.

Cloud hesabı ABD fiyatlarıdır. [Regions](https://docs.convex.dev/production/regions) ABD dışı kullanıma 1,3× fiyat gösteriyor; güncel pricing dahil kaynakların bölgeler arasında paylaşıldığını söylüyor. Şubat 2026 EU duyurusunun eski ayrı kota ifadesi yerine güncel doküman esas alındı; mevcut deployment bölgesi/pano faturası okunmadı. Yedek/export trafiği ve uzun süre biriken depolama bu aralıklara ayrıca etki eder.

Başabaş testi basit: `Cloud’dan aylık tasarruf > ek operasyon saati × Emre saat değeri + ek altyapı + geçişin aylık payı`. Örneğin ayrı VM zaten €18 ve iki ek saat €50 ise, $1–18 Cloud faturasını azaltmak ekonomik kazanç değildir. 20 firmada iyileştirme yapılmadan $400 fatura oluşması self-host’u araştırmayı haklı çıkarır; aynı maliyeti doğuran sorgu israfı self-host CPU’sunu da tüketir. Önce sorgu verimliliğinin etkisini ölçmek gerekir.

## 5. KVKK ve veri yeri

TR’de veri tutma şartı olmadığı için iki model de ilkesel olarak adaydır. **Almanya/Finlandiya Hetzner’e taşınmak Türkiye’de tutmak değildir**; sunucu ve dış backup bölgesi ayrı belirlenmelidir. Hetzner’in güncel cloud lokasyonları Türkiye dışında; Cloud’da da seçilen bölge uygulama altyapısının yerini belirler. Self-host veri/anahtar ve erişim kontrolünü artırır, yurt dışı aktarım yükümlülüğünü kendiliğinden kaldırmaz.

[KVKK Kurumu yurt dışına aktarım açıklaması](https://www.kvkk.gov.tr/Icerik/2053/Yurtdisina-Aktarim), 01.06.2024’te yürürlüğe giren 9. madde düzenlemesindeki yeterlilik/uygun güvence mekanizmalarını anlatıyor. [Kurumun standart sözleşme duyurusu](https://www.kvkk.gov.tr/Icerik/8170/Yurt-Disina-Kisisel-Veri-Aktariminda-Kullanilacak-Standart-Sozlesmelerde-Dikkat-Edilmesi-Gereken-Hususlara-Iliskin-Kamuoyu-Duyurusu), imzadan itibaren beş iş günü bildirim yükümlülüğünü hatırlatıyor. AB’de tutmak veya sağlayıcının GDPR/DPA belgesine sahip olması tek başına KVKK aktarım mekanizması yerine geçmez. Somut müşteri sözleşmesi ve veri işleyen zinciri bu araştırmada hukuken karara bağlanmadı.

PDKS/kart kimliği, erişim zamanı ve çalışan bilgisi kişisel veri; yüz/parmak iziyle benzersiz kimlik tespiti de kullanılıyorsa özel nitelikli veri değerlendirmesi ayrıca gerekir; bkz. [KVKK biyometrik veri rehberi](https://www.kvkk.gov.tr/Icerik/7047/Biyometrik-Verilerin-Islenmesinde-Dikkat-Edilmesi-Gereken-Hususlara-Iliskin-Rehber). Her iki modelde müşteri–NGS–altyapı sağlayıcısı rolleri, aktarım dayanağı, aydınlatma, saklama/silme, erişim ve ihlal müdahalesi belgelenmeli. [Convex güvenlik sayfası](https://www.convex.dev/security) şifreli depolama/iletişim ve SOC 2 uygulamalarını açıklıyor (sayfa güncellemesi 24.09.2024); self-host’ta bu kontroller kodla otomatik devralınmaz. Emre host şifrelemesi, secret, yedek anahtarı ve yetkileri işletir. Bunun avantajı kontrol; maliyeti sorumluluktur.

## 6. Net öneri ve kararın değişeceği koşullar

**Önerim E; açılışta C.** Bunun gerekçesi self-host’un yapılamaması değil, 10–12 günlük kalan sürede mobil/auth/cihaz/veri kesimi ve gece işletimini ürün açılışıyla birleştirmenin sağlayacağı ek riskin küçük Cloud faturasıyla karşılaştırılmasıdır. İlk müşteri için mevcut RAM olumlu bir başlangıç işareti, uzun süreli işletim kanıtı değil. Emre’nin Pro istememesiyle C uyumlu; D, otomatik yedek ve daha yüksek eşzamanlılığın aylık ücretine değdiği durumda güçlü alternatiftir.

Starter **Free’nin performans yükseltmesi değildir**: [güncel limit belgesinde](https://docs.convex.dev/production/state/limits) ikisi S16, Pro S256. Vardiya pikinde eşzamanlı istek hataları çıkarsa sırf kullandıkça ödemeye geçmek bunu çözmez. C/D kararını yalnız aylık fatura değil, gecikme/ret ve destek gereği belirler. Cloud da hatasız değil: [22.11.2026 resmî olay kaydı](https://status.convex.dev/) ABD bölgesinde bazı deployment’larda 08:42–09:15 UTC erişim sorunu ve failover anlatıyor, veri kaybı olmadığını belirtiyor. Avantajı arıza ihtimalinin sıfır olması değil, altyapı kurtarmasının Emre’ye kalmamasıdır.

### 8–10 Aralık için uygulanabilir güvenli yol

1. **28 Kasım–1 Aralık:** Starter billing, doğru production hedefi, uyarı ve limit politikası netleştirilsin; ilk geri yüklenebilir veri+dosya ve ayrı env/code yedeği alınsın. Dev → prod ayrı bir veri/URL geçişidir: mevcut kullanıcı, mobil ve cihaz hedefleri korunmadan yalnız yeni prod açmak çözüm olmaz. Dev’i yedeksiz açık bırakıp “plan ücretli oldu” demek de üretim hazırlığı değildir.
2. **1–4 Aralık:** Mevcut 2 dakikalık görünür yenilemenin test/yayın durumu doğrulansın; gerçek Cloud sayaçlarında 48–72 saat I/O, çağrı, depolama ve hata eğrisi izlensin. $1–5 tahmini bu veriyle yeniden hesaplansın. 10 cihazdan gerçek olay, yeniden deneme, offline dönüş ve 500 kişilik aylık rapor kontrol edilsin.
3. **En geç 5 Aralık:** İzole hedefte restore: giriş/oturum yenileme, dosya/fotoğraf, tenant yetkisi, kart sayısı, PDKS ve bekleyen işlerin yeniden kurulması doğrulansın. Sağlık yanında kuyruğun en eski olay yaşı ve son başarılı dış yedek zamanı alarm olsun. Hedef RPO/RTO gerçekleşen süreyle kaydedilsin.
4. **6–10 Aralık:** Zorunlu hata dışında altyapı kesimi ve büyük refactor yapılmasın; açılışta kontrollü müşteri kabulü ve vardiya piki gözlensin. Bu tarihlere kadar bu kapılar geçmezse ücretsiz dev ortamını sessizce canlı saymak yerine açılış kapsamı/tarihi yeniden değerlendirilsin.

**Harcama limiti ayrıntısı:** [Team spending limits](https://docs.convex.dev/dashboard/teams/teams) hard limit aşılınca takımın bütün projelerini durdurur; uyarı yalnız bildirimdir. İlk model ~$18 iken örneğin $10 hard limit açılış kesintisi üretir. Başlangıç için **$15 uyarı / $50 disable** yalnız örnek bütçe; dış yedek ve başka takım trafiğiyle birlikte gerçek sayaca göre ayarlanmalı. Yakın izleme ve Emre’ye ulaşan alarm şart. [Deployment usage limits](https://docs.convex.dev/production/usage-limits) günlük/aylık kaynak sınırlarını ayrıca sunuyor; dev deployment’larda e-posta uyarısı yok. Maliyet koruması ile kesintisiz hizmet arasındaki bu tercih açıkça kabul edilmeli.

### Ne olursa self-host’a dönerim?

- Ölçülen, iyileştirme sonrası Cloud faturası birkaç ay boyunca B + ek emek + geçiş payını aşıyorsa; özel ağ/yerleşim gereği veya Cloud’da çalışmayan native bağımlılık gerçekten gerekiyorsa.
- Emre ayda 4–8 saat işletim ve gece müdahaleyi bilerek kabul ediyor, yokluğunda kimin ilgileneceği belli, RPO/RTO müşteriye uygun ve restore provası başarılıysa.
- Sabit backend/dashboard digest’leri güncel gerekli düzeltmeleri içeriyor; 500 kişi, büyümüş geçmiş, restart, export, vardiya burst’ü ve Pafta eşzamanlı yükü altında kabul testi geçiyorsa.

Self-host kararı değişmezse **B ile başlarım**: ayrı VM, sabit sürüm, dış şifreli yedek, dış alarm ve kanıtlanmış geri dönüş. A ancak düşük ilk yükte geçici ve bilinçli seçim olabilir; CPU/RAM/disk sınırları, backup alan sınırı, gateway spool’unun korunması ve Pafta bakım etkisi ayrıca test edilmeli. “5 GB sınır koyduk” bu koşulların yerine geçmez. 20 firmaya yaklaşırken büyümüş veriyle yeniden kapasite testi ve persistence kararı gerekir.

**Güven düzeyi:** Açılışta E/C seçimi yüksek; aynı hostun ilk müşteri kapasitesi orta/düşük; 20 firma faturası ve VM boyutu düşük. Eksik olan şey teknolojiye dair bir slogan değil, seçilen sürümde gerçek kullanım ve kurtarma ölçümüdür.
