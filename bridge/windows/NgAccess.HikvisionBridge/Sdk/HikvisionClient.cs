using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using static NgAccess.HikvisionBridge.Sdk.HikvisionNative;

namespace NgAccess.HikvisionBridge.Sdk;

/// <summary>
/// Panel başına bir instance. Bu panelin SDK login'i + alarm kanalı + komutlarını yönetir.
/// SDK init/cleanup ve global mesaj callback'i HikvisionSdkRuntime'da (süreç-genel).
/// `unsafe` yalnız pointer kullanan senkron metotlarda; async metotlar kilidi alıp onları çağırır.
/// </summary>
public sealed class HikvisionClient : IAsyncDisposable
{
  private static readonly string[] WeekdayNames =
    ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  private readonly PanelConfig _panel;
  private readonly HikvisionSdkRuntime _runtime;
  private readonly string _sdkDllDirectory;
  private readonly ILogger _logger;
  private readonly SemaphoreSlim _sdkLock = new(1, 1);
  private RemoteConfigCallback? _activeRemoteConfigCallback;
  private int _userId = -1;
  private int _alarmHandle = -1;
  private bool _disposed;

  public HikvisionClient(PanelConfig panel, HikvisionSdkRuntime runtime, string sdkDllDirectory, ILogger logger)
  {
    _panel = panel;
    _runtime = runtime;
    _sdkDllDirectory = sdkDllDirectory;
    _logger = logger;
  }

  public event Action<AcsEvent>? CardEventReceived;

  public bool IsLoggedIn => _userId >= 0;

  public async Task<SdkResult> EnsureConnectedAsync(CancellationToken cancellationToken)
  {
    await _sdkLock.WaitAsync(cancellationToken);
    try { return ConnectInsideLock(); }
    finally { _sdkLock.Release(); }
  }

  public async Task<SdkResult> OpenDoorAsync(int doorNo, CancellationToken cancellationToken)
  {
    await _sdkLock.WaitAsync(cancellationToken);
    try
    {
      var connected = ConnectInsideLock();
      if (!connected.Ok) return connected;
      return OpenDoorInsideLock(doorNo);
    }
    finally { _sdkLock.Release(); }
  }

  public async Task<SdkResult> ExecuteOperationAsync(BridgeOperation operation, CancellationToken cancellationToken)
  {
    await _sdkLock.WaitAsync(cancellationToken);
    try
    {
      var connected = ConnectInsideLock();
      if (!connected.Ok) return connected;

      return operation.Operation switch
      {
        "syncWeekPlan" => PutWeekPlan(operation.Payload),
        "addPerson" or "updatePerson" or "addCard" => SetCard(operation.Payload),
        "deletePerson" or "deleteCard" => DeleteCard(operation.Payload),
        "openDoor" => OpenDoorInsideLock(operation.Payload.DoorNo ?? 1),
        "addFace" or "deleteFace" or "addFingerprint" or "deleteFingerprint" =>
          SdkResult.Failure($"{operation.Operation} is deferred for DS-K2804 bridge v1"),
        _ => SdkResult.Failure($"Unknown operation {operation.Operation}"),
      };
    }
    finally { _sdkLock.Release(); }
  }

  /// <summary>Panele login (gerekirse) + alarm kanalı. Caller _sdkLock'u tutuyor olmalı.</summary>
  private unsafe SdkResult ConnectInsideLock()
  {
    if (_disposed) return SdkResult.Failure("client disposed");
    if (_userId >= 0) return SdkResult.Success();
    if (string.IsNullOrWhiteSpace(_panel.Password))
    {
      return SdkResult.Failure($"[{_panel.Name}] panel password is empty");
    }

    _runtime.EnsureInitialized(_sdkDllDirectory);

    var login = new NET_DVR_USER_LOGIN_INFO
    {
      wPort = _panel.Port,
      bUseAsynLogin = 0,
      byLoginMode = 0,
    };
    // Lokal struct'ın fixed-buffer'ı zaten sabit (stack) → doğrudan pointer, `fixed` yok (CS0213).
    WriteFixed(login.sDeviceAddress, 129, _panel.Host);
    WriteFixed(login.sUserName, 64, _panel.Username);
    WriteFixed(login.sPassword, 64, _panel.Password);

    var info = new NET_DVR_DEVICEINFO_V40();
    _userId = NET_DVR_Login_V40(ref login, ref info);
    if (_userId < 0)
    {
      return SdkResult.Failure($"NET_DVR_Login_V40 failed: {NET_DVR_GetLastError()}");
    }
    _logger.LogInformation("[{Panel}] logged in {Host}:{Port}", _panel.Name, _panel.Host, _panel.Port);

    _runtime.RegisterHandler(_userId, ev => CardEventReceived?.Invoke(ev));

    var armed = StartAlarmChannel();
    if (!armed.Ok) _logger.LogWarning("[{Panel}] alarm channel not armed: {Error}", _panel.Name, armed.Error);
    return SdkResult.Success();
  }

