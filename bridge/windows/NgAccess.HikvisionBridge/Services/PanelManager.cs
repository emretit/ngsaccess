using Microsoft.Extensions.Options;
using NgAccess.HikvisionBridge.Sdk;

namespace NgAccess.HikvisionBridge.Services;

/// <summary>
/// Tek-yer modeli koordinatörü. Bir bridge token ile Convex roster'ını çeker; gelen cihaz
/// listesine göre PanelWorker'ları uzlaştırır (yeni başlat / değişen-kaldırılan durdur) ve
/// bekleyen işleri ilgili worker'a uygulatıp ack'ler. Panel bilgileri buluttan gelir.
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
  private string _bridgeToken = "";
  private ConvexBridgeClient? _convex;
  private volatile string? _lastRosterError;
  // Configure() yalnız bunu kaldırır; worker teardown'ı poll thread yapar (tek-sahip, #11).
  private bool _needsWorkerReset;
  private WakeInfo? _wake;
  private int? _nextPollSeconds;
  private int? _nextDueInSeconds;
  private readonly RosterCallLimiter _rosterLimiter;
  private TaskCompletionSource _configurationChanged = new(TaskCreationOptions.RunContinuationsAsynchronously);

  public Task ConfigurationChanged { get { lock (_lock) return _configurationChanged.Task; } }
  public int SuccessWaitSeconds
  {
    get { lock (_lock) return _nextDueInSeconds is int due ? Math.Min(NextPollSeconds, Math.Max(5, due)) : NextPollSeconds; }
  }
  private TaskCompletionSource _wakeChanged = new(TaskCreationOptions.RunContinuationsAsynchronously);

  public int NextPollSeconds
  {
    get
    {
      lock (_lock) return Math.Clamp(_nextPollSeconds ??
        Math.Max(_options.PollIntervalSeconds, _options.PollMaxIntervalSeconds), 30, 3600);
    }
  }

  public (WakeInfo? Info, Task Changed) GetWakeState()
  {
    lock (_lock) return (_wake, _wakeChanged.Task);
  }

  private void SetRosterHints(WakeInfo? wake, int? nextPollSeconds, int? nextDueInSeconds)
  {
    lock (_lock)
    {
      _nextPollSeconds = nextPollSeconds;
      _nextDueInSeconds = nextDueInSeconds;
      if (_wake == wake) return;
      _wake = wake;
      var previous = _wakeChanged;
      _wakeChanged = new(TaskCreationOptions.RunContinuationsAsynchronously);
      previous.TrySetResult();
    }
  }

  public PanelManager(
    HikvisionSdkRuntime runtime,
    IHttpClientFactory httpFactory,
    IOptions<BridgeOptions> options,
    ILoggerFactory loggerFactory,
    ILogger<PanelManager> logger, TimeProvider? timeProvider = null)
  {
    _runtime = runtime;
    _httpFactory = httpFactory;
    _options = options.Value;
    _loggerFactory = loggerFactory;
    _logger = logger;
    _rosterLimiter = new RosterCallLimiter(timeProvider ?? TimeProvider.System, logger);
  }

  public string? LastRosterError => _lastRosterError;
  public bool HasToken => _convex?.HasToken ?? false;

  /// <summary>Site URL / bridge token uygula. Değiştiyse Convex istemcisi yeniden kurulur ve
  /// worker reset bayrağı kaldırılır; gerçek teardown'ı poll thread yapar (cross-thread dispose
  /// yarışı önlenir, #11).</summary>
  public void Configure(string siteUrl, string bridgeToken)
  {
    lock (_lock)
    {
      var unchanged = string.Equals(_siteUrl, siteUrl, StringComparison.Ordinal)
        && string.Equals(_bridgeToken, bridgeToken, StringComparison.Ordinal)
        && _convex is not null;
      if (unchanged) return;

      _siteUrl = siteUrl;
      _bridgeToken = bridgeToken;
      var http = _httpFactory.CreateClient();
      _convex = new ConvexBridgeClient(
        http, siteUrl, bridgeToken, _options.PollMaxOperations, _loggerFactory.CreateLogger("Convex:roster"), _rosterLimiter);

      // Mevcut worker'lar eski Convex istemcisini tutar; burada (HTTP thread) durdurmak
      // PollRosterAsync ile yarışırdı. Bayrağı kaldır — bir sonraki poll eski worker'ları
      // durdurup yeni istemciyle yeniden kurar.
      _needsWorkerReset = true;
      SetRosterHints(null, null, null);
      var previous = _configurationChanged;
      _configurationChanged = new(TaskCreationOptions.RunContinuationsAsynchronously);
      previous.TrySetResult();
    }
  }

  /// <summary>Bir poll turu: roster çek → worker'ları uzlaştır → işleri uygula + ack.
  /// Dönüş: başarı, iş sayısı ve cihaz değişikliği; caller kuyruk boşaltmayı sınırlar.</summary>
  public async Task<RosterPollResult> PollRosterAsync(CancellationToken ct)
  {
    // Worker yaşam döngüsünün tek sahibi bu thread: Configure() reset istediyse eski
    // worker'ları burada (await ile) durdur — fire-and-forget cross-thread dispose yok.
    ConvexBridgeClient? convex;
    List<PanelWorker> toReset = [];
    lock (_lock)
    {
      if (_needsWorkerReset)
      {
        foreach (var (_, w) in _workers.Values) toReset.Add(w);
        _workers.Clear();
        _needsWorkerReset = false;
      }
      convex = _convex;
    }
    foreach (var w in toReset) await w.DisposeAsync();

    if (convex is null || !convex.HasToken)
    {
      _lastRosterError = "bridge token girilmemiş";
      return new(false);
    }

    RosterResponse roster;
    try { roster = await convex.RosterAsync(ct); }
    catch (Exception) when (!ct.IsCancellationRequested)
    {
      lock (_lock)
      {
        if (!ReferenceEquals(convex, _convex)) return new(false, ConfigurationChanged: true);
      }
      throw;
    }
    lock (_lock)
    {
      // Ayarlar HTTP çağrısı sürerken değiştiyse eski bilet yeniden kurulmasın.
      if (!ReferenceEquals(convex, _convex)) return new(false, ConfigurationChanged: true);
      if (!roster.Ok)
      {
        _lastRosterError = roster.Error;
        return new(false);
      }
      SetRosterHints(roster.Wake, roster.NextPollSeconds, roster.NextDueInSeconds);
    }
    _lastRosterError = null;

    var (toStop, devicesChanged) = Reconcile(roster.Devices);
    foreach (var w in toStop) await w.DisposeAsync();

    foreach (var op in roster.Operations)
    {
      if (ct.IsCancellationRequested) break;
      PanelWorker? worker;
      lock (_lock)
      {
        worker = _workers.TryGetValue(op.DeviceId, out var w) ? w.Worker : null;
      }
      if (worker is null)
      {
        await convex.AckAsync(op.OpId, false, "panel worker bulunamadı (roster'da yok)", ct);
        continue;
      }
      SdkResult result;
      try { result = await worker.ExecuteOperationAsync(op); }
      catch (Exception ex) { result = SdkResult.Failure(ex.Message); }
      if (!result.Ok)
      {
        _logger.LogWarning("op {OpId} ({Op}) failed: {Error}", op.OpId, op.Operation, result.Error);
      }
      await convex.AckAsync(op.OpId, result.Ok, result.Error, ct);
    }

    return new(true, roster.Operations.Count, devicesChanged);
  }

  /// <summary>Roster cihaz listesine göre worker'ları uzlaştır. Durdurulacak worker listesini
  /// döner — çağıran await ile dispose eder (tek-sahip thread). İkinci eleman: bu turda worker
  /// eklendi/çıkarıldı mı (cihaz listesi değişikliği) — caller backoff sıfırlama için kullanır.</summary>
  private (List<PanelWorker> ToStop, bool Changed) Reconcile(List<RosterDevice> rosterDevices)
  {
    List<PanelWorker> toStop = [];
    lock (_lock)
    {
      var desired = rosterDevices
        .Where(d => !string.IsNullOrWhiteSpace(d.DeviceId) && !string.IsNullOrWhiteSpace(d.Host))
        .Select(PanelConfig.FromRoster)
        .ToDictionary(p => p.Id);

      // Kaldırılan / BAĞLANTISI (host/port/kullanıcı/şifre/token) değişen worker'ları durdur.
      foreach (var id in _workers.Keys.ToList())
      {
        if (desired.TryGetValue(id, out var d) && SameConnection(_workers[id].Cfg, d))
        {
          // Bağlantı aynı → worker'ı yeniden kurma (relogin yok). Yalnız metadata'yı
          // (Name/DoorCount) YERİNDE güncelle: Cfg, worker + HikvisionClient ile paylaşılan
          // referans olduğundan değişiklik status/log/op'lara yansır (#6).
          var cfg = _workers[id].Cfg;
          cfg.Name = d.Name;
          cfg.DoorCount = d.DoorCount;
        }
        else
        {
          toStop.Add(_workers[id].Worker);
          _workers.Remove(id);
        }
      }

      // Yeni (veya yeniden kurulacak) worker'ları başlat.
      var added = 0;
      foreach (var (id, panel) in desired)
      {
        if (_workers.ContainsKey(id)) continue;
        var worker = CreateWorker(panel);
        _workers[id] = (panel, worker);
        worker.Start();
        added++;
        _logger.LogInformation("Panel worker started: {Name} ({Host})", panel.Name, panel.Host);
      }
      return (toStop, toStop.Count > 0 || added > 0);
    }
  }

  private PanelWorker CreateWorker(PanelConfig panel)
  {
    var hik = new HikvisionClient(
      panel, _runtime, _options.SdkDllDirectory, _loggerFactory.CreateLogger($"Hik:{panel.Name}"));
    // _convex paylaşılır (event relay için); çağıran lock tutuyor.
    var convex = _convex!;
    return new PanelWorker(panel, hik, convex, _loggerFactory.CreateLogger($"Panel:{panel.Name}"));
  }

  // DoorCount KASITLI dışarıda: bağlantı kimliği değil (metadata). Değişince relogin yerine
  // Reconcile yerinde günceller. Name de metadata — aynı şekilde restart'sız güncellenir.
  private static bool SameConnection(PanelConfig a, PanelConfig b) =>
    a.Host == b.Host
    && a.Port == b.Port
    && a.Username == b.Username
    && a.Password == b.Password
    && a.DeviceToken == b.DeviceToken;

  public List<PanelStatus> GetStatuses()
  {
    lock (_lock)
    {
      return _workers.Values.Select(w => w.Worker.Status()).ToList();
    }
  }

  public Task<SdkResult> OpenDoorAsync(string deviceId, int doorNo)
  {
    lock (_lock)
    {
      return _workers.TryGetValue(deviceId, out var w)
        ? w.Worker.OpenDoorAsync(doorNo)
        : Task.FromResult(SdkResult.Failure("panel bulunamadı (roster'da yok)"));
    }
  }

  public Task<SdkResult> TestAsync(string deviceId)
  {
    lock (_lock)
    {
      return _workers.TryGetValue(deviceId, out var w)
        ? w.Worker.TestAsync()
        : Task.FromResult(SdkResult.Failure("panel bulunamadı (roster'da yok)"));
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
