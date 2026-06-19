using System.Text.Json;
using Microsoft.Extensions.Options;

namespace NgAccess.HikvisionBridge.Services;

/// <summary>
/// Yerel bridge ayarı (bridge.json) yükle/kaydet: site Convex URL'i + bridge token.
/// Tek-yer modeli — panel IP/şifre artık burada DEĞİL, buluttan roster ile gelir.
/// Thread-safe; UI ayarı düzenleyince Save çağrılır.
/// </summary>
public sealed class PanelConfigStore
{
  private static readonly JsonSerializerOptions WriteOptions = new() { WriteIndented = true };

  private readonly string _path;
  private readonly string _defaultSiteUrl;
  private readonly string _defaultBridgeToken;
  private readonly ILogger<PanelConfigStore> _logger;
  private readonly object _lock = new();

  public PanelConfigStore(IOptions<BridgeOptions> options, ILogger<PanelConfigStore> logger)
  {
    var o = options.Value;
    _path = Path.IsPathRooted(o.ConfigFile)
      ? o.ConfigFile
      : Path.Combine(AppContext.BaseDirectory, o.ConfigFile);
    _defaultSiteUrl = o.ConvexSiteUrl;
    _defaultBridgeToken = o.BridgeToken;
    _logger = logger;
  }

  public string ConfigPath => _path;

  public BridgeConfig Load()
  {
    lock (_lock)
    {
      if (!File.Exists(_path))
      {
        return new BridgeConfig { ConvexSiteUrl = _defaultSiteUrl, BridgeToken = _defaultBridgeToken };
      }
      try
      {
        var config = JsonSerializer.Deserialize<BridgeConfig>(File.ReadAllText(_path)) ?? new BridgeConfig();
        if (string.IsNullOrWhiteSpace(config.ConvexSiteUrl)) config.ConvexSiteUrl = _defaultSiteUrl;
        if (string.IsNullOrWhiteSpace(config.BridgeToken)) config.BridgeToken = _defaultBridgeToken;
        return config;
      }
      catch (Exception ex)
      {
        _logger.LogError(ex, "bridge.json okunamadı ({Path}); varsayılan config ile devam", _path);
        return new BridgeConfig { ConvexSiteUrl = _defaultSiteUrl, BridgeToken = _defaultBridgeToken };
      }
    }
  }

  public void Save(BridgeConfig config)
  {
    lock (_lock)
    {
      File.WriteAllText(_path, JsonSerializer.Serialize(config, WriteOptions));
    }
  }
}
