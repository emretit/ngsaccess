using NgAccess.HikvisionBridge.Sdk;

namespace NgAccess.HikvisionBridge.Services;

/// <summary>
/// Tek panelin çalışma döngüsü: login → Convex poll → komut uygula → ack; ayrıca kart event'lerini
/// (SDK runtime'dan gelen) Convex'e relay eder. PanelManager her etkin panel için bir tane kurar.
/// </summary>
public sealed class PanelWorker : IAsyncDisposable
{
  private readonly PanelConfig _panel;
  private readonly HikvisionClient _hik;
  private readonly ConvexBridgeClient _convex;
  private readonly int _pollIntervalSeconds;
  private readonly ILogger _logger;
  private readonly CancellationTokenSource _cts = new();
  private Task? _loop;

  private volatile string _state = "stopped";
  private volatile string? _lastError;
  private DateTime? _lastPollAt;
  private DateTime? _lastEventAt;

  public PanelWorker(PanelConfig panel, HikvisionClient hik, ConvexBridgeClient convex, int pollIntervalSeconds, ILogger logger)
  {
    _panel = panel;
    _hik = hik;
    _convex = convex;
    _pollIntervalSeconds = pollIntervalSeconds;
    _logger = logger;
    _hik.CardEventReceived += OnCardEvent;
  }

  public void Start() => _loop = Task.Run(() => RunAsync(_cts.Token));

  public PanelStatus Status() => new()
  {
    Id = _panel.Id,
    Name = _panel.Name,
    Host = _panel.Host,
    Port = _panel.Port,
    DoorCount = _panel.DoorCount,
    Enabled = _panel.Enabled,
    HasPassword = !string.IsNullOrWhiteSpace(_panel.Password),
    HasToken = !string.IsNullOrWhiteSpace(_panel.DeviceToken),
    State = _state,
    PanelLoggedIn = _hik.IsLoggedIn,
    LastError = _lastError,
    LastPollAt = _lastPollAt?.ToString("o"),
    LastEventAt = _lastEventAt?.ToString("o"),
  };

  public Task<SdkResult> OpenDoorAsync(int doorNo) => _hik.OpenDoorAsync(doorNo, _cts.Token);

  public Task<SdkResult> TestAsync() => _hik.EnsureConnectedAsync(_cts.Token);

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
          await DelayAsync(10, ct);
          continue;
        }
        _state = "connected";
        _lastError = null;

        var poll = await _convex.PollAsync(ct);
        _lastPollAt = DateTime.UtcNow;
        if (!poll.Ok)
        {
          _lastError = poll.Error;
          await DelayAsync(_pollIntervalSeconds, ct);
          continue;
        }

        foreach (var op in poll.Operations)
        {
          _logger.LogInformation("[{Panel}] op {OpId} {Operation}", _panel.Name, op.OpId, op.Operation);
          var result = await _hik.ExecuteOperationAsync(op, ct);
          if (!result.Ok) _logger.LogWarning("[{Panel}] op {OpId} failed: {Error}", _panel.Name, op.OpId, result.Error);
          await _convex.AckAsync(op.OpId, result.Ok, result.Error, ct);
        }

        await DelayAsync(_pollIntervalSeconds, ct);
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
        await DelayAsync(_pollIntervalSeconds, ct);
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
      DeviceIp = _panel.Host,
      SerialNumber = _panel.Host,
      MajorEventType = ev.Major,
      SubEventType = ev.Minor,
      DoorNo = ev.DoorNo,
      DateTime = ev.DateTime,
    };
    _logger.LogInformation("[{Panel}] card event cardNo={Card} door={Door}", _panel.Name, ev.CardNo, ev.DoorNo);
    _ = _convex.PostCardReaderEventAsync(payload, CancellationToken.None);
  }

  public async ValueTask DisposeAsync()
  {
    _hik.CardEventReceived -= OnCardEvent;
    _cts.Cancel();
    if (_loop is not null)
    {
      try { await _loop; } catch { /* shutdown */ }
    }
    _hik.Dispose();
    _cts.Dispose();
  }
}
