using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace NgAccess.HikvisionBridge.Services;

/// <summary>
/// 127.0.0.1'de yerel web sunucu:
///  - "/" ve diğer yollar → wwwroot içindeki ngsplus arayüzü (statik SPA, bulut Convex'e bağlanır).
///  - "/__bridge" → bridge ayar sayfası (site URL + bridge token + cihaz durum tablosu).
///  - "/__bridge/api/*" → bridge JSON API'si.
/// Tek-yer modeli: panel ekleme/IP/şifre YOK — paneller ngsplus'tan yönetilir, buluttan roster ile gelir.
/// </summary>
public sealed class LocalConfigServer
{
  private const string BridgePrefix = "/__bridge";
  private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

  private static readonly Dictionary<string, string> ContentTypes = new(StringComparer.OrdinalIgnoreCase)
  {
    [".html"] = "text/html; charset=utf-8",
    [".js"] = "text/javascript; charset=utf-8",
    [".mjs"] = "text/javascript; charset=utf-8",
    [".css"] = "text/css; charset=utf-8",
    [".json"] = "application/json; charset=utf-8",
    [".svg"] = "image/svg+xml",
    [".png"] = "image/png",
    [".jpg"] = "image/jpeg",
    [".jpeg"] = "image/jpeg",
    [".gif"] = "image/gif",
    [".ico"] = "image/x-icon",
    [".webp"] = "image/webp",
    [".woff"] = "font/woff",
    [".woff2"] = "font/woff2",
    [".ttf"] = "font/ttf",
    [".map"] = "application/json",
    [".txt"] = "text/plain; charset=utf-8",
    [".webmanifest"] = "application/manifest+json",
  };

  private readonly PanelConfigStore _store;
  private readonly PanelManager _manager;
  private readonly LocalApiOptions _options;
  private readonly ILogger<LocalConfigServer> _logger;
  private readonly string _webRoot;
  private HttpListener? _listener;

  public LocalConfigServer(
    PanelConfigStore store,
    PanelManager manager,
    IOptions<LocalApiOptions> options,
    ILogger<LocalConfigServer> logger)
  {
    _store = store;
    _manager = manager;
    _options = options.Value;
    _logger = logger;
    _webRoot = Path.Combine(AppContext.BaseDirectory, "wwwroot");
  }

  public async Task StartAsync(CancellationToken cancellationToken)
  {
    if (!_options.Enabled) return;
    var url = _options.Url.TrimEnd('/') + "/";
    _listener = new HttpListener();
    _listener.Prefixes.Add(url);
    _listener.Start();
    _logger.LogInformation("Local server listening on {Url} (ngsplus UI + köprü ayarı /__bridge)", url);
    if (!Directory.Exists(_webRoot))
    {
      _logger.LogWarning("wwwroot bulunamadı ({Path}); ngsplus arayüzü sunulamayacak", _webRoot);
    }

    while (!cancellationToken.IsCancellationRequested)
    {
      HttpListenerContext context;
      try { context = await _listener.GetContextAsync(); }
      catch (ObjectDisposedException) { return; }
      catch (HttpListenerException) { return; }
      _ = Task.Run(() => HandleAsync(context), cancellationToken);
    }
  }

  private async Task HandleAsync(HttpListenerContext context)
  {
    var req = context.Request;
    var res = context.Response;
    try
    {
      var method = req.HttpMethod;
      var path = req.Url?.AbsolutePath ?? "/";

      if (path == BridgePrefix || path == BridgePrefix + "/")
      {
        await HtmlAsync(res, BridgeHtml);
        return;
      }
      if (path.StartsWith(BridgePrefix + "/api", StringComparison.Ordinal))
      {
        await HandleBridgeApiAsync(method, path, req, res);
        return;
      }

      if (method == "GET" || method == "HEAD")
      {
        await ServeStaticAsync(path, res);
        return;
      }

      await JsonAsync(res, new { ok = false, error = "not found" }, 404);
    }
    catch (Exception ex)
    {
      _logger.LogWarning(ex, "Request failed");
      try { await JsonAsync(res, new { ok = false, error = "system error" }, 500); }
      catch { /* response may be closed */ }
    }
  }

