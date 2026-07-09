using System.Collections.Concurrent;
using System.Runtime.InteropServices;
using System.Text;
using static NgAccess.HikvisionBridge.Sdk.HikvisionNative;

namespace NgAccess.HikvisionBridge.Sdk;

/// <summary>
/// Süreç-genelinde HCNetSDK yaşam döngüsü: NET_DVR_Init bir kez, TEK global mesaj callback'i,
/// ve ACS event'lerini login userId'sine göre doğru panele yönlendirme. Çok-panelli bridge'de
/// SDK init/callback panel başına değil, burada (singleton) yönetilir.
/// </summary>
public sealed class HikvisionSdkRuntime : IDisposable
{
  private readonly ILogger<HikvisionSdkRuntime> _logger;
  private readonly object _initLock = new();
  // Global callback süreç boyunca yaşamalı → instance alanında tut (GC koruması).
  private readonly MsgCallback _messageCallback;
  private readonly ConcurrentDictionary<int, Action<AcsEvent>> _handlers = new();
  private bool _initialized;

  public HikvisionSdkRuntime(ILogger<HikvisionSdkRuntime> logger)
  {
    _logger = logger;
    _messageCallback = OnSdkMessage;
  }

  public void EnsureInitialized(string sdkDllDirectory)
  {
    if (_initialized) return;
    lock (_initLock)
    {
      if (_initialized) return;
      var dllDir = Path.IsPathRooted(sdkDllDirectory)
        ? sdkDllDirectory
        : Path.Combine(AppContext.BaseDirectory, sdkDllDirectory);
      if (Directory.Exists(dllDir)) SetDllDirectory(dllDir);
      if (!NET_DVR_Init())
      {
        throw new InvalidOperationException($"NET_DVR_Init failed: {NET_DVR_GetLastError()}");
      }
      NET_DVR_SetConnectTime(3000, 2);
      NET_DVR_SetReconnect(10000, true);
      if (!NET_DVR_SetDVRMessageCallBack_V50(0, _messageCallback, IntPtr.Zero))
      {
        _logger.LogWarning("NET_DVR_SetDVRMessageCallBack_V50 failed: {Err}", NET_DVR_GetLastError());
      }
      _initialized = true;
      _logger.LogInformation("HCNetSDK initialized (dll dir: {Dir})", dllDir);
    }
  }

  /// <summary>Bir panelin login userId'si için event handler kaydet (login sonrası çağrılır).</summary>
  public void RegisterHandler(int userId, Action<AcsEvent> handler) => _handlers[userId] = handler;

  public void UnregisterHandler(int userId) => _handlers.TryRemove(userId, out _);

  private unsafe bool OnSdkMessage(int command, IntPtr alarmer, IntPtr alarmInfo, uint bufferLength, IntPtr user)
  {
    if (command != CommAlarmAcs || alarmInfo == IntPtr.Zero || bufferLength == 0) return true;
    try
    {
      // NET_DVR_ALARMER: ilk 8 byte valid-flag, ardından LONG lUserID (offset 8). Tüm struct'ı
      // tanımlamak yerine sadece userId'yi oku (sürüm farkı olan reserved alanlardan etkilenmez).
      var userId = alarmer != IntPtr.Zero ? Marshal.ReadInt32(alarmer, 8) : -1;
      if (userId < 0 || !_handlers.TryGetValue(userId, out var handler)) return true;

      var alarm = Marshal.PtrToStructure<NET_DVR_ACS_ALARM_INFO>(alarmInfo);
      var cardNo = ReadFixed(alarm.struAcsEventInfo.byCardNo, AcsCardNoLen);
      if (string.IsNullOrWhiteSpace(cardNo)) return true;

      handler(new AcsEvent
      {
        CardNo = cardNo,
        DoorNo = alarm.struAcsEventInfo.dwDoorNo,
        Major = alarm.dwMajor,
        Minor = alarm.dwMinor,
        DateTime =
          $"{alarm.struTime.dwYear:D4}-{alarm.struTime.dwMonth:D2}-{alarm.struTime.dwDay:D2}T" +
          $"{alarm.struTime.dwHour:D2}:{alarm.struTime.dwMinute:D2}:{alarm.struTime.dwSecond:D2}",
      });
    }
    catch (Exception ex)
    {
      _logger.LogWarning(ex, "Failed to parse ACS alarm");
    }
    return true;
  }

  private static unsafe string ReadFixed(byte* source, int length)
  {
    var bytes = new byte[length];
    Marshal.Copy((IntPtr)source, bytes, 0, length);
    var end = Array.IndexOf(bytes, (byte)0);
    if (end < 0) end = length;
    return Encoding.UTF8.GetString(bytes, 0, end).Trim();
  }

  public void Dispose()
  {
    if (_initialized)
    {
      NET_DVR_Cleanup();
      _initialized = false;
    }
  }
}