  private SdkResult StartAlarmChannel()
  {
    if (_alarmHandle >= 0) return SdkResult.Success();
    var setup = new NET_DVR_SETUPALARM_PARAM_V50
    {
      dwSize = (uint)Marshal.SizeOf<NET_DVR_SETUPALARM_PARAM_V50>(),
      // byAlarmInfoType ACS için anlamsız (ANPR/trafik bayrağı); kart event'i COMM_ALARM_ACS ile
      // bu alandan bağımsız gelir. Resmî ACS örneği yalnız dwSize set eder.
      byLevel = 1,
    };
    var subscription = Encoding.UTF8.GetBytes(
      "<SubscribeEvent version=\"2.0\"><eventMode>all</eventMode></SubscribeEvent>");
    var ptr = Marshal.AllocHGlobal(subscription.Length + 1);
    try
    {
      Marshal.Copy(subscription, 0, ptr, subscription.Length);
      Marshal.WriteByte(ptr + subscription.Length, 0);
      _alarmHandle = NET_DVR_SetupAlarmChan_V50(_userId, ref setup, ptr, (uint)subscription.Length);
    }
    finally
    {
      Marshal.FreeHGlobal(ptr);
    }
    return _alarmHandle >= 0
      ? SdkResult.Success()
      : SdkResult.Failure($"NET_DVR_SetupAlarmChan_V50 failed: {NET_DVR_GetLastError()}");
  }

  private SdkResult OpenDoorInsideLock(int doorNo)
  {
    if (doorNo < 1 || doorNo > Math.Max(1, _panel.DoorCount))
    {
      return SdkResult.Failure($"Invalid doorNo {doorNo}");
    }
    var ok = NET_DVR_ControlGateway(_userId, doorNo, 1);
    return ok ? SdkResult.Success() : SdkResult.Failure($"NET_DVR_ControlGateway failed: {NET_DVR_GetLastError()}");
  }

  private SdkResult PutWeekPlan(OperationPayload payload)
  {
    if (payload.WeekPlanNo is not { } weekPlanNo)
    {
      return SdkResult.Failure("weekPlanNo missing");
    }
    var segments = BuildWeekPlanSegments(payload.Schedule ?? []);
    var weekBody = new
    {
      UserRightWeekPlanCfg = new
      {
        enable = true,
        WeekPlanCfg = segments,
      },
    };
    var weekResult = StdXmlPut(
      $"/ISAPI/AccessControl/UserRightWeekPlanCfg/{weekPlanNo}?format=json",
      weekBody);
    if (!weekResult.Ok) return weekResult;

    var templateBody = new
    {
      UserRightPlanTemplate = new
      {
        enable = true,
        templateName = payload.TemplateName ?? $"Rule {weekPlanNo}",
        weekPlanNo,
        // holidayGroupNo sayısal bir No. alanıdır (SDK: 0-invalid). Boş string "" tip
        // uyumsuzdur ve bazı firmware'lerde STDXMLConfig'i reddedebilir. Tatil grubu
        // desteklenene kadar alanı HİÇ göndermiyoruz (cihaz default'u = tatil grubu yok).
      },
    };
    return StdXmlPut(
      $"/ISAPI/AccessControl/UserRightPlanTemplate/{weekPlanNo}?format=json",
      templateBody);
  }

