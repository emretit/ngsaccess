using System.Net;
using System.Text;
using System.Threading.Channels;
using Microsoft.Extensions.Options;

namespace NgAccess.HikvisionBridge.Services;

/// <summary>Biriken uyandırmaları tek tura indirir; bekleme yarışı tüketici bırakmaz.</summary>
public sealed class WakeSignal(TimeProvider? timeProvider = null)
{
  private readonly TimeProvider _clock = timeProvider ?? TimeProvider.System;
  private readonly Channel<bool> _channel = Channel.CreateBounded<bool>(new BoundedChannelOptions(1)
  {
    FullMode = BoundedChannelFullMode.DropWrite,
    SingleReader = true,
    SingleWriter = false,
  });

  public void Set() => _channel.Writer.TryWrite(true);

  public async Task<bool> WaitAsync(TimeSpan ceiling, CancellationToken ct)
  {
    using var timeout = new CancellationTokenSource(ceiling, _clock);
    using var wait = CancellationTokenSource.CreateLinkedTokenSource(ct, timeout.Token);
    try { await _channel.Reader.WaitToReadAsync(wait.Token); }
    catch (OperationCanceledException) when (!ct.IsCancellationRequested) { return false; }
    // İlk sinyalden itibaren sabit pencere: sürekli wake gelmesi poll'u ertelemez.
    await Task.Delay(TimeSpan.FromSeconds(1), _clock, ct);
    while (_channel.Reader.TryRead(out _)) { }
    return true;
  }
}

public sealed class WakeStreamClient : IDisposable
{
  private readonly PanelManager _manager;
  private readonly bool _enabled;
  private readonly ILogger<WakeStreamClient> _logger;
  // Factory HTTP logları URL içindeki bileti yazmasın; SSE istemcisi ayrı tutulur.
  private readonly HttpClient _http = new(new HttpClientHandler { AllowAutoRedirect = false })
  {
    Timeout = Timeout.InfiniteTimeSpan,
  };
  private volatile string _state = "kapalı";
  private long _lastWakeAt;
  private long? _lastReadyPoll;
  private readonly TimeProvider _clock;
  public string State => _state;
  public long? LastWakeAt => Interlocked.Read(ref _lastWakeAt) is var value && value != 0 ? value : null;
  public WakeSignal Signal { get; }

  public WakeStreamClient(PanelManager manager, IOptions<BridgeOptions> options, ILogger<WakeStreamClient> logger, TimeProvider? timeProvider = null)
  {
    _clock = timeProvider ?? TimeProvider.System;
    Signal = new WakeSignal(_clock);
    _manager = manager;
    _enabled = options.Value.WakeStreamEnabled;
    _logger = logger;
    _http.DefaultRequestHeaders.UserAgent.ParseAdd(ConvexBridgeClient.UserAgent);
    _http.DefaultRequestHeaders.Accept.ParseAdd("text/event-stream");
  }

  public async Task RunAsync(CancellationToken ct)
  {
    WakeInfo? denied = null;
    var backoff = 1;
    try
    {
      while (!ct.IsCancellationRequested)
      {
        var (info, changed) = _manager.GetWakeState();
        if (!_enabled || info is null || info == denied)
        {
          _state = info is not null && _enabled ? "kopuk" : "kapalı";
          await (_enabled ? changed : Task.Delay(Timeout.Infinite, ct)).WaitAsync(ct);
          continue;
        }

        if (!IsAllowedStreamUrl(info.StreamUrl))
        {
          _state = "kopuk";
          _logger.LogWarning("Uyandırma kanalı için HTTPS adresi gerekli");
          await changed.WaitAsync(ct);
          continue;
        }

        using var connection = CancellationTokenSource.CreateLinkedTokenSource(ct);
        _state = "bağlanıyor";
        long? readyAt = null;
        var attempt = ConnectAsync(info, () =>
        {
          denied = null;
          readyAt ??= _clock.GetTimestamp();
        }, connection.Token);
        await Task.WhenAny(attempt, changed);
        if (changed.IsCompleted) await connection.CancelAsync();
        try
        {
          if (await attempt == HttpStatusCode.Unauthorized) denied = info;
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested || changed.IsCompleted) { }
        catch (OperationCanceledException) { _logger.LogWarning("Uyandırma kanalı koptu: 90 sn veri alınamadı"); }
        catch (Exception ex)
        {
          // Exception mesajı/nesnesi istek URL'ini (bileti) içerebilir.
          _logger.LogWarning("Uyandırma kanalı koptu: {Reason}", ex.GetType().Name);
        }
        _state = "kopuk";
        if (changed.IsCompleted || ct.IsCancellationRequested || denied == info) continue;

        // Kısa ready/kopma döngüleri geri çekilmeyi sıfırlamamalı.
        if (readyAt is long started && _clock.GetElapsedTime(started) >= TimeSpan.FromSeconds(60)) backoff = 1;
        using var retry = CancellationTokenSource.CreateLinkedTokenSource(ct);
        var delay = Task.Delay(TimeSpan.FromSeconds(Math.Min(60, backoff + Random.Shared.NextDouble())), _clock, retry.Token);
        await Task.WhenAny(delay, changed);
        await retry.CancelAsync();
        backoff = Math.Min(60, backoff * 2);
      }
    }
    catch (OperationCanceledException) when (ct.IsCancellationRequested) { }
    finally { _state = "kapalı"; }
  }

