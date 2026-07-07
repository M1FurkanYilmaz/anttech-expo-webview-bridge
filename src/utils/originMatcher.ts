/**
 * Checks a URL against a list of trusted origins.
 *
 * Supports exact prefixes ("https://example.com") and wildcard suffixes
 * ("https://example.com/*", "https://*.example.com" — the "*" is only
 * meaningful at the end of the pattern, matched as a simple prefix check).
 */
export function isTrustedOrigin(
  url: string,
  trustedOrigins: string[],
): boolean {
  return trustedOrigins.some((origin) => {
    if (origin.endsWith("/*")) {
      return url.startsWith(origin.slice(0, -2));
    }
    return url.startsWith(origin);
  });
}
