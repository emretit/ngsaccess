
/**
 * Formats a date for display in logs
 * @param date - Date to format
 * @returns Formatted date string
 */
export function formatLogDate(date: Date): string {
  return date.toLocaleString('tr-TR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Logs an error with a timestamp
 * @param message - Error message
 * @param error - Optional error object
 */
export function logError(message: string, error?: unknown): void {
  const timestamp = formatLogDate(new Date());
  console.error(`[${timestamp}] ${message}`, error || '');
}

/**
 * Logs info with a timestamp
 * @param message - Info message
 * @param data - Optional data to log
 */
export function logInfo(message: string, data?: unknown): void {
  const timestamp = formatLogDate(new Date());
  console.log(`[${timestamp}] ${message}`, data || '');
}

/**
 * Formats an object for debug display
 * @param obj - Object to format
 * @returns Formatted string
 */
export function formatObject(obj: Record<string, any>): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (e) {
    return '[Unable to stringify object]';
  }
}
