using Microsoft.Extensions.Options;
using NgAccess.HikvisionBridge.Sdk;

namespace NgAccess.HikvisionBridge.Services;

/// <summary>
/// Etkin panel başına bir PanelWorker tutar; ApplyConfig ile çalışan worker'ları istenen config'e
/// göre uzlaştırır (yeni başlat / kaldırılan-değişen durdur). UI'dan config değişince yeniden çağrılır.
/// </summary>
public sealed class PanelManager : IAsyncDisposable
{
  private readonly HikvisionSdkRuntime _runtime;
  private readonly IHttpClientFactory _httpFactory;
  private readonly BridgeOptions _options;
  private readonly ILoggerFactory _loggerFactory;
  private readonly ILogger<PanelManager> _logger;
  private readonly object _lock = new();
  private readonly Dictionary<string, (PanelConfig Cfg, PanelWorker Worker)> _workers = new();
  private string _siteUrl = "";

  public PanelManager(
    HikvisionSdkRuntime runtime,
    IHttpClientFactory httpFactory,
    IOptions<BridgeOptions> options,
    ILoggerFactory loggerFactory,
    ILogger<PanelManager> logger)
  {
    _runtime = runtime;
    _httpFactory = httpFactory;
    _options = options.Value;
    _loggerFactory = loggerFactory;
    _logger = logger;
  }

  public void ApplyConfig(BridgeConfig config)
  {
    var toStop = new List<PanelWorker>();
    lock (_lock)
    {
      // SiteUrl değişirse tüm worker'lar (base address'i içlerinde tuttukları için) yeniden kurulur.
      var siteUrlChanged = !string.Equals(_siteUrl, config.ConvexSiteUrl, StringComparison.Ordinal);
      _siteUrl = config.ConvexSiteUrl;

      var desired = config.Panels
        .Where(p => p.Enabled && !string.IsNullOrWhiteSpace(p.Id))
        .ToDictionary(p => p.Id);

      // Kaldırılan / bağlantısı değişen / siteUrl değişmiş worker'ları durdur.
      foreach (var id in _workers.Keys.ToList())
      {
        var keep = !siteUrlChanged
          && desired.TryGetValue(id, out var d)
          && SameConnection(_workers[id].Cfg, d);
        if (!keep)
        {
          toStop.Add(_workers[id].Worker);
          _workers.Remove(id);
        }
      }

      // Yeni (veya yeniden kurulacak) worker'ları başlat.
      foreach (var (id, panel) in desired)
      {
        if (_workers.ContainsKey(id)) continue;
        var worker = CreateWorker(panel, config.ConvexSiteUrl);
        _workers[id] = (panel, worker);
        worker.Start();
        _logger.LogInformation("Panel worker started: {Name} ({Host})", panel.Name, panel.Host);
      }
    }

    // Durdurmayı kilit dışında yap (DisposeAsync loop'u await eder).
    foreach (var w in toStop) _ = w.DisposeAsync();
  }

  private PanelWorker CreateWorker(PanelConfig panel, string siteUrl)
  {
    var hik = new HikvisionClient(
      panel, _runtime, _options.SdkDllDirectory, _loggerFactory.CreateLogger($"Hik:{panel.Name}"));
    var http = _httpFactory.CreateClient();
    var convex = new ConvexBridgeClient(
      http, siteUrl, panel.DeviceToken, _options.PollMaxOperations, _loggerFactory.CreateLogger($"Convex:{panel.Name}"));
    return new PanelWorker(panel, hik, convex, _options.PollIntervalSeconds, _loggerFactory.CreateLogger($"Panel:{panel.Name}"));
  }

  private static bool SameConnection(PanelConfig a, PanelConfig b) =>
    a.Host == b.Host
    && a.Port == b.Port
    && a.Username == b.Username
    && a.Password == b.Password
    && a.DeviceToken == b.DeviceToken
    && a.DoorCount == b.DoorCount;

  public List<PanelStatus> GetStatuses()
  {
    lock (_lock)
    {
      return _workers.Values.Select(w => w.Worker.Status()).ToList();
    }
  }

  public Task<SdkResult> OpenDoorAsync(string panelId, int doorNo)
  {
    lock (_lock)
    {
      return _workers.TryGetValue(panelId, out var w)
        ? w.Worker.OpenDoorAsync(doorNo)
        : Task.FromResult(SdkResult.Failure("panel bulunamadı veya devre dışı"));
    }
  }

  public Task<SdkResult> TestAsync(string panelId)
  {
    lock (_lock)
    {
      return _workers.TryGetValue(panelId, out var w)
        ? w.Worker.TestAsync()
        : Task.FromResult(SdkResult.Failure("panel bulunamadı veya devre dışı"));
    }
  }

  public async ValueTask DisposeAsync()
  {
    List<PanelWorker> workers;
    lock (_lock)
    {
      workers = _workers.Values.Select(w => w.Worker).ToList();
      _workers.Clear();
    }
    foreach (var w in workers) await w.DisposeAsync();
  }
}
