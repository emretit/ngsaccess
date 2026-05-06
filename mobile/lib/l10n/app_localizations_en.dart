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
    return '+$count movements';
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
  String get profileEditButton => 'Edit Profile';

  @override
  String get profileEditDialogBody => 'Profile editing will be added soon.';

  @override
  String get profileNotifications => 'Notifications';

  @override
  String get profileNotificationsSubtitle => 'Manage notification settings';

  @override
  String get profileSecurity => 'Security';

  @override
  String get profileSecuritySubtitle => 'Password and security settings';

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
  String get profileAppVersion => 'Version 1.0.0';

  @override
  String get profilePrivacy => 'Privacy Policy';

  @override
  String get profilePrivacySubtitle => 'Data usage policy';

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
  String get profileSettingsBody => 'Advanced settings will be added soon.';

  @override
  String get profileNotificationsDialogTitle => 'Notification Settings';

  @override
  String get profileNotificationsDialogBody =>
      'Notification settings will be added soon.';

  @override
  String get profileSecurityDialogTitle => 'Security Settings';

  @override
  String get profileSecurityDialogBody =>
      'Security settings will be added soon.';

  @override
  String get profileThemeDialogTitle => 'Theme Settings';

  @override
  String get profileThemeDialogBody => 'Theme settings will be added soon.';

  @override
  String get profileLanguageDialogTitle => 'Language Settings';

  @override
  String get profileLanguageDialogBody =>
      'Language settings will be added soon.';

  @override
  String get profileHelpDialogTitle => 'Help & Support';

  @override
  String get profileHelpDialogBody =>
      'Help and support page will be added soon.';

  @override
  String get profilePrivacyDialogTitle => 'Privacy Policy';

  @override
  String get profilePrivacyDialogBody => 'Privacy policy will be added soon.';

  @override
  String get profileAboutDialogTitle => 'About NGS Plus';

  @override
  String get profileAboutLine1 => 'NGS Plus Attendance Tracking System';

  @override
  String get profileAboutLine2 => 'Version: 1.0.0';

  @override
  String get profileAboutLine3 => 'Developer: NGS Team';

  @override
  String get profileAboutLine4 =>
      'QR code based attendance tracking application.';

  @override
  String get profileFallbackEmail => 'email@example.com';

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
    return '$count records this week';
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
    return '$count Record(s)';
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
}
