; ============================================================================
; NGS Access Hikvision Bridge — Inno Setup installer
; Çıktı: tek dosya  ->  Output\NgAccessHikvisionBridge-Setup.exe
; Karşı taraf bu setup.exe'ye çift tıklar: exe + tüm DLL'ler kurulur,
; Windows servisi otomatik kurulup başlatılır, sonra /__bridge ekranı açılır.
;
; DERLEME (Windows'ta):
;   1) Inno Setup'ı indir/kur:  https://jrsoftware.org/isdl.php  (6.3+ önerilir)
;   2) Bridge'in publish çıktısını hazırla (self-contained win-x64):
;         dotnet publish .\NgAccess.HikvisionBridge.csproj -c Release -r win-x64 ^
;           --self-contained true -o .\installer\publish
;      (publish\ içinde ngsaccess-hikvision-bridge.exe + .NET runtime DLL'leri +
;       hikvision-sdk\win-x64\*.dll bulunmalı — HCNetSDK.dll dahil.)
;   3) Bu setup.iss'i Inno Setup Compiler'da aç -> Build > Compile.
;   4) Çıktı:  installer\Output\NgAccessHikvisionBridge-Setup.exe
;
; Not: Elindeki hazır "ngsaccess-bridge.zip" zaten publish çıktısıdır. İçindekileri
;      installer\publish\ klasörüne kopyalarsan adım 2'yi atlayabilirsin (SrcDir'i
;      o klasöre işaret etmen yeterli).
; ============================================================================

#define AppName       "NGS Access Hikvision Bridge"
#define AppVersion    "1.0.0"
#define ExeName       "ngsaccess-hikvision-bridge.exe"
#define ServiceName   "NgAccessHikvisionBridge"

; Publish çıktısının bu .iss'e göre RELATİF yolu. Hazır zip'i açtıysan burayı
; o klasörün adıyla değiştir (örn. "ngsaccess-bridge").
#define SrcDir        "publish"

[Setup]
AppId={{8F3A1C42-6B7E-4D19-A2F5-9C0E1D7B4A36}}
AppName={#AppName}
AppVersion={#AppVersion}
DefaultDirName={autopf}\NgAccessHikvisionBridge
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
OutputBaseFilename=NgAccessHikvisionBridge-Setup
Compression=lzma2/max
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
WizardStyle=modern
UninstallDisplayName={#AppName}

[Files]
Source: "{#SrcDir}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{group}\Bridge Ayarları (/__bridge)"; Filename: "http://127.0.0.1:8787/__bridge"
Name: "{group}\Console Modda Çalıştır"; Filename: "{app}\{#ExeName}"; Parameters: "--console"
Name: "{group}\Kaldır {#AppName}"; Filename: "{uninstallexe}"

[Run]
; Servisi kur (binPath= ve start= sonrasındaki BOŞLUK sc.exe sözdizimi gereği zorunlu).
Filename: "{sys}\sc.exe"; Parameters: "create {#ServiceName} binPath= ""{app}\{#ExeName}"" start= auto DisplayName= ""{#AppName}"""; Flags: runhidden
Filename: "{sys}\sc.exe"; Parameters: "description {#ServiceName} ""DS-K2804 Hikvision panel köprüsü (Convex roster/ack, LAN SDK 8000)"""; Flags: runhidden
Filename: "{sys}\sc.exe"; Parameters: "failure {#ServiceName} reset= 60 actions= restart/5000/restart/5000/restart/10000"; Flags: runhidden
Filename: "{sys}\sc.exe"; Parameters: "start {#ServiceName}"; Flags: runhidden
; Kurulum bitince bridge ayar ekranını aç (panel + Bridge Token buradan girilir).
Filename: "http://127.0.0.1:8787/__bridge"; Description: "Bridge ayar ekranını aç (panel + token gir)"; Flags: shellexec postinstall nowait skipifsilent

[UninstallRun]
Filename: "{sys}\sc.exe"; Parameters: "stop {#ServiceName}"; Flags: runhidden; RunOnceId: "StopNgsSvc"
Filename: "{sys}\sc.exe"; Parameters: "delete {#ServiceName}"; Flags: runhidden; RunOnceId: "DelNgsSvc"

[Code]
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
begin
  // Güncelleme/yeniden kurulum: dosyalar kopyalanmadan ÖNCE eski servisi durdur + sil,
  // yoksa çalışan exe kilitli olur ve kopyalama başarısız olur. İlk kurulumda bu komutlar
  // "servis yok" hatası döndürür; sorun değil, yok sayılır.
  Exec(ExpandConstant('{sys}\sc.exe'), 'stop {#ServiceName}',   '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec(ExpandConstant('{sys}\sc.exe'), 'delete {#ServiceName}', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Sleep(1500);
  Result := '';
end;
