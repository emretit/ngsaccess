namespace NgAccess.HikvisionBridge;

/// <summary>
/// Kurulum seviyesi ayarlar (appsettings.json). Panel listesi burada DEĞİL — o, UI'dan
/// düzenlenen panels.json'da (yerel, buluta gitmez).
/// </summary>
public sealed class BridgeOptions
{
  public string SdkDllDirectory { get; init; } = "hikvision-sdk/win-x64";
  /// <summary>Varsayılan site Convex URL'i; panels.json'daki değer öncelikli.</summary>
  public string ConvexSiteUrl { get; init; } = "";
  public int PollIntervalSeconds { get; init; } = 3;
  public int PollMaxOperations { get; init; } = 10;
  /// <summary>Panel listesi dosyası (exe yanında ya da mutlak yol).</summary>
  public string ConfigFile { get; init; } = "panels.json";
}

public sealed class LocalApiOptions
{
  public bool Enabled { get; init; } = true;
  public string Url { get; init; } = "http://127.0.0.1:8787";
}