  private static List<object> BuildWeekPlanSegments(List<WeekPlanSegment> schedule)
  {
    var byDay = schedule
      .Where(s => !string.IsNullOrWhiteSpace(s.Week))
      .GroupBy(s => s.Week, StringComparer.OrdinalIgnoreCase)
      .ToDictionary(g => g.Key, g => g.Take(8).ToList(), StringComparer.OrdinalIgnoreCase);

    var result = new List<object>(56);
    for (var dayIndex = 0; dayIndex < WeekdayNames.Length; dayIndex++)
    {
      byDay.TryGetValue(WeekdayNames[dayIndex], out var daySegments);
      daySegments ??= [];
      for (var i = 0; i < 8; i++)
      {
        var segment = i < daySegments.Count ? daySegments[i] : null;
        result.Add(new
        {
          week = dayIndex + 1,
          id = i + 1,
          enable = segment is not null,
          TimeSegment = new
          {
            beginTime = segment?.BeginTime ?? "00:00:00",
            endTime = NormalizeEndTime(segment?.EndTime ?? "00:00:00"),
          },
          authenticationTimesEnabled = false,
          authenticationTimes = 0,
        });
      }
    }
    return result;
  }

  private static string NormalizeEndTime(string value) =>
    value == "23:59:59" ? "24:00:00" : value;

  private SdkResult StdXmlPut(string path, object body)
  {
    var requestUrl = $"PUT {path}";
    var bodyJson = JsonSerializer.Serialize(body);
    var requestBytes = Encoding.UTF8.GetBytes(requestUrl);
    var bodyBytes = Encoding.UTF8.GetBytes(bodyJson);
    var outBuffer = Marshal.AllocHGlobal(64 * 1024);
    var statusBuffer = Marshal.AllocHGlobal(8 * 1024);
    var requestPtr = Marshal.AllocHGlobal(requestBytes.Length + 1);
    var bodyPtr = Marshal.AllocHGlobal(bodyBytes.Length + 1);
    try
    {
      Marshal.Copy(requestBytes, 0, requestPtr, requestBytes.Length);
      Marshal.WriteByte(requestPtr + requestBytes.Length, 0);
      Marshal.Copy(bodyBytes, 0, bodyPtr, bodyBytes.Length);
      Marshal.WriteByte(bodyPtr + bodyBytes.Length, 0);

      var input = new NET_DVR_XML_CONFIG_INPUT
      {
        dwSize = (uint)Marshal.SizeOf<NET_DVR_XML_CONFIG_INPUT>(),
        lpRequestUrl = requestPtr,
        dwRequestUrlLen = (uint)requestBytes.Length,
        lpInBuffer = bodyPtr,
        dwInBufferSize = (uint)bodyBytes.Length,
        dwRecvTimeOut = 5000,
        byRes = new byte[29],
      };
      var output = new NET_DVR_XML_CONFIG_OUTPUT
      {
        dwSize = (uint)Marshal.SizeOf<NET_DVR_XML_CONFIG_OUTPUT>(),
        lpOutBuffer = outBuffer,
        dwOutBufferSize = 64 * 1024,
        lpStatusBuffer = statusBuffer,
        dwStatusSize = 8 * 1024,
        byRes = new byte[23],
      };
      var ok = NET_DVR_STDXMLConfig(_userId, ref input, ref output);
      if (ok) return SdkResult.Success();
      var status = Marshal.PtrToStringAnsi(statusBuffer) ?? "";
      return SdkResult.Failure($"NET_DVR_STDXMLConfig failed {NET_DVR_GetLastError()}: {status}");
    }
    finally
    {
      Marshal.FreeHGlobal(outBuffer);
      Marshal.FreeHGlobal(statusBuffer);
      Marshal.FreeHGlobal(requestPtr);
      Marshal.FreeHGlobal(bodyPtr);
    }
  }

