// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appName => 'NGS Plus';

  @override
  String get appTagline => 'Attendance Tracking System';

  @override
  String get pdksTitle => 'Time & Attendance';

  @override
  String get pdksSubtitle => 'Personnel Attendance Control System';

  @override
  String get commonOk => 'OK';

  @override
  String get commonCancel => 'Cancel';

  @override
  String get commonClose => 'Close';

  @override
  String get commonRetry => 'Try Again';

  @override
  String get commonError => 'Error';

  @override
  String get commonSuccess => 'Success';

  @override
  String get commonAdd => 'Add';

  @override
  String get comingSoon => 'Coming soon.';

  @override
  String get navHome => 'Home';

  @override
  String get navHistory => 'History';

  @override
  String get navVisitor => 'Visitor';

  @override
  String get navProfile => 'Profile';

  @override
  String get loginWelcomeTitle => 'Welcome back!';

  @override
  String get loginTitle => 'Sign In';

  @override
  String get loginPrompt =>
      'Enter your credentials to sign in to the time & attendance system';

  @override
  String get loginEmailLabel => 'Email';

  @override
  String get loginPasswordLabel => 'Password';

  @override
  String get loginEmailRequired => 'Please enter your email address';

  @override
  String get loginEmailInvalid => 'Please enter a valid email address';

  @override
  String get loginPasswordRequired => 'Please enter your password';

  @override
  String get loginPasswordTooShort => 'Password must be at least 6 characters';

  @override
  String get loginRememberMe => 'Remember Me';

  @override
  String get loginForgotPassword => 'Forgot password';

  @override
  String get forgotPasswordTitle => 'Reset Password';

  @override
  String get forgotPasswordHeadline => 'Forgot your password?';

  @override
  String get forgotPasswordPrompt =>
      'Enter your email address and we\'ll send you a reset link.';

  @override
  String get forgotPasswordSendButton => 'Send Reset Link';

  @override
  String get forgotPasswordBackToLogin => 'Back to sign in';

  @override
  String get forgotPasswordSuccessTitle => 'Email Sent!';

  @override
  String forgotPasswordSuccessBody(String email) {
    return 'A password reset link has been sent to $email. Please check your inbox.';
  }

  @override
  String get forgotPasswordSuccessButton => 'Back to Sign In';

  @override
  String get homeGreetingMorning => 'Good morning';

  @override
  String get homeGreetingDay => 'Good day';

  @override
  String get homeGreetingEvening => 'Good evening';

  @override
  String get homeGreetingFallback => 'User';

  @override
  String homeGreetingLine(String greeting, String name) {
    return '$greeting, $name!';
  }

  @override
  String get homeAttendanceStatus => 'Attendance Status';

  @override
  String get homeScanCheckIn => 'Scan QR - Check In';

  @override
  String get homeScanCheckOut => 'Scan QR - Check Out';

  @override
  String get homeStatusInside => 'Inside';

  @override
  String get homeStatusOut => 'Checked Out';

  @override
  String get homeStatusNone => 'Not Yet';

  @override
  String get homeAttendanceEntryRow => 'Last In';

  @override
  String get homeAttendanceExitRow => 'Last Out';

  @override
  String homeExtraMovements(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '+$count movements',
      one: '+1 movement',
    );
    return '$_temp0';
  }

  @override
  String get homeScanCheckInAgain => 'Scan QR - Check In Again';

  @override
  String get homeAttendanceTimeEmpty => '—';

  @override
  String get homeMonthSummary => 'This Month\'s Summary';

  @override
  String get homeStatTotalDays => 'Total Days';

  @override
  String get homeStatDaysPresent => 'Days Present';

  @override
  String get homeStatTimesLate => 'Times Late';

  @override
  String homeProgressLabel(int present, int total) {
    return '$present / $total days attended';
  }

  @override
  String get homeQuoteOfTheDay => '💫 Quote of the Day';

  @override
  String get homeQuote1 => 'Success is where preparation meets opportunity.';

  @override
  String get homeQuote2 => 'Every new day is a new beginning.';

  @override
  String get homeQuote3 => 'Discipline is the bridge to freedom.';

  @override
  String get homeQuote4 => 'Small steps create big changes.';

  @override
  String get homeQuote5 => 'Today is the tomorrow you thought about yesterday.';

  @override
  String get homeQuote6 =>
      'Time is the most valuable treasure — use it wisely.';

  @override
  String get homeQuote7 => 'Good habits are the key to success.';

  @override
  String get homeQuote8 => 'Every day is an opportunity to improve yourself.';

  @override
  String get profileTitle => 'Profile';

  @override
  String get profileEditButton => 'Personal details';

  @override
  String get profileEditDialogBody =>
      'Your organization manages your first name, last name and email address. Contact your personnel or system administrator for corrections. These fields are read-only in this app.';

  @override
  String get profileNotifications => 'Notifications';

  @override
  String get profileNotificationsSubtitle => 'Updates and usage information';

  @override
  String get profileSecurity => 'Security';

  @override
  String get profileSecuritySubtitle => 'Password change and recovery';

  @override
  String get profileTheme => 'Theme';

  @override
  String get profileThemeDark => 'Dark theme active';

  @override
  String get profileThemeLight => 'Light theme active';

  @override
  String get profileThemeSystem => 'Follow system';

  @override
  String get profileThemeModeLight => 'Light theme';

  @override
  String get profileThemeModeDark => 'Dark theme';

  @override
  String get profileThemeModeSystem => 'Follow system';

  @override
  String get profileLanguage => 'Language';

  @override
  String get profileLanguageValueTr => 'Turkish';

  @override
  String get profileLanguageValueEn => 'English';

  @override
  String get profilePreferredDoor => 'Quick Access Door';

  @override
  String get profilePreferredDoorEmpty => 'Not selected';

  @override
  String get homeQuickActions => 'Quick Actions';

  @override
  String get quickActionUnlock => 'Open Door';

  @override
  String get quickActionVisitor => 'Visitor';

  @override
  String get quickActionHistory => 'History';

  @override
  String get quickActionProfile => 'Profile';

  @override
  String get unlockNoDeviceSelected =>
      'Pick a quick-access door from Profile first';

  @override
  String get unlockGranted => 'Access Granted';

  @override
  String get unlockDenied => 'Access Denied';

  @override
  String get selectDeviceTitle => 'Select Door';

  @override
  String get selectDeviceSearch => 'Search...';

  @override
  String get selectDeviceEmpty => 'No accessible doors yet';

  @override
  String get selectDeviceNoMatch => 'No matching doors';

  @override
  String get profileHelp => 'Help & Support';

  @override
  String get profileHelpSubtitle => 'FAQ and support';

  @override
  String get profileAboutApp => 'About the App';

  @override
  String get profileAppVersion => 'Version';

  @override
  String get profilePrivacy => 'Privacy information';

  @override
  String get profilePrivacySubtitle => 'App data and who to contact';

  @override
  String get profileLogout => 'Sign Out';

  @override
  String get profileLogoutSubtitle => 'Sign out of your account';

  @override
  String get profileLogoutConfirmTitle => 'Sign Out';

  @override
  String get profileLogoutConfirmBody =>
      'Are you sure you want to sign out of your account?';

  @override
  String get profileSettings => 'Settings';

  @override
  String get profileSettingsBody =>
      'Set your theme, language and quick access target from Profile.';

  @override
  String get profileNotificationsDialogTitle => 'Notification Settings';

  @override
  String get profileNotificationsDialogBody =>
      'Push delivery and notification preference management are not available in this version. Open the app and refresh to view current access and event information. Contact your organization’s administrator about missing or incorrect records.';

  @override
  String get profileSecurityDialogTitle => 'Security Settings';

  @override
  String get profileSecurityDialogBody =>
      'If you know your current password, choose a new one using the form below. Changing your password ends all mobile sessions. If you forgot it, ask your organization’s administrator for a new setup link. Sign out before leaving a shared device.';

  @override
  String get profileThemeDialogTitle => 'Theme Settings';

  @override
  String get profileThemeDialogBody =>
      'Choose the light, dark or system theme.';

  @override
  String get profileLanguageDialogTitle => 'Language Settings';

  @override
  String get profileLanguageDialogBody =>
      'The language preference is stored on this device and retained after sign-out.';

  @override
  String get profileHelpDialogTitle => 'Help & Support';

  @override
  String get profileHelpDialogBody =>
      'Door selection\nChoose an accessible target from Profile > Quick Access Door. You can clear the selection or refresh the list. If the list is empty, ask your administrator to check your access permissions.\n\nUsing QR codes\nCamera permission is needed only for scanning. If permission is denied, check camera access in device settings. Show your personal QR code to a supported reader and refresh it when expired. Scanning an identity label alone does not create a passage record.\n\nRecords and access issues\nCheck your connection and refresh the relevant screen. A door command, a physical passage and an official attendance result are different events. Contact your personnel or system administrator about missing or incorrect records.\n\nSupport details\nGive your administrator the app version (About the App), the time of the issue and the displayed error. Do not share passwords, session information or your personal QR code.';

  @override
  String get profilePrivacyDialogTitle => 'Privacy information';

  @override
  String get profilePrivacyDialogBody =>
      'App data information — 19 October 2026\n\nNGS Plus retrieves and displays your organization’s employee details, accessible devices and your access events from the service. Personal QR codes are obtained from the service; the camera is used for scanning. A door request sends the selected target to the service. Theme, language and scoped target preferences are stored on this device.\n\nYour organization manages employee details, access permissions and event records. Contact your personnel or data administrator about processing purposes, retention periods, legal basis and personal data requests.\n\nThis explanation describes app data use and does not replace your organization’s approved privacy policy. A published organization policy link is not configured in this version.';

  @override
  String get profileAboutDialogTitle => 'About NGS Plus';

  @override
  String get profileAboutLine1 => 'NGS Plus Attendance Tracking System';

  @override
  String get profileAboutLine2 => 'Installed app version';

  @override
  String get profileAboutLine3 =>
      'Contact your organization’s administrator for support.';

  @override
  String get profileAboutLine4 =>
      'Employee access and event information application.';

  @override
  String get profileFallbackEmail => 'Email unavailable';

  @override
  String get historyTitle => 'History';

  @override
  String get historyTabAll => 'All';

  @override
  String get historyTabThisMonth => 'This Month';

  @override
  String get historyTabStats => 'Stats';

  @override
  String get historyLoading => 'Loading data...';

  @override
  String get historyErrorTitle => 'An Error Occurred';

  @override
  String historyErrorBody(String error) {
    return 'Failed to load data: $error';
  }

  @override
  String get historyEmpty => 'No records found';

  @override
  String get historyEmptyHint => 'Pull down to refresh data';

  @override
  String get historyColorLegend => 'Color Legend';

  @override
  String get historyLegendEarly => 'Early Check-in';

  @override
  String get historyLegendEarlyDesc => 'Days checked in before 09:00';

  @override
  String get historyLegendNormal => 'Normal Check-in';

  @override
  String get historyLegendNormalDesc => 'Days checked in between 09:00 - 09:30';

  @override
  String get historyLegendLate => 'Late Check-in';

  @override
  String get historyLegendLateDesc => 'Days checked in after 09:30';

  @override
  String get historyLegendNone => 'No Attendance';

  @override
  String get historyLegendNoneDesc => 'Days with no check-in/out records';

  @override
  String get historyCalendarHint =>
      'Tap days to see details. Green dots indicate additional attendance records.';

  @override
  String get historyMonthSummary => 'This Month\'s Summary';

  @override
  String get historyTotalCheckIns => 'Total Check-ins';

  @override
  String get historyTotalCheckOuts => 'Total Check-outs';

  @override
  String get historyActiveDays => 'Active Days';

  @override
  String get historyGeneralStats => 'General Statistics';

  @override
  String get historyThisWeek => 'This Week';

  @override
  String get historyWeeklySummary => 'Weekly Summary';

  @override
  String historyWeeklyTotalRecords(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count records this week',
      one: '1 record this week',
    );
    return '$_temp0';
  }

  @override
  String historyWeeklyCheckIn(int count) {
    return 'Check-ins: $count';
  }

  @override
  String historyWeeklyCheckOut(int count) {
    return 'Check-outs: $count';
  }

  @override
  String get historyDeviceStats => 'Device Statistics';

  @override
  String get historyCheckInRecord => 'Checked In';

  @override
  String get historyCheckOutRecord => 'Checked Out';

  @override
  String get historyBadgeIn => 'IN';

  @override
  String get historyBadgeOut => 'OUT';

  @override
  String get historyUnknownDevice => 'Unknown Device';

  @override
  String get historyUnknownLocation => 'Unknown Location';

  @override
  String get historyDetailCheckIn => 'Check-in Details';

  @override
  String get historyDetailCheckOut => 'Check-out Details';

  @override
  String get historyDetailDate => 'Date';

  @override
  String get historyDetailTime => 'Time';

  @override
  String get historyDetailLocation => 'Location';

  @override
  String get historyDetailQrCode => 'QR Code';

  @override
  String get historyFilterTitle => 'Filter';

  @override
  String get historyFilterDate => 'Date';

  @override
  String get historyFilterDateNone => 'No date selected';

  @override
  String get historyFilterDevice => 'Device';

  @override
  String get historyFilterDeviceNone => 'No device selected';

  @override
  String get historyFilterClear => 'Clear Filters';

  @override
  String get historyFilterDeviceSelectTitle => 'Select Device';

  @override
  String historyDayRecordCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count records',
      one: '1 record',
    );
    return '$_temp0';
  }

  @override
  String get historyEntryShort => 'In';

  @override
  String get historyExitShort => 'Out';

  @override
  String get qrTabTitle => 'QR Actions';

  @override
  String get qrTabMyQr => 'My QR';

  @override
  String get qrTabScan => 'Scan';

  @override
  String get qrInvalidResponse => 'Invalid response';

  @override
  String get qrTokenMissing => 'Token missing';

  @override
  String get qrRefresh => 'Refresh';

  @override
  String get qrTryAgain => 'Try again';

  @override
  String get qrFrameHint => 'Place the QR code inside the frame';

  @override
  String get qrTokenHint =>
      'Show this QR code to the door device. Code is valid for 10 seconds; tap refresh when expired.';

  @override
  String qrProcessError(String error) {
    return 'An error occurred while processing the QR code: $error';
  }

  @override
  String get qrUserCodeTitle => 'User QR Code';

  @override
  String qrUserCodeBody(String name, String email, String date) {
    return 'User: $name\nEmail: $email\nDate: $date';
  }

  @override
  String get qrInvalidCode => 'Invalid QR code';

  @override
  String get qrAccessGranted => 'Access Granted';

  @override
  String get qrUnknownError => 'An error occurred';

  @override
  String qrDeviceLine(String name) {
    return 'Device: $name';
  }

  @override
  String qrLocationLine(String location) {
    return 'Location: $location';
  }

  @override
  String qrTimeLine(String time) {
    return 'Time: $time';
  }

  @override
  String get visitorTitle => 'Visitor Management';

  @override
  String get visitorStatTotal => 'Total';

  @override
  String get visitorStatInside => 'Inside';

  @override
  String get visitorStatExpected => 'Expected';

  @override
  String get visitorEmpty => 'No visitor records yet';

  @override
  String get visitorEmptyHint => 'Tap + to add a new visitor';

  @override
  String get visitorStatusExpected => 'Expected';

  @override
  String get visitorStatusInside => 'Inside';

  @override
  String get visitorStatusOut => 'Left';

  @override
  String visitorContactPerson(String name) {
    return 'Contact: $name';
  }

  @override
  String get visitorCheckOut => 'Check Out';

  @override
  String get visitorCheckIn => 'Check In';

  @override
  String visitorCheckedInToast(String name) {
    return '$name checked in';
  }

  @override
  String visitorCheckedOutToast(String name) {
    return '$name checked out';
  }

  @override
  String get visitorFilterTitle => 'Filter';

  @override
  String get visitorFilterBody => 'Filtering options will go here.';

  @override
  String get visitorAddTitle => 'New Visitor';

  @override
  String get visitorFieldName => 'Full Name';

  @override
  String get visitorFieldCompany => 'Company';

  @override
  String get visitorFieldPurpose => 'Visit Purpose';

  @override
  String get visitorFieldContact => 'Contact Person';

  @override
  String get visitorAddedToast => 'Visitor added';

  @override
  String get visitorAddButton => 'Add Visitor';

  @override
  String get errorNetwork =>
      'No internet connection. Please check your connection.';

  @override
  String get errorTimeout =>
      'The server did not respond. Please try again later.';

  @override
  String errorServer(int code) {
    return 'Server error ($code). Please try again shortly.';
  }

  @override
  String get errorAuthExpired =>
      'Your session has ended. Please sign in again.';

  @override
  String get errorUnknown => 'An unexpected error occurred. Please try again.';

  @override
  String get errorBusinessInvalidCredentials => 'Invalid email or password';

  @override
  String get errorBusinessNoMobilePassword =>
      'Your mobile password isn\'t set yet. Ask your administrator for a setup link.';

  @override
  String get errorBusinessEmployeeInactive =>
      'Your employee record is not active';

  @override
  String get passwordResetAdminInfo =>
      'Your mobile password is set up by your administrator. Please contact them.';

  @override
  String get qrInvalidDevice => 'QR code is missing device information';

  @override
  String get accessDenied => 'Access denied';

  @override
  String get profileFirstName => 'First name';

  @override
  String get profileLastName => 'Last name';

  @override
  String get profileLanguageSystem => 'System language';

  @override
  String get profileLanguageScope =>
      'Stored on this device; retained after sign-out.';

  @override
  String get profileVersionUnavailable => 'Version information unavailable';

  @override
  String profileVersionBuild(String version, String build) {
    return 'Version $version (build $build)';
  }

  @override
  String get preferenceSaveFailed =>
      'Could not save your preference. Please try again.';

  @override
  String get preferenceIdentityUnavailable =>
      'Account or project information could not be verified. Sign in again.';

  @override
  String get selectDeviceClear => 'Clear selection';

  @override
  String get selectDeviceInvalidated =>
      'The previous target is no longer available. Choose a new target.';

  @override
  String get historyLoadMore => 'Load more';

  @override
  String get historyAccessDenied => 'Access denied';

  @override
  String get historyUnknownDirection => 'Unknown direction';

  @override
  String get historyUnknownAccess => 'Unknown access result';

  @override
  String get historyStaleData => 'Showing previous data; refresh failed.';

  @override
  String get historySummaryUnavailable => 'Period summary unavailable.';

  @override
  String get historyRawEvents =>
      'Raw access events; not an official attendance result.';

  @override
  String get homeDataLoading => 'Loading data';

  @override
  String get homeDataUnavailable => 'Data unavailable';

  @override
  String get homeDataStale => 'Showing previous data';

  @override
  String get homeDataRefreshing => 'Refreshing data';

  @override
  String get homeRetry => 'Try again';

  @override
  String get homeStatusUnknown => 'Status unknown';

  @override
  String get homeSelfCheckIn => 'Manual check-in';

  @override
  String get homeSelfCheckInRecorded => 'Manual check-in recorded';

  @override
  String get homeCommandPending =>
      'Command submitted; physical passage is not confirmed.';

  @override
  String get qrCameraUnavailableRetry => 'Camera unavailable. Try again.';

  @override
  String get qrCameraInUseRetry =>
      'Camera unavailable. Close other camera apps and try again.';

  @override
  String get qrSettingsUnavailable =>
      'Unable to open settings. Enable camera permission in system settings.';

  @override
  String get qrServiceUnavailable => 'QR service unavailable.';

  @override
  String get qrPersonalCode => 'Your personal QR code';

  @override
  String get qrConsumedHint => 'Code consumed. Refresh for a new operation.';

  @override
  String get qrExpiredHint => 'Code expired.';

  @override
  String get qrRefreshFailed => 'Unable to refresh QR.';

  @override
  String get qrStatusUnavailable =>
      'Unable to verify code status. Check again.';

  @override
  String get qrReaderHint =>
      'Show this code to a supported reader. Time is based on server expiry. An operation record does not confirm a door opening or physical passage.';

  @override
  String get qrSwitchCamera => 'Switch camera';

  @override
  String get qrFlashlight => 'Flashlight';

  @override
  String get qrCameraPermissionRequired =>
      'Camera permission is required to scan QR codes.';

  @override
  String get qrOpenSettings => 'Open settings';

  @override
  String get qrCameraControlUnavailable => 'Camera control unavailable.';

  @override
  String get qrDeviceIdentityOnly =>
      'This is a device identity label, not access authorization or proof of presence. Use My QR at a supported reader.';

  @override
  String get qrEmployeeIdentityOnly =>
      'This is an employee identity code. It does not verify identity or create an operation record.';

  @override
  String get qrChallengeUnsupported =>
      'This reader’s secure operation flow is not supported yet. Use My QR at a supported reader.';

  @override
  String get qrScanExpired => 'QR code expired.';

  @override
  String get qrInvalidDate => 'QR code date is invalid.';

  @override
  String get qrUnsupportedVersion => 'This QR version is unsupported.';

  @override
  String qrRemainingSeconds(int seconds) {
    return 'Remaining: $seconds s';
  }

  @override
  String get loginRememberEmail => 'Remember my email';

  @override
  String get passwordHelpTitle => 'Password help';

  @override
  String get passwordHelpAdminTitle => 'Contact your administrator';

  @override
  String get passwordHelpAdminBody =>
      'Your organization’s administrator manages mobile password setup. Ask them to send a new setup link to your registered email address. Open that link to choose a new password, then return here to sign in.';

  @override
  String get passwordHelpNoEmail =>
      'This screen does not send email or change your password.';

  @override
  String get passwordHelpRequest =>
      'Hello, I need to set or reset my NGS Plus mobile password. Please send a new password setup link to the email address registered in my employee account.';

  @override
  String get passwordHelpCopy => 'Copy request for administrator';

  @override
  String get passwordHelpCopied =>
      'Request copied. Share it with your administrator.';

  @override
  String get passwordHelpCopyFailed =>
      'Could not copy. You can select the request text below.';

  @override
  String get loginShowPassword => 'Show password';

  @override
  String get loginHidePassword => 'Hide password';

  @override
  String get startupTitle => 'Starting NGS Plus';

  @override
  String get startupUnavailable =>
      'Could not verify your session. Check your connection and try again.';

  @override
  String get startupRetry => 'Try again';

  @override
  String get startupUseLogin => 'Return to sign in';

  @override
  String homeUpdatedAt(String time) {
    return 'Updated: $time';
  }

  @override
  String get homeScanQr => 'Scan QR code';

  @override
  String get homeCommandConfirmed =>
      'The device confirmed the command; physical passage is not confirmed.';

  @override
  String get homeCommandFailed => 'Door command failed.';

  @override
  String get homeCommandUnknown =>
      'The result is uncertain. Check its status before sending another command.';

  @override
  String get homeCommandCheckStatus => 'Check status';

  @override
  String get visitorFirstName => 'First name';

  @override
  String get visitorLastName => 'Last name';

  @override
  String get visitorPhone => 'Phone';

  @override
  String get visitorStart => 'Visit starts';

  @override
  String get visitorEnd => 'Visit ends';

  @override
  String get visitorSave => 'Save';

  @override
  String get visitorEdit => 'Edit';

  @override
  String get visitorCancelInvitation => 'Cancel invitation';

  @override
  String get visitorCancelConfirm => 'Cancel this invitation?';

  @override
  String get visitorPreRegistered => 'Awaiting operator activation';

  @override
  String get visitorAccessActive => 'Access active';

  @override
  String get visitorAccessEnded => 'Access ended';

  @override
  String get visitorExpired => 'Expired';

  @override
  String get visitorPresenceUnknown => 'Physical presence unknown';

  @override
  String get visitorPresenceInside => 'Last recorded inside';

  @override
  String get visitorPresenceOutside => 'Last recorded outside';

  @override
  String get visitorOperatorRequired =>
      'Contact an authorized operator to revoke active access.';

  @override
  String get visitorSaved =>
      'Invitation record saved; operator activation is required.';

  @override
  String get visitorCancelled => 'Invitation cancelled.';

  @override
  String get visitorLoadMore => 'Load more';

  @override
  String get visitorNotice => 'Project visitor notice';

  @override
  String get visitorNoticeReviewed => 'I have reviewed the current notice.';

  @override
  String get visitorInvalidForm => 'Check the required fields and visit dates.';

  @override
  String get visitorStale => 'Could not refresh; showing previous records.';

  @override
  String get visitorRefresh => 'Refresh';

  @override
  String get profileChangePassword => 'Change password';

  @override
  String get profileCurrentPassword => 'Current password';

  @override
  String get profileNewPassword => 'New password';

  @override
  String get profileRepeatPassword => 'Repeat new password';

  @override
  String get profilePasswordRules =>
      'Use at least 12 characters and at most 72 UTF-8 bytes, different from your current password. Changing it ends all sessions; sign in again afterwards.';

  @override
  String get profilePasswordInvalid =>
      'Check the password rules and that both new passwords match.';

  @override
  String get profilePasswordRequired => 'Enter your current password.';

  @override
  String get profilePasswordChanged =>
      'Password changed. Sign in with your new password.';

  @override
  String get errorRateLimited =>
      'Too many attempts. Wait a while and try again.';

  @override
  String get errorSessionStorageFailed =>
      'Your session could not be stored securely. Please sign in again.';

  @override
  String get errorProtocol =>
      'The server response could not be verified. Please try again.';

  @override
  String get errorPasswordPolicy =>
      'Use a new password of at least 12 characters and at most 72 UTF-8 bytes, different from the current password.';

  @override
  String get homeChooseDoor => 'Choose a door';

  @override
  String get homeDoorUnavailable =>
      'The selected door is no longer available. Choose a new door from Profile.';

  @override
  String get homeNoOpenableDoor =>
      'No door on this device is available to open.';

  @override
  String get startupContactAdministrator =>
      'If the problem continues, contact your organization’s system administrator.';

  @override
  String get selectDeviceInactive => 'Target inactive';

  @override
  String get selectDeviceOutsideSchedule => 'Outside access hours';

  @override
  String get selectDeviceUnsupported =>
      'Mobile opening is not supported for this target';

  @override
  String get selectDeviceUnavailable => 'This target is currently unavailable';

  @override
  String get visitorOutcomeUnknown =>
      'The result is unknown. Retry this same invitation before creating another; its details are locked to prevent duplicates.';

  @override
  String get homeCommandRetrySameRequest => 'Retry the same request';

  @override
  String get homeCommandSending => 'Sending command; waiting for a result.';

  @override
  String get startupConfigurationUnavailable =>
      'The app could not start. Retry or contact your organization’s system administrator.';

  @override
  String get visitorSearch => 'Search invitations';

  @override
  String get visitorAllStatuses => 'All access states';

  @override
  String get visitorSummaryTitle => 'Your invitations, all pages';

  @override
  String get visitorSummaryLimited =>
      'These totals are lower bounds; the summary read limit was reached.';

  @override
  String get visitorSummaryError => 'Summary could not be refreshed.';

  @override
  String get visitorSyncTitle => 'Device synchronization';

  @override
  String get visitorSyncPending => 'Device update pending';

  @override
  String get visitorSyncApplied => 'Device acknowledged the update';

  @override
  String get visitorSyncFailed => 'Device update failed; contact an operator.';

  @override
  String get visitorSyncUnknown => 'Device result not verified';

  @override
  String get profileDiagnosticsTitle => 'Technical support report';

  @override
  String get profileDiagnosticsBody =>
      'Copy app version, build and recent technical failures for your organization’s support team. Account details, passwords, QR codes and response bodies are excluded. The bounded log stays in memory until the app closes; nothing is sent automatically. Copying puts it on the system clipboard, which other apps may access. Clearing the local log does not erase an already copied report.';

  @override
  String get profileDiagnosticsEmpty =>
      'No recent technical failures. The report still includes app and build information.';

  @override
  String get profileDiagnosticsCopy => 'Copy support report';

  @override
  String get profileDiagnosticsClear => 'Clear local log';

  @override
  String get profileDiagnosticsCopied =>
      'Support report copied. Share it only with your organization’s support team.';

  @override
  String get profileDiagnosticsCopyFailed =>
      'Could not copy the report. Please try again.';

  @override
  String get profileDiagnosticsCleared =>
      'Local log cleared. Previously copied reports remain on the clipboard.';

  @override
  String get visitorNotes => 'Notes';

  @override
  String get visitorOptionalHint => 'Optional';
}
