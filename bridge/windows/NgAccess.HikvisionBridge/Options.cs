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
  /// <summary>Eski sunucularda emniyet poll aralığı.</summary>
  public int PollIntervalSeconds { get; init; } = 900;
  public int PollMaxIntervalSeconds { get; init; } = 900;
  public bool WakeStreamEnabled { get; init; } = true;
  public int PollMaxOperations { get; init; } = 25;
  /// <summary>Sabit kayan saat tavanı; yapılandırmayla yükseltilemez.</summary>
  public const int PollMaxPerHour = 240;
  /// <summary>Yerel ayar dosyası (exe yanında ya da mutlak yol): convexSiteUrl + bridgeToken.</summary>
  public string ConfigFile { get; init; } = "bridge.json";
}

public sealed class LocalApiOptions
{
  public bool Enabled { get; init; } = true;
  public string Url { get; init; } = "http://127.0.0.1:8787";
}