  private unsafe SdkResult SetCard(OperationPayload payload)
  {
    var cardNo = payload.CardNumber ?? payload.EmployeeNo;
    if (string.IsNullOrWhiteSpace(cardNo)) return SdkResult.Failure("cardNumber missing");
    var planTemplateNo = payload.PlanTemplateNo ?? payload.WeekPlanNo;
    if (planTemplateNo is null) return SdkResult.Failure("planTemplateNo missing");

    var cond = SingleCardCond();
    var card = new NET_DVR_CARD_CFG_V50
    {
      dwSize = (uint)Marshal.SizeOf<NET_DVR_CARD_CFG_V50>(),
      dwModifyParamType = CardModifyMaskBase,
      byCardValid = 1,
      byCardType = 1,
      byLeaderCard = 0,
      byUserType = 0,
      struValid = ValidPeriod(),
      dwMaxSwipeTime = 0,
      dwSwipeTime = 0,
    };
    WriteFixed(card.byCardNo, AcsCardNoLen, cardNo);
    WriteFixed(card.byName, NameLen, payload.Name ?? cardNo);
    // DS-K2804 rejects NET_DVR_CARD_CFG_V50 on some firmware when EMPLOYEE_NO is
    // included in dwModifyParamType. Card number is the stable key we need, so keep
    // dwEmployeeNo out of the write mask for localBridge card apply.

    var rights = payload.DoorRights is { Count: > 0 }
      ? payload.DoorRights
      : Enumerable.Range(1, Math.Max(1, payload.DoorCount ?? _panel.DoorCount)).ToList();
    foreach (var door in rights.Where(d => d is >= 1 and <= MaxDoorNum256))
    {
      card.byDoorRight[door - 1] = 1;
      card.wCardRightPlan[(door - 1) * MaxCardRightPlanNum] = (ushort)Math.Clamp(planTemplateNo.Value, 1, ushort.MaxValue);
    }
    card.byBelongGroup[0] = 1;

    return SendRemoteCardConfig(NetDvrSetCardCfgV50, cond, card, new CardDebugInfo(
      cardNo,
      planTemplateNo.Value,
      [.. rights],
      card.dwModifyParamType));
  }

  private unsafe SdkResult DeleteCard(OperationPayload payload)
  {
    var cardNo = payload.CardNumber ?? payload.EmployeeNo;
    if (string.IsNullOrWhiteSpace(cardNo)) return SdkResult.Failure("cardNumber missing");
    var cond = SingleCardCond();
    // SDK'da ayrı bir "kart sil" remote-config komutu yok; doc'un kanonik yolu
    // NET_DVR_SET_CARD_CFG_V50 + byCardValid=0 (yalnız CARD_VALID bit'i ile).
    var card = new NET_DVR_CARD_CFG_V50
    {
      dwSize = (uint)Marshal.SizeOf<NET_DVR_CARD_CFG_V50>(),
      dwModifyParamType = CardModifyCardValid,
      byCardValid = 0,
    };
    WriteFixed(card.byCardNo, AcsCardNoLen, cardNo);
    return SendRemoteCardConfig(NetDvrSetCardCfgV50, cond, card, new CardDebugInfo(
      cardNo,
      null,
      [],
      card.dwModifyParamType));
  }

  private static NET_DVR_CARD_CFG_COND SingleCardCond() => new()
  {
    dwSize = (uint)Marshal.SizeOf<NET_DVR_CARD_CFG_COND>(),
    dwCardNum = 1,
    byCheckCardNo = 1,
  };

  private sealed record CardDebugInfo(
    string CardNo,
    int? PlanTemplateNo,
    IReadOnlyList<int> DoorRights,
    uint ModifyMask);

  private SdkResult SendRemoteCardConfig(
    int command,
    NET_DVR_CARD_CFG_COND cond,
    NET_DVR_CARD_CFG_V50 card,
    CardDebugInfo debug)
  {
    return WithRemoteConfig(command, ref cond, ref card, debug);
  }