  private async Task HandleBridgeApiAsync(string method, string path, HttpListenerRequest req, HttpListenerResponse res)
  {
    var rest = path[(BridgePrefix.Length)..];
    var segments = rest.Trim('/').Split('/', StringSplitOptions.RemoveEmptyEntries); // [api, ...]

    if (method == "GET" && segments is ["api", "config"])
    {
      var config = _store.Load();
      var devices = _manager.GetStatuses();
      await JsonAsync(res, new
      {
        convexSiteUrl = config.ConvexSiteUrl,
        hasToken = !string.IsNullOrWhiteSpace(config.BridgeToken),
        rosterError = _manager.LastRosterError,
        devices,
      });
      return;
    }

    if (method == "POST" && segments is ["api", "config"])
    {
      var body = await ReadJsonAsync<ConfigBody>(req);
      var config = _store.Load();
      if (!string.IsNullOrWhiteSpace(body?.ConvexSiteUrl)) config.ConvexSiteUrl = body.ConvexSiteUrl.Trim();
      // Boş token gönderilirse mevcut korunur (UI token'ı düzenlemede göstermez).
      if (!string.IsNullOrWhiteSpace(body?.BridgeToken)) config.BridgeToken = body.BridgeToken.Trim();
      _store.Save(config);
      _manager.Configure(config.ConvexSiteUrl, config.BridgeToken);
      await JsonAsync(res, new { ok = true });
      return;
    }

    if (method == "POST" && segments is ["api", "panels", var testId, "test"])
    {
      var result = await _manager.TestAsync(testId);
      await JsonAsync(res, new { ok = result.Ok, error = result.Error }, result.Ok ? 200 : 400);
      return;
    }

    if (method == "POST" && segments is ["api", "panels", var doorDeviceId, "door", var doorStr]
        && int.TryParse(doorStr, out var doorNo))
    {
      var result = await _manager.OpenDoorAsync(doorDeviceId, doorNo);
      await JsonAsync(res, new { ok = result.Ok, error = result.Error }, result.Ok ? 200 : 400);
      return;
    }

    await JsonAsync(res, new { ok = false, error = "not found" }, 404);
  }

  private async Task ServeStaticAsync(string path, HttpListenerResponse res)
  {
    if (!Directory.Exists(_webRoot))
    {
      await HtmlAsync(res,
        "<h2>ngsplus arayüzü paketlenmemiş</h2><p>wwwroot klasörü yok. Köprü ayarları: <a href=\"/__bridge\">/__bridge</a></p>",
        404);
      return;
    }

    var relative = path.Trim('/');
    if (string.IsNullOrEmpty(relative)) relative = "index.html";

    var full = Path.GetFullPath(Path.Combine(_webRoot, relative));
    var rootFull = Path.GetFullPath(_webRoot);
    if (!full.StartsWith(rootFull, StringComparison.Ordinal) || !File.Exists(full))
    {
      full = Path.Combine(rootFull, "index.html");
      if (!File.Exists(full))
      {
        await JsonAsync(res, new { ok = false, error = "not found" }, 404);
        return;
      }
    }

    var ext = Path.GetExtension(full);
    res.StatusCode = 200;
    res.ContentType = ContentTypes.TryGetValue(ext, out var ct) ? ct : "application/octet-stream";
    var bytes = await File.ReadAllBytesAsync(full);
    res.ContentLength64 = bytes.Length;
    await res.OutputStream.WriteAsync(bytes);
    res.Close();
  }

  private static async Task<T?> ReadJsonAsync<T>(HttpListenerRequest req)
  {
    using var reader = new StreamReader(req.InputStream, req.ContentEncoding);
    var text = await reader.ReadToEndAsync();
    return string.IsNullOrWhiteSpace(text) ? default : JsonSerializer.Deserialize<T>(text, JsonOpts);
  }

  private static async Task JsonAsync(HttpListenerResponse response, object body, int status = 200)
  {
    response.StatusCode = status;
    response.ContentType = "application/json";
    var bytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(body));
    response.ContentLength64 = bytes.Length;
    await response.OutputStream.WriteAsync(bytes);
    response.Close();
  }

  private static async Task HtmlAsync(HttpListenerResponse response, string html, int status = 200)
  {
    response.StatusCode = status;
    response.ContentType = "text/html; charset=utf-8";
    var bytes = Encoding.UTF8.GetBytes(html);
    response.ContentLength64 = bytes.Length;
    await response.OutputStream.WriteAsync(bytes);
    response.Close();
  }

  private sealed class ConfigBody
  {
    public string? ConvexSiteUrl { get; set; }
    public string? BridgeToken { get; set; }
  }

  private const string BridgeHtml =
