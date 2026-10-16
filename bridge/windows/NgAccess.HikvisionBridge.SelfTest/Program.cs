using System.Collections.Concurrent;
using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using NgAccess.HikvisionBridge;
using NgAccess.HikvisionBridge.Sdk;
using NgAccess.HikvisionBridge.Services;

var checks = 0;
void Check(bool condition, string name)
{
  if (!condition) throw new InvalidOperationException(name);
  Console.WriteLine($"PASS {name}");
  checks++;
}

if (args.Contains("--audit-only"))
{
  await AuditTests.Run(Check);
  Console.WriteLine($"{checks} denetim kontrolü geçti.");
  return;
}

var parser = new SseParser();
Check(parser.ProcessLine(": ping\r") is null && parser.IsComment, "ping canlılığı");
parser.ProcessLine("retry: 10000\r");
parser.ProcessLine("retry: -2");
Check(parser.RetryMilliseconds == 10000, "retry ve geçersiz değer");
parser.ProcessLine("event: wake\r");
parser.ProcessLine("data: bir\r");
parser.ProcessLine("data: iki");
Check(parser.ProcessLine("") == new SseEvent("wake", "bir\niki"), "CRLF/LF çok satırlı data");
parser.ProcessLine("event: unknown");
parser.ProcessLine("data: test");
Check(parser.ProcessLine("") is null, "bilinmeyen olay yok sayılır");
parser.ProcessLine("event: ready");
parser.ProcessLine("data:");
Check(parser.ProcessLine("") == new SseEvent("ready", ""), "ready ve boş data");
Check(parser.ProcessLine("") is null, "olay durumu sıfırlanır");

var signal = new WakeSignal();
for (var i = 0; i < 100; i++) signal.Set();
var timer = Stopwatch.StartNew();
var waiting = signal.WaitAsync(TimeSpan.FromSeconds(5), CancellationToken.None);
await Task.Delay(200);
signal.Set();
Check(await waiting && timer.Elapsed >= TimeSpan.FromMilliseconds(950)
  && timer.Elapsed < TimeSpan.FromSeconds(2), "wake fırtınası sabit bir saniyede birleşir");
Check(!await signal.WaitAsync(TimeSpan.FromMilliseconds(40), CancellationToken.None), "debounce sonrası sinyal kalmaz");
signal.Set();
Check(await signal.WaitAsync(TimeSpan.FromSeconds(2), CancellationToken.None), "timeout tüketicisi yeni sinyali çalmaz");
using (var cancellation = new CancellationTokenSource(30))
{
  try { await signal.WaitAsync(TimeSpan.FromSeconds(10), cancellation.Token); Check(false, "iptal"); }
  catch (OperationCanceledException) { Check(true, "bekleme iptal olur"); }
}

// Gerçek PanelManager ve SSE istemcisi; panel yok, SDK veya bulut çağrısı yapılmaz.
var factory = new RosterFactory();
var options = Options.Create(new BridgeOptions());
using var runtime = new HikvisionSdkRuntime(NullLogger<HikvisionSdkRuntime>.Instance);
await using var manager = new PanelManager(runtime, factory, options,
  NullLoggerFactory.Instance, NullLogger<PanelManager>.Instance);
manager.Configure("https://roster.invalid", "test-token");
factory.Body = "{\"ok\":true,\"devices\":[],\"operations\":[]}";
await manager.PollRosterAsync(CancellationToken.None);
Check(manager.NextPollSeconds == 900 && manager.GetWakeState().Info is null, "eski roster 900 saniye ve wake null");
Check(factory.UserAgent == ConvexBridgeClient.UserAgent, "Convex User-Agent");
factory.Body = "{\"ok\":true,\"nextPollSeconds\":1}";
await manager.PollRosterAsync(CancellationToken.None);
Check(manager.NextPollSeconds == 30, "alt poll sınırı");
factory.Body = "{\"ok\":true,\"nextPollSeconds\":9999}";
await manager.PollRosterAsync(CancellationToken.None);
Check(manager.NextPollSeconds == 3600, "üst poll sınırı");

using var reservation = new TcpListener(IPAddress.Loopback, 0);
reservation.Start();
var port = ((IPEndPoint)reservation.LocalEndpoint).Port;
reservation.Stop();
using var server = new HttpListener();
server.Prefixes.Add($"http://127.0.0.1:{port}/");
server.Start();
var info = new WakeInfo { StreamUrl = $"http://127.0.0.1:{port}/hik-bridge/stream", BridgeId = "test bridge", Ticket = "test+ticket" };
async Task SetWake(WakeInfo? next)
{
  factory.Body = JsonSerializer.Serialize(new RosterResponse { Ok = true, NextPollSeconds = 900, Wake = next });
  await manager.PollRosterAsync(CancellationToken.None);
}
await SetWake(info);
using var client = new WakeStreamClient(manager, options, NullLogger<WakeStreamClient>.Instance);
using var lifetime = new CancellationTokenSource(TimeSpan.FromSeconds(20));
var running = client.RunAsync(lifetime.Token);
var first = await server.GetContextAsync().WaitAsync(TimeSpan.FromSeconds(3));
Check(first.Request.QueryString["bridge"] == info.BridgeId && first.Request.QueryString["ticket"] == info.Ticket,
  "SSE parametreleri escape edilir");
Check(first.Request.UserAgent == ConvexBridgeClient.UserAgent && first.Request.Headers["Accept"] == "text/event-stream",
  "SSE User-Agent ve Accept");
