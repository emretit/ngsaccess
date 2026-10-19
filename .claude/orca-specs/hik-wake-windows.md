# Görev: Hik köprü uyandırma — Windows köprüsü (Faz 3, C# .NET 8 worker service)

## Hedef
Köprü roster'dan gelen `wake` bilgisiyle relay'e SSE bağlantısı açık tutar; `event: wake` (veya yeniden bağlanınca `ready`)
gelince ≤1 sn debounce ile hemen roster çeker, iş varsa kuyruk boşalana kadar art arda çeker; aksi halde
`nextPollSeconds` (vars. 900) bekler. Relay yoksa/kopuksa davranış bugünkü 15 dk poll'dur — `dotnet build` 0 hata ile kanıtlanır.

## Ownership (yalnız bunlar) — kök `bridge/windows/NgAccess.HikvisionBridge/`
- `Services/WakeStreamClient.cs` (YENİ), `Services/SseParser.cs` (YENİ, saf, test edilebilir)
- `Services/BridgeWorker.cs`, `Services/PanelManager.cs` (yalnız roster sonucunu/uyandırma bilgisini dışarı vermek),
  `Services/ConvexBridgeClient.cs` (User-Agent), `Services/LocalConfigServer.cs` (yalnız durum JSON'u + UI'da tek satır durum)
- `Models.cs` (`RosterResponse`'a `NextPollSeconds`, `Wake` alanları), `Options.cs` (`WakeStreamEnabled`), `appsettings.json`,
  `Program.cs` (DI gerekiyorsa), `NgAccess.HikvisionBridge.csproj` (YALNIZ `<Version>` → `1.1.0`), `README.md` (kısa bölüm)
- İstersen test için `bridge/windows/NgAccess.HikvisionBridge.SelfTest/` (YENİ küçük konsol projesi; SseParser + debounce kontrolü)

## Yapılacaklar
1. Model: `RosterResponse.NextPollSeconds` (`int?`, `nextPollSeconds`), `RosterResponse.Wake` (`WakeInfo?`: `streamUrl`,
   `bridgeId`, `ticket`). Eski Convex (alanlar yok) → null; davranış bugünkü gibi.
2. User-Agent: tüm Convex çağrıları + stream `NgAccessHikBridge/<AssemblyInformationalVersion> (<Environment.MachineName>)`.
3. `SseParser`: satır tabanlı (`\n` / `\r\n`), `event:`/`data:` (çok satırlı data birleşir), `:` yorum (ping) satırı "canlılık"
   sayılır, boş satır olayı yayınlar, `retry:` okunur. Bilinmeyen olay yok sayılır.
4. `WakeStreamClient` (BridgeWorker'ın yönettiği uzun ömürlü döngü, kendi `HttpClient`'ı `Timeout = InfiniteTimeSpan`):
   - Güncel `WakeInfo`'yu PanelManager'dan alır (her roster sonrası güncellenir). `WakeStreamEnabled=false` veya `Wake==null` → bekle.
   - `GET {streamUrl}?bridge=..&ticket=..` (`Uri.EscapeDataString`), `HttpCompletionOption.ResponseHeadersRead`, satır satır oku.
   - `wake` ve `ready` olayında uyandırma sinyali ver (aşağıda). 90 sn hiç bayt (ping dahil) gelmezse bağlantıyı iptal et, yeniden bağlan.
   - Hata/kopma: üstel bekleme 1→60 sn + jitter; başarılı `ready` sonrası sıfırla. `401` → bilet değişene (yeni roster farklı ticket/url
     getirene) kadar bağlanma. WakeInfo değişince mevcut bağlantıyı kapat, yenisini aç. Kapanışta (`stoppingToken`) temiz çık.
   - Ticket/token LOGLANMAZ; log: bağlandı / koptu (sebep) / wake alındı.
5. Uyandırma sinyali: kapasitesi 1 `Channel<bool>` (`BoundedChannelFullMode.DropWrite`) ya da eşdeğeri — çoklu wake tek tura iner.
6. `BridgeWorker` poll döngüsü (yeniden yaz, mevcut davranışı koru):
   - Tavan `ceiling = clamp(roster.NextPollSeconds ?? Max(PollIntervalSeconds, PollMaxIntervalSeconds), 30, 3600)` sn.
   - Bekleme = `Task.WhenAny(Task.Delay(ceiling), wakeSignal)`; wake ile uyanınca 1 sn bekle + o sürede gelen ek wake'leri boşalt, sonra poll.
   - Bir tur iş işlediyse (PollRosterAsync "aktif" + op sayısı > 0) en fazla 20 tura kadar beklemeden tekrar poll (roster tur başına
     ≤10 op döner; kuyruk boşalsın). Yalnız cihaz listesi değiştiyse tek ek poll yeter.
   - Hata durumunda mevcut gibi yavaşla (tavanı aşma), sürekli hızlı çağrı ASLA olmasın: art arda iki poll arasında en az 1 sn.
7. `LocalConfigServer` durum JSON'una `wakeChannel: "kapalı" | "bağlanıyor" | "bağlı" | "kopuk"`, `lastWakeAt`, `nextPollSeconds`;
   yerel UI'da tek satır "Uyandırma kanalı: …".
8. `appsettings.json`: `"WakeStreamEnabled": true`; 900/900 değerleri korunur. `README.md`: uyandırma kanalı + kapatma anahtarı.

## Kapsam dışı
Convex ve relay başka worker'larda. Installer (`installer/**`) ve publish/yayın koordinatörde. Panel SDK/PanelWorker mantığı değişmez.

## Kapılar
- `dotnet build bridge/windows/NgAccess.HikvisionBridge/NgAccess.HikvisionBridge.csproj -c Release` → 0 hata (Mac'te çalışıyor;
  gerekirse `-r win-x64` ya da `-p:EnableWindowsTargeting=true`). Yeni uyarı ekleme.
- SelfTest projesi yazdıysan `dotnet run --project <SelfTest>` → tüm kontroller geçer.
- `git status` yalnız ownership dosyalarını göstermeli (bin/obj gitignore'lu).
