using System.Text.Json.Serialization;

namespace NgAccess.HikvisionBridge;

public sealed class BridgePollResponse
{
  [JsonPropertyName("ok")]
  public bool Ok { get; init; }

  [JsonPropertyName("error")]
  public string? Error { get; init; }

  [JsonPropertyName("device")]
  public BridgeDevice? Device { get; init; }

  [JsonPropertyName("operations")]
  public List<BridgeOperation> Operations { get; init; } = [];
}

public sealed class BridgeDevice
{
  [JsonPropertyName("deviceId")]
  public string DeviceId { get; init; } = "";

  [JsonPropertyName("name")]
  public string Name { get; init; } = "";

  [JsonPropertyName("deviceIp")]
  public string? DeviceIp { get; init; }

  [JsonPropertyName("deviceSerial")]
  public string? DeviceSerial { get; init; }

  [JsonPropertyName("hikDoorCount")]
  public int? HikDoorCount { get; init; }
}

public sealed class BridgeOperation
{
  [JsonPropertyName("opId")]
  public string OpId { get; init; } = "";

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

  [JsonPropertyName("deviceIp")]
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

/// <summary>Tek panelin yerel ayarı (panels.json içinde saklanır; buluta gitmez).</summary>
public sealed class PanelConfig
{
  [JsonPropertyName("id")] public string Id { get; set; } = "";
  [JsonPropertyName("name")] public string Name { get; set; } = "";
  [JsonPropertyName("host")] public string Host { get; set; } = "";
  [JsonPropertyName("port")] public ushort Port { get; set; } = 8000;
  [JsonPropertyName("username")] public string Username { get; set; } = "admin";
  [JsonPropertyName("password")] public string Password { get; set; } = "";
  [JsonPropertyName("deviceToken")] public string DeviceToken { get; set; } = "";
  [JsonPropertyName("doorCount")] public int DoorCount { get; set; } = 4;
  [JsonPropertyName("enabled")] public bool Enabled { get; set; } = true;
}

/// <summary>Bridge'in tüm yerel ayarı: site Convex URL'i + panel listesi.</summary>
public sealed class BridgeConfig
{
  [JsonPropertyName("convexSiteUrl")] public string ConvexSiteUrl { get; set; } = "";
  [JsonPropertyName("panels")] public List<PanelConfig> Panels { get; set; } = [];
}

/// <summary>UI'a dönen anlık panel durumu (şifre/token içermez).</summary>
public sealed class PanelStatus
{
  [JsonPropertyName("id")] public string Id { get; init; } = "";
  [JsonPropertyName("name")] public string Name { get; init; } = "";
  [JsonPropertyName("host")] public string Host { get; init; } = "";
  [JsonPropertyName("port")] public ushort Port { get; init; }
  [JsonPropertyName("doorCount")] public int DoorCount { get; init; }
  [JsonPropertyName("enabled")] public bool Enabled { get; init; }
  [JsonPropertyName("hasPassword")] public bool HasPassword { get; init; }
  [JsonPropertyName("hasToken")] public bool HasToken { get; init; }
  [JsonPropertyName("state")] public string State { get; init; } = "stopped";
  [JsonPropertyName("panelLoggedIn")] public bool PanelLoggedIn { get; init; }
  [JsonPropertyName("lastError")] public string? LastError { get; init; }
  [JsonPropertyName("lastPollAt")] public string? LastPollAt { get; init; }
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