first.Response.StatusCode = 401;
first.Response.Close();
var secondRequest = server.GetContextAsync();
await Task.Delay(1500);
Check(!secondRequest.IsCompleted && client.State == "kopuk", "401 aynı biletle tekrar bağlanmaz");
await SetWake(info);
await Task.Delay(100);
Check(!secondRequest.IsCompleted, "aynı roster 401 beklemesini kaldırmaz");
await SetWake(info with { Ticket = "new-ticket" });
var second = await secondRequest.WaitAsync(TimeSpan.FromSeconds(3));
Check(second.Request.QueryString["ticket"] == "new-ticket", "yeni bilet bağlantıyı yeniler");
second.Response.ContentType = "text/event-stream";
second.Response.SendChunked = true;
async Task Send(string value)
{
  await second.Response.OutputStream.WriteAsync(Encoding.UTF8.GetBytes(value));
  await second.Response.OutputStream.FlushAsync();
}
await Send("retry: 10000\n\nevent: rea");
await Task.Delay(30);
await Send("dy\r\ndata: {\"bridgeId\":\"test bridge\"}\r\n\r\n: ping\n\n");
Check(await client.Signal.WaitAsync(TimeSpan.FromSeconds(3), lifetime.Token)
  && client.State == "bağlı" && client.LastWakeAt is not null, "parçalı ready roster uyandırır");
await Send("event: wake\ndata: {\"ts\":1}\n\n");
Check(await client.Signal.WaitAsync(TimeSpan.FromSeconds(3), lifetime.Token), "wake roster uyandırır");
await SetWake(info);
var restored = await server.GetContextAsync().WaitAsync(TimeSpan.FromSeconds(3));
Check(restored.Request.QueryString["ticket"] == info.Ticket, "401→yeni bilet ready→eski bilete dönüş bağlanır");
restored.Response.Close();
await SetWake(null);
await Task.Delay(100);
Check(client.State == "kapalı", "wake null aktif bağlantıyı kapatır");
second.Response.Close();
await lifetime.CancelAsync();
await running.WaitAsync(TimeSpan.FromSeconds(2));
Check(client.State == "kapalı", "temiz kapanış");

await SetWake(info);
using var disabled = new WakeStreamClient(manager, Options.Create(new BridgeOptions { WakeStreamEnabled = false }),
  NullLogger<WakeStreamClient>.Instance);
using var disabledLifetime = new CancellationTokenSource(100);
await disabled.RunAsync(disabledLifetime.Token);
Check(disabled.State == "kapalı", "ayar kapalıyken bağlantı açılmaz");
// Gerçek worker döngüsü: sürekli iş dönse de yirminci turdan sonra emniyet beklemesine geçer.
var burstFactory = new RosterFactory
{
  Body = """{"ok":true,"operations":[{"opId":"test-op","deviceId":"missing-panel"}]}""",
};
var burstOptions = Options.Create(new BridgeOptions
{
  ConvexSiteUrl = "https://roster.invalid",
  BridgeToken = "test-token",
  WakeStreamEnabled = false,
  ConfigFile = "selftest-missing-config.json",
});
await using var burstManager = new PanelManager(runtime, burstFactory, burstOptions,
  NullLoggerFactory.Instance, NullLogger<PanelManager>.Instance);
using var burstWake = new WakeStreamClient(burstManager, burstOptions, NullLogger<WakeStreamClient>.Instance);
var localOptions = Options.Create(new LocalApiOptions { Enabled = false });
var store = new PanelConfigStore(burstOptions, NullLogger<PanelConfigStore>.Instance);
var local = new LocalConfigServer(store, burstManager, burstWake, localOptions, NullLogger<LocalConfigServer>.Instance);
using var worker = new BridgeWorker(store, burstManager, burstWake, local, burstOptions, localOptions,
  NullLogger<BridgeWorker>.Instance);
await worker.StartAsync(CancellationToken.None);
using (var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(26)))
{
  while (burstFactory.PollTimes.Count < 20) await Task.Delay(20, deadline.Token);
}
await Task.Delay(1200);
Check(burstFactory.PollTimes.Count == 20, "sürekli iş kuyruğu 20 turda sınırlanır");
var pollTimes = burstFactory.PollTimes.ToArray();
Check(pollTimes.Zip(pollTimes.Skip(1)).All(pair => Stopwatch.GetElapsedTime(pair.First, pair.Second)
  >= TimeSpan.FromMilliseconds(990)), "poll turları arasında en az bir saniye");
await worker.StopAsync(CancellationToken.None);
Check(worker.ExecuteTask?.IsCompletedSuccessfully == true, "worker ve stream birlikte temiz kapanır");
await AuditTests.Run(Check);
Console.WriteLine($"{checks} kontrol geçti.");

sealed class RosterFactory : IHttpClientFactory
{
  public ConcurrentQueue<long> PollTimes { get; } = new();
  public string Body { get; set; } = "{}";
  public string? UserAgent { get; private set; }
  public HttpClient CreateClient(string name) => new(new Handler(this));

  private sealed class Handler(RosterFactory owner) : HttpMessageHandler
  {
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
      owner.UserAgent = request.Headers.UserAgent.ToString();
      if (request.RequestUri?.AbsolutePath == "/hik-bridge/roster") owner.PollTimes.Enqueue(Stopwatch.GetTimestamp());
      return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
      {
        Content = new StringContent(owner.Body, Encoding.UTF8, "application/json"),
      });
    }
  }
}
