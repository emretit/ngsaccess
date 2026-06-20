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
  /// <summary>Boşta (op/cihaz değişikliği yokken) poll aralığı tabanı; aktivite olunca buraya döner.</summary>
  public int PollIntervalSeconds { get; init; } = 3;
  /// <summary>Boşta backoff tavanı: ardışık boş turlarda aralık 2x büyür, bu değerde durur.
  /// Boş roster çağrılarını (function-call maliyeti) seyreltir. Uzaktan kapı-aç komutu boşken
  /// en fazla bu kadar gecikir; kart okuma SDK callback ile anında relay edildiğinden etkilenmez.</summary>
  public int PollMaxIntervalSeconds { get; init; } = 30;
  public int PollMaxOperations { get; init; } = 10;
  /// <summary>Yerel ayar dosyası (exe yanında ya da mutlak yol): convexSiteUrl + bridgeToken.</summary>
  public string ConfigFile { get; init; } = "bridge.json";
}

public sealed class LocalApiOptions
{
  public bool Enabled { get; init; } = true;
  public string Url { get; init; } = "http://127.0.0.1:8787";
}
