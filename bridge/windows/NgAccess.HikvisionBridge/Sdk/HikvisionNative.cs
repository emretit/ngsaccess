using System.Runtime.InteropServices;

namespace NgAccess.HikvisionBridge.Sdk;

internal static unsafe class HikvisionNative
{
  public const int AcsCardNoLen = 32;
  public const int MaxDoorNum256 = 256;
  public const int MaxCardRightPlanNum = 4;
  public const int MaxGroupNum128 = 128;
  public const int CardPasswordLen = 8;
  public const int NameLen = 32;
  public const int MaxLockCodeLen = 8;
  public const int MaxDoorCodeLen = 8;

  public const int NetDvrSetCardCfgV50 = 2179;
  public const int EnumAcsSendData = 3;
  public const int CommAlarmAcs = 0x5002;
  public const uint CallbackStatusSuccess = 1000;
  public const uint CallbackStatusFailed = 1002;

  // dwModifyParamType bit maskesi (NET_DVR_CARD_CFG_V50). Taban maske bridge'in yazdığı alanları
  // seçer: CARD_VALID|VALID|CARD_TYPE|DOOR_RIGHT|LEADER|GROUP|RIGHT_PLAN|NAME. EMPLOYEE_NO (0x400)
  // yalnız geçerli (>0) bir employeeNo parse edildiğinde eklenir; aksi halde alanı 0 ile ezmeyiz.
  public const uint CardModifyMaskBase = 0x0000095F;
  public const uint CardModifyEmployeeNo = 0x00000400;
  public const uint CardModifyCardValid = 0x00000001;

  [UnmanagedFunctionPointer(CallingConvention.StdCall)]
  public delegate void MsgCallback(
    int command,
    IntPtr alarmer,
    IntPtr alarmInfo,
    uint bufferLength,
    IntPtr user);

  [UnmanagedFunctionPointer(CallingConvention.StdCall)]
  public delegate void RemoteConfigCallback(
    uint callbackType,
    IntPtr buffer,
    uint bufferLength,
    IntPtr user);

