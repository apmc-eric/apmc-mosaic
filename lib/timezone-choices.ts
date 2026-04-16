/** Curated IANA zones for onboarding / settings (label is shorthand for users). */
export const PROFILE_TIMEZONE_CHOICES: { value: string; label: string }[] = [
  { value: 'America/Los_Angeles', label: 'Pacific Time (Los Angeles)' },
  { value: 'America/Denver', label: 'Mountain Time (Denver)' },
  { value: 'America/Chicago', label: 'Central Time (Chicago)' },
  { value: 'America/New_York', label: 'Eastern Time (New York)' },
  { value: 'America/Phoenix', label: 'Arizona (no DST)' },
  { value: 'America/Toronto', label: 'Eastern — Toronto' },
  { value: 'America/Vancouver', label: 'Pacific — Vancouver' },
  { value: 'Europe/London', label: 'UK (London)' },
  { value: 'Europe/Paris', label: 'Central Europe (Paris)' },
  { value: 'Europe/Warsaw', label: 'Central Europe (Warsaw)' },
  { value: 'Europe/Berlin', label: 'Central Europe (Berlin)' },
  { value: 'Asia/Tokyo', label: 'Japan' },
  { value: 'Asia/Seoul', label: 'Korea' },
  { value: 'Asia/Singapore', label: 'Singapore' },
  { value: 'Australia/Sydney', label: 'Australia — Sydney' },
  { value: 'Pacific/Auckland', label: 'New Zealand' },
]

export function defaultProfileTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles'
  } catch {
    return 'America/Los_Angeles'
  }
}
