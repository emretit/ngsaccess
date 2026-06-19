using System.Text.Json;
using Microsoft.Extensions.Options;

namespace NgAccess.HikvisionBridge.Services;

/// <summary>
/// panels.json yükle/kaydet (yerel; panel IP/şifre/token burada, buluta gitmez).
/// Thread-safe; UI düzenleyince Save + PanelManager.ApplyConfig çağrılır.
/// </summary>
public sealed class PanelConfigStore
{
  private static readonly JsonSerializerOptions WriteOptions = new() { WriteIndented = true };

  private readonly string _path;
  private readonly string _defaultSiteUrl;
  private readonly ILogger<PanelConfigStore> _logger;
  private readonly object _lock = new();

  public PanelConfigStore(IOptions<BridgeOptions> options, ILogger<PanelConfigStore> logger)
  {
    var o = options.Value;
    _path = Path.IsPathRooted(o.ConfigFile)
      ? o.ConfigFile
      : Path.Combine(AppContext.BaseDirectory, o.ConfigFile);
    _defaultSiteUrl = o.ConvexSiteUrl;
    _logger = logger;
  }

  public string ConfigPath => _path;

  public BridgeConfig Load()
  {
    lock (_lock)
    {
      if (!File.Exists(_path))
      {
        return new BridgeConfig { ConvexSiteUrl = _defaultSiteUrl };
      }
      try
      {
        var config = JsonSerializer.Deserialize<BridgeConfig>(File.ReadAllText(_path)) ?? new BridgeConfig();
        if (string.IsNullOrWhiteSpace(config.ConvexSiteUrl)) config.ConvexSiteUrl = _defaultSiteUrl;
        return config;
      }
      catch (Exception ex)
      {
        _logger.LogError(ex, "panels.json okunamadı ({Path}); boş config ile devam", _path);
        return new BridgeConfig { ConvexSiteUrl = _defaultSiteUrl };
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
