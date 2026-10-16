using System.Collections.Concurrent;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using NgAccess.HikvisionBridge;
using NgAccess.HikvisionBridge.Sdk;
using NgAccess.HikvisionBridge.Services;

static class AuditTests
{
  private static async Task Until(Func<bool> predicate)
  {
    using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));
    while (!predicate()) await Task.Delay(1, timeout.Token);
  }

  public static async Task Run(Action<bool, string> check)
  {
    check(BridgeOptions.PollMaxPerHour == 240 && new BridgeOptions().PollMaxOperations == 25, "sabit 240/saat ve 25 iş varsayılanı");
    check(WakeStreamClient.IsAllowedStreamUrl("https://relay.invalid/hik-bridge/stream")
      && WakeStreamClient.IsAllowedStreamUrl("http://localhost:8080/stream")
      && !WakeStreamClient.IsAllowedStreamUrl("http://relay.invalid/stream")
      && !WakeStreamClient.IsAllowedStreamUrl("http://127.0.0.1.evil.invalid/stream")
      && !WakeStreamClient.IsAllowedStreamUrl("file:///tmp/stream"), "SSE HTTPS zorunlu; yalnız loopback HTTP serbest");

    await using (var h = new Harness())
    {
      h.Factory.Body = "{\"ok\":false}";
      await h.Start();
      foreach (var seconds in new[] { 5, 10, 20, 40, 80, 160, 300, 300 })
      {
        await Until(() => h.Clock.PendingTimers > 0);
        var count = h.Factory.Calls.Count;
        h.Wake.Signal.Set();
        h.Clock.Advance(TimeSpan.FromSeconds(seconds) - TimeSpan.FromMilliseconds(10));
        await Task.Delay(5);
        check(h.Factory.Calls.Count == count, $"hata geri çekilmesi {seconds} sn; wake kısaltmaz");
        h.Clock.Advance(TimeSpan.FromMilliseconds(10));
        await Until(() => h.Factory.Calls.Count == count + 1);
      }
      await Until(() => h.Clock.PendingTimers > 0);
      var before = h.Factory.Calls.Count;
      h.Clock.Advance(TimeSpan.FromSeconds(1));
      h.Manager.Configure("https://roster.invalid", "changed-token");
      await Until(() => h.Factory.Calls.Count == before + 1);
      check(true, "Configure hata beklemesini keser");
    }

    foreach (var due in new int?[] { 7, null, 1, 9999 })
    {
      await using var h = new Harness();
      h.Factory.Body = JsonSerializer.Serialize(new RosterResponse { Ok = true, NextPollSeconds = 900, NextDueInSeconds = due });
      await h.Start();
      await Until(() => h.Clock.PendingTimers > 0);
      var seconds = due is int n ? Math.Min(900, Math.Max(5, n)) : 900;
      h.Clock.Advance(TimeSpan.FromSeconds(seconds) - TimeSpan.FromMilliseconds(10));
      await Task.Delay(5);
      check(h.Factory.Calls.Count == 1, $"nextDue={due?.ToString() ?? "null"} erken poll üretmez");
      h.Clock.Advance(TimeSpan.FromMilliseconds(10));
      await Until(() => h.Factory.Calls.Count == 2);
      check(true, $"nextDue={due?.ToString() ?? "null"} → {seconds} sn poll");
      await Until(() => h.Clock.PendingTimers > 0);
      h.Clock.Advance(TimeSpan.FromSeconds(1));
      h.Manager.Configure("https://roster.invalid", "success-config-change");
      await Until(() => h.Factory.Calls.Count == 3);
      check(true, "Configure başarı beklemesini keser");
    }

    // Gerçek HTTP gönderimlerini sayar; hata, drain, wake ve ayar değişimi aynı bütçededir.
    await using (var h = new Harness())
    {
      h.Factory.Body = "{\"ok\":true,\"operations\":[{\"opId\":\"op\",\"deviceId\":\"missing\"}]}";
      await h.Start();
      for (var i = 1; i < 240; i++)
      {
        await Until(() => h.Clock.PendingTimers > 0);
        h.Factory.Body = i % 3 == 0 ? "{\"ok\":false}" : "{\"ok\":true,\"operations\":[{\"opId\":\"op\",\"deviceId\":\"missing\"}]}";
        h.Manager.Configure("https://roster.invalid", $"token-{i}");
        h.Wake.Signal.Set();
        // Ayar sinyalinin worker tarafından işlenmesini bekle; tavanın tek-saniye kapısı kalır.
        await Task.Delay(2);
        h.Clock.Advance(TimeSpan.FromSeconds(1));
        await Until(() => h.Factory.Calls.Count == i + 1);
      }
      await Until(() => h.Clock.PendingTimers > 0);
      h.Manager.Configure("https://roster.invalid", "over-budget");
      await Task.Delay(5);
      h.Clock.Advance(TimeSpan.FromSeconds(1));
      await Task.Delay(5);
      h.Clock.Advance(TimeSpan.FromSeconds(3359));
      h.Manager.Configure("https://roster.invalid", "still-over-budget");
      h.Wake.Signal.Set();
      await Task.Delay(5);
      check(h.Factory.Calls.Count == 240, "wake/drain/hata/config karışımı 3599 sn içinde en fazla 240 roster");
      h.Clock.Advance(TimeSpan.FromSeconds(1));
      await Until(() => h.Factory.Calls.Count == 241);
      var times = h.Factory.Calls.ToArray();
      check(times.Zip(times.Skip(1)).All(p => p.Second - p.First >= TimeSpan.TicksPerSecond), "tüm HTTP roster çağrıları arasında en az 1 sn");
      check(times[240] - times[0] >= TimeSpan.TicksPerHour, "241. çağrı kayan pencere açılınca gönderilir");
    }

    // Configure HTTP sırasında olursa eski başarısız yanıt hata olarak sayılmaz.
    await using (var h = new Harness())
    {
      h.Manager.Configure("https://roster.invalid", "old");
      h.Factory.BeforeResponse = () => h.Manager.Configure("https://roster.invalid", "new");
      h.Factory.Body = "{\"ok\":false,\"error\":\"old error\"}";
      var result = await h.Manager.PollRosterAsync(CancellationToken.None);
      check(result.ConfigurationChanged && h.Manager.LastRosterError is null, "poll sırasında Configure eski hatayı yok sayar");
    }

    await using (var h = new Harness())
    {
      h.Factory.Body = "{\"ok\":false}";
      h.Factory.BeforeResponse = () =>
      {
        h.Factory.BeforeResponse = null;
        h.Manager.Configure("https://roster.invalid", "changed-during-poll");
      };
      await h.Start();
      await Until(() => h.Clock.PendingTimers > 0);
      h.Clock.Advance(TimeSpan.FromMilliseconds(999));
      await Task.Delay(5);
      check(h.Factory.Calls.Count == 1, "poll sırasında Configure sonrası 1 sn korunur");
      h.Clock.Advance(TimeSpan.FromMilliseconds(1));
      await Until(() => h.Factory.Calls.Count == 2);
      check(true, "poll sırasında Configure hata beklemeden 1 sn sonra yeniler");
      await Until(() => h.Clock.PendingTimers > 0);
      h.Clock.Advance(TimeSpan.FromSeconds(5));
      await Until(() => h.Factory.Calls.Count == 3);
      check(true, "iptal edilen eski ayar turu hata backoff'unu büyütmez");
    }

    await Flapping(check);
  }

  private static async Task Flapping(Action<bool, string> check)
  {
    await using var h = new Harness();
    h.Manager.Configure("https://roster.invalid", "test");
    using var reservation = new TcpListener(IPAddress.Loopback, 0);
    reservation.Start();
    var port = ((IPEndPoint)reservation.LocalEndpoint).Port;
    reservation.Stop();
    using var server = new HttpListener();
    server.Prefixes.Add($"http://127.0.0.1:{port}/");
    server.Start();
    h.Factory.Body = JsonSerializer.Serialize(new RosterResponse
    {
      Ok = true, Wake = new WakeInfo { StreamUrl = $"http://127.0.0.1:{port}/stream", BridgeId = "bridge", Ticket = "ticket" },
    });
    await h.Manager.PollRosterAsync(CancellationToken.None);
    using var lifetime = new CancellationTokenSource();
    var running = h.Wake.RunAsync(lifetime.Token);
    var connects = new ConcurrentQueue<long>();
    var serving = Task.Run(async () =>
    {
      try
      {
        while (!lifetime.IsCancellationRequested)
        {
          var context = await server.GetContextAsync().WaitAsync(lifetime.Token);
          connects.Enqueue(h.Clock.GetTimestamp());
          context.Response.ContentType = "text/event-stream";
          var bytes = Encoding.UTF8.GetBytes("event: ready\ndata: {}\n\n");
          context.Response.ContentLength64 = bytes.Length;
          await context.Response.OutputStream.WriteAsync(bytes, lifetime.Token);
          context.Response.Close();
        }
      }
      catch (OperationCanceledException) { }
    });
    var polls = 0;
    var consuming = Task.Run(async () =>
    {
      try
      {
        while (!lifetime.IsCancellationRequested)
          if (await h.Wake.Signal.WaitAsync(TimeSpan.FromHours(1), lifetime.Token)) Interlocked.Increment(ref polls);
      }
      catch (OperationCanceledException) { }
    });
    await Until(() => connects.Count == 1 && h.Clock.PendingTimers >= 2);
    for (var second = 1; second < 300; second++)
    {
      h.Clock.Advance(TimeSpan.FromSeconds(1));
      await Task.Delay(3);
    }
    check(polls == 1, "ready→hemen kopma 5 dk içinde yalnız 1 ready-poll");
    var times = connects.ToArray();
    var gaps = times.Zip(times.Skip(1)).Select(p => TimeSpan.FromTicks(p.Second - p.First).TotalSeconds).ToArray();
    check(gaps.Length >= 6 && gaps[0] >= 1 && gaps[1] >= 2 && gaps[2] >= 4 && gaps[3] >= 8
      && gaps[4] >= 16 && gaps[5] >= 32 && gaps.Skip(6).All(gap => gap >= 60), "kısa SSE bağlantıları 1→60 sn geri çekilmeyi büyütür");
    await lifetime.CancelAsync();
    await Task.WhenAll(running, serving, consuming);
  }

  private sealed class Harness : IAsyncDisposable
  {
    public ManualClock Clock { get; } = new();
    public TestFactory Factory { get; }
    public PanelManager Manager { get; }
    public WakeStreamClient Wake { get; }
    private readonly HikvisionSdkRuntime _runtime = new(NullLogger<HikvisionSdkRuntime>.Instance);
    private readonly BridgeWorker _worker;
    public Harness()
    {
      Factory = new TestFactory(Clock);
      var options = Options.Create(new BridgeOptions { ConvexSiteUrl = "https://roster.invalid", BridgeToken = "test", ConfigFile = "selftest-missing-config.json" });
      Manager = new PanelManager(_runtime, Factory, options, NullLoggerFactory.Instance, NullLogger<PanelManager>.Instance, Clock);
      Wake = new WakeStreamClient(Manager, options, NullLogger<WakeStreamClient>.Instance, Clock);
      var localOptions = Options.Create(new LocalApiOptions { Enabled = false });
      var store = new PanelConfigStore(options, NullLogger<PanelConfigStore>.Instance);
      var local = new LocalConfigServer(store, Manager, Wake, localOptions, NullLogger<LocalConfigServer>.Instance);
      _worker = new BridgeWorker(store, Manager, Wake, local, options, localOptions, NullLogger<BridgeWorker>.Instance, Clock);
    }
    public async Task Start() { await _worker.StartAsync(CancellationToken.None); await Until(() => Factory.Calls.Count > 0); }
    public async ValueTask DisposeAsync()
    {
      await _worker.StopAsync(CancellationToken.None);
      _worker.Dispose();
      Wake.Dispose();
      await Manager.DisposeAsync();
      _runtime.Dispose();
    }
  }

  private sealed class TestFactory(ManualClock clock) : IHttpClientFactory
  {
    private readonly ManualClock _clock = clock;
    public ConcurrentQueue<long> Calls { get; } = new();
    public string Body { get; set; } = "{\"ok\":true}";
    public Action? BeforeResponse { get; set; }
    public HttpClient CreateClient(string name) => new(new Handler(this));
    private sealed class Handler(TestFactory owner) : HttpMessageHandler
    {
      protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
      {
        if (request.RequestUri?.AbsolutePath == "/hik-bridge/roster")
        {
          owner.Calls.Enqueue(owner._clock.GetTimestamp());
          owner.BeforeResponse?.Invoke();
        }
        return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(owner.Body, Encoding.UTF8, "application/json") });
      }
    }
  }
}
