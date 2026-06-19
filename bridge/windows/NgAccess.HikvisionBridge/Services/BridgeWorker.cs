using System.Diagnostics;
using Microsoft.Extensions.Hosting.WindowsServices;
using Microsoft.Extensions.Options;

namespace NgAccess.HikvisionBridge.Services;

/// <summary>
/// Süreç giriş noktası (hosted service): yerel config'i yükler, PanelManager'a verir (her etkin
/// panel için worker başlar), yerel config UI'ını açar ve kapanışa kadar ayakta kalır. Konsol/masaüstü
/// modunda yönetim arayüzünü tarayıcıda otomatik açar. Panel döngüleri PanelManager worker'larında döner.
/// </summary>
public sealed class BridgeWorker : BackgroundService
{
  private readonly PanelConfigStore _store;
  private readonly PanelManager _manager;
  private readonly LocalConfigServer _configServer;
  private readonly LocalApiOptions _localApi;
  private readonly ILogger<BridgeWorker> _logger;

  public BridgeWorker(
    PanelConfigStore store,
    PanelManager manager,
    LocalConfigServer configServer,
    IOptions<LocalApiOptions> localApi,
    ILogger<BridgeWorker> logger)
  {
    _store = store;
    _manager = manager;
    _configServer = configServer;
    _localApi = localApi.Value;
    _logger = logger;
  }

  protected override async Task ExecuteAsync(CancellationToken stoppingToken)
  {
    var config = _store.Load();
    var enabled = config.Panels.Count(p => p.Enabled);
    _logger.LogInformation(
      "Bridge started: {Enabled}/{Total} panel(s) enabled (config: {Path})",
      enabled, config.Panels.Count, _store.ConfigPath);
    _manager.ApplyConfig(config);

    _ = _configServer.StartAsync(stoppingToken);

    // Konsol/masaüstü modunda yönetim arayüzünü tarayıcıda otomatik aç.
    // Windows Service modunda masaüstü oturumu yoktur → açma (UI yine 127.0.0.1'de erişilebilir).
    if (_localApi.Enabled && !WindowsServiceHelpers.IsWindowsService())
    {
      _ = OpenBrowserWhenReadyAsync(stoppingToken);
    }

    try { await Task.Delay(Timeout.Infinite, stoppingToken); }
    catch (OperationCanceledException) { /* shutdown */ }

    await _manager.DisposeAsync();
  }

  private async Task OpenBrowserWhenReadyAsync(CancellationToken ct)
  {
    try
    {
      await Task.Delay(TimeSpan.FromMilliseconds(800), ct); // listener bind olana kadar bekle
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
