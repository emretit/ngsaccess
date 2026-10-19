# Görev: Hik köprü uyandırma — Windows köprüsü DENETİM DÜZELTMELERİ (önceki worker'ın kodu üzerinde)

## Hedef
Claude denetiminin Windows bulguları kapanır ve hiçbir kod yolu (relay flapping, hata döngüsü, wake yağmuru, bug) köprünün
saatte 240'tan fazla roster çağrısı yapmasına izin vermez — SelfTest'e eklenen senaryolarla kanıtlanır.

## Ownership — kök `bridge/windows/`
- `NgAccess.HikvisionBridge/Services/{WakeStreamClient,BridgeWorker,PanelManager,LocalConfigServer,ConvexBridgeClient}.cs`,
  `NgAccess.HikvisionBridge/{Models,Options}.cs`, `appsettings.json`, `NgAccess.HikvisionBridge.csproj` (yalnız sürüm alanları),
  `README.md`, `NgAccess.HikvisionBridge.SelfTest/**`

## Düzeltmeler
1. **YÜKSEK — ready flapping = kota yangını** (WakeStreamClient): backoff'u `ready`'de DEĞİL, bağlantı ≥60 sn yaşadıktan sonra
   sıfırla; ardışık kısa ömürlü bağlantılarda backoff 1→60 sn büyümeye devam etsin. `ready` olayı poll sinyali versin ama en fazla
   5 dakikada bir (wake olayları bu sınıra tabi değil; onları BridgeWorker'daki genel tavan sınırlar).
2. **YÜKSEK — genel emniyet tavanı** (BridgeWorker): kayan 60 dk pencerede en fazla 240 roster çağrısı (sabit, Options'a
   `PollMaxPerHour` = 240). Aşılırsa bir sonraki çağrı pencere açılana kadar bekler (wake/drain/config fark etmez) + bir kez uyarı logu.
   Art arda iki roster arasında en az 1 sn kuralı kalır.
3. **ORTA — hata/ilk kurulum gecikmesi**: hata geri çekilmesi 5 sn'den başlayıp 2x, tavan 300 sn (900 değil). `PanelManager.Configure()`
   (yerel UI'dan ayar kaydı) ayrı bir "ayar değişti" sinyali versin; BridgeWorker hem başarı hem HATA beklemesinde bu sinyali dinlesin
   (relay wake'i hata beklemesini kısaltmaz, ayar değişikliği kısaltır). Poll sırasında ayar değiştiyse (ReferenceEquals kontrolü) bunu
   hata sayma, 1 sn sonra yeniden dene.
4. **ORTA — 401 sonrası kalıcı red**: başarılı `ready` sonrası `denied` temizlensin.
5. **(sözleşme v1.1) `nextDueInSeconds`**: `RosterResponse.NextDueInSeconds` (`int?`). Başarı beklemesi = `min(tavan, max(5, nextDue))`
   (null ise tavan).
6. **DÜŞÜK**: `streamUrl` `https://` değilse bağlanma + uyarı (yalnız `http://127.0.0.1` / `http://localhost` SelfTest için serbest).
   csproj `AssemblyVersion`/`FileVersion`/`Version` hepsi 1.1.0 (tutarlı). `PollMaxOperations` varsayılanı 25 (sunucu tavanı; drain
   turlarını azaltır) — Options + appsettings.
7. SelfTest'e ekle: (a) bağlan→ready→hemen kopan relay 5 dk'da en fazla 1 ready-poll üretir, backoff büyür; (b) 240/saat tavanı;
   (c) hata backoff 5→10→…→300; (d) Configure sinyali hata beklemesini keser; (e) 401→başka bilet ok→eski bilete dönüş bağlanır;
   (f) nextDueInSeconds=7 → ~7 sn sonra poll; null → tavan. Zamanı enjekte edilebilir saat/kısa süreli parametrelerle hızlandır.

## Kapsam dışı
Convex, relay, installer. Panel SDK/PanelWorker mantığı.

## Kapılar
- `dotnet build bridge/windows/NgAccess.HikvisionBridge/NgAccess.HikvisionBridge.csproj -c Release` → 0 hata, yeni uyarı yok
- `dotnet run --project bridge/windows/NgAccess.HikvisionBridge.SelfTest` → tüm kontroller geçer