"""
<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NGS Access Bridge — Ayarlar</title>
<style>
 body{font-family:system-ui,Segoe UI,sans-serif;margin:0;background:#0f1115;color:#e6e6e6}
 header{padding:16px 20px;background:#161a22;border-bottom:1px solid #2a2f3a;display:flex;justify-content:space-between;align-items:center}
 h1{font-size:18px;margin:0}
 h3{margin:0 0 8px}
 a{color:#7db4ff}
 .wrap{max-width:1040px;margin:0 auto;padding:20px}
 .card{background:#161a22;border:1px solid #2a2f3a;border-radius:10px;padding:16px;margin-bottom:16px}
 .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
 table{width:100%;border-collapse:collapse;margin-top:8px}
 th,td{text-align:left;padding:8px;border-bottom:1px solid #2a2f3a;font-size:14px;vertical-align:middle}
 th{color:#9aa0aa;font-weight:500}
 .badge{padding:2px 8px;border-radius:10px;font-size:12px}
 .ok{background:#0f5132;color:#7be0a0}.err{background:#5c1a1a;color:#f0a0a0}.idle{background:#30343d;color:#bbb}
 input,button{font-size:14px;padding:6px 9px;border-radius:6px;border:1px solid #2a2f3a;background:#1b2029;color:#e6e6e6}
 button{cursor:pointer;background:#2563eb;border-color:#2563eb}
 button.sec{background:#2a2f3a;border-color:#2a2f3a}
 label{display:block;font-size:12px;color:#9aa0aa;margin:8px 0 2px}
 .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
 .muted{color:#9aa0aa;font-size:12px}
</style>
</head>
<body>
<header><h1>Kopru — Ayarlar</h1><a href="/">← ngsplus arayuzune don</a></header>
<div class="wrap">
 <div class="card">
   <h3>Baglanti</h3>
   <div class="grid">
     <div><label>Convex Site URL</label><input id="url" placeholder="https://....convex.site"></div>
     <div><label>Bridge Token <span class="muted">(bos = degistirme)</span></label><input id="token" type="password" placeholder="ngsplus Ayarlar > Bridge"></div>
   </div>
   <div class="row" style="margin-top:12px"><button onclick="saveCfg()">Kaydet</button><span id="tokenState" class="muted"></span></div>
   <div id="msg" class="muted" style="margin-top:8px"></div>
 </div>
 <div class="card">
   <h3>Paneller <span class="muted">(ngsplus'tan yonetilir — buradan eklenmez)</span></h3>
   <div id="rosterErr" class="muted"></div>
   <table><thead><tr><th>Ad</th><th>Adres</th><th>Kapi</th><th>Durum</th><th>Son event</th><th></th></tr></thead><tbody id="rows"></tbody></table>
 </div>
 <p class="muted">Panel IP/sifre/kapi ngsplus cihaz formunda girilir; bridge bunlari token ile otomatik ceker.</p>
</div>
<script>
const B='/__bridge';
async function api(p,o){const r=await fetch(B+p,o);try{return await r.json()}catch(e){return{ok:r.ok}}}
function badge(s){const m={connected:'ok',error:'err',connecting:'idle',stopped:'idle'};return '<span class="badge '+(m[s.state]||'idle')+'">'+s.state+(s.panelLoggedIn?' · login':'')+'</span>'}
function fmt(t){return t?new Date(t).toLocaleTimeString('tr-TR'):'-'}
function esc(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function g(id){return document.getElementById(id)}
async function load(){
  const c=await api('/api/config');
  g('url').value=c.convexSiteUrl||'';
  g('tokenState').textContent=c.hasToken?'Token girili.':'Token henuz girilmedi.';
  g('rosterErr').innerHTML=c.rosterError?('<span class="badge err">roster: '+esc(c.rosterError)+'</span>'):'';
  const rows=g('rows');rows.innerHTML='';
  (c.devices||[]).forEach(p=>{
    const tr=document.createElement('tr');
    tr.innerHTML='<td>'+esc(p.name||'-')+'</td>'
      +'<td>'+esc(p.host)+':'+p.port+'</td><td>'+p.doorCount+'</td>'
      +'<td>'+badge(p)+(p.lastError?' <span class="muted">'+esc(p.lastError)+'</span>':'')+'</td>'
      +'<td>'+fmt(p.lastEventAt)+'</td>'
      +'<td class="row">'
      +'<button class="sec" onclick="test(\''+p.deviceId+'\')">Test</button>'
      +'<button class="sec" onclick="openDoor(\''+p.deviceId+'\')">Kapi</button>'
      +'</td>';
    rows.appendChild(tr);
  });
  if(!(c.devices||[]).length) rows.innerHTML='<tr><td colspan="6" class="muted">Henuz panel yok. ngsplus\\'ta localBridge cihazi ekleyin.</td></tr>';
}
async function saveCfg(){
  const body={convexSiteUrl:g('url').value,bridgeToken:g('token').value};
  const r=await api('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  g('msg').textContent=r.ok?'Kaydedildi.':'Hata: '+(r.error||'?');g('token').value='';load();
}
async function test(id){g('msg').textContent='Test ediliyor...';const r=await api('/api/panels/'+id+'/test',{method:'POST'});g('msg').textContent=r.ok?'Baglanti OK':'Hata: '+(r.error||'?')}
async function openDoor(id){const r=await api('/api/panels/'+id+'/door/1',{method:'POST'});g('msg').textContent=r.ok?'Kapi komutu gonderildi':'Hata: '+(r.error||'?')}
load();setInterval(load,5000);
</script>
</body>
</html>
""";
}
