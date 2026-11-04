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
  String get commonOk => 'OK';

  @override
  String get commonCancel => 'Cancel';

  @override
  String get commonClose => 'Close';

  @override
  String get commonRetry => 'Try again';

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
  String get pdksSubtitle => 'Personnel Attendance Control System';

  @override
  String get loginPrompt =>
      'Enter your credentials to sign in to the time & attendance system';

  @override
  String get loginTitle => 'Sign in';

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
  String get loginForgotPassword => 'Password help';

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
    return '$greeting, $name';
  }

  @override
  String get homeStatusInside => 'Inside';

  @override
  String get homeStatusOut => 'Outside';

  @override
  String get homeStatusNone => 'No records today';

  @override
  String get homeAttendanceEntryRow => 'Last entry';

  @override
  String get homeAttendanceExitRow => 'Last exit';

  @override
  String homeExtraEntries(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '+$count more entries',
      one: '+1 more entry',
    );
    return '$_temp0';
  }

  @override
  String homeExtraExits(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '+$count more exits',
      one: '+1 more exit',
    );
    return '$_temp0';
  }

  @override
  String get homeAttendanceTimeEmpty => '—';

  @override
  String get profileTitle => 'Profile';

  @override
  String get profileAccountSection => 'Account';

  @override
  String get profilePreferencesSection => 'Preferences';

  @override
  String get profileSupportSection => 'Support';

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
  String get profileTheme => 'Theme';

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
  String get profilePreferredDoor => 'Quick access door';

  @override
  String get profilePreferredDoorEmpty => 'Not selected';

  @override
  String get quickActionUnlock => 'Open Door';

  @override
  String get quickActionProfile => 'Profile';

  @override
  String get unlockNoDeviceSelected =>
      'Pick a quick-access door from Profile first';

  @override
  String get unlockDenied => 'Access Denied';

  @override
  String get selectDeviceTitle => 'Choose a door';

  @override
  String get selectDeviceSearch => 'Search doors';

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
  String get profilePrivacy => 'Privacy information';

  @override
  String get profilePrivacySubtitle => 'App data and who to contact';

  @override
  String get profileLogout => 'Sign Out';

  @override
  String get profileLogoutConfirmTitle => 'Sign Out';

  @override
  String get profileLogoutConfirmBody =>
      'Are you sure you want to sign out of your account?';

  @override
  String get profileNotificationsDialogBody =>
      'Push delivery and notification preference management are not available in this version. Open the app and refresh to view current access and event information. Contact your organization’s administrator about missing or incorrect records.';

  @override
  String get profileSecurityDialogBody =>
      'If you know your current password, choose a new one using the form below. Changing your password ends all mobile sessions. If you forgot it, ask your organization’s administrator for a new setup link. Sign out before leaving a shared device.';

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
  String get profileAboutLine4 =>
      'Employee access and event information application.';

  @override
  String get profileFallbackEmail => 'Email unavailable';

  @override
  String get historyTitle => 'History';

  @override
  String get historyTabAll => 'Records';

  @override
  String get historyTabThisMonth => 'Calendar';

  @override
  String get historyTabStats => 'Overview';

  @override
  String get historyLoading => 'Loading records';

  @override
  String get historyErrorTitle => 'Records could not be loaded';

  @override
  String get historyEmpty => 'No records found';

  @override
  String get historyEmptyHint => 'Your new access records will appear here.';

  @override
  String get historyMonthSummary => 'This month’s summary';

  @override
  String get historyActiveDays => 'Entry days';

  @override
  String get historyThisWeek => 'This week';

  @override
  String get historyWeeklySummary => 'Weekly summary';

  @override
  String get historyUnknownDevice => 'Door unavailable';

  @override
  String get historyRecordDetailTitle => 'Record details';

  @override
  String get historyDetailDate => 'Date';

  @override
  String get historyDetailTime => 'Time';

  @override
  String get historyDetailLocation => 'Location';

  @override
  String get historyFilterTitle => 'Filter';

  @override
  String get historyFilterDate => 'Date';

  @override
  String get historyFilterDevice => 'Door';

  @override
  String get historyFilterClear => 'Clear filters';

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
  String get qrRefresh => 'Refresh';

  @override
  String get qrTryAgain => 'Try again';

  @override
  String get qrFrameHint => 'Place the QR code inside the frame';

  @override
  String get qrInvalidCode => 'Invalid QR code';

  @override
  String get visitorTitle => 'Visitors';

  @override
  String get visitorStatTotal => 'Total';

  @override
  String get visitorEmpty => 'No invitations yet';

  @override
  String get visitorEmptyHint =>
      'Use Invite a visitor to create an invitation.';

  @override
  String get visitorFilterTitle => 'Filter';

  @override
  String get visitorAddTitle => 'Invite a visitor';

  @override
  String get visitorFieldPurpose => 'Visit Purpose';

  @override
  String get visitorAddButton => 'Invite a visitor';

  @override
  String get errorNetwork =>
      'No internet connection. Please check your connection.';

  @override
  String get errorTimeout => 'The operation did not finish in time. Try again.';

  @override
  String get errorServer =>
      'The operation could not be completed. Try again shortly.';

  @override
  String get errorEmploymentEnded =>
      'Your mobile access is disabled. Contact your organisation’s administrator.';

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
  String get historyUnknownDirection => 'Unknown direction';

  @override
  String get historyUnknownAccess => 'Unknown access result';

  @override
  String get historyStaleData => 'Showing previous data; refresh failed.';

  @override
  String get historySummaryUnavailable => 'Period summary unavailable.';

  @override
  String get historyRawEvents =>
      'These are access records. Official attendance and working time results may differ.';

  @override
  String get homeDataLoading => 'Loading data';

  @override
  String get homeDataUnavailable => 'Today’s status could not be loaded';

  @override
  String get homeDataStale => 'Showing previous data';

  @override
  String get homeDataRefreshing => 'Refreshing data';

  @override
  String get homeRetry => 'Try again';

  @override
  String get homeStatusUnknown => 'Status unknown';

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
  String get qrReaderHint => 'Show the code to the reader';

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
  String get qrGrantCameraPermission => 'Allow camera access';

  @override
  String get qrCameraControlUnavailable => 'Camera control unavailable.';

  @override
  String get qrDeviceIdentityOnly =>
      'This code identifies a device; it does not open a door or record access. Show the code in My QR to a compatible reader.';

  @override
  String get qrEmployeeIdentityOnly =>
      'This is an employee identity code. It does not verify identity or create an operation record.';

  @override
  String get qrChallengeUnsupported =>
      'Scanning is not available with this reader. Show the code in My QR to a compatible reader.';

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
      'Ask your organisation’s administrator to send a password setup link to your registered email. Set your password, then sign in.';

  @override
  String get passwordHelpNoEmail =>
      'This screen does not send email or change your password.';

  @override
  String get passwordHelpRequest =>
      'Hello, I need to set or reset my NGS Plus mobile password. Please send a new password setup link to the email address registered in my employee account.';

  @override
  String get passwordHelpCopy => 'Copy request';

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
  String get startupBandTitle => 'Starting';

  @override
  String get startupFailureTitle => 'Unable to start';

  @override
  String get startupUnavailable =>
      'Could not verify your session. Check your connection and try again.';

  @override
  String get startupRetry => 'Try again';

  @override
  String get startupUseLogin => 'Return to sign in';

  @override
  String homeUpdatedAt(String time) {
    return 'Last updated $time';
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
  String get visitorSave => 'Save invitation';

  @override
  String get visitorEdit => 'Edit';

  @override
  String get visitorEditTitle => 'Edit invitation';

  @override
  String get visitorStartDate => 'Start date';

  @override
  String get visitorEndDate => 'End date';

  @override
  String get visitorStartTime => 'Start time';

  @override
  String get visitorEndTime => 'End time';

  @override
  String get visitorNotFound => 'Invitation not found';

  @override
  String get visitorErrorEndBeforeStart => 'End must be after start.';

  @override
  String get visitorErrorMaxDuration => 'A visit can last at most 31 days.';

  @override
  String get visitorErrorEndInPast => 'End cannot be in the past.';

  @override
  String get visitorErrorNoticeRequired =>
      'Accept the privacy notice to continue.';

  @override
  String get visitorCancelInvitation => 'Cancel invitation';

  @override
  String get visitorCancelConfirm => 'Cancel this invitation?';

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
  String get visitorSaved => 'Invitation saved. Approval is required.';

  @override
  String get visitorCancelled => 'Invitation cancelled.';

  @override
  String get visitorLoadMore => 'Load more';

  @override
  String get visitorNotice => 'Project visitor notice';

  @override
  String get visitorNoticeReviewed => 'I have reviewed the current notice.';

  @override
  String get fieldRequired => 'This field is required.';

  @override
  String get visitorStale =>
      'Invitations could not be refreshed. Previously loaded invitations are shown.';

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
      'Use at least 8 characters with an uppercase letter, a lowercase letter and a digit, at most 72 UTF-8 bytes, different from your current password. Changing it ends all sessions; sign in again afterwards.';

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
      'The operation could not be completed. Try again.';

  @override
  String get errorPasswordPolicy =>
      'Use a new password of at least 8 characters with an uppercase letter, a lowercase letter and a digit, at most 72 UTF-8 bytes, different from the current password.';

  @override
  String get homeChooseDoor => 'Choose a door';

  @override
  String get homeDoorUnavailable =>
      'The selected door is unavailable. Choose another door.';

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
  String get visitorSummaryTitle => 'All invitations';

  @override
  String get visitorSummaryLimited =>
      'Some invitations could not be included; the actual total may be higher.';

  @override
  String get visitorSummaryError => 'Summary could not be refreshed.';

  @override
  String get visitorSyncTitle => 'Device status';

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

  @override
  String get historyInfoTitle => 'About these records';

  @override
  String get historyTimeZone => 'Türkiye time · UTC+3';

  @override
  String get historyAllDates => 'All dates';

  @override
  String get historyAllDevices => 'All doors';

  @override
  String get historyApplyFilters => 'Apply filters';

  @override
  String get historyShowAllRecords => 'Show all records';

  @override
  String get historyFilteredEmptyHint =>
      'No records match the selected date or device.';

  @override
  String get historyCalendarLegend => 'Days with a dot have records.';

  @override
  String get historySelectDayHint => 'Select a day to see its records.';

  @override
  String get historyNoActivity => 'No access events in this period';

  @override
  String get historyNoActivityHint =>
      'New records will appear here. No records does not mean an absence.';

  @override
  String get historyDeniedCount => 'Denied';

  @override
  String get historyUnknownCount => 'Unknown';

  @override
  String get historyLoadedDevices =>
      'Doors appearing in this list of records are shown.';

  @override
  String get historyNoDeviceOptions =>
      'No door options are available for these records.';

  @override
  String get historyTabThisMonthPeriod => 'This month';

  @override
  String get visitorPeopleSection => 'Personal details';

  @override
  String get visitorVisitSection => 'Visit details';

  @override
  String get visitorActivationHint =>
      'An authorized operator must activate access after the invitation is saved.';

  @override
  String get visitorMetricPending => 'Pending';

  @override
  String get visitorPendingShort => 'Awaiting activation';

  @override
  String get visitorInvitationsTitle => 'Invitations';

  @override
  String get visitorFilteredEmptyHint =>
      'No invitations match the search or access status.';

  @override
  String get visitorClearFilters => 'Clear filters';

  @override
  String get visitorNoticeUnavailable =>
      'The privacy notice could not be loaded. Try again before saving.';

  @override
  String get profileProject => 'Organisation and project';

  @override
  String get profileProjectUnavailable =>
      'Project information is currently unavailable';

  @override
  String get doorOperationRecoveryTitle => 'Review door request';

  @override
  String get doorOperationNothingToCheck =>
      'There is no door operation to check.';

  @override
  String get doorOperationRecoveryHint =>
      'The previous request is checked first. Retrying uses the same request and original door. A command result does not confirm physical passage.';

  @override
  String get visitorRecoveryChecking =>
      'Checking the previous visitor request…';

  @override
  String get visitorRecoveryUnresolved =>
      'The previous request is still unconfirmed. Re-enter the same visitor details to retry the same request. No new request will be created.';

  @override
  String get visitorRecoveryRetry => 'Retry same request';

  @override
  String get visitorRecoveryFound => 'The previous visitor record was found.';

  @override
  String get visitorRecoveryStorageError =>
      'The visitor request could not be safely saved or read. Check its status again before continuing.';

  @override
  String get errorRequestProjectMissing =>
      'Your employee project could not be found.';

  @override
  String get errorRequestNoteTooLong => 'Notes must be at most 500 characters.';

  @override
  String get errorRequestDateInvalid => 'Choose a valid date.';

  @override
  String get errorRequestRangeInvalid =>
      'The end date cannot precede the start date.';

  @override
  String get errorRequestStartTooOld =>
      'Leave may start at most 30 days in the past.';

  @override
  String get errorRequestRangeTooLong => 'Leave can cover at most 60 days.';

  @override
  String get errorRequestPendingLimit =>
      'The pending leave request limit has been reached.';

  @override
  String get errorRequestOverlapPending =>
      'These dates overlap another pending leave request.';

  @override
  String get errorRequestOverlapApproved =>
      'These dates overlap approved leave.';

  @override
  String get errorRequestNotFound => 'The request could not be found.';

  @override
  String get errorRequestNotPending =>
      'Only your own pending request can be withdrawn.';

  @override
  String get errorCorrectionDateOutOfRange =>
      'Choose today or a date within the past 30 days.';

  @override
  String get errorCorrectionReasonLength =>
      'The reason must contain 5–300 characters.';

  @override
  String get errorCorrectionTimesMismatch =>
      'Provide only the times required by the correction type.';

  @override
  String get errorCorrectionTimeInvalid => 'Choose a valid time.';

  @override
  String get errorCorrectionPendingExists =>
      'You already have a pending correction for this date.';

  @override
  String get requestsTitle => 'My requests';

  @override
  String get requestsLeave => 'Leave';

  @override
  String get requestsCorrection => 'Record correction';

  @override
  String get requestsNew => 'New request';

  @override
  String get requestsEmpty => 'You have no requests yet.';

  @override
  String get requestsRetry => 'Retry';

  @override
  String get requestsWithdraw => 'Withdraw request';

  @override
  String get requestsWithdrawConfirm => 'Withdraw this request?';

  @override
  String get requestsCancel => 'Cancel';

  @override
  String get requestsUncertain =>
      'The request may have been submitted; check the list.';

  @override
  String get requestsAdmin => 'Administrator record';

  @override
  String get requestsPending => 'Pending';

  @override
  String get requestsApproved => 'Approved';

  @override
  String get requestsRejected => 'Rejected';

  @override
  String get requestsWithdrawn => 'Withdrawn';

  @override
  String get requestsUnknown => 'Unknown';

  @override
  String get requestsOther => 'Other';

  @override
  String get requestsStart => 'Start date';

  @override
  String get requestsEnd => 'End date';

  @override
  String get requestsDate => 'Date';

  @override
  String get requestsNotes => 'Notes';

  @override
  String get requestsReason => 'Reason';

  @override
  String get requestsType => 'Type';

  @override
  String get requestsCheckIn => 'Check-in';

  @override
  String get requestsCheckOut => 'Check-out';

  @override
  String get requestsBoth => 'Both';

  @override
  String get requestsDecision => 'Manager decision note';

  @override
  String get requestsLeaveAnnual => 'Annual leave';

  @override
  String get requestsLeaveSick => 'Sick leave';

  @override
  String get requestsLeaveExcuse => 'Excuse leave';

  @override
  String get requestsLeaveUnpaid => 'Unpaid leave';

  @override
  String get requestsLeaveParental => 'Parental leave';

  @override
  String get requestsLeaveMarriage => 'Marriage leave';

  @override
  String get requestsLeaveBereavement => 'Bereavement leave';

  @override
  String get requestsLeavePaternity => 'Paternity leave';

  @override
  String get requestsLeaveLactation => 'Lactation leave';

  @override
  String get requestsLeaveCompensatory => 'Compensatory leave';

  @override
  String get requestsWithdrawUncertain =>
      'The request may have been withdrawn; check the list.';

  @override
  String get errorSummaryTooLarge =>
      'This period is too large to summarize. Select a shorter date range.';

  @override
  String get errorInvalidCursor =>
      'This history page is no longer valid. Refresh the list.';

  @override
  String get errorDeviceNotFound =>
      'The device could not be found in this project. Refresh your device selection or contact your administrator.';

  @override
  String get errorSummaryInvalidData =>
      'Record times could not be verified. Contact your administrator to check the records.';

  @override
  String get errorVisitorInvalid =>
      'Visitor details or the list page are invalid. Check the details and dates; refresh the list if needed.';

  @override
  String get errorVisitorLocked =>
      'This invitation can no longer be edited. Refresh the invitation or contact the operator.';

  @override
  String get errorVisitorNoticeChanged =>
      'The visitor privacy notice has changed. Refresh the invitation form, read the updated notice and confirm again.';

  @override
  String get errorRequestConflict =>
      'This request was already saved with different visitor details. Refresh the visitor list and check the existing invitation.';

  @override
  String get navQr => 'QR';

  @override
  String get homeToday => 'Today';

  @override
  String get homeFirstEntry => 'First entry';

  @override
  String get loginSigningIn => 'Signing in';

  @override
  String get fieldSelectDate => 'Choose a date';

  @override
  String get fieldSelectTime => 'Choose a time';

  @override
  String get fieldSelectOption => 'Choose an option';

  @override
  String get requestsLeaveFormTitle => 'Leave request';

  @override
  String get requestsCorrectionFormTitle => 'Record correction request';

  @override
  String get requestsLeaveSubmit => 'Send leave request';

  @override
  String get requestsLeaveSubmitting => 'Sending leave request';

  @override
  String get requestsLeaveSubmitted => 'Leave request sent';

  @override
  String get requestsCorrectionSubmit => 'Send correction request';

  @override
  String get requestsCorrectionSubmitting => 'Sending correction request';

  @override
  String get requestsCorrectionSubmitted => 'Correction request sent';

  @override
  String get requestsWithdrawnToast => 'Request withdrawn';

  @override
  String get requestsTimeZoneHint => 'Enter times in Turkey time.';

  @override
  String get visitorSaving => 'Saving invitation';

  @override
  String get visitorLoadFailed => 'Invitations could not be loaded. Try again.';

  @override
  String get visitorNoMatchTitle => 'No matching invitations';

  @override
  String get commonLoading => 'Loading';

  @override
  String get fieldNoOptions => 'No options available';

  @override
  String get metricNoRecord => 'No record';

  @override
  String get fieldClear => 'Clear';

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
  String get unlockGranted => 'Access Granted';

  @override
  String get visitorPreRegistered => 'Awaiting operator activation';
}
