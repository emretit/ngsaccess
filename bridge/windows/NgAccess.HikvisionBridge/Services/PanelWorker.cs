using NgAccess.HikvisionBridge.Sdk;

namespace NgAccess.HikvisionBridge.Services;

/// <summary>
/// Tek panelin SDK bağlantısı: login + alarm kanalı (kart event dinleme). Tek-yer modelinde
/// Convex poll'unu PanelManager merkezî olarak yapar; bu worker yalnız panele bağlı kalır,
/// kart event'lerini cihazın apiToken'ı ile Convex'e relay eder ve merkezden gelen işleri
/// (ExecuteOperationAsync) SDK ile uygular.
/// </summary>
public sealed class PanelWorker : IAsyncDisposable
{
  private const int HealthCheckSeconds = 30;
  private const int RetryAfterErrorSeconds = 10;

  private readonly PanelConfig _panel;
  private readonly HikvisionClient _hik;
  private readonly ConvexBridgeClient _convex;
  private readonly ILogger _logger;
  private readonly CancellationTokenSource _cts = new();
  private Task? _loop;

  private volatile string _state = "stopped";
  private volatile string? _lastError;
  private DateTime? _lastEventAt;

  public PanelWorker(PanelConfig panel, HikvisionClient hik, ConvexBridgeClient convex, ILogger logger)
  {
    _panel = panel;
    _hik = hik;
    _convex = convex;
    _logger = logger;
    _hik.CardEventReceived += OnCardEvent;
  }

  public void Start() => _loop = Task.Run(() => RunAsync(_cts.Token));

  public PanelStatus Status() => new()
  {
    DeviceId = _panel.Id,
    Name = _panel.Name,
    Host = _panel.Host,
    Port = _panel.Port,
    DoorCount = _panel.DoorCount,
    State = _state,
    PanelLoggedIn = _hik.IsLoggedIn,
    LastError = _lastError,
    LastEventAt = _lastEventAt?.ToString("o"),
  };

  public Task<SdkResult> OpenDoorAsync(int doorNo) => _hik.OpenDoorAsync(doorNo, _cts.Token);

  public Task<SdkResult> TestAsync() => _hik.EnsureConnectedAsync(_cts.Token);

  /// <summary>Merkezden gelen iş — panele bağlanıp SDK ile uygular.</summary>
  public Task<SdkResult> ExecuteOperationAsync(BridgeOperation operation) =>
    _hik.ExecuteOperationAsync(operation, _cts.Token);

  private async Task RunAsync(CancellationToken ct)
  {
    while (!ct.IsCancellationRequested)
    {
      try
      {
        _state = "connecting";
        var connect = await _hik.EnsureConnectedAsync(ct);
        if (!connect.Ok)
        {
          _state = "error";
          _lastError = connect.Error;
          await DelayAsync(RetryAfterErrorSeconds, ct);
          continue;
        }
        _state = "connected";
        _lastError = null;
        // SDK otomatik reconnect ediyor; periyodik sağlık kontrolü dışında beklemeye gerek yok.
        await DelayAsync(HealthCheckSeconds, ct);
      }
      catch (OperationCanceledException)
      {
        break;
      }
      catch (Exception ex)
      {
        _state = "error";
        _lastError = ex.Message;
        _logger.LogWarning(ex, "[{Panel}] loop error", _panel.Name);
        await DelayAsync(RetryAfterErrorSeconds, ct);
      }
    }
    _state = "stopped";
  }

  private static async Task DelayAsync(int seconds, CancellationToken ct)
  {
    try { await Task.Delay(TimeSpan.FromSeconds(seconds), ct); }
    catch (OperationCanceledException) { }
  }

  private void OnCardEvent(AcsEvent ev)
  {
    _lastEventAt = DateTime.UtcNow;
    var payload = new CardReaderEventPayload
    {
      CardNo = ev.CardNo,
      // Yalnız IP (ipAddress) gönderilir; serialNumber'a IP yazmak backend cross-tenant
      // guard'ında (serial-set Hikvision cihazlarda) mismatch/403 üretirdi.
      DeviceIp = _panel.Host,
      MajorEventType = ev.Major,
      SubEventType = ev.Minor,
      DoorNo = ev.DoorNo,
      DateTime = ev.DateTime,
    };
    _logger.LogInformation("[{Panel}] card event cardNo={Card} door={Door}", _panel.Name, ev.CardNo, ev.DoorNo);
    _ = _convex.PostCardReaderEventAsync(_panel.DeviceToken, payload, CancellationToken.None);
  }

  public async ValueTask DisposeAsync()
  {
    _hik.CardEventReceived -= OnCardEvent;
    _cts.Cancel();
    if (_loop is not null)
    {
      try { await _loop; } catch { /* shutdown */ }
    }
    await _hik.DisposeAsync();
    _cts.Dispose();
  }
}