  public static bool IsAllowedStreamUrl(string url) =>
    Uri.TryCreate(url, UriKind.Absolute, out var uri)
    && string.IsNullOrEmpty(uri.UserInfo)
    && (uri.Scheme == Uri.UriSchemeHttps
      || (uri.Scheme == Uri.UriSchemeHttp && uri.Host is "127.0.0.1" or "localhost"));

  private async Task<HttpStatusCode> ConnectAsync(WakeInfo info, Action onReady, CancellationToken ct)
  {
    var separator = info.StreamUrl.Contains('?') ? '&' : '?';
    var url = $"{info.StreamUrl}{separator}bridge={Uri.EscapeDataString(info.BridgeId)}&ticket={Uri.EscapeDataString(info.Ticket)}";
    using var idle = CancellationTokenSource.CreateLinkedTokenSource(ct);
    idle.CancelAfter(TimeSpan.FromSeconds(90));
    using var request = new HttpRequestMessage(HttpMethod.Get, url);
    using var response = await _http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, idle.Token);
    if (!response.IsSuccessStatusCode)
    {
      _logger.LogWarning("Uyandırma kanalı koptu: HTTP {Status}", (int)response.StatusCode);
      return response.StatusCode;
    }
    if (response.Content.Headers.ContentType?.MediaType != "text/event-stream")
      throw new InvalidDataException("SSE içerik türü bekleniyor");
    using var stream = await response.Content.ReadAsStreamAsync(idle.Token);
    var parser = new SseParser();
    var bytes = new byte[4096];
    var chars = new char[Encoding.UTF8.GetMaxCharCount(bytes.Length)];
    var decoder = Encoding.UTF8.GetDecoder();
    var line = new StringBuilder();
    while (true)
    {
      // Satır tamamlanmasa bile alınan her bayt canlılık süresini yeniler.
      idle.CancelAfter(TimeSpan.FromSeconds(90));
      var count = await stream.ReadAsync(bytes.AsMemory(), idle.Token);
      if (count == 0) break;
      var charCount = decoder.GetChars(bytes, 0, count, chars, 0);
      for (var i = 0; i < charCount; i++)
      {
        if (chars[i] != '\n')
        {
          if (line.Length >= 65536) throw new InvalidDataException("SSE satırı çok büyük");
          line.Append(chars[i]);
          continue;
        }
        var evt = parser.ProcessLine(line.ToString());
        line.Clear();
        if (evt is null) continue;
        if (evt.Event == "ready")
        {
          onReady();
          _state = "bağlı";
          _logger.LogInformation("Uyandırma kanalı bağlandı");
        }
        if (evt.Event == "ready")
        {
          var now = _clock.GetTimestamp();
          if (_lastReadyPoll is long previous && _clock.GetElapsedTime(previous, now) < TimeSpan.FromMinutes(5)) continue;
          _lastReadyPoll = now;
        }
        Interlocked.Exchange(ref _lastWakeAt, _clock.GetUtcNow().ToUnixTimeMilliseconds());
        Signal.Set();
        _logger.LogInformation("Uyandırma alındı: {Event}", evt.Event);
      }
    }
    _logger.LogWarning("Uyandırma kanalı koptu: akış kapandı");
    return response.StatusCode;
  }

  public void Dispose() => _http.Dispose();
}
