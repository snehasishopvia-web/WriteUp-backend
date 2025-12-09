import { Request } from 'express';

/**
 * Get timezone from request
 * Priority:
 * 1. Timezone header (from client)
 * 2. User's timezone (if authenticated)
 * 3. Geo-location based on IP (simple mapping)
 * 4. Default to UTC
 */
export function getTimezoneFromRequest(req: Request, userTimezone?: string): string {
  // 1. Check if timezone is explicitly provided in headers
  const timezoneHeader = req.headers['x-timezone'] as string;
  if (timezoneHeader && isValidTimezone(timezoneHeader)) {
    return timezoneHeader;
  }

  // 2. Use authenticated user's timezone if available
  if (userTimezone && isValidTimezone(userTimezone)) {
    return userTimezone;
  }

  // 3. Try to guess from IP address (basic mapping)
  const clientIp = getClientIp(req);
  const guessedTimezone = guessTimezoneFromIp(clientIp);
  if (guessedTimezone) {
    return guessedTimezone;
  }

  // 4. Default to UTC
  return 'UTC';
}

/**
 * Validate if a timezone string is valid
 */
function isValidTimezone(timezone: string): boolean {
  try {
    // Try to use the timezone with Intl API
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get client IP from request
 */
function getClientIp(req: Request): string {
  const xForwardedFor = req.headers['x-forwarded-for'];

  if (xForwardedFor) {
    const ipsValue = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor;
    if (ipsValue) {
      const firstIp = ipsValue.split(',')[0]?.trim();
      if (firstIp) {
        return firstIp;
      }
    }
  }

  const xRealIp = req.headers['x-real-ip'];
  if (xRealIp) {
    const ip = Array.isArray(xRealIp) ? xRealIp[0] : xRealIp;
    if (ip) {
      return ip;
    }
  }

  return req.socket.remoteAddress || 'unknown';
}

/**
 * Guess timezone from IP address (basic implementation)
 * This is a simple fallback - for production, use a proper IP geolocation service
 *
 * NOTE: For localhost/development, this cannot reliably detect client timezone.
 * The client should send timezone via x-timezone header instead.
 */
function guessTimezoneFromIp(ip: string): string | null {
  // For localhost/development, we cannot determine client's actual timezone from IP
  // The client browser should send its timezone via x-timezone header
  if (ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    // Return null to fall through to default (UTC)
    // Client should send x-timezone header with their actual timezone
    return null;
  }

  // In production, you would use an IP geolocation service here
  // For now, return null to use default
  return null;
}

/**
 * Common timezone mappings for convenience
 */
export const COMMON_TIMEZONES = {
  // US Timezones
  EST: 'America/New_York',
  EDT: 'America/New_York',
  CST: 'America/Chicago',
  CDT: 'America/Chicago',
  MST: 'America/Denver',
  MDT: 'America/Denver',
  PST: 'America/Los_Angeles',
  PDT: 'America/Los_Angeles',

  // Europe
  GMT: 'Europe/London',
  BST: 'Europe/London',
  CET: 'Europe/Paris',
  CEST: 'Europe/Paris',

  // Asia
  IST: 'Asia/Kolkata',
  JST: 'Asia/Tokyo',
  CST_CHINA: 'Asia/Shanghai',

  // Australia
  AEST: 'Australia/Sydney',
  AEDT: 'Australia/Sydney',
  AWST: 'Australia/Perth',
} as const;

/**
 * Normalize timezone abbreviation to full IANA timezone
 */
export function normalizeTimezone(timezone: string): string {
  const upperTimezone = timezone.toUpperCase();

  // Check if it's a common abbreviation
  if (upperTimezone in COMMON_TIMEZONES) {
    return COMMON_TIMEZONES[upperTimezone as keyof typeof COMMON_TIMEZONES];
  }

  // Return as-is if already valid
  if (isValidTimezone(timezone)) {
    return timezone;
  }

  // Default to UTC if invalid
  return 'UTC';
}
