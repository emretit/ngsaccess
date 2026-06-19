; NGS Access Hikvision Bridge - NSIS installer (makensis ile Mac/Linux'ta derlenir)
; Cikti: NgAccessHikvisionBridge-Setup.exe  (tek dosya, cift tikla kur + servis baslat)

SetCompressor /SOLID lzma

!define APPNAME  "NGS Access Hikvision Bridge"
!define EXENAME  "ngsaccess-hikvision-bridge.exe"
!define SVCNAME  "NgAccessHikvisionBridge"
!define COMPANY  "NGS Access"
!define VERSION  "1.0.0"
!define UNINST   "Software\Microsoft\Windows\CurrentVersion\Uninstall\${SVCNAME}"

Name "${APPNAME}"
OutFile "NgAccessHikvisionBridge-Setup.exe"
InstallDir "$PROGRAMFILES64\NgAccessHikvisionBridge"
RequestExecutionLevel admin
ShowInstDetails show
ShowUninstDetails show
BrandingText "${COMPANY} - Hikvision Bridge"

!include "MUI2.nsh"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_TEXT "Kurulum tamamlandi. Servis arka planda calisiyor ve PC her acildiginda otomatik baslar.$\r$\n$\r$\nPanel bilgisi ve Bridge Token girmek icin asagidaki secenegi acin."
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_TEXT "Bridge ayar ekranini ac (/__bridge)"
!define MUI_FINISHPAGE_RUN_FUNCTION OpenBridge

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Function OpenBridge
  ExecShell "open" "http://127.0.0.1:8787/__bridge"
FunctionEnd

Section "Install"
  ; Guncelleme/yeniden kurulum: dosyalar yazilmadan ONCE eski servisi durdur+sil
  ; (calisan exe kilitliyse kopyalama bozulur). Ilk kurulumda "servis yok" -> yok sayilir.
  DetailPrint "Onceki servis temizleniyor (varsa)..."
  nsExec::Exec 'sc stop ${SVCNAME}'
  nsExec::Exec 'sc delete ${SVCNAME}'
  Sleep 1500

  SetOutPath "$INSTDIR"
  File /r "ngsaccess-bridge/*"

  DetailPrint "Windows servisi kuruluyor ve baslatiliyor..."
  ; sc.exe sozdizimi: '=' sonrasi BOSLUK zorunlu (binPath= "..." start= auto).
  nsExec::Exec 'sc create ${SVCNAME} binPath= "$INSTDIR\${EXENAME}" start= auto DisplayName= "${APPNAME}"'
  nsExec::Exec 'sc description ${SVCNAME} "DS-K2804 Hikvision panel kopru (Convex roster/ack, LAN SDK 8000)"'
  nsExec::Exec 'sc failure ${SVCNAME} reset= 60 actions= restart/5000/restart/5000/restart/10000'
  nsExec::Exec 'sc start ${SVCNAME}'

  ; Baslat menusu kisayollari
  CreateDirectory "$SMPROGRAMS\${APPNAME}"
  WriteINIStr "$SMPROGRAMS\${APPNAME}\Bridge Ayarlari.url" "InternetShortcut" "URL" "http://127.0.0.1:8787/__bridge"
  WriteUninstaller "$INSTDIR\uninstall.exe"
  CreateShortcut "$SMPROGRAMS\${APPNAME}\Kaldir.lnk" "$INSTDIR\uninstall.exe"

  ; Programlar ve Ozellikler (Apps & Features) kaydi
  WriteRegStr   HKLM "${UNINST}" "DisplayName"     "${APPNAME}"
  WriteRegStr   HKLM "${UNINST}" "DisplayVersion"  "${VERSION}"
  WriteRegStr   HKLM "${UNINST}" "Publisher"       "${COMPANY}"
  WriteRegStr   HKLM "${UNINST}" "DisplayIcon"     "$INSTDIR\${EXENAME}"
  WriteRegStr   HKLM "${UNINST}" "UninstallString" "$INSTDIR\uninstall.exe"
  WriteRegDWORD HKLM "${UNINST}" "NoModify" 1
  WriteRegDWORD HKLM "${UNINST}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  nsExec::Exec 'sc stop ${SVCNAME}'
  nsExec::Exec 'sc delete ${SVCNAME}'
  Sleep 1000
  RMDir /r "$INSTDIR"
  Delete "$SMPROGRAMS\${APPNAME}\*.*"
  RMDir  "$SMPROGRAMS\${APPNAME}"
  DeleteRegKey HKLM "${UNINST}"
SectionEnd
