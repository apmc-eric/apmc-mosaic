/** Domains treated as one company identity (same mailbox, different suffix). */
export const DEFAULT_COMPANY_ALIAS_DOMAINS = ['aparentmedia.com', 'kidoodle.tv'] as const

export function emailLocalPart(email: string): string {
  const i = email.indexOf('@')
  if (i <= 0) return ''
  return email.slice(0, i).trim().toLowerCase()
}

export function emailDomain(email: string): string {
  const i = email.indexOf('@')
  if (i < 0 || i === email.length - 1) return ''
  return email.slice(i + 1).trim().toLowerCase()
}

/**
 * True when both addresses use the same local part and both domains are in `allowedDomains`.
 * Used to merge @aparentmedia.com and @kidoodle.tv accounts for the same person.
 */
export function emailsAreCompanyAliases(
  a: string,
  b: string,
  allowedDomains: readonly string[],
): boolean {
  const la = emailLocalPart(a)
  const lb = emailLocalPart(b)
  if (!la || la !== lb) return false
  const da = emailDomain(a)
  const db = emailDomain(b)
  const allowed = new Set(allowedDomains.map((d) => d.toLowerCase()))
  return allowed.has(da) && allowed.has(db)
}
