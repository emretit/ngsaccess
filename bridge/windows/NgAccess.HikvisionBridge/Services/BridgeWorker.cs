using System.Diagnostics;
using Microsoft.Extensions.Hosting.WindowsServices;
using Microsoft.Extensions.Options;

namespace NgAccess.HikvisionBridge.Services;

/// <summary>
/// Süreç giriş noktası (hosted service). Tek-yer modeli: yerel ayardan site URL + bridge
/// token okur, PanelManager'ı yapılandırır ve periyodik olarak Convex roster'ını çeker
/// (cihazlar + işler buluttan gelir). Yerel config UI'ını da açar. Panel döngüleri
/// PanelManager worker'larında döner.
/// </summary>
public sealed class BridgeWorker : BackgroundService
{
  private readonly PanelConfigStore _store;
  private readonly PanelManager _manager;
  private readonly LocalConfigServer _configServer;
  private readonly BridgeOptions _bridgeOptions;
  private readonly LocalApiOptions _localApi;
  private readonly ILogger<BridgeWorker> _logger;

  public BridgeWorker(
    PanelConfigStore store,
    PanelManager manager,
    LocalConfigServer configServer,
    IOptions<BridgeOptions> bridgeOptions,
    IOptions<LocalApiOptions> localApi,
    ILogger<BridgeWorker> logger)
  {
    _store = store;
    _manager = manager;
    _configServer = configServer;
    _bridgeOptions = bridgeOptions.Value;
    _localApi = localApi.Value;
    _logger = logger;
  }

  protected override async Task ExecuteAsync(CancellationToken stoppingToken)
  {
    var config = _store.Load();
    _manager.Configure(config.ConvexSiteUrl, config.BridgeToken);
    _logger.LogInformation(
      "Bridge started (tek-yer modeli). Convex: {Url} · token: {Token} (config: {Path})",
      config.ConvexSiteUrl,
      string.IsNullOrWhiteSpace(config.BridgeToken) ? "GIRILMEMIS" : "set",
      _store.ConfigPath);

    _ = _configServer.StartAsync(stoppingToken);

    if (_localApi.Enabled && !WindowsServiceHelpers.IsWindowsService())
    {
      _ = OpenBrowserWhenReadyAsync(stoppingToken);
    }

    // Adaptive backoff: boşta (op/cihaz değişikliği yok) aralık 2x büyür, tavanda durur;
    // aktivite olunca anında tabana döner. Boş roster çağrılarını (function-call maliyeti) seyreltir.
    var minInterval = TimeSpan.FromSeconds(Math.Max(1, _bridgeOptions.PollIntervalSeconds));
    var maxInterval = TimeSpan.FromSeconds(
      Math.Max(_bridgeOptions.PollIntervalSeconds, _bridgeOptions.PollMaxIntervalSeconds));
    var interval = minInterval;
    while (!stoppingToken.IsCancellationRequested)
    {
      try
      {
        var active = await _manager.PollRosterAsync(stoppingToken);
        interval = active
          ? minInterval
          : TimeSpan.FromTicks(Math.Min(interval.Ticks * 2, maxInterval.Ticks));
      }
      catch (OperationCanceledException)
      {
        break;
      }
      catch (Exception ex)
      {
        _logger.LogWarning(ex, "Roster poll hatası");
        // Hatada da yavaşla — sürekli başarısız çağrı yakma.
        interval = TimeSpan.FromTicks(Math.Min(interval.Ticks * 2, maxInterval.Ticks));
      }
      try { await Task.Delay(interval, stoppingToken); }
      catch (OperationCanceledException) { break; }
    }

    await _manager.DisposeAsync();
  }

  private async Task OpenBrowserWhenReadyAsync(CancellationToken ct)
  {
    try
    {
      await Task.Delay(TimeSpan.FromMilliseconds(800), ct);
      var url = _localApi.Url.TrimEnd('/') + "/";
      _logger.LogInformation("Yönetim arayüzü açılıyor: {Url}", url);
      Process.Start(new ProcessStartInfo { FileName = url, UseShellExecute = true });
    }
    catch (OperationCanceledException) { /* shutdown */ }
    catch (Exception ex)
    {
      _logger.LogWarning(ex, "Tarayıcı otomatik açılamadı; arayüze {Url} adresinden ulaşın", _localApi.Url);
    }
  }
}
