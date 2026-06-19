namespace NgAccess.HikvisionBridge;

/// <summary>
/// Kurulum seviyesi ayarlar (appsettings.json). Tek-yer modeli: panel bilgileri buluttan
/// gelir; yerel config (bridge.json) yalnız site Convex URL'i + bridge token tutar.
/// </summary>
public sealed class BridgeOptions
{
  public string SdkDllDirectory { get; init; } = "hikvision-sdk/win-x64";
  /// <summary>Varsayılan site Convex URL'i; yerel config'teki değer öncelikli.</summary>
  public string ConvexSiteUrl { get; init; } = "";
  /// <summary>Varsayılan bridge token; yerel config'teki değer öncelikli (UI'dan girilir).</summary>
  public string BridgeToken { get; init; } = "";
  public int PollIntervalSeconds { get; init; } = 3;
  public int PollMaxOperations { get; init; } = 10;
  /// <summary>Yerel ayar dosyası (exe yanında ya da mutlak yol): convexSiteUrl + bridgeToken.</summary>
  public string ConfigFile { get; init; } = "bridge.json";
}

public sealed class LocalApiOptions
{
  public bool Enabled { get; init; } = true;
  public string Url { get; init; } = "http://127.0.0.1:8787";
}