  private SdkResult WithRemoteConfig<TCond, TData>(
    int command,
    ref TCond cond,
    ref TData data,
    CardDebugInfo? debug = null)
    where TCond : struct
    where TData : struct
  {
    var condSize = Marshal.SizeOf<TCond>();
    var dataSize = Marshal.SizeOf<TData>();
    var condPtr = Marshal.AllocHGlobal(condSize);
    var dataPtr = Marshal.AllocHGlobal(dataSize);
    var tcs = new TaskCompletionSource<SdkResult>(TaskCreationOptions.RunContinuationsAsynchronously);
    RemoteConfigCallback callback = (type, buffer, bufferLength, _) =>
    {
      var status = type;
      if (type == CallbackTypeStatus && buffer != IntPtr.Zero && bufferLength >= sizeof(uint))
      {
        status = unchecked((uint)Marshal.ReadInt32(buffer));
      }
      if (status is CallbackStatusSuccess or CallbackStatusFinish)
      {
        tcs.TrySetResult(SdkResult.Success());
      }
      else if (status == CallbackStatusFailed)
      {
        var err = buffer != IntPtr.Zero && bufferLength >= sizeof(uint) * 2
          ? Marshal.ReadInt32(buffer, sizeof(uint))
          : NET_DVR_GetLastError();
        tcs.TrySetResult(SdkResult.Failure($"remote config failed: {err}{FormatDebug(debug, condSize, dataSize)}"));
      }
    };
    _activeRemoteConfigCallback = callback;
    try
    {
      Marshal.StructureToPtr(cond, condPtr, false);
      Marshal.StructureToPtr(data, dataPtr, false);
      var handle = NET_DVR_StartRemoteConfig(_userId, command, condPtr, (uint)condSize, callback, IntPtr.Zero);
      if (handle < 0)
      {
        return SdkResult.Failure($"NET_DVR_StartRemoteConfig failed: {NET_DVR_GetLastError()}");
      }
      try
      {
        if (!NET_DVR_SendRemoteConfig(handle, EnumAcsSendData, dataPtr, (uint)dataSize))
        {
          return SdkResult.Failure(
            $"NET_DVR_SendRemoteConfig failed: {NET_DVR_GetLastError()}{FormatDebug(debug, condSize, dataSize)}");
        }
        var completed = tcs.Task.Wait(TimeSpan.FromSeconds(8));
        return completed ? tcs.Task.Result : SdkResult.Failure("remote config callback timeout");
      }
      finally
      {
        NET_DVR_StopRemoteConfig(handle);
      }
    }
    finally
    {
      _activeRemoteConfigCallback = null;
      Marshal.FreeHGlobal(condPtr);
      Marshal.FreeHGlobal(dataPtr);
    }
  }

  private static string FormatDebug(CardDebugInfo? debug, int condSize, int dataSize)
  {
    if (debug is null) return $" (condSize={condSize}, dataSize={dataSize})";
    var doors = debug.DoorRights.Count > 0 ? string.Join(",", debug.DoorRights) : "-";
    var plan = debug.PlanTemplateNo?.ToString() ?? "-";
    return
      $" (card={debug.CardNo}, plan={plan}, doors={doors}, mask=0x{debug.ModifyMask:X}, condSize={condSize}, dataSize={dataSize})";
  }

  private static NET_DVR_VALID_PERIOD_CFG ValidPeriod()
  {
    return new NET_DVR_VALID_PERIOD_CFG
    {
      byEnable = 1,
      struBeginTime = new NET_DVR_TIME_EX
      {
        wYear = (ushort)DateTime.Now.Year,
        byMonth = (byte)DateTime.Now.Month,
        byDay = (byte)DateTime.Now.Day,
      },
      struEndTime = new NET_DVR_TIME_EX
      {
        wYear = 2037,
        byMonth = 12,
        byDay = 31,
        byHour = 23,
        byMinute = 59,
        bySecond = 59,
      },
    };
  }

  private static unsafe void WriteFixed(byte* destination, int length, string value)
  {
    for (var i = 0; i < length; i++) destination[i] = 0;
    var bytes = Encoding.UTF8.GetBytes(value);
    var count = Math.Min(bytes.Length, length - 1);
    for (var i = 0; i < count; i++) destination[i] = bytes[i];
  }

  public async ValueTask DisposeAsync()
  {
    // In-flight SDK komutu (ControlGateway/STDXMLConfig/remote-config) bitene kadar bekle;
    // aksi halde paralel NET_DVR_Logout aynı userId üzerinde native çakışma/crash riski.
    await _sdkLock.WaitAsync();
    try
    {
      _disposed = true;
      if (_alarmHandle >= 0)
      {
        NET_DVR_CloseAlarmChan_V30(_alarmHandle);
        _alarmHandle = -1;
      }
      if (_userId >= 0)
      {
        _runtime.UnregisterHandler(_userId);
        NET_DVR_Logout(_userId);
        _userId = -1;
      }
    }
    finally
    {
      _sdkLock.Release();
    }
    _sdkLock.Dispose();
  }
}
