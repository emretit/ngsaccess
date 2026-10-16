using System.Diagnostics;
using Microsoft.Extensions.Hosting.WindowsServices;
using Microsoft.Extensions.Options;

namespace NgAccess.HikvisionBridge.Services;

/// <summary>Tüm istemcilerin paylaştığı, ayar değişiminde sıfırlanmayan roster bütçesi.</summary>
public sealed class RosterCallLimiter(TimeProvider clock, ILogger logger)
{
  private readonly Queue<long> _calls = new();
  private readonly SemaphoreSlim _gate = new(1, 1);
  private long? _lastCall;
  private bool _limitWarningLogged;

  public async Task WaitAsync(CancellationToken ct)
  {
    await _gate.WaitAsync(ct);
    try
    {
      while (true)
      {
        ct.ThrowIfCancellationRequested();
        var now = clock.GetTimestamp();
        while (_calls.TryPeek(out var oldest) && clock.GetElapsedTime(oldest, now) >= TimeSpan.FromHours(1))
          _calls.Dequeue();
        var delay = _lastCall is long last ? TimeSpan.FromSeconds(1) - clock.GetElapsedTime(last, now) : TimeSpan.Zero;
        if (_calls.Count >= BridgeOptions.PollMaxPerHour)
        {
          var budgetDelay = TimeSpan.FromHours(1) - clock.GetElapsedTime(_calls.Peek(), now);
          if (budgetDelay > delay) delay = budgetDelay;
          if (!_limitWarningLogged)
          {
            logger.LogWarning("Roster saatlik {Limit} çağrı tavanında; pencerenin açılması bekleniyor", BridgeOptions.PollMaxPerHour);
            _limitWarningLogged = true;
          }
        }
        if (delay <= TimeSpan.Zero)
        {
          _calls.Enqueue(now);
          _lastCall = now;
          return;
        }
        // Wake veya ayar sinyali bütçe beklemesini kesemez.
        await Task.Delay(delay, clock, ct);
      }
    }
    finally { _gate.Release(); }
  }
}

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
  private readonly WakeStreamClient _wake;
  private readonly LocalConfigServer _configServer;
  private readonly TimeProvider _clock;
  private readonly LocalApiOptions _localApi;
  private readonly ILogger<BridgeWorker> _logger;

  public BridgeWorker(
    PanelConfigStore store,
    PanelManager manager,
    WakeStreamClient wake,
    LocalConfigServer configServer,
    IOptions<BridgeOptions> bridgeOptions,
    IOptions<LocalApiOptions> localApi,
    ILogger<BridgeWorker> logger, TimeProvider? timeProvider = null)
  {
    _store = store;
    _manager = manager;
    _wake = wake;
    _configServer = configServer;
    _clock = timeProvider ?? TimeProvider.System;
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

    using var wakeLifetime = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
    var wakeTask = _wake.RunAsync(wakeLifetime.Token);
    var burst = 0;
    var deviceFollowupUsed = false;
    var failureDelay = 5;
    try
    {
      while (!stoppingToken.IsCancellationRequested)
      {
        var configurationChanged = _manager.ConfigurationChanged;
        RosterPollResult result;
        try { result = await _manager.PollRosterAsync(stoppingToken); }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        catch (Exception ex)
        {
          _logger.LogWarning(ex, "Roster poll hatası");
          result = new(false);
        }

        if (result.ConfigurationChanged || configurationChanged.IsCompleted)
        {
          failureDelay = 5;
          burst = 0;
          deviceFollowupUsed = false;
          await Task.Delay(TimeSpan.FromSeconds(1), _clock, stoppingToken);
          continue;
        }

        var ceiling = _manager.SuccessWaitSeconds;
        burst++;
        var drain = result.Success && result.Active && result.OperationCount > 0 && burst < 20;
        if (result.Success && result.DevicesChanged && result.OperationCount == 0
            && !deviceFollowupUsed && burst < 20)
        {
          drain = true;
          deviceFollowupUsed = true;
        }
        if (drain)
        {
          failureDelay = 5;
          await WaitForPollAsync(1, configurationChanged, false, stoppingToken);
          continue;
        }

        burst = 0;
        deviceFollowupUsed = false;
        if (!result.Success)
        {
          // Hata halinde wake yağmuru bile çağrıları hızlandırmasın.
          await WaitForPollAsync(failureDelay, configurationChanged, false, stoppingToken);
          failureDelay = configurationChanged.IsCompleted ? 5 : Math.Min(300, failureDelay * 2);
        }
        else
        {
          failureDelay = 5;
          await WaitForPollAsync(ceiling, configurationChanged, true, stoppingToken);
        }
      }
    }
    catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
    finally
    {
      await wakeLifetime.CancelAsync();
      await wakeTask;
    }

    await _manager.DisposeAsync();
  }

  private async Task WaitForPollAsync(int seconds, Task configurationChanged, bool allowWake, CancellationToken ct)
  {
    using var wait = CancellationTokenSource.CreateLinkedTokenSource(ct);
    var delay = allowWake
      ? _wake.Signal.WaitAsync(TimeSpan.FromSeconds(seconds), wait.Token)
      : Task.Delay(TimeSpan.FromSeconds(seconds), _clock, wait.Token);
    await Task.WhenAny(delay, configurationChanged);
    await wait.CancelAsync();
    try { await delay; }
    catch (OperationCanceledException) when (!ct.IsCancellationRequested) { }
    ct.ThrowIfCancellationRequested();
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
