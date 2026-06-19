using System.Text.Json.Serialization;

namespace NgAccess.HikvisionBridge;

/// <summary>
/// /hik-bridge/roster cevabı: bu projedeki tüm localBridge cihazları + bekleyen işler.
/// Tek-yer modeli — panel bilgileri buluttan gelir, bridge'de panel listesi tutulmaz.
/// </summary>
public sealed class RosterResponse
{
  [JsonPropertyName("ok")]
  public bool Ok { get; init; }

  [JsonPropertyName("error")]
  public string? Error { get; init; }

  [JsonPropertyName("devices")]
  public List<RosterDevice> Devices { get; init; } = [];

  [JsonPropertyName("operations")]
  public List<BridgeOperation> Operations { get; init; } = [];
}

/// <summary>Roster'dan gelen tek bir panelin bağlantı bilgileri (buluttan).</summary>
public sealed class RosterDevice
{
  [JsonPropertyName("deviceId")]
  public string DeviceId { get; init; } = "";

  [JsonPropertyName("name")]
  public string Name { get; init; } = "";

  [JsonPropertyName("host")]
  public string Host { get; init; } = "";

  // int (ushort değil): aralık dışı bir port tek başına TÜM roster deserializasyonunu
  // patlatıp tüm panelleri düşürürdü. PanelConfig.FromRoster güvenli aralığa clamp'ler.
  [JsonPropertyName("port")]
  public int Port { get; init; } = 8000;

  [JsonPropertyName("username")]
  public string Username { get; init; } = "admin";

  [JsonPropertyName("password")]
  public string Password { get; init; } = "";

  [JsonPropertyName("doorCount")]
  public int DoorCount { get; init; } = 4;

  /// <summary>Kart-okutma event'lerini /card-reader'a basmak için per-device token.</summary>
  [JsonPropertyName("apiToken")]
  public string ApiToken { get; init; } = "";
}

public sealed class BridgeOperation
{
  [JsonPropertyName("opId")]
  public string OpId { get; init; } = "";

  [JsonPropertyName("deviceId")]
  public string DeviceId { get; init; } = "";

  [JsonPropertyName("operation")]
  public string Operation { get; init; } = "";

  [JsonPropertyName("payload")]
  public OperationPayload Payload { get; init; } = new();

  [JsonPropertyName("attemptCount")]
  public int AttemptCount { get; init; }
}

public sealed class OperationPayload
{
  [JsonPropertyName("employeeId")]
  public string? EmployeeId { get; init; }

  [JsonPropertyName("accessRuleId")]
  public string? AccessRuleId { get; init; }

  [JsonPropertyName("employeeNo")]
  public string? EmployeeNo { get; init; }

  [JsonPropertyName("cardNumber")]
  public string? CardNumber { get; init; }

  [JsonPropertyName("name")]
  public string? Name { get; init; }

  [JsonPropertyName("planTemplateNo")]
  public int? PlanTemplateNo { get; init; }

  [JsonPropertyName("weekPlanNo")]
  public int? WeekPlanNo { get; init; }

  [JsonPropertyName("templateName")]
  public string? TemplateName { get; init; }

  [JsonPropertyName("doorNo")]
  public int? DoorNo { get; init; }

  [JsonPropertyName("doorCount")]
  public int? DoorCount { get; init; }

  [JsonPropertyName("doorRights")]
  public List<int>? DoorRights { get; init; }

  [JsonPropertyName("schedule")]
  public List<WeekPlanSegment>? Schedule { get; init; }
}

public sealed class WeekPlanSegment
{
  [JsonPropertyName("week")]
  public string Week { get; init; } = "";

  [JsonPropertyName("beginTime")]
  public string BeginTime { get; init; } = "00:00:00";

  [JsonPropertyName("endTime")]
  public string EndTime { get; init; } = "24:00:00";
}

public sealed class CardReaderEventPayload
{
  [JsonPropertyName("cardNo")]
  public string CardNo { get; init; } = "";

  // "ipAddress": parseCardReaderBody IP'yi yalnız ipAddress/ip/IP anahtarlarından okur;
  // "deviceIp" anahtarı parse edilmez → cihaz eşleşmesi/lastSeen çalışmazdı.
  [JsonPropertyName("ipAddress")]
  public string DeviceIp { get; init; } = "";

  [JsonPropertyName("serialNumber")]
  public string? SerialNumber { get; init; }

  [JsonPropertyName("majorEventType")]
  public uint MajorEventType { get; init; }

  [JsonPropertyName("subEventType")]
  public uint SubEventType { get; init; }

  [JsonPropertyName("dateTime")]
  public string DateTime { get; init; } = "";

  [JsonPropertyName("doorNo")]
  public uint DoorNo { get; init; }
}

public sealed record SdkResult(bool Ok, string? Error = null)
{
  public static SdkResult Success() => new(true);
  public static SdkResult Failure(string error) => new(false, error);
}

/// <summary>
/// Tek panelin runtime bağlantı ayarı. Roster'dan (buluttan) türetilir; artık
/// panels.json'da saklanmaz. DeviceToken = cihazın /card-reader apiToken'ı.
/// </summary>
public sealed class PanelConfig
{
  public string Id { get; set; } = "";
  public string Name { get; set; } = "";
  public string Host { get; set; } = "";
  public ushort Port { get; set; } = 8000;
  public string Username { get; set; } = "admin";
  public string Password { get; set; } = "";
  public string DeviceToken { get; set; } = "";
  public int DoorCount { get; set; } = 4;
  public bool Enabled { get; set; } = true;

  public static PanelConfig FromRoster(RosterDevice d) => new()
  {
    Id = d.DeviceId,
    Name = d.Name,
    Host = d.Host,
    Port = (ushort)Math.Clamp(d.Port, 1, 65535),
    Username = string.IsNullOrWhiteSpace(d.Username) ? "admin" : d.Username,
    Password = d.Password,
    DeviceToken = d.ApiToken,
    DoorCount = d.DoorCount <= 0 ? 4 : d.DoorCount,
    Enabled = true,
  };
}

/// <summary>Bridge'in tüm yerel ayarı: site Convex URL'i + bridge token (tek-yer modeli).</summary>
public sealed class BridgeConfig
{
  [JsonPropertyName("convexSiteUrl")] public string ConvexSiteUrl { get; set; } = "";
  [JsonPropertyName("bridgeToken")] public string BridgeToken { get; set; } = "";
}

/// <summary>UI'a dönen anlık panel durumu (şifre/token içermez).</summary>
public sealed class PanelStatus
{
  [JsonPropertyName("deviceId")] public string DeviceId { get; init; } = "";
  [JsonPropertyName("name")] public string Name { get; init; } = "";
  [JsonPropertyName("host")] public string Host { get; init; } = "";
  [JsonPropertyName("port")] public ushort Port { get; init; }
  [JsonPropertyName("doorCount")] public int DoorCount { get; init; }
  [JsonPropertyName("state")] public string State { get; init; } = "stopped";
  [JsonPropertyName("panelLoggedIn")] public bool PanelLoggedIn { get; init; }
  [JsonPropertyName("lastError")] public string? LastError { get; init; }
  [JsonPropertyName("lastEventAt")] public string? LastEventAt { get; init; }
}

/// <summary>Runtime'ın çözüp panel handler'ına ilettiği kart-okutma olayı.</summary>
public sealed class AcsEvent
{
  public string CardNo { get; init; } = "";
  public uint DoorNo { get; init; }
  public uint Major { get; init; }
  public uint Minor { get; init; }
  public string DateTime { get; init; } = "";
}