  [DllImport("kernel32", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool SetDllDirectory(string? pathName);

  [DllImport("HCNetSDK.dll", CallingConvention = CallingConvention.StdCall)]
  public static extern bool NET_DVR_Init();

  [DllImport("HCNetSDK.dll", CallingConvention = CallingConvention.StdCall)]
  public static extern bool NET_DVR_Cleanup();

  [DllImport("HCNetSDK.dll", CallingConvention = CallingConvention.StdCall)]
  public static extern bool NET_DVR_SetConnectTime(uint waitTime, uint tryTimes);

  [DllImport("HCNetSDK.dll", CallingConvention = CallingConvention.StdCall)]
  public static extern bool NET_DVR_SetReconnect(uint interval, bool enableReconnect);

  [DllImport("HCNetSDK.dll", CallingConvention = CallingConvention.StdCall)]
  public static extern int NET_DVR_GetLastError();

  [DllImport("HCNetSDK.dll", CallingConvention = CallingConvention.StdCall)]
  public static extern int NET_DVR_Login_V40(
    ref NET_DVR_USER_LOGIN_INFO loginInfo,
    ref NET_DVR_DEVICEINFO_V40 deviceInfo);

  [DllImport("HCNetSDK.dll", CallingConvention = CallingConvention.StdCall)]
  public static extern bool NET_DVR_Logout(int userId);

  [DllImport("HCNetSDK.dll", CallingConvention = CallingConvention.StdCall)]
  public static extern bool NET_DVR_ControlGateway(int userId, int gatewayIndex, uint staticCommand);

  [DllImport("HCNetSDK.dll", CallingConvention = CallingConvention.StdCall)]
  public static extern bool NET_DVR_SetDVRMessageCallBack_V50(
    int index,
    MsgCallback callback,
    IntPtr user);

  [DllImport("HCNetSDK.dll", CallingConvention = CallingConvention.StdCall)]
  public static extern int NET_DVR_SetupAlarmChan_V50(
    int userId,
    ref NET_DVR_SETUPALARM_PARAM_V50 setupParam,
    IntPtr subscription,
    uint subscriptionSize);

  [DllImport("HCNetSDK.dll", CallingConvention = CallingConvention.StdCall)]
  public static extern bool NET_DVR_CloseAlarmChan_V30(int alarmHandle);

  [DllImport("HCNetSDK.dll", CallingConvention = CallingConvention.StdCall)]
  public static extern int NET_DVR_StartRemoteConfig(
    int userId,
    int command,
    IntPtr inputBuffer,
    uint inputBufferSize,
    RemoteConfigCallback callback,
    IntPtr user);

  [DllImport("HCNetSDK.dll", CallingConvention = CallingConvention.StdCall)]
  public static extern bool NET_DVR_SendRemoteConfig(
    int handle,
    uint dataType,
    IntPtr sendBuffer,
    uint sendBufferSize);

  [DllImport("HCNetSDK.dll", CallingConvention = CallingConvention.StdCall)]
  public static extern bool NET_DVR_StopRemoteConfig(int handle);

  [DllImport("HCNetSDK.dll", CallingConvention = CallingConvention.StdCall)]
  public static extern bool NET_DVR_STDXMLConfig(
    int userId,
    ref NET_DVR_XML_CONFIG_INPUT input,
    ref NET_DVR_XML_CONFIG_OUTPUT output);

  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
  public unsafe struct NET_DVR_USER_LOGIN_INFO
  {
    public fixed byte sDeviceAddress[129];
    public byte byUseTransport;
    public ushort wPort;
    public fixed byte sUserName[64];
    public fixed byte sPassword[64];
    public IntPtr cbLoginResult;
    public IntPtr pUser;
    public int bUseAsynLogin;
    public byte byProxyType;
    public byte byUseUTCTime;
    public byte byLoginMode;
    public byte byHttps;
    public int iProxyID;
    public byte byVerifyMode;
    public fixed byte byRes3[119];
  }

  [StructLayout(LayoutKind.Sequential)]
  public unsafe struct NET_DVR_DEVICEINFO_V40
  {
    public fixed byte raw[800];
  }

  [StructLayout(LayoutKind.Sequential)]
  public unsafe struct NET_DVR_SETUPALARM_PARAM_V50
  {
    public uint dwSize;
    public byte byLevel;
    public byte byAlarmInfoType;
    public byte byRetAlarmTypeV40;
    public byte byRetDevInfoVersion;
    public byte byRetVQDAlarmType;
    public byte byFaceAlarmDetection;
    public byte bySupport;
    public byte byBrokenNetHttp;
    public ushort wTaskNo;
    public byte byDeployType;
    public byte bySubScription;
    public byte byBrokenNetHttpV60;
    public byte byRes1;
    public byte byAlarmTypeURL;
    public byte byCustomCtrl;
    public fixed byte byRes4[128];
  }

  [StructLayout(LayoutKind.Sequential)]
  public unsafe struct NET_DVR_CARD_CFG_COND
  {
    public uint dwSize;
    public uint dwCardNum;
    public byte byCheckCardNo;
    public fixed byte byRes1[3];
    public ushort wLocalControllerID;
    public fixed byte byRes2[2];
    public uint dwLockID;
    public fixed byte byRes3[20];
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct NET_DVR_TIME_EX
  {
    public ushort wYear;
    public byte byMonth;
    public byte byDay;
    public byte byHour;
    public byte byMinute;
    public byte bySecond;
    public byte byRes;
  }

  [StructLayout(LayoutKind.Sequential)]
  public unsafe struct NET_DVR_VALID_PERIOD_CFG
  {
    public byte byEnable;
    public byte byBeginTimeFlag;
    public byte byEnableTimeFlag;
    public byte byTimeDurationNo;
    public NET_DVR_TIME_EX struBeginTime;
    public NET_DVR_TIME_EX struEndTime;
    public byte byTimeType;
    public fixed byte byRes2[32];
  }

  [StructLayout(LayoutKind.Sequential)]
  public unsafe struct NET_DVR_CARD_CFG_V50
  {
    public uint dwSize;
    public uint dwModifyParamType;
    public fixed byte byCardNo[AcsCardNoLen];
    public byte byCardValid;
    public byte byCardType;
    public byte byLeaderCard;
    public byte byUserType;
    public fixed byte byDoorRight[MaxDoorNum256];
    public NET_DVR_VALID_PERIOD_CFG struValid;
    public fixed byte byBelongGroup[MaxGroupNum128];
    public fixed byte byCardPassword[CardPasswordLen];
    public fixed ushort wCardRightPlan[MaxDoorNum256 * MaxCardRightPlanNum];
    public uint dwMaxSwipeTime;
    public uint dwSwipeTime;
    public ushort wRoomNumber;
    public short wFloorNumber;
    public uint dwEmployeeNo;
    public fixed byte byName[NameLen];
    public ushort wDepartmentNo;
    public ushort wSchedulePlanNo;
    public byte bySchedulePlanType;
    public byte byRightType;
    public fixed byte byRes2[2];
    public uint dwLockID;
    public fixed byte byLockCode[MaxLockCodeLen];
    public fixed byte byRoomCode[MaxDoorCodeLen];
    public uint dwCardRight;
    public uint dwPlanTemplate;
    public uint dwCardUserId;
    public byte byCardModelType;
    public fixed byte bySIMNum[NameLen];
    public fixed byte byRes3[51];
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct NET_DVR_XML_CONFIG_INPUT
  {
    public uint dwSize;
    public IntPtr lpRequestUrl;
    public uint dwRequestUrlLen;
    public IntPtr lpInBuffer;
    public uint dwInBufferSize;
    public uint dwRecvTimeOut;
    public byte byForceEncrpt;
    public byte byNumOfMultiPart;
    public byte byMIMEType;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 29)]
    public byte[] byRes;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct NET_DVR_XML_CONFIG_OUTPUT
  {
    public uint dwSize;
    public IntPtr lpOutBuffer;
    public uint dwOutBufferSize;
    public uint dwReturnedXMLSize;
    public IntPtr lpStatusBuffer;
    public uint dwStatusSize;
    public IntPtr lpDataBuffer;
    public byte byNumOfMultiPart;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 23)]
    public byte[] byRes;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct NET_DVR_TIME
  {
    public uint dwYear;
    public uint dwMonth;
    public uint dwDay;
    public uint dwHour;
    public uint dwMinute;
    public uint dwSecond;
  }

  [StructLayout(LayoutKind.Sequential)]
  public unsafe struct NET_DVR_IPADDR
  {
    public fixed byte sIpV4[16];
    public fixed byte byIPv6[128];
  }

  [StructLayout(LayoutKind.Sequential)]
  public unsafe struct NET_DVR_ACS_EVENT_INFO
  {
    public uint dwSize;
    public fixed byte byCardNo[AcsCardNoLen];
    public byte byCardType;
    public byte byAllowListNo;
    public byte byReportChannel;
    public byte byCardReaderKind;
    public uint dwCardReaderNo;
    public uint dwDoorNo;
    public uint dwVerifyNo;
    public uint dwAlarmInNo;
    public uint dwAlarmOutNo;
    public uint dwCaseSensorNo;
    public uint dwRs485No;
    public uint dwMultiCardGroupNo;
    public ushort wAccessChannel;
    public byte byDeviceNo;
    public byte byDistractControlNo;
    public uint dwEmployeeNo;
    public ushort wLocalControllerID;
    public byte byInternetAccess;
    public byte byType;
    public fixed byte byMACAddr[6];
    public byte bySwipeCardType;
    public byte byMask;
    public uint dwSerialNo;
    public byte byChannelControllerID;
    public byte byChannelControllerLampID;
    public byte byChannelControllerIRAdaptorID;
    public byte byChannelControllerIREmitterID;
    public byte byHelmet;
    public byte byHealthCode;
    public fixed byte byRes[2];
  }

  [StructLayout(LayoutKind.Sequential)]
  public unsafe struct NET_DVR_ACS_ALARM_INFO
  {
    public uint dwSize;
    public uint dwMajor;
    public uint dwMinor;
    public NET_DVR_TIME struTime;
    public fixed byte sNetUser[16];
    public NET_DVR_IPADDR struRemoteHostAddr;
    public NET_DVR_ACS_EVENT_INFO struAcsEventInfo;
    public uint dwPicDataLen;
    public IntPtr pPicData;
    public ushort wInductiveEventType;
    public byte byPicTransType;
    public byte byRes1;
    public uint dwIOTChannelNo;
    public IntPtr pAcsEventInfoExtend;
    public byte byAcsEventInfoExtend;
    public byte byTimeType;
    public byte byRes2;
    public byte byAcsEventInfoExtendV20;
    public IntPtr pAcsEventInfoExtendV20;
    public fixed byte byRes[4];
  }
}
